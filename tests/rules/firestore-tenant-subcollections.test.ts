/**
 * Suíte dedicada de teste de `firestore.rules`, usando
 * `@firebase/rules-unit-testing` contra o Firebase Emulator Suite real (via
 * `npm run test:rules` -> `firebase emulators:exec --only firestore`).
 *
 * Cobre o achado de segurança UC-13-RN-09 / UC-15-RN-07 / UC-20-RN-07 (ver
 * ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md): a regra genérica de
 * subcoleção do tenant concedia `write` irrestrito a qualquer usuário do
 * tenant para TODAS as subcoleções, tornando inefetivas as restrições de
 * role que só existiam na UI. Esta suíte simula diretamente o bypass da UI
 * (chamada ao SDK do Firestore sem passar por nenhum componente React) -- é
 * exatamente o vetor do achado original, por isso a ferramenta certa é
 * `@firebase/rules-unit-testing`, não Playwright.
 *
 * IMPORTANTE (lição da regressão em PR #344, UC-05/UC-51/UC-52/UC-53 no CI):
 * toda operação é testada tanto via `getDoc` (get de um documento específico)
 * quanto via `getDocs(query(...))` (list/query de uma coleção) -- as duas
 * são avaliadas de formas diferentes pelo Firestore e uma regra pode se
 * comportar corretamente para uma e quebrar silenciosamente para a outra
 * (foi exatamente o que aconteceu: `document[0]` de um wildcard recursivo
 * funciona para `get`, mas não é vinculável para `list`). A primeira versão
 * desta suíte só testava `getDoc`, por isso não pegou a regressão.
 *
 * Complementar ao caderno de teste obrigatório do CLAUDE.md (item 8); não o
 * substitui.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  collection,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  setDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-curva-mestra-e2e';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// --- Helpers de contexto autenticado -----------------------------------

function clinicAdmin(tenantId: string) {
  return testEnv.authenticatedContext(`admin-${tenantId}`, {
    tenant_id: tenantId,
    role: 'clinic_admin',
    is_system_admin: false,
    is_consultant: false,
    active: true,
  });
}

function clinicUser(tenantId: string) {
  return testEnv.authenticatedContext(`user-${tenantId}`, {
    tenant_id: tenantId,
    role: 'clinic_user',
    is_system_admin: false,
    is_consultant: false,
    active: true,
  });
}

function systemAdmin() {
  return testEnv.authenticatedContext('system-admin', {
    is_system_admin: true,
    is_consultant: false,
    active: true,
  });
}

function consultantWithAccess(tenantId: string) {
  return testEnv.authenticatedContext('consultant-with-access', {
    is_consultant: true,
    is_system_admin: false,
    consultant_id: 'consultant-with-access',
    authorized_tenants: [tenantId],
    active: true,
  });
}

function inactiveConsultantWithAccess(tenantId: string) {
  return testEnv.authenticatedContext('consultant-inactive', {
    is_consultant: true,
    is_system_admin: false,
    consultant_id: 'consultant-inactive',
    authorized_tenants: [tenantId],
    active: false,
  });
}

function consultantWithoutAccess(tenantId: string) {
  return testEnv.authenticatedContext('consultant-without-access', {
    is_consultant: true,
    is_system_admin: false,
    authorized_tenants: [`not-${tenantId}`],
    active: true,
  });
}

/** Consultor com `consultant_id` no token (opt-in financeiro, RN-13/RN-18). */
function consultantWith(consultantId: string, tenants: string[], active = true) {
  return testEnv.authenticatedContext(`consultant-${consultantId}`, {
    is_consultant: true,
    is_system_admin: false,
    consultant_id: consultantId,
    authorized_tenants: tenants,
    active,
  });
}

/** Grava um doc direto no emulador, sem passar pelas regras (seed de teste). */
async function seed(pathStr: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), pathStr), data);
  });
}

// --- Subcoleções com LEITURA ampla (clinic_admin + clinic_user) e ESCRITA
// restrita a clinic_admin: inventory, stock_limits, protocolos,
// solicitacoes, inventory_activity -----------------------------------------

