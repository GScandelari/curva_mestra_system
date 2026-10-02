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
import { doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';

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
    authorized_tenants: [tenantId],
    active: true,
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

/** Grava um doc direto no emulador, sem passar pelas regras (seed de teste). */
async function seed(pathStr: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), pathStr), data);
  });
}

// --- Subcoleções com LEITURA ampla (clinic_admin + clinic_user) e ESCRITA
// restrita a clinic_admin: inventory, stock_limits, protocolos,
// solicitacoes, inventory_activity -----------------------------------------

describe.each([
  ['inventory', { quantidade_disponivel: 10, active: true }],
  ['stock_limits', { limite: 5 }],
  ['protocolos', { nome: 'Protocolo X', active: true }],
  ['solicitacoes', { status: 'criada' }],
  ['inventory_activity', { tipo: 'consumo', quantidade: 1 }],
])('tenants/{tenantId}/%s', (collectionName, sampleData) => {
  const docPathA = `tenants/${TENANT_A}/${collectionName}/doc1`;
  const docPathB = `tenants/${TENANT_B}/${collectionName}/doc1`;

  beforeEach(async () => {
    await seed(docPathA, sampleData);
    await seed(docPathB, sampleData);
  });

  it('clinic_admin do tenant correto lê', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
  });

  it('clinic_user do tenant correto lê', async () => {
    const db = clinicUser(TENANT_A).firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
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

  it('usuário (qualquer role) de outro tenant NÃO lê', async () => {
    const dbAdminB = clinicAdmin(TENANT_B).firestore();
    await assertFails(getDoc(doc(dbAdminB, docPathA)));
  });

  it('usuário (qualquer role) de outro tenant NÃO escreve', async () => {
    const dbAdminB = clinicAdmin(TENANT_B).firestore();
    await assertFails(updateDoc(doc(dbAdminB, docPathA), { updated_by_test: true }));
  });

  it('system_admin lê e escreve, cross-tenant, sem regressão', async () => {
    const db = systemAdmin().firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
    await assertSucceeds(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });

  it('consultor com acesso ao tenant lê, mas não escreve', async () => {
    const db = consultantWithAccess(TENANT_A).firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
    await assertFails(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });

  it('consultor sem acesso ao tenant não lê nem escreve', async () => {
    const db = consultantWithoutAccess(TENANT_A).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });
});

// --- nf_imports: leitura E escrita restritas a clinic_admin (defesa em
// profundidade — diferente das subcoleções acima, nem clinic_user nem
// consultor leem). Compartilhamento com consultor fica para um UC dedicado
// futuro (opt-in do clinic_admin), fora do escopo desta correção. ----------

describe('tenants/{tenantId}/nf_imports', () => {
  const docPathA = `tenants/${TENANT_A}/nf_imports/nf1`;

  beforeEach(async () => {
    await seed(docPathA, { numero: '026229', status: 'success' });
  });

  it('clinic_admin do tenant correto lê e escreve', async () => {
    const db = clinicAdmin(TENANT_A).firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
    await assertSucceeds(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });

  it('clinic_user do tenant correto NÃO lê nem escreve', async () => {
    const db = clinicUser(TENANT_A).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });

  it('consultor com acesso ao tenant NÃO lê (sem opt-in do clinic_admin, hoje inexistente)', async () => {
    const db = consultantWithAccess(TENANT_A).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
  });

  it('usuário de outro tenant NÃO lê nem escreve', async () => {
    const db = clinicAdmin(TENANT_B).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
    await assertFails(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });

  it('system_admin lê e escreve, cross-tenant', async () => {
    const db = systemAdmin().firestore();
    await assertSucceeds(getDoc(doc(db, docPathA)));
    await assertSucceeds(updateDoc(doc(db, docPathA), { updated_by_test: true }));
  });
});

// --- notifications: já tinha regra dedicada (create/delete admin-only),
// mas era mascarada pela regra genérica -- confirma que agora é efetiva. --

describe('tenants/{tenantId}/notifications', () => {
  const docPathA = `tenants/${TENANT_A}/notifications/notif1`;

  beforeEach(async () => {
    await seed(docPathA, { read: false, title: 'Produto vencendo' });
  });

  it('clinic_admin e clinic_user leem e marcam como lida (update)', async () => {
    for (const ctx of [clinicAdmin(TENANT_A), clinicUser(TENANT_A)]) {
      const db = ctx.firestore();
      await assertSucceeds(getDoc(doc(db, docPathA)));
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

  it('usuário de outro tenant não lê nem escreve', async () => {
    const db = clinicAdmin(TENANT_B).firestore();
    await assertFails(getDoc(doc(db, docPathA)));
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