// A terceira coluna diz se o consultor com acesso lê pelo bloco genérico
// (allowlist de UC-48-RN-06); protocolos só com opt-in financeiro (describe
// dedicado mais abaixo).
describe.each([
  ['inventory', { quantidade_disponivel: 10, active: true }, true],
  ['stock_limits', { limite: 5 }, true],
  ['protocolos', { nome: 'Protocolo X', active: true }, false],
  ['solicitacoes', { status: 'criada' }, true],
  ['inventory_activity', { tipo: 'consumo', quantidade: 1 }, false],
])('tenants/{tenantId}/%s', (collectionName, sampleData, consultantReads) => {
  const docPathA = `tenants/${TENANT_A}/${collectionName}/doc1`;
  const docPathB = `tenants/${TENANT_B}/${collectionName}/doc1`;
  const collectionPathA = `tenants/${TENANT_A}/${collectionName}`;

  beforeEach(async () => {
    await seed(docPathA, sampleData);
    await seed(docPathB, sampleData);
  });

  it('clinic_admin do tenant correto lê (get)', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
  });

  it('clinic_admin do tenant correto lê (list/query)', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertSucceeds(getDocs(query(collection(db, collectionPathA))));
  });

  it('clinic_user do tenant correto lê (get)', async () => {
    const db = clinicUser(TENANT_A).firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
  });

  it('clinic_user do tenant correto lê (list/query)', async () => {
    const db = clinicUser(TENANT_A).firestore();
    await assertSucceeds(getDocs(query(collection(db, collectionPathA))));
  });

  it('clinic_admin do tenant correto escreve', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertSucceeds(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });

  it('clinic_user do tenant correto NÃO escreve (bug original)', async () => {
    const db = clinicUser(TENANT_A).firestore();
    await assertFails(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });

  it('clinic_user do tenant correto NÃO cria novo documento', async () => {
    const db = clinicUser(TENANT_A).firestore();
    await assertFails(setDoc(doc(db, `tenants/${TENANT_A}/${collectionName}/novo`), sampleData));
  });

  it('clinic_user do tenant correto NÃO deleta', async () => {
    const db = clinicUser(TENANT_A).firestore();
    await assertFails(deleteDoc(doc(db, docPathA)));
  });

  it('usuário (qualquer role) de outro tenant NÃO lê (get)', async () => {
    const dbAdminB = clinicAdmin(TENANT_B).firestore();
    await assertFails(getDoc(doc(dbAdminB, docPathA)));
  });

  it('usuário (qualquer role) de outro tenant NÃO lê (list/query)', async () => {
    const dbAdminB = clinicAdmin(TENANT_B).firestore();
    await assertFails(getDocs(query(collection(dbAdminB, collectionPathA))));
  });

  it('usuário (qualquer role) de outro tenant NÃO escreve', async () => {
    const dbAdminB = clinicAdmin(TENANT_B).firestore();
    await assertFails(updateDoc(doc(dbAdminB, docPathA), { updated_by_test: true }));
  });

  it('system_admin lê (get e list) e escreve, cross-tenant, sem regressão', async () => {
    const db = systemAdmin().firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
    await assertSucceeds(getDocs(query(collection(db, collectionPathA))));
    await assertSucceeds(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });

  it(`consultor com acesso ao tenant ${consultantReads ? 'lê' : 'NÃO lê'} (get e list) e não escreve`, async () => {
    const db = consultantWithAccess(TENANT_A).firestore();
    const assertRead = consultantReads ? assertSucceeds : assertFails;
    await assertRead(getDoc(doc(db, docPathA)));
    await assertRead(getDocs(query(collection(db, collectionPathA))));
    await assertFails(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });

  it('consultor sem acesso ao tenant não lê (get nem list) nem escreve', async () => {
    const db = consultantWithoutAccess(TENANT_A).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(getDocs(query(collection(db, collectionPathA))));
    await assertFails(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });
});

// --- tenants/{tenantId}/users: subcoleção "morta" (UC-05/RN-04) -- nenhum
// fluxo real do sistema escreve aqui (usuários reais ficam na coleção raiz
// `/users`, filtrada por tenant_id), mas `getTenantLimits()`
// (accessRequestService.ts) faz `getDocs(query(...))` nela para contar
// "usuários ativos". Precisa continuar lendo (list) normalmente -- uma lista
// vazia é o comportamento correto e esperado (bug RN-04 já documentado,
// não desta correção); um `permission-denied` aqui é que seria regressão
// nova (foi exatamente a causa de UC-05 falhar no CI da primeira versão
// desta correção). ------------------------------------------------------

describe('tenants/{tenantId}/users (subcoleção morta, RN-04)', () => {
  const collectionPathA = `tenants/${TENANT_A}/users`;

  it('clinic_admin lista (list/query) sem permission-denied, mesmo vazia', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertSucceeds(getDocs(query(collection(db, collectionPathA))));
  });

  it('clinic_user lista (list/query) sem permission-denied, mesmo vazia', async () => {
    const db = clinicUser(TENANT_A).firestore();
    await assertSucceeds(getDocs(query(collection(db, collectionPathA))));
  });

  it('usuário de outro tenant NÃO lista', async () => {
    const db = clinicAdmin(TENANT_B).firestore();
    await assertFails(getDocs(query(collection(db, collectionPathA))));
  });
});

// --- nf_imports: leitura E escrita restritas a clinic_admin (defesa em
// profundidade — diferente das subcoleções acima, nem clinic_user nem
// consultor leem). Compartilhamento com consultor fica para um UC dedicado
// futuro (opt-in do clinic_admin), fora do escopo desta correção. ----------

describe('tenants/{tenantId}/nf_imports', () => {
  const docPathA = `tenants/${TENANT_A}/nf_imports/nf1`;
  const collectionPathA = `tenants/${TENANT_A}/nf_imports`;

  beforeEach(async () => {
    await seed(docPathA, { numero: '026229', status: 'success' });
  });

  it('clinic_admin do tenant correto lê (get e list) e escreve', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
    await assertSucceeds(getDocs(query(collection(db, collectionPathA))));
    await assertSucceeds(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });

  it('clinic_user do tenant correto NÃO lê (get nem list) nem escreve', async () => {
    const db = clinicUser(TENANT_A).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(getDocs(query(collection(db, collectionPathA))));
    await assertFails(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });

  it('consultor com acesso ao tenant NÃO lê (sem opt-in do clinic_admin, hoje inexistente)', async () => {
    const db = consultantWithAccess(TENANT_A).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(getDocs(query(collection(db, collectionPathA))));
  });

  it('usuário de outro tenant NÃO lê nem escreve', async () => {
    const db = clinicAdmin(TENANT_B).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });

  it('system_admin lê (get e list) e escreve, cross-tenant', async () => {
    const db = systemAdmin().firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
    await assertSucceeds(getDocs(query(collection(db, collectionPathA))));
    await assertSucceeds(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });
});

// --- notifications: já tinha regra dedicada (create/delete admin-only),
// mas era mascarada pela regra genérica -- confirma que agora é efetiva. --

describe('tenants/{tenantId}/notifications', () => {
  const docPathA = `tenants/${TENANT_A}/notifications/notif1`;
  const collectionPathA = `tenants/${TENANT_A}/notifications`;

  beforeEach(async () => {
    await seed(docPathA, { read: false, title: 'Produto vencendo' });
  });

  it('clinic_admin e clinic_user leem (get e list) e marcam como lida (update)', async () => {
    for (const ctx of [clinicAdmin(TENANT_A), clinicUser(TENANT_A)]) {
      const db = ctx.firestore();
      await assertSucceeds(getDoc(doc(db, docPathA)));
      await assertSucceeds(getDocs(query(collection(db, collectionPathA))));
      await assertSucceeds(updateDoc(doc(db, docPathA), { read: true }));
    }
  });

  it('clinic_user NÃO cria nem deleta notificação', async () => {
    const db = clinicUser(TENANT_A).firestore();
    await assertFails(setDoc(doc(db, `tenants/${TENANT_A}/notifications/nova`), { read: false }));
    await assertFails(deleteDoc(doc(db, docPathA)));
  });

  it('clinic_admin cria e deleta notificação', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertSucceeds(
      setDoc(doc(db, `tenants/${TENANT_A}/notifications/nova`), { read: false })
    );
    await assertSucceeds(deleteDoc(doc(db, docPathA)));
  });

  it('usuário de outro tenant não lê (get nem list) nem escreve', async () => {
    const db = clinicAdmin(TENANT_B).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(getDocs(query(collection(db, collectionPathA))));
  });
});

// --- settings/notifications: idem, já tinha regra dedicada mascarada. ----

describe('tenants/{tenantId}/settings/notifications', () => {
  const docPathA = `tenants/${TENANT_A}/settings/notifications`;

  beforeEach(async () => {
    await seed(docPathA, { email_enabled: true });
  });

  it('clinic_admin e clinic_user leem', async () => {
    for (const ctx of [clinicAdmin(TENANT_A), clinicUser(TENANT_A)]) {
      await assertSucceeds(getDoc(doc(ctx.firestore(), docPathA)));
    }
  });

  it('clinic_admin escreve; clinic_user não', async () => {
    await assertSucceeds(
      updateDoc(doc(clinicAdmin(TENANT_A).firestore(), docPathA), { email_enabled: false })
    );
    await assertFails(
      updateDoc(doc(clinicUser(TENANT_A).firestore(), docPathA), { email_enabled: false })
    );
  });

  it('usuário de outro tenant não lê nem escreve', async () => {
    const db = clinicAdmin(TENANT_B).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
  });
});

// --- financeiro: dados financeiros internos (FEAT-precificacao-hora-clinica).
// Leitura E escrita só clinic_admin; excluída do fallback genérico, então
// clinic_user não lê. Consultor só lê com opt-in amarrado ao seu
// consultant_id (RN-13). ------------------------------------------------------

describe('tenants/{tenantId}/financeiro', () => {
  const docPathA = `tenants/${TENANT_A}/financeiro/custo_hora`;
  const collectionPathA = `tenants/${TENANT_A}/financeiro`;

  const config = (overrides: Record<string, unknown> = {}) => ({
    tenant_id: TENANT_A,
    compartilhar_com_consultor: false,
    compartilhado_com_consultant_id: null,
    ...overrides,
  });

  it('clinic_admin do tenant lê (get e list) e escreve', async () => {
    await seed(docPathA, config());
    const db = clinicAdmin(TENANT_A).firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
    await assertSucceeds(getDocs(query(collection(db, collectionPathA))));
    await assertSucceeds(setDoc(doc(db, docPathA), config({ quantidade_salas: 2 })));
  });

  it('clinic_admin cria o documento quando ele ainda não existe', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertSucceeds(setDoc(doc(db, docPathA), config()));
  });

  it('clinic_admin NÃO escreve com tenant_id de outro tenant', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertFails(setDoc(doc(db, docPathA), config({ tenant_id: TENANT_B })));
  });

  it('clinic_admin NÃO escreve sem compartilhar_com_consultor booleano', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertFails(setDoc(doc(db, docPathA), { tenant_id: TENANT_A }));
    await assertFails(setDoc(doc(db, docPathA), config({ compartilhar_com_consultor: 'sim' })));
  });

  it('clinic_admin NÃO deleta (só system_admin)', async () => {
    await seed(docPathA, config());
    const db = clinicAdmin(TENANT_A).firestore();
    await assertFails(deleteDoc(doc(db, docPathA)));
  });

  it('clinic_user do tenant NÃO lê (get nem list) nem escreve', async () => {
    await seed(docPathA, config());
    const db = clinicUser(TENANT_A).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(getDocs(query(collection(db, collectionPathA))));
    await assertFails(setDoc(doc(db, docPathA), config()));
  });

  it('usuário de outro tenant NÃO lê nem escreve', async () => {
    await seed(docPathA, config());
    const db = clinicAdmin(TENANT_B).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(setDoc(doc(db, docPathA), config()));
  });

  it('consultor com acesso NÃO lê sem o compartilhamento ligado', async () => {
    await seed(docPathA, config({ compartilhado_com_consultant_id: 'cons-x' }));
    const db = consultantWith('cons-x', [TENANT_A]).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
  });

  it('consultor com opt-in para o seu consultant_id lê (get), mas não escreve', async () => {
    await seed(
      docPathA,
      config({ compartilhar_com_consultor: true, compartilhado_com_consultant_id: 'cons-x' })
    );
    const db = consultantWith('cons-x', [TENANT_A]).firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
    await assertFails(setDoc(doc(db, docPathA), config()));
  });

  it('consultor NÃO lê quando o opt-in é de outro consultant_id', async () => {
    await seed(
      docPathA,
      config({ compartilhar_com_consultor: true, compartilhado_com_consultant_id: 'cons-x' })
    );
    const db = consultantWith('cons-y', [TENANT_A]).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
  });

  it('consultor sem o tenant em authorized_tenants NÃO lê, mesmo com opt-in do seu id', async () => {
    await seed(
      docPathA,
      config({ compartilhar_com_consultor: true, compartilhado_com_consultant_id: 'cons-x' })
    );
    const db = consultantWith('cons-x', [TENANT_B]).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
  });

  it('system_admin lê (get e list), escreve e deleta', async () => {
    await seed(docPathA, config());
    const db = systemAdmin().firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
    await assertSucceeds(getDocs(query(collection(db, collectionPathA))));
    await assertSucceeds(setDoc(doc(db, docPathA), config({ quantidade_salas: 3 })));
    await assertSucceeds(deleteDoc(doc(db, docPathA)));
  });
});

// --- protocolos: leitura do consultor com opt-in financeiro (D6/RN-18). Os
// casos de NEGAÇÃO sem opt-in só valem quando a allowlist de UC-48-RN-06
// (BUGFIX-consultor-allowlist-subcolecoes) entrar — até lá o bloco genérico
// ainda concede a leitura ao consultor (semântica OR). -----------------------

describe('protocolos — leitura do consultor com opt-in financeiro (D6)', () => {
  const finPathA = `tenants/${TENANT_A}/financeiro/custo_hora`;
  const docPathA = `tenants/${TENANT_A}/protocolos/p1`;
  const collectionPathA = `tenants/${TENANT_A}/protocolos`;
  const optIn = {
    tenant_id: TENANT_A,
    compartilhar_com_consultor: true,
    compartilhado_com_consultant_id: 'cons-x',
  };

  beforeEach(async () => {
    await seed(docPathA, { nome: 'Protocolo X', active: true });
  });

  it('consultor com opt-in para o seu consultant_id lê (get e list), mas não escreve', async () => {
    await seed(finPathA, optIn);
    const db = consultantWith('cons-x', [TENANT_A]).firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
    await assertSucceeds(getDocs(query(collection(db, collectionPathA))));
    await assertFails(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });

  it('consultor sem o tenant em authorized_tenants NÃO lê, mesmo com opt-in do seu id', async () => {
    await seed(finPathA, optIn);
    const db = consultantWith('cons-x', [TENANT_B]).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(getDocs(query(collection(db, collectionPathA))));
  });

  it('consultor inativo NÃO lê, mesmo com opt-in válido', async () => {
    await seed(finPathA, optIn);
    const db = consultantWith('cons-x', [TENANT_A], false).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(getDocs(query(collection(db, collectionPathA))));
  });

  it('clinic_admin e clinic_user leem protocolos sem documento financeiro (regressão)', async () => {
    await assertSucceeds(
      getDocs(query(collection(clinicAdmin(TENANT_A).firestore(), collectionPathA)))
    );
    await assertSucceeds(
      getDocs(query(collection(clinicUser(TENANT_A).firestore(), collectionPathA)))
    );
  });

  it('consultor com acesso NÃO lê com opt-in desligado (UC-48-RN-06)', async () => {
    await seed(finPathA, { ...optIn, compartilhar_com_consultor: false });
    const db = consultantWith('cons-x', [TENANT_A]).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(getDocs(query(collection(db, collectionPathA))));
  });

  it('consultor com acesso NÃO lê com opt-in de outro consultant_id (UC-48-RN-06)', async () => {
    await seed(finPathA, optIn);
    const db = consultantWith('cons-y', [TENANT_A]).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(getDocs(query(collection(db, collectionPathA))));
  });

  it('consultor com acesso NÃO lê sem documento financeiro (UC-48-RN-06)', async () => {
    const db = consultantWith('cons-x', [TENANT_A]).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(getDocs(query(collection(db, collectionPathA))));
  });
});

// --- precificacao_procedimentos: snapshot da precificação de cada
// procedimento (FEAT-precificacao-hora-clinica, D10). Só clinic_admin lê e
// grava; o opt-in financeiro do consultor NÃO libera estes documentos. ------

describe('tenants/{tenantId}/precificacao_procedimentos', () => {
  const docPathA = `tenants/${TENANT_A}/precificacao_procedimentos/s1`;
  const collectionPathA = `tenants/${TENANT_A}/precificacao_procedimentos`;

  const snapshot = (overrides: Record<string, unknown> = {}) => ({
    tenant_id: TENANT_A,
    solicitacao_id: 's1',
    forma_pagamento: 'pix_dinheiro',
    preco_sugerido: 1489.16,
    ...overrides,
  });

  beforeEach(async () => {
    await seed(`tenants/${TENANT_A}/solicitacoes/s1`, { status: 'agendada' });
    await seed(`tenants/${TENANT_A}/solicitacoes/s2`, { status: 'agendada' });
    await seed(docPathA, snapshot());
    await seed(`tenants/${TENANT_A}/financeiro/custo_hora`, {
      tenant_id: TENANT_A,
      compartilhar_com_consultor: true,
      compartilhado_com_consultant_id: 'cons-x',
    });
  });

  it('clinic_admin do tenant lê (get e list)', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
    await assertSucceeds(getDocs(query(collection(db, collectionPathA))));
  });

  it('clinic_admin cria e atualiza com tenant, solicitação e forma válidos', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertSucceeds(setDoc(doc(db, docPathA), snapshot({ forma_pagamento: 'credito' })));
    await assertSucceeds(
      setDoc(
        doc(db, `tenants/${TENANT_A}/precificacao_procedimentos/s2`),
        snapshot({ solicitacao_id: 's2', forma_pagamento: 'debito' })
      )
    );
  });

  it('clinic_admin NÃO grava com tenant_id de outro tenant', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertFails(setDoc(doc(db, docPathA), snapshot({ tenant_id: TENANT_B })));
  });

  it('clinic_admin NÃO grava com solicitacao_id diferente do id do documento', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertFails(setDoc(doc(db, docPathA), snapshot({ solicitacao_id: 's2' })));
  });

  it('clinic_admin NÃO grava com forma de pagamento inválida', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertFails(setDoc(doc(db, docPathA), snapshot({ forma_pagamento: 'cartao' })));
  });

  it('clinic_admin NÃO grava snapshot de solicitação inexistente', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertFails(
      setDoc(
        doc(db, `tenants/${TENANT_A}/precificacao_procedimentos/s-inexistente`),
        snapshot({ solicitacao_id: 's-inexistente' })
      )
    );
  });

  it('clinic_admin NÃO deleta (só system_admin)', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertFails(deleteDoc(doc(db, docPathA)));
  });

  it('clinic_user do tenant NÃO lê (get nem list) nem escreve', async () => {
    const db = clinicUser(TENANT_A).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(getDocs(query(collection(db, collectionPathA))));
    await assertFails(setDoc(doc(db, docPathA), snapshot()));
  });

  it('clinic_admin de outro tenant NÃO lê nem escreve', async () => {
    const db = clinicAdmin(TENANT_B).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(setDoc(doc(db, docPathA), snapshot()));
  });

  it('consultor com opt-in financeiro ativo para ele NÃO lê nem escreve', async () => {
    const db = consultantWith('cons-x', [TENANT_A]).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(getDocs(query(collection(db, collectionPathA))));
    await assertFails(setDoc(doc(db, docPathA), snapshot()));
  });

  it('consultor com acesso e sem opt-in NÃO lê', async () => {
    const db = consultantWith('cons-y', [TENANT_A]).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(getDocs(query(collection(db, collectionPathA))));
  });

  it('consultor sem o tenant em authorized_tenants NÃO lê', async () => {
    const db = consultantWith('cons-x', [TENANT_B]).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
  });

  it('system_admin lê (get e list), escreve e deleta', async () => {
    const db = systemAdmin().firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
    await assertSucceeds(getDocs(query(collection(db, collectionPathA))));
    await assertSucceeds(setDoc(doc(db, docPathA), snapshot({ forma_pagamento: 'debito' })));
    await assertSucceeds(deleteDoc(doc(db, docPathA)));
  });
});

// --- Portal do Consultor — allowlist de subcoleções (UC-48-RN-06). O
// consultor só lê inventory, stock_limits e solicitacoes pelo bloco genérico;
// as queries abaixo são as mesmas das telas (InventoryView, detalhe da
// clínica e projectionService). ---------------------------------------------

describe('Portal do Consultor — allowlist de subcoleções (UC-48-RN-06)', () => {
  const PERMITIDAS = ['inventory', 'stock_limits', 'solicitacoes'];
  const NEGADAS = [
    'protocolos',
    'inventory_activity',
    'notifications',
    'users',
    'nf_imports',
    'financeiro',
    'precificacao_procedimentos',
    'subcolecao_futura_qa',
  ];

  beforeEach(async () => {
    for (const nome of [...PERMITIDAS, ...NEGADAS]) {
      await seed(`tenants/${TENANT_A}/${nome}/doc1`, { tenant_id: TENANT_A, active: true });
    }
    await seed(`tenants/${TENANT_A}/settings/notifications`, { email: true });
    await seed(`tenants/${TENANT_A}`, { name: 'Clínica A', active: true });
  });

  it.each(PERMITIDAS)('consultor com acesso lê %s (get e list) e não escreve', async (nome) => {
    const db = consultantWithAccess(TENANT_A).firestore();
    await assertSucceeds(getDoc(doc(db, `tenants/${TENANT_A}/${nome}/doc1`)));
    await assertSucceeds(getDocs(query(collection(db, `tenants/${TENANT_A}/${nome}`))));
    await assertFails(updateDoc(doc(db, `tenants/${TENANT_A}/${nome}/doc1`), { x: 1 }));
    await assertFails(setDoc(doc(db, `tenants/${TENANT_A}/${nome}/novo`), { x: 1 }));
    await assertFails(deleteDoc(doc(db, `tenants/${TENANT_A}/${nome}/doc1`)));
  });

  it('queries reais das telas do consultor são permitidas', async () => {
    const db = consultantWithAccess(TENANT_A).firestore();
    const inventory = collection(db, `tenants/${TENANT_A}/inventory`);
    await assertSucceeds(
      getDocs(query(inventory, where('active', '==', true), orderBy('nome_produto', 'asc')))
    );
    await assertSucceeds(getDocs(query(inventory, where('brand', '==', 'Rennova'))));
    await assertSucceeds(
      getDocs(
        query(
          collection(db, `tenants/${TENANT_A}/solicitacoes`),
          where('status', '==', 'concluida'),
          where('dt_procedimento', '>=', Timestamp.fromDate(new Date('2026-01-01')))
        )
      )
    );
    await assertSucceeds(getDocs(collection(db, `tenants/${TENANT_A}/stock_limits`)));
  });

  it.each(NEGADAS)('consultor com acesso NÃO lê %s (get e list)', async (nome) => {
    const db = consultantWithAccess(TENANT_A).firestore();
    await assertFails(getDoc(doc(db, `tenants/${TENANT_A}/${nome}/doc1`)));
    await assertFails(getDocs(query(collection(db, `tenants/${TENANT_A}/${nome}`))));
  });

  it('consultor com acesso NÃO lê settings/notifications', async () => {
    const db = consultantWithAccess(TENANT_A).firestore();
    await assertFails(getDoc(doc(db, `tenants/${TENANT_A}/settings/notifications`)));
  });

  it.each(PERMITIDAS)('consultor sem o tenant autorizado NÃO lê %s', async (nome) => {
    const db = consultantWithoutAccess(TENANT_A).firestore();
    await assertFails(getDoc(doc(db, `tenants/${TENANT_A}/${nome}/doc1`)));
    await assertFails(getDocs(query(collection(db, `tenants/${TENANT_A}/${nome}`))));
  });

  it.each(PERMITIDAS)('consultor inativo NÃO lê %s', async (nome) => {
    const db = inactiveConsultantWithAccess(TENANT_A).firestore();
    await assertFails(getDoc(doc(db, `tenants/${TENANT_A}/${nome}/doc1`)));
    await assertFails(getDocs(query(collection(db, `tenants/${TENANT_A}/${nome}`))));
  });

  it('documento raiz do tenant: consultor com acesso lê, sem acesso não (regressão)', async () => {
    await assertSucceeds(
      getDoc(doc(consultantWithAccess(TENANT_A).firestore(), `tenants/${TENANT_A}`))
    );
    await assertFails(
      getDoc(doc(consultantWithoutAccess(TENANT_A).firestore(), `tenants/${TENANT_A}`))
    );
  });

  it('clinic_user continua lendo protocolos e inventory_activity (regressão)', async () => {
    const db = clinicUser(TENANT_A).firestore();
    await assertSucceeds(getDocs(query(collection(db, `tenants/${TENANT_A}/protocolos`))));
    await assertSucceeds(getDocs(query(collection(db, `tenants/${TENANT_A}/inventory_activity`))));
  });
});
