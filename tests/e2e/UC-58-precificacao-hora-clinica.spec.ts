import { test, expect, Page, Locator } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminFirestore, EMULATOR_PROJECT_ID } from '../../scripts/lib/emulatorAdmin';
import {
  TEST_PASSWORD,
  TEST_TENANTS,
  TEST_USERS,
  TEST_LEGAL_DOCUMENTS,
} from './fixtures/seed-data';
import { DocumentData, DocumentSnapshot, Timestamp } from 'firebase-admin/firestore';

/**
 * Caderno E2E (Modo A do qa-agent) de:
 * - ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-precificacao-hora-clinica.md (v1.7) — Seção "STEP 4 —
 *   Validação Manual", roteiros A–M (fonte da verdade deste arquivo) e Seção 8.4.
 * - UC-58 (Precificar protocolos pela hora clínica) — em redação em paralelo; o número/slug foi
 *   definido pelo orquestrador.
 *
 * Organização: um único `describe.serial`, porque o STEP 4 é um roteiro encadeado — G–M dependem
 * da configuração deixada por A–F (Aluguel 30.000, Seg–Sex 8 h + Sáb 4 h, 1 sala/1 profissional,
 * Boleto Tec quitado, markup 6/2/4/0/30, compartilhamento desligado). Cada `test()` abre uma sessão
 * nova (um usuário por teste); o estado entre eles vive no Firestore do emulador e em variáveis do
 * módulo (`ctx`).
 *
 * Decisões / suposições (revisão humana):
 * 1. D14 — `clinicUserA`, `clinicAdminB` e `consultant` não têm aceite de termos no seed. O aceite é
 *    gravado via Admin SDK no `beforeAll` (`user_document_acceptances/{uid}_{docId}`) e removido no
 *    `afterAll`. O seed NÃO foi estendido.
 * 2. Relógio do navegador fixado em 15/10/2026 12:00 (-03:00) e fuso America/Sao_Paulo: o app
 *    calcula "mês corrente" e "data no passado" pelo relógio do navegador.
 * 3. Dados por teste (inventário L1/L2/L3, protocolos P1–P4, solicitações legadas) usam IDs fixos
 *    `qa-uc58-*` / `qa-legado-*` e são removidos no `afterAll`, junto com tudo que o fluxo criou
 *    (solicitações, snapshots, `inventory_activity` dos lotes de teste, `audit_log` com
 *    `entity_type: 'financial_config'`). `financeiro/custo_hora` de test-clinic-a/test-clinic-b é
 *    copiado no `beforeAll` e restaurado (ou apagado, se não existia) no `afterAll`.
 * 4. Asserções de rules (E.3, J.4) são feitas pela API REST do Firestore Emulator com o ID token do
 *    próprio usuário (Auth Emulator) — com um controle positivo (clinic_admin A lê o documento) para
 *    garantir que o 403 vem da regra, e não de um token inválido.
 * 5. F.1/F.10/F.12 — "consultor sem opt-in NÃO lê `protocolos`" depende da allowlist do
 *    BUGFIX-consultor-allowlist-subcolecoes (ainda fora de develop). Aqui fica só a parte de UI
 *    (estado vazio, nenhum nome de protocolo na página); não há assert de rules sobre `protocolos`.
 * 6. Notas da revisão humana (10/10/2026):
 *    - Divisores são exibidos com 2 a 4 casas: Crédito aparece "0,60".
 *    - K.4: sem configuração de custos, o card "Preço sugerido" do detalhe mostra o CTA com o
 *      material ("Material: R$ 200,00").
 *    - G.10: `duracao_origem` é 'protocolo' só enquanto o campo guarda a duração preenchida pelo
 *      protocolo sem edição; o roteiro G redigita a duração (G.5/G.6), então grava 'informada'.
 * 7. RF-29/RN-29 (falha do snapshot) fica fora do caderno (STEP 4, K.7 e Seção 8.4).
 */

// ============================================================================================
// Constantes e estado compartilhado
// ============================================================================================

const TENANT_A = TEST_TENANTS.clinicA.tenant_id;
const TENANT_B = TEST_TENANTS.clinicB.tenant_id;
const DATA_FIXA = new Date('2026-10-15T12:00:00-03:00');

const LOTES = {
  l1: 'qa-uc58-l1',
  l2: 'qa-uc58-l2',
  l3: 'qa-uc58-l3',
} as const;

const PROTOCOLOS = {
  p1: { id: 'qa-uc58-p1', nome: 'Protocolo Exemplo 60min' },
  p2: { id: 'qa-uc58-p2', nome: 'Protocolo Incompleto' },
  p3: { id: 'qa-uc58-p3', nome: 'Protocolo Misto' },
  p4: { id: 'qa-uc58-p4', nome: 'Protocolo Sem Duração' },
} as const;

const LEGADOS = ['qa-legado-1', 'qa-legado-2'] as const;

const USUARIOS_SEM_ACEITE = [
  TEST_USERS.clinicUserA.uid,
  TEST_USERS.clinicAdminB.uid,
  TEST_USERS.consultant.uid,
];

const ctx: {
  solicitacoesCriadas: string[];
  idRoteiroG?: string;
  gravadoEmAposH?: Timestamp;
  backupFinanceiro: Record<string, DocumentData | null>;
} = { solicitacoesCriadas: [], backupFinanceiro: {} };

// ============================================================================================
// Helpers — Admin SDK
// ============================================================================================

function db() {
  return getEmulatorAdminFirestore();
}

function custoHoraRef(tenantId: string) {
  return db().doc(`tenants/${tenantId}/financeiro/custo_hora`);
}

async function lerCustoHora(tenantId = TENANT_A): Promise<DocumentData> {
  const snap = await custoHoraRef(tenantId).get();
  expect(snap.exists, `financeiro/custo_hora de ${tenantId} deveria existir`).toBe(true);
  return snap.data()!;
}

async function auditFinanceiro(): Promise<DocumentData[]> {
  const snap = await db()
    .collection('audit_log')
    .where('tenant_id', '==', TENANT_A)
    .where('entity_type', '==', 'financial_config')
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function semearDados(): Promise<void> {
  const now = Timestamp.now();
  const lote = (params: {
    id: string;
    codigo: string;
    nome: string;
    brand: string;
    lote: string;
    disponivel: number;
    valor: number;
    validade: string;
  }) =>
    db()
      .doc(`tenants/${TENANT_A}/inventory/${params.id}`)
      .set({
        tenant_id: TENANT_A,
        codigo_produto: params.codigo,
        nome_produto: params.nome,
        brand: params.brand,
        lote: params.lote,
        quantidade_inicial: params.disponivel,
        quantidade_disponivel: params.disponivel,
        quantidade_reservada: 0,
        valor_unitario: params.valor,
        dt_validade: Timestamp.fromDate(new Date(`${params.validade}T00:00:00Z`)),
        nf_numero: 'QA-NF-UC58',
        active: true,
        created_at: now,
        updated_at: now,
      });

  await lote({
    id: LOTES.l1,
    codigo: '9990001',
    nome: 'Produto Teste Rennova',
    brand: 'Rennova',
    lote: 'L1',
    disponivel: 10,
    valor: 100,
    validade: '2027-03-31',
  });
  await lote({
    id: LOTES.l2,
    codigo: '9990001',
    nome: 'Produto Teste Rennova',
    brand: 'Rennova',
    lote: 'L2',
    disponivel: 30,
    valor: 120,
    validade: '2028-03-31',
  });
  await lote({
    id: LOTES.l3,
    codigo: '9990003',
    nome: 'Material Terceiro',
    brand: 'Marca X',
    lote: 'L3',
    disponivel: 5,
    valor: 50,
    validade: '2027-12-31',
  });

  const protocolo = (
    p: { id: string; nome: string },
    itens: { codigo_produto: string; nome_produto: string; quantidade_sugerida: number }[],
    duracao?: number
  ) =>
    db()
      .doc(`tenants/${TENANT_A}/protocolos/${p.id}`)
      .set({
        tenant_id: TENANT_A,
        nome: p.nome,
        itens,
        ...(duracao === undefined ? {} : { duracao_minutos: duracao }),
        active: true,
        created_at: now,
        updated_at: now,
        created_by: TEST_USERS.clinicAdminA.uid,
      });

  const rennova = (q: number) => ({
    codigo_produto: '9990001',
    nome_produto: 'Produto Teste Rennova',
    quantidade_sugerida: q,
  });
  await protocolo(PROTOCOLOS.p1, [rennova(2)], 60);
  await protocolo(PROTOCOLOS.p2, [
    { codigo_produto: '9990002', nome_produto: 'Material Sem Custo', quantidade_sugerida: 1 },
  ]);
  await protocolo(
    PROTOCOLOS.p3,
    [
      rennova(1),
      { codigo_produto: '9990003', nome_produto: 'Material Terceiro', quantidade_sugerida: 2 },
    ],
    30
  );
  await protocolo(PROTOCOLOS.p4, [rennova(1)]);
}

async function gravarAceiteDeTermos(): Promise<void> {
  const now = Timestamp.now();
  for (const uid of USUARIOS_SEM_ACEITE) {
    for (const legalDoc of Object.values(TEST_LEGAL_DOCUMENTS)) {
      await db().collection('user_document_acceptances').doc(`${uid}_${legalDoc.id}`).set({
        user_id: uid,
        document_id: legalDoc.id,
        document_version: '1.0',
        accepted_at: now,
      });
    }
  }
}

async function limparTudo(): Promise<void> {
  const tenantA = db().doc(`tenants/${TENANT_A}`);

  // Solicitações criadas pelo fluxo (rastreadas) + qualquer outra que use os lotes de teste.
  const solicitacoes = await tenantA.collection('solicitacoes').get();
  const lotesTeste = new Set<string>(Object.values(LOTES));
  const ids = new Set<string>([...ctx.solicitacoesCriadas, ...LEGADOS]);
  for (const d of solicitacoes.docs) {
    const produtos = (d.data().produtos_solicitados ?? []) as { inventory_item_id?: string }[];
    if (produtos.some((p) => p.inventory_item_id && lotesTeste.has(p.inventory_item_id))) {
      ids.add(d.id);
    }
  }
  for (const id of ids) {
    await tenantA.collection('solicitacoes').doc(id).delete();
    await tenantA.collection('precificacao_procedimentos').doc(id).delete();
  }

  const atividades = await tenantA.collection('inventory_activity').get();
  await Promise.all(
    atividades.docs
      .filter((d) => lotesTeste.has(d.data().inventory_item_id))
      .map((d) => d.ref.delete())
  );

  for (const id of Object.values(LOTES)) await tenantA.collection('inventory').doc(id).delete();
  for (const p of Object.values(PROTOCOLOS))
    await tenantA.collection('protocolos').doc(p.id).delete();

  for (const d of await auditFinanceiro()) await db().collection('audit_log').doc(d.id).delete();

  for (const tenantId of [TENANT_A, TENANT_B]) {
    const backup = ctx.backupFinanceiro[tenantId];
    if (backup) await custoHoraRef(tenantId).set(backup);
    else await custoHoraRef(tenantId).delete();
  }

  for (const uid of USUARIOS_SEM_ACEITE) {
    for (const legalDoc of Object.values(TEST_LEGAL_DOCUMENTS)) {
      await db().collection('user_document_acceptances').doc(`${uid}_${legalDoc.id}`).delete();
    }
  }
}

// ============================================================================================
// Helpers — rules via REST do emulador (E.3, J.4)
// ============================================================================================

async function idToken(email: string): Promise<string> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const res = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: TEST_PASSWORD, returnSecureToken: true }),
    }
  );
  const body = (await res.json()) as { idToken?: string };
  expect(body.idToken, `login REST de ${email} no Auth Emulator`).toBeTruthy();
  return body.idToken!;
}

/** Status HTTP de um GET (documento ou listagem de coleção) autenticado no Firestore Emulator. */
async function statusLeitura(token: string, caminho: string): Promise<number> {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const res = await fetch(
    `http://${host}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/${caminho}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.status;
}

// ============================================================================================
// Helpers — UI
// ============================================================================================

function brl(valor: string): RegExp {
  return new RegExp(`^R\\$\\s*${valor.replace('.', '\\.')}$`);
}

function brlContido(valor: string): RegExp {
  return new RegExp(`R\\$\\s*${valor.replace('.', '\\.')}`);
}

async function submeterLogin(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function loginClinicAdminA(page: Page): Promise<void> {
  await loginAs(
    page,
    { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
    '/clinic/dashboard'
  );
}

/** `loginAs` não aceita destinos de consultor — preenche o formulário e espera /consultant. */
async function loginConsultor(page: Page, email: string): Promise<void> {
  await submeterLogin(page, email);
  await expect(page).toHaveURL(/\/consultant/);
}

/** Card shadcn (div.shadow-sm) mais próximo do título informado. */
function cardPorTitulo(page: Page, titulo: string): Locator {
  return page
    .getByRole('heading', { name: titulo, exact: true })
    .locator('xpath=ancestor::div[contains(@class,"shadow-sm")][1]');
}

/** Valor exibido logo abaixo de um rótulo (componentes ProtocoloPrecificacao/ProcedimentoPrecificacao). */
function valor(escopo: Locator, rotulo: string): Locator {
  return escopo.getByText(rotulo, { exact: true }).locator('xpath=following-sibling::p[1]');
}

function linhaDia(page: Page, dia: string): Locator {
  return page
    .getByRole('switch', { name: dia, exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-lg") and contains(@class,"border")][1]');
}

function divisor(page: Page, forma: string): Locator {
  return page
    .getByText('Divisores de markup', { exact: true })
    .locator('xpath=..')
    .locator('div.flex', { hasText: forma })
    .locator('span')
    .nth(1);
}

async function abrirCustosFixos(page: Page): Promise<void> {
  await page.goto('/clinic/my-clinic?tab=fixed_costs');
  await expect(page.getByTestId('custo-hora')).toBeVisible();
}

async function salvarCustos(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Custos salvos com sucesso').first()).toBeVisible();
}

/** Preços do bloco de procedimento (Pix/Dinheiro, Débito, Crédito) + destaque esperado. */
async function esperarPrecos(
  page: Page,
  precos: { pix: string; debito: string; credito: string },
  destaque: 'pix_dinheiro' | 'debito' | 'credito',
  selo: 'Forma escolhida' | 'Forma registrada'
): Promise<void> {
  const pix = page.getByTestId('preco-pix_dinheiro');
  const deb = page.getByTestId('preco-debito');
  const cred = page.getByTestId('preco-credito');
  await expect(pix).toContainText('Pix/Dinheiro (sem taxa de cartão)');
  await expect(pix).toContainText(brlContido(precos.pix));
  await expect(deb).toContainText(brlContido(precos.debito));
  await expect(cred).toContainText(brlContido(precos.credito));
  const porForma = { pix_dinheiro: pix, debito: deb, credito: cred };
  for (const [forma, loc] of Object.entries(porForma)) {
    await expect(loc.getByText(selo, { exact: true })).toHaveCount(forma === destaque ? 1 : 0);
  }
}

async function esperarInventarioCarregado(page: Page): Promise<void> {
  // O protocolo só aloca lotes depois que o inventário carregou (FEFO sobre produtosAgrupados).
  await page.locator('#produto').click();
  await expect(page.getByRole('option').filter({ hasText: 'Produto Teste Rennova' })).toBeVisible();
  await page.keyboard.press('Escape');
}

async function aplicarProtocolo(page: Page, nome: string): Promise<void> {
  await page.getByRole('combobox').filter({ hasText: 'Selecione um protocolo' }).click();
  await page.getByRole('option', { name: nome, exact: true }).click();
}

async function adicionarProdutoManual(page: Page, nome: string, quantidade: number) {
  await page.locator('#produto').click();
  await page.getByRole('option').filter({ hasText: nome }).click();
  await page.locator('#quantidade').fill(String(quantidade));
  await page.locator('#quantidade').locator('xpath=following-sibling::button').click();
}

async function confirmarProcedimento(page: Page): Promise<string> {
  await page.getByRole('button', { name: /Revisar Procedimento/ }).click();
  await page.getByRole('button', { name: /Confirmar e Reservar Produtos/ }).click();
  await expect(page).toHaveURL(/\/clinic\/requests\/(?!new)[^/?]+$/);
  const id = new URL(page.url()).pathname.split('/').pop()!;
  ctx.solicitacoesCriadas.push(id);
  return id;
}

async function cancelarProcedimento(page: Page, id: string): Promise<void> {
  await page.goto(`/clinic/requests/${id}`);
  await page.getByRole('button', { name: 'Cancelar Procedimento' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Cancelar Procedimento' })
    .click();
  await expect
    .poll(
      async () => (await db().doc(`tenants/${TENANT_A}/solicitacoes/${id}`).get()).data()?.status
    )
    .toBe('cancelada');
}

// ============================================================================================
// Spec
// ============================================================================================

test.describe
  .serial('UC-58 — Precificação pela hora clínica (FEAT-precificacao-hora-clinica, STEP 4)', () => {
  test.use({ timezoneId: 'America/Sao_Paulo' });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    for (const tenantId of [TENANT_A, TENANT_B]) {
      const snap: DocumentSnapshot = await custoHoraRef(tenantId).get();
      ctx.backupFinanceiro[tenantId] = snap.exists ? snap.data()! : null;
      await custoHoraRef(tenantId).delete(); // pré-condição do roteiro A: config inexistente
    }
    await semearDados();
    await gravarAceiteDeTermos();
  });

  test.afterAll(async () => {
    await limparTudo();
  });

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(DATA_FIXA);
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro A — clinic_admin configura custos fixos e vê o custo/hora (R$ 153,06) antes de salvar; o documento financeiro/custo_hora é gravado com o markup v1.3', async ({
    page,
  }) => {
    await loginClinicAdminA(page);
    await page.goto('/clinic/my-clinic');

    // A.2 — aba "Custos Fixos" visível; clicar leva a ?tab=fixed_costs
    const aba = page.getByRole('tab', { name: 'Custos Fixos' });
    await expect(aba).toBeVisible();
    await aba.click();
    await expect(page).toHaveURL(/tab=fixed_costs/);

    // A.3 — config inexistente: referência outubro/2026, custo/hora indisponível
    await expect(page.getByText(/Referência: outubro\/2026/)).toBeVisible();
    await expect(page.getByTestId('custo-hora')).toHaveText('—');
    await expect(
      page.getByText('Configure a disponibilidade semanal para calcular.')
    ).toBeVisible();

    // A.4 — preenchimento
    await page.locator('#custo-aluguel').fill('30000');
    for (const dia of ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']) {
      await page.getByRole('switch', { name: dia, exact: true }).click();
      // Ativar o dia cria 08:00–12:00; "Período" acrescenta 13:00–17:00.
      await linhaDia(page, dia).getByRole('button', { name: 'Período', exact: true }).click();
      await expect(page.getByLabel(`${dia} início do período 1`)).toHaveValue('08:00');
      await expect(page.getByLabel(`${dia} fim do período 1`)).toHaveValue('12:00');
      await expect(page.getByLabel(`${dia} início do período 2`)).toHaveValue('13:00');
      await expect(page.getByLabel(`${dia} fim do período 2`)).toHaveValue('17:00');
    }
    await page.getByRole('switch', { name: 'Sábado', exact: true }).click();
    await expect(page.getByLabel('Sábado fim do período 1')).toHaveValue('12:00');
    await page.locator('#salas').fill('1');
    await page.locator('#profissionais').fill('1');
    await page.locator('#markup-imposto_pct').fill('6');
    await page.locator('#markup-debito_pct').fill('2');
    await page.locator('#markup-credito_pct').fill('4');
    await page.locator('#markup-comissao_pct').fill('0');
    await page.locator('#markup-margem_pct').fill('30');

    // A.5 — resumo recalculado sem salvar
    await expect(page.getByText(/Total de custos fixos considerados:/)).toContainText(
      brlContido('30.000,00')
    );
    await expect(page.getByText('196 h', { exact: true })).toBeVisible();
    await expect(page.getByText('Capacidade simultânea: 1')).toBeVisible();
    await expect(page.getByTestId('custo-hora')).toHaveText(brl('153,06'));
    await expect(divisor(page, 'Pix/Dinheiro')).toHaveText('0,64');
    await expect(divisor(page, 'Débito')).toHaveText('0,62');
    // Exibido com até 4 casas, sem zeros à direita (STEP 4 escreve "0,60").
    await expect(divisor(page, 'Crédito')).toHaveText('0,60');

    // A.6 — salvar
    await salvarCustos(page);

    // A.7 — Firestore
    const doc = await lerCustoHora();
    expect(doc.tenant_id).toBe(TENANT_A);
    expect(doc.custos_fixos_base.aluguel).toBe(30000);
    expect(doc.disponibilidade.sab.periodos).toHaveLength(1);
    expect(doc.disponibilidade.seg.periodos).toHaveLength(2);
    expect(doc.markup.margem_pct).toBe(30);
    expect(doc.markup.debito_pct).toBe(2);
    expect(doc.markup.credito_pct).toBe(4);
    expect(doc.markup).not.toHaveProperty('cartao_pct');
    expect(doc.compartilhar_com_consultor).toBe(false);
    expect(doc.compartilhado_com_consultant_id).toBeNull();
    expect(doc.updated_by).toBe(TEST_USERS.clinicAdminA.uid);
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro B — validações do formulário (períodos sobrepostos, fim antes do início, soma do markup ≥ 100% na forma mais cara — RN-20) desabilitam "Salvar"', async ({
    page,
  }) => {
    await loginClinicAdminA(page);
    await abrirCustosFixos(page);
    const salvar = page.getByRole('button', { name: 'Salvar', exact: true });
    const segunda = linhaDia(page, 'Segunda');
    await expect(page.getByTestId('custo-hora')).toHaveText(brl('153,06'));

    // B.1 — 11:00–14:00 sobrepõe os períodos existentes
    await segunda.getByRole('button', { name: 'Período', exact: true }).click();
    await page.getByLabel('Segunda início do período 3').fill('11:00');
    await page.getByLabel('Segunda fim do período 3').fill('14:00');
    await expect(segunda.getByText('Períodos sobrepostos')).toBeVisible();
    await expect(salvar).toBeDisabled();
    await segunda.getByRole('button', { name: 'Remover período' }).nth(2).click();
    await expect(salvar).toBeEnabled();

    // B.2 — 18:00–17:00
    await segunda.getByRole('button', { name: 'Período', exact: true }).click();
    await page.getByLabel('Segunda início do período 3').fill('18:00');
    await page.getByLabel('Segunda fim do período 3').fill('17:00');
    await expect(segunda.getByText('O fim deve ser posterior ao início')).toBeVisible();
    await expect(salvar).toBeDisabled();
    await segunda.getByRole('button', { name: 'Remover período' }).nth(2).click();
    await expect(salvar).toBeEnabled();

    // B.3 — Comissão 60 → crédito 6+4+60+30 = 100
    const erroSoma = page.getByText('A soma dos percentuais deve ser menor que 100%');
    await page.locator('#markup-comissao_pct').fill('60');
    await expect(erroSoma).toBeVisible();
    await expect(salvar).toBeDisabled();
    for (const forma of ['Pix/Dinheiro', 'Débito', 'Crédito']) {
      await expect(divisor(page, forma)).toHaveText('—');
    }
    await page.locator('#markup-comissao_pct').fill('0');
    await expect(erroSoma).toHaveCount(0);

    // B.4 — Crédito 64 → 6+64+0+30 = 100 (débito 38 seria válido)
    await page.locator('#markup-credito_pct').fill('64');
    await expect(erroSoma).toBeVisible();
    await expect(salvar).toBeDisabled();
    await page.locator('#markup-credito_pct').fill('4');
    await expect(erroSoma).toHaveCount(0);
    await expect(salvar).toBeEnabled();

    // Nada foi salvo neste roteiro.
    const doc = await lerCustoHora();
    expect(doc.markup.credito_pct).toBe(4);
    expect(doc.markup.comissao_pct).toBe(0);
    expect(doc.disponibilidade.seg.periodos).toHaveLength(2);
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro C — Boleto Tec compõe o custo enquanto há parcelas restantes; capacidade = mín(salas, profissionais) (D3)', async ({
    page,
  }) => {
    await loginClinicAdminA(page);
    await abrirCustosFixos(page);
    const total = page.getByText(/Total de custos fixos considerados:/);
    const custoHora = page.getByTestId('custo-hora');

    // C.1
    await page.getByRole('button', { name: 'Adicionar Boleto Tec' }).click();
    await page.getByLabel('Descrição').fill('Laser X');
    await page.getByLabel('Valor da parcela').fill('5000');
    await page.getByLabel('Total de parcelas').fill('24');
    await page.getByLabel('Parcelas já pagas').fill('10');
    await expect(page.getByText('Compõe o custo · 14 restantes')).toBeVisible();
    await expect(total).toContainText(brlContido('35.000,00'));
    await expect(custoHora).toHaveText(brl('178,57'));

    // C.2
    await page.getByLabel('Parcelas já pagas').fill('24');
    await expect(page.getByText('Quitado', { exact: true })).toBeVisible();
    await expect(total).toContainText(brlContido('30.000,00'));
    await expect(custoHora).toHaveText(brl('153,06'));

    // C.3
    await page.locator('#salas').fill('2');
    await expect(page.getByText('Capacidade simultânea: 1')).toBeVisible();
    await expect(custoHora).toHaveText(brl('153,06'));

    // C.4
    await page.locator('#profissionais').fill('2');
    await expect(page.getByText('Capacidade simultânea: 2')).toBeVisible();
    await expect(custoHora).toHaveText(brl('76,53'));
    await page.locator('#salas').fill('1');
    await page.locator('#profissionais').fill('1');
    await expect(custoHora).toHaveText(brl('153,06'));
    await salvarCustos(page);

    // C.5
    const doc = await lerCustoHora();
    expect(doc.boletos_tec).toHaveLength(1);
    expect(doc.boletos_tec[0].parcelas_pagas).toBe(24);
    expect(doc.boletos_tec[0].mes_referencia).toBe('2026-10');
    expect(doc.quantidade_salas).toBe(1);
    expect(doc.quantidade_profissionais).toBe(1);
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro D — /clinic/protocolos mostra material (custo médio), hora clínica, custo real e preços Pix/Crédito; protocolo sem duração usa 60 min (padrão, D11); duração 0 é rejeitada', async ({
    page,
  }) => {
    await loginClinicAdminA(page);
    await page.goto('/clinic/protocolos');

    // D.2 — P1
    const p1 = cardPorTitulo(page, PROTOCOLOS.p1.nome);
    await expect(valor(p1, 'Duração')).toHaveText('60 min');
    await expect(valor(p1, 'Material')).toHaveText(brl('230,00'));
    await expect(valor(p1, 'Hora clínica')).toHaveText(brl('153,06'));
    await expect(valor(p1, 'Custo real')).toHaveText(brl('383,06'));
    await expect(valor(p1, 'Preço Pix/Dinheiro')).toHaveText(brl('598,53'));
    await expect(valor(p1, 'Preço Crédito')).toHaveText(brl('638,44'));

    // D.3 — P3 (dois produtos nomeados)
    const p3 = cardPorTitulo(page, PROTOCOLOS.p3.nome);
    await expect(p3.getByText('Produto Teste Rennova × 1')).toBeVisible();
    await expect(p3.getByText('Material Terceiro × 2')).toBeVisible();
    await expect(valor(p3, 'Material')).toHaveText(brl('215,00'));
    await expect(valor(p3, 'Hora clínica')).toHaveText(brl('76,53'));
    await expect(valor(p3, 'Custo real')).toHaveText(brl('291,53'));
    await expect(valor(p3, 'Preço Pix/Dinheiro')).toHaveText(brl('455,52'));
    await expect(valor(p3, 'Preço Crédito')).toHaveText(brl('485,88'));

    // D.4 — P2 (material sem custo, sem duração)
    const p2 = cardPorTitulo(page, PROTOCOLOS.p2.nome);
    await expect(
      p2.getByText(/Custo de material incompleto: sem valor para Material Sem Custo/)
    ).toBeVisible();
    await expect(valor(p2, 'Duração')).toHaveText('60 min (padrão)');
    await expect(p2.getByText('Duração não informada — considerada 1 hora')).toBeVisible();
    await expect(valor(p2, 'Material')).toHaveText(brl('0,00'));
    await expect(valor(p2, 'Hora clínica')).toHaveText(brl('153,06'));
    await expect(valor(p2, 'Custo real')).toHaveText(brl('153,06'));
    await expect(valor(p2, 'Preço Pix/Dinheiro')).toHaveText(brl('239,16'));
    await expect(valor(p2, 'Preço Crédito')).toHaveText(brl('255,10'));

    // D.4a — P4
    const p4 = cardPorTitulo(page, PROTOCOLOS.p4.nome);
    await expect(valor(p4, 'Duração')).toHaveText('60 min (padrão)');
    await expect(p4.getByText('Duração não informada — considerada 1 hora')).toBeVisible();
    await expect(valor(p4, 'Material')).toHaveText(brl('115,00'));
    await expect(valor(p4, 'Custo real')).toHaveText(brl('268,06'));
    await expect(valor(p4, 'Preço Pix/Dinheiro')).toHaveText(brl('418,85'));
    await expect(valor(p4, 'Preço Crédito')).toHaveText(brl('446,77'));

    await expect(page.getByText(/Valores com base nos custos de outubro\/2026/)).toBeVisible();

    // D.5 — duração 0 rejeitada
    await page.goto(`/clinic/protocolos/${PROTOCOLOS.p1.id}`);
    await expect(page.locator('#duracao')).toHaveValue('60');
    await page.locator('#duracao').fill('0');
    await page.getByRole('button', { name: 'Salvar Alterações' }).click();
    await expect(
      page.getByText('Informe uma duração entre 1 e 1440 minutos').first()
    ).toBeVisible();
    const p1Doc = (
      await db().doc(`tenants/${TENANT_A}/protocolos/${PROTOCOLOS.p1.id}`).get()
    ).data()!;
    expect(p1Doc.duracao_minutos).toBe(60);
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro E (1–3) — clinic_user não vê a aba "Custos Fixos" nem a precificação dos protocolos e recebe permission-denied em financeiro/custo_hora (RF-18)', async ({
    page,
  }) => {
    await loginAs(
      page,
      { email: TEST_USERS.clinicUserA.email, password: TEST_PASSWORD },
      '/clinic/dashboard'
    );

    // E.1
    await page.goto('/clinic/my-clinic?tab=fixed_costs');
    const abaClinica = page.getByRole('tab', { name: 'Clínica', exact: true });
    await expect(abaClinica).toBeVisible();
    await expect(abaClinica).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Custos Fixos' })).toHaveCount(0);
    await expect(page.getByTestId('custo-hora')).toHaveCount(0);

    // E.2
    await page.goto('/clinic/protocolos');
    await expect(
      page.getByRole('heading', { name: PROTOCOLOS.p1.nome, exact: true })
    ).toBeVisible();
    await expect(page.getByText('Preço Pix/Dinheiro')).toHaveCount(0);
    await expect(page.getByText('Hora clínica')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Configurar custos fixos' })).toHaveCount(0);

    // E.3 — rules (controle positivo: clinic_admin A lê o mesmo documento)
    const caminho = `tenants/${TENANT_A}/financeiro/custo_hora`;
    expect(await statusLeitura(await idToken(TEST_USERS.clinicAdminA.email), caminho)).toBe(200);
    expect(await statusLeitura(await idToken(TEST_USERS.clinicUserA.email), caminho)).toBe(403);
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro E (4) — clinic_admin da clínica B vê a configuração padrão, sem nenhum valor da clínica A (multi-tenant)', async ({
    page,
  }) => {
    await loginAs(
      page,
      { email: TEST_USERS.clinicAdminB.email, password: TEST_PASSWORD },
      '/clinic/dashboard'
    );
    await abrirCustosFixos(page);
    await expect(page.getByTestId('custo-hora')).toHaveText('—');
    await expect(page.locator('#custo-aluguel')).toHaveValue('');
    await expect(page.getByText(/Total de custos fixos considerados:/)).toContainText(
      brlContido('0,00')
    );
    await expect(page.getByText(/30\.000,00/)).toHaveCount(0);
    expect(
      await statusLeitura(
        await idToken(TEST_USERS.clinicAdminB.email),
        `tenants/${TENANT_A}/financeiro/custo_hora`
      )
    ).toBe(403);
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro F (1–2) — sem opt-in, o consultor vinculado não vê "Ver Precificação" e /pricing mostra o estado vazio, sem nomes de protocolos', async ({
    page,
  }) => {
    await loginConsultor(page, TEST_USERS.consultant.email);

    // F.1 (só UI — o assert de rules sobre `protocolos` depende da allowlist UC-48-RN-06)
    await page.goto(`/consultant/clinics/${TENANT_A}`);
    await expect(page.getByRole('button', { name: /Ver Projeções/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ver Precificação/ })).toHaveCount(0);

    // F.2
    await page.goto(`/consultant/clinics/${TENANT_A}/pricing`);
    await expect(
      page.getByText('Esta clínica não compartilhou dados financeiros com você.')
    ).toBeVisible();
    for (const p of Object.values(PROTOCOLOS)) {
      await expect(page.getByText(p.nome)).toHaveCount(0);
    }
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro F (3–7) — clinic_admin compartilha com o consultor: grava o opt-in amarrado ao consultant_id e audita exatamente 1 vez (D4/RN-14)', async ({
    page,
  }) => {
    const antes = await auditFinanceiro();
    await loginClinicAdminA(page);
    await abrirCustosFixos(page);

    // F.3
    const sw = page.getByRole('switch', { name: 'Compartilhar dados financeiros com o consultor' });
    await expect(sw).toBeEnabled();
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await salvarCustos(page);

    // F.4
    const doc = await lerCustoHora();
    expect(doc.compartilhar_com_consultor).toBe(true);
    expect(doc.compartilhado_com_consultant_id).toBe(TEST_USERS.consultant.uid);

    // F.5
    const depois = await auditFinanceiro();
    expect(depois).toHaveLength(antes.length + 1);
    const nova = depois.find((d) => !antes.some((a) => a.id === d.id))!;
    expect(nova).toMatchObject({
      tenant_id: TENANT_A,
      entity_type: 'financial_config',
      entity_id: TENANT_A,
      action: 'share_with_consultant',
      actor_id: TEST_USERS.clinicAdminA.uid,
      actor_role: 'clinic_admin',
    });
    expect(nova.metadata?.consultant_id).toBe(TEST_USERS.consultant.uid);

    // F.6 — salvar de novo sem mudar o switch não audita
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.getByText('Custos salvos com sucesso').first()).toBeVisible();
    await expect.poll(async () => (await auditFinanceiro()).length).toBe(depois.length);

    // F.7
    await page.goto('/clinic/audit-log');
    const linha = page
      .getByTestId('audit-log-row')
      .filter({ hasText: 'Compartilhar com Consultor' })
      .first();
    await expect(linha).toBeVisible();
    await expect(linha).toContainText('Dados Financeiros');
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro F (8) — com opt-in, o consultor vê a precificação somente leitura; P3 mostra totais completos e agrega o material não-Rennova em "Outros materiais" (RF-20/RN-17)', async ({
    page,
  }) => {
    await loginConsultor(page, TEST_USERS.consultant.email);
    await page.goto(`/consultant/clinics/${TENANT_A}`);
    await page.getByRole('button', { name: /Ver Precificação/ }).click();
    await expect(page).toHaveURL(new RegExp(`/consultant/clinics/${TENANT_A}/pricing`));

    await expect(page.getByTestId('custo-hora')).toHaveText(brl('153,06'));
    await expect(page.getByText('Modo Visualização')).toBeVisible();
    await expect(page.locator('main input, main textarea, main [role="switch"]')).toHaveCount(0);

    // Bloco do protocolo = pai do parágrafo com o nome.
    const bloco = (nome: string) => page.getByText(nome, { exact: true }).locator('xpath=..');

    const p1 = bloco(PROTOCOLOS.p1.nome);
    await expect(valor(p1, 'Preço Pix/Dinheiro')).toHaveText(brl('598,53'));
    await expect(valor(p1, 'Preço Crédito')).toHaveText(brl('638,44'));
    await expect(p1.getByText('Produto Teste Rennova × 2')).toBeVisible();

    const p3 = bloco(PROTOCOLOS.p3.nome);
    await expect(valor(p3, 'Material')).toHaveText(brl('215,00'));
    await expect(valor(p3, 'Preço Pix/Dinheiro')).toHaveText(brl('455,52'));
    await expect(valor(p3, 'Preço Crédito')).toHaveText(brl('485,88'));
    await expect(p3.getByText('Produto Teste Rennova × 1')).toBeVisible();
    const outros = p3.locator('div.flex', { hasText: 'Outros materiais' });
    await expect(outros).toContainText(brlContido('100,00'));

    await expect(page.getByText('Material Terceiro')).toHaveCount(0);
    await expect(page.getByText('9990003')).toHaveCount(0);

    // A listagem de protocolos carregou — o opt-in libera a leitura (D6/RN-18).
    await expect(page.getByText(PROTOCOLOS.p2.nome, { exact: true })).toBeVisible();
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro F (9) — consultor sem a clínica em authorized_tenants é redirecionado para /consultant/clinics', async ({
    page,
  }) => {
    await loginConsultor(page, TEST_USERS.consultantB.email);
    await page.goto(`/consultant/clinics/${TENANT_A}/pricing`);
    await expect(page).toHaveURL(/\/consultant\/clinics$/);
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro F (10–11) — clinic_admin revoga o compartilhamento: opt-in limpo e auditoria unshare_with_consultant', async ({
    page,
  }) => {
    const antes = await auditFinanceiro();
    await loginClinicAdminA(page);
    await abrirCustosFixos(page);
    const sw = page.getByRole('switch', { name: 'Compartilhar dados financeiros com o consultor' });
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await salvarCustos(page);

    const doc = await lerCustoHora();
    expect(doc.compartilhar_com_consultor).toBe(false);
    expect(doc.compartilhado_com_consultant_id).toBeNull();

    const depois = await auditFinanceiro();
    expect(depois).toHaveLength(antes.length + 1);
    const nova = depois.find((d) => !antes.some((a) => a.id === d.id))!;
    expect(nova.action).toBe('unshare_with_consultant');
    expect(nova.metadata?.consultant_id).toBe(TEST_USERS.consultant.uid);
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro F (10, consultor) — após a revogação, /pricing volta ao estado vazio sem nomes de protocolos', async ({
    page,
  }) => {
    await loginConsultor(page, TEST_USERS.consultant.email);
    await page.goto(`/consultant/clinics/${TENANT_A}/pricing`);
    await expect(
      page.getByText('Esta clínica não compartilhou dados financeiros com você.')
    ).toBeVisible();
    for (const p of Object.values(PROTOCOLOS)) {
      await expect(page.getByText(p.nome)).toHaveCount(0);
    }
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro F (12, consultor) — opt-in gravado para outro consultant_id não libera a precificação ao consultor atual (RN-13/RN-18)', async ({
    page,
  }) => {
    await custoHoraRef(TENANT_A).update({
      compartilhar_com_consultor: true,
      compartilhado_com_consultant_id: TEST_USERS.consultantB.uid,
    });
    await loginConsultor(page, TEST_USERS.consultant.email);
    await page.goto(`/consultant/clinics/${TENANT_A}/pricing`);
    await expect(
      page.getByText('Esta clínica não compartilhou dados financeiros com você.')
    ).toBeVisible();
    for (const p of Object.values(PROTOCOLOS)) {
      await expect(page.getByText(p.nome)).toHaveCount(0);
    }
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro F (12, clinic_admin) — troca de consultor: switch desligado + aviso; salvar revoga com motivo troca_de_consultor (RN-16)', async ({
    page,
  }) => {
    try {
      const antes = await auditFinanceiro();
      await loginClinicAdminA(page);
      await abrirCustosFixos(page);
      const sw = page.getByRole('switch', {
        name: 'Compartilhar dados financeiros com o consultor',
      });
      await expect(
        page.getByText(/O compartilhamento anterior não vale para o consultor atual/)
      ).toBeVisible();
      await expect(sw).toHaveAttribute('aria-checked', 'false');
      await salvarCustos(page);

      const doc = await lerCustoHora();
      expect(doc.compartilhar_com_consultor).toBe(false);
      expect(doc.compartilhado_com_consultant_id).toBeNull();

      const depois = await auditFinanceiro();
      expect(depois).toHaveLength(antes.length + 1);
      const nova = depois.find((d) => !antes.some((a) => a.id === d.id))!;
      expect(nova.action).toBe('unshare_with_consultant');
      expect(nova.metadata?.motivo).toBe('troca_de_consultor');
    } finally {
      await custoHoraRef(TENANT_A).update({
        compartilhar_com_consultor: false,
        compartilhado_com_consultant_id: null,
      });
    }
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro G (1–11) — cadastro com P1: material pelo lote real (FEFO), três preços sempre visíveis, forma só muda o destaque (D13); confirmar grava snapshot sem dados financeiros na solicitação', async ({
    page,
  }) => {
    await loginClinicAdminA(page);
    await page.goto('/clinic/requests/new');

    // G.2
    await expect(page.getByRole('heading', { name: 'Dados do Procedimento' })).toBeVisible();
    await expect(page.locator('#duracao')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Pix/Dinheiro', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    // G.3
    await esperarInventarioCarregado(page);
    await page.locator('#dt-procedimento').fill('2026-10-20');
    await aplicarProtocolo(page, PROTOCOLOS.p1.nome);
    const linhaL1 = page.getByRole('row').filter({ hasText: 'Produto Teste Rennova' });
    await expect(linhaL1).toHaveCount(1);
    await expect(linhaL1.getByRole('cell').nth(1)).toHaveText('L1');
    await expect(linhaL1.getByRole('cell').nth(2)).toHaveText('2');
    await expect(page.getByRole('row').filter({ hasText: 'Valor Total:' })).toContainText(
      brlContido('200,00')
    );
    await expect(page.locator('#duracao')).toHaveValue('60');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    const bloco = cardPorTitulo(page, 'Preço sugerido');
    await expect(valor(bloco, 'Material')).toHaveText(brl('200,00'));
    await expect(valor(bloco, 'Hora clínica')).toHaveText(brl('153,06'));
    await expect(valor(bloco, 'Custo real')).toHaveText(brl('353,06'));
    const precosG = { pix: '551,66', debito: '569,45', credito: '588,44' };
    await esperarPrecos(page, precosG, 'pix_dinheiro', 'Forma escolhida');
    await expect(page.getByTestId('preco-debito')).toContainText('Débito (taxa 2%)');
    await expect(page.getByTestId('preco-credito')).toContainText('Crédito (taxa 4%)');
    await expect(bloco.getByText(/custos de outubro\/2026/)).toBeVisible();

    // G.4
    await page.getByRole('button', { name: 'Débito', exact: true }).click();
    await esperarPrecos(page, precosG, 'debito', 'Forma escolhida');
    await page.getByRole('button', { name: 'Crédito', exact: true }).click();
    await esperarPrecos(page, precosG, 'credito', 'Forma escolhida');

    // G.5
    await page.locator('#duracao').fill('45');
    await expect(valor(bloco, 'Hora clínica')).toHaveText(brl('114,80'));
    await expect(valor(bloco, 'Custo real')).toHaveText(brl('314,80'));
    await esperarPrecos(
      page,
      { pix: '491,87', debito: '507,74', credito: '524,66' },
      'credito',
      'Forma escolhida'
    );
    await page.locator('#duracao').fill('60');

    // G.6
    await page.locator('#duracao').fill('0');
    await page.getByRole('button', { name: /Revisar Procedimento/ }).click();
    await expect(
      page.getByText('Informe uma duração entre 1 e 1440 minutos').first()
    ).toBeVisible();
    await expect(page.locator('#duracao')).toBeVisible();
    await page.locator('#duracao').fill('60');

    // G.7
    await page.getByRole('button', { name: 'Procedimento Programado' }).click();
    await page.getByRole('button', { name: /Revisar Procedimento/ }).click();
    const dados = cardPorTitulo(page, 'Dados do Procedimento');
    await expect(dados.getByText('60 min', { exact: true })).toBeVisible();
    await expect(dados.getByText('Crédito', { exact: true })).toBeVisible();
    await esperarPrecos(page, precosG, 'credito', 'Forma escolhida');

    // G.8
    await page.getByRole('button', { name: /Confirmar e Reservar Produtos/ }).click();
    await expect(page).toHaveURL(/\/clinic\/requests\/(?!new)[^/?]+$/);
    const id = new URL(page.url()).pathname.split('/').pop()!;
    ctx.solicitacoesCriadas.push(id);
    ctx.idRoteiroG = id;
    await expect(
      page.getByText('Procedimento salvo, mas a precificação não foi registrada')
    ).toHaveCount(0);

    // G.9 — solicitação sem nenhum dado financeiro
    const sol = (await db().doc(`tenants/${TENANT_A}/solicitacoes/${id}`).get()).data()!;
    expect(sol.duracao_minutos).toBe(60);
    expect(sol.forma_pagamento).toBe('credito');
    expect(sol.protocolo_id).toBe(PROTOCOLOS.p1.id);
    for (const campo of [
      'custo_hora',
      'custo_real',
      'preco_sugerido',
      'divisor',
      'markup',
      'taxa_pagamento_pct',
    ]) {
      expect(sol, `solicitação não deve ter ${campo}`).not.toHaveProperty(campo);
    }

    // G.10 — snapshot. G.5/G.6 redigitaram a duração, então a origem é 'informada' (seria
    // 'protocolo' só se o campo mantivesse o valor preenchido por P1 sem edição).
    const snap = (
      await db().doc(`tenants/${TENANT_A}/precificacao_procedimentos/${id}`).get()
    ).data()!;
    expect(snap).toMatchObject({
      tenant_id: TENANT_A,
      solicitacao_id: id,
      mes_referencia: '2026-10',
      duracao_minutos: 60,
      duracao_origem: 'informada',
      custo_material: 200,
      custo_material_incompleto: false,
      markup: { imposto_pct: 6, debito_pct: 2, credito_pct: 4, comissao_pct: 0, margem_pct: 30 },
      forma_pagamento: 'credito',
      origem: 'criacao',
      gravado_por: TEST_USERS.clinicAdminA.uid,
    });
    expect(snap.custo_hora).toBeCloseTo(153.0612, 3);
    expect(snap.custo_hora_aplicado).toBeCloseTo(153.0612, 3);
    expect(snap.custo_real).toBeCloseTo(353.0612, 3);
    expect(snap.divisores.pix_dinheiro).toBeCloseTo(0.64, 6);
    expect(snap.divisores.debito).toBeCloseTo(0.62, 6);
    expect(snap.divisores.credito).toBeCloseTo(0.6, 6);
    expect(snap.precos_sugeridos.pix_dinheiro).toBeCloseTo(551.6582, 3);
    expect(snap.precos_sugeridos.debito).toBeCloseTo(569.4536, 3);
    expect(snap.precos_sugeridos.credito).toBeCloseTo(588.4354, 3);

    // G.11 — detalhe
    const detalhes = cardPorTitulo(page, 'Detalhes do Procedimento');
    await expect(detalhes.getByText('60 min', { exact: true })).toBeVisible();
    await expect(detalhes.getByText('Crédito', { exact: true })).toBeVisible();
    const card = cardPorTitulo(page, 'Preço sugerido');
    await expect(valor(card, 'Material')).toHaveText(brl('200,00'));
    await expect(valor(card, 'Hora clínica')).toHaveText(brl('153,06'));
    await expect(valor(card, 'Custo real')).toHaveText(brl('353,06'));
    await esperarPrecos(page, precosG, 'credito', 'Forma registrada');
    await expect(card.getByText(/com os custos de outubro\/2026/)).toBeVisible();
    await expect(card.getByText('Estimativa atual')).toHaveCount(0);
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro G (12–14) — protocolo sem duração abre o diálogo "Entendi" e considera 60 min (padrão); duração digitada prevalece e apagá-la volta ao padrão (D11/RN-24)', async ({
    page,
  }) => {
    await loginClinicAdminA(page);
    await page.goto('/clinic/requests/new');
    await esperarInventarioCarregado(page);
    await page.locator('#dt-procedimento').fill('2026-10-22');

    // G.12
    await aplicarProtocolo(page, PROTOCOLOS.p4.nome);
    const dialogo = page.getByRole('alertdialog');
    await expect(dialogo).toContainText('Protocolo sem duração');
    await expect(dialogo).toContainText(
      `O protocolo "${PROTOCOLOS.p4.nome}" não tem duração cadastrada. Será considerada 1 hora de procedimento`
    );
    await dialogo.getByRole('button', { name: 'Entendi' }).click();
    await expect(dialogo).toHaveCount(0);
    await expect(page.locator('#duracao')).toHaveValue('');

    const bloco = cardPorTitulo(page, 'Preço sugerido');
    const aviso = bloco.getByText('Duração não informada — considerada 1 hora');
    await expect(valor(bloco, 'Duração')).toHaveText('60 min (padrão)');
    await expect(aviso).toBeVisible();
    await expect(valor(bloco, 'Material')).toHaveText(brl('100,00'));
    await expect(valor(bloco, 'Hora clínica')).toHaveText(brl('153,06'));
    await expect(valor(bloco, 'Custo real')).toHaveText(brl('253,06'));
    await esperarPrecos(
      page,
      { pix: '395,41', debito: '408,16', credito: '421,77' },
      'pix_dinheiro',
      'Forma escolhida'
    );

    // G.13
    await adicionarProdutoManual(page, 'Material Terceiro', 1);
    await expect(valor(bloco, 'Duração')).toHaveText('60 min (padrão)');
    await expect(valor(bloco, 'Material')).toHaveText(brl('150,00'));

    // G.14
    await page.locator('#duracao').fill('30');
    await expect(valor(bloco, 'Hora clínica')).toHaveText(brl('76,53'));
    await expect(aviso).toHaveCount(0);
    await page.locator('#duracao').fill('');
    await expect(valor(bloco, 'Duração')).toHaveText('60 min (padrão)');
    await expect(aviso).toBeVisible();
    // Sai sem confirmar — nada gravado (verificado no cleanup: nenhuma solicitação extra com P4).
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro G (15) — procedimento sem protocolo e sem duração: 60 min (padrão), solicitação sem duracao_minutos, snapshot com duracao_origem "padrao"; edição reabre com o campo vazio', async ({
    page,
  }) => {
    await loginClinicAdminA(page);
    await page.goto('/clinic/requests/new');
    await esperarInventarioCarregado(page);
    await page.locator('#dt-procedimento').fill('2026-10-22');
    await adicionarProdutoManual(page, 'Produto Teste Rennova', 2);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(
      page.getByRole('row').filter({ hasText: 'Produto Teste Rennova' }).getByRole('cell').nth(1)
    ).toHaveText('L1');

    const bloco = cardPorTitulo(page, 'Preço sugerido');
    await expect(valor(bloco, 'Duração')).toHaveText('60 min (padrão)');
    await expect(bloco.getByText('Duração não informada — considerada 1 hora')).toBeVisible();
    await expect(valor(bloco, 'Material')).toHaveText(brl('200,00'));
    await expect(valor(bloco, 'Custo real')).toHaveText(brl('353,06'));
    await esperarPrecos(
      page,
      { pix: '551,66', debito: '569,45', credito: '588,44' },
      'pix_dinheiro',
      'Forma escolhida'
    );

    const id = await confirmarProcedimento(page);
    try {
      const sol = (await db().doc(`tenants/${TENANT_A}/solicitacoes/${id}`).get()).data()!;
      expect(sol).not.toHaveProperty('duracao_minutos');
      const snap = (
        await db().doc(`tenants/${TENANT_A}/precificacao_procedimentos/${id}`).get()
      ).data()!;
      expect(snap.duracao_minutos).toBe(60);
      expect(snap.duracao_origem).toBe('padrao');
      expect(snap.precos_sugeridos.pix_dinheiro).toBeCloseTo(551.6582, 3);
      expect(snap.precos_sugeridos.debito).toBeCloseTo(569.4536, 3);
      expect(snap.precos_sugeridos.credito).toBeCloseTo(588.4354, 3);

      // Edição reabre com Duração vazia e bloco em 60 min (padrão)
      await page.getByRole('button', { name: 'Editar Procedimento' }).click();
      await expect(page).toHaveURL(/\/clinic\/requests\/new\?edit=/);
      await expect(page.getByRole('heading', { name: 'Editar Procedimento' })).toBeVisible();
      await expect(page.locator('#duracao')).toHaveValue('');
      await expect(valor(cardPorTitulo(page, 'Preço sugerido'), 'Duração')).toHaveText(
        '60 min (padrão)'
      );
    } finally {
      await cancelarProcedimento(page, id); // libera L1
    }
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro H — snapshot congelado após mudar os custos; edição recalcula e sobrescreve (origem "edicao"); legados sem snapshot mostram "Estimativa atual" sem gravar nada (RN-25)', async ({
    page,
  }) => {
    const idG = ctx.idRoteiroG!;
    expect(idG, 'depende do Roteiro G (1–11)').toBeTruthy();
    const solRef = (id: string) => db().doc(`tenants/${TENANT_A}/solicitacoes/${id}`);
    const snapRef = (id: string) =>
      db().doc(`tenants/${TENANT_A}/precificacao_procedimentos/${id}`);

    try {
      // H.1
      await loginClinicAdminA(page);
      await abrirCustosFixos(page);
      await page.locator('#custo-aluguel').fill('35000');
      await expect(page.getByTestId('custo-hora')).toHaveText(brl('178,57'));
      await salvarCustos(page);

      // H.2 — snapshot congelado
      await page.goto(`/clinic/requests/${idG}`);
      const card = cardPorTitulo(page, 'Preço sugerido');
      await expect(valor(card, 'Hora clínica')).toHaveText(brl('153,06'));
      await expect(page.getByTestId('preco-credito')).toContainText(brlContido('588,44'));

      // H.3 — edição recalcula com a configuração atual
      await page.getByRole('button', { name: 'Editar Procedimento' }).click();
      await expect(page).toHaveURL(/\/clinic\/requests\/new\?edit=/);
      await expect(page.locator('#duracao')).toHaveValue('60');
      await expect(page.getByRole('button', { name: 'Crédito', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      const bloco = cardPorTitulo(page, 'Preço sugerido');
      await expect(valor(bloco, 'Hora clínica')).toHaveText(brl('178,57'));
      await expect(valor(bloco, 'Custo real')).toHaveText(brl('378,57'));
      const precosH = { pix: '591,52', debito: '610,60', credito: '630,95' };
      await esperarPrecos(page, precosH, 'credito', 'Forma escolhida');

      // H.4
      await page.getByRole('button', { name: 'Pix/Dinheiro', exact: true }).click();
      await esperarPrecos(page, precosH, 'pix_dinheiro', 'Forma escolhida');
      await page.getByRole('button', { name: /Revisar Procedimento/ }).click();
      await page.getByRole('button', { name: /Confirmar Alterações/ }).click();
      await expect(page).toHaveURL(new RegExp(`/clinic/requests/${idG}$`));

      // H.5
      await expect.poll(async () => (await snapRef(idG).get()).data()?.origem).toBe('edicao');
      const snap = (await snapRef(idG).get()).data()!;
      expect(snap.forma_pagamento).toBe('pix_dinheiro');
      expect(snap.mes_referencia).toBe('2026-10');
      expect(snap.custo_hora).toBeCloseTo(178.5714, 3);
      expect(snap.custo_real).toBeCloseTo(378.5714, 3);
      expect(snap.precos_sugeridos.pix_dinheiro).toBeCloseTo(591.5179, 3);
      expect(snap.precos_sugeridos.debito).toBeCloseTo(610.5991, 3);
      expect(snap.precos_sugeridos.credito).toBeCloseTo(630.9524, 3);
      ctx.gravadoEmAposH = snap.gravado_em as Timestamp;
      expect((await solRef(idG).get()).data()!.forma_pagamento).toBe('pix_dinheiro');
      await esperarPrecos(page, precosH, 'pix_dinheiro', 'Forma registrada');

      // H.6 — solicitações legadas (sem forma_pagamento e sem snapshot)
      const now = Timestamp.now();
      const legado = (duracao?: number) => ({
        tenant_id: TENANT_A,
        tipo: 'programado',
        status: 'agendada',
        dt_procedimento: Timestamp.fromDate(new Date('2026-10-25T00:00:00Z')),
        produtos_solicitados: [
          {
            inventory_item_id: LOTES.l1,
            produto_codigo: '9990001',
            produto_nome: 'Produto Teste Rennova',
            lote: 'L1',
            quantidade: 1,
            quantidade_disponivel_antes: 10,
            valor_unitario: 100,
          },
        ],
        ...(duracao === undefined ? {} : { duracao_minutos: duracao }),
        created_by: TEST_USERS.clinicAdminA.uid,
        created_by_name: TEST_USERS.clinicAdminA.name,
        created_at: now,
        updated_at: now,
      });
      await solRef(LEGADOS[0]).set(legado(30));
      await solRef(LEGADOS[1]).set(legado());

      // H.7
      await page.goto(`/clinic/requests/${LEGADOS[0]}`);
      const c1 = cardPorTitulo(page, 'Preço sugerido');
      await expect(c1.getByText('Estimativa atual')).toBeVisible();
      await expect(c1.getByText(/para outubro\/2026/)).toBeVisible();
      await expect(valor(c1, 'Material')).toHaveText(brl('100,00'));
      await expect(valor(c1, 'Hora clínica')).toHaveText(brl('89,29'));
      await expect(valor(c1, 'Custo real')).toHaveText(brl('189,29'));
      await esperarPrecos(
        page,
        { pix: '295,76', debito: '305,30', credito: '315,48' },
        'pix_dinheiro',
        'Forma registrada'
      );
      expect((await snapRef(LEGADOS[0]).get()).exists).toBe(false);

      // H.8
      await page.goto(`/clinic/requests/${LEGADOS[1]}`);
      const c2 = cardPorTitulo(page, 'Preço sugerido');
      await expect(c2.getByText('Estimativa atual')).toBeVisible();
      await expect(valor(c2, 'Duração')).toHaveText('60 min (padrão)');
      await expect(c2.getByText('Duração não informada — considerada 1 hora')).toBeVisible();
      await expect(valor(c2, 'Material')).toHaveText(brl('100,00'));
      await expect(valor(c2, 'Hora clínica')).toHaveText(brl('178,57'));
      await expect(valor(c2, 'Custo real')).toHaveText(brl('278,57'));
      await esperarPrecos(
        page,
        { pix: '435,27', debito: '449,31', credito: '464,29' },
        'pix_dinheiro',
        'Forma registrada'
      );
      expect((await snapRef(LEGADOS[1]).get()).exists).toBe(false);
    } finally {
      // H.9 — restaura Aluguel 30.000 e remove os legados
      await custoHoraRef(TENANT_A).update({ 'custos_fixos_base.aluguel': 30000 });
      for (const id of LEGADOS) await solRef(id).delete();
    }
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro I — cancelar o procedimento mantém o snapshot intacto e o card informa que os valores ficam só como referência', async ({
    page,
  }) => {
    const idG = ctx.idRoteiroG!;
    await loginClinicAdminA(page);
    await cancelarProcedimento(page, idG);

    const snap = (
      await db().doc(`tenants/${TENANT_A}/precificacao_procedimentos/${idG}`).get()
    ).data()!;
    expect(snap.origem).toBe('edicao');
    expect((snap.gravado_em as Timestamp).isEqual(ctx.gravadoEmAposH!)).toBe(true);
    expect(snap.precos_sugeridos.pix_dinheiro).toBeCloseTo(591.5179, 3);

    await page.reload();
    await expect(
      page.getByText('Procedimento cancelado — valores mantidos apenas como referência.')
    ).toBeVisible();
    await esperarPrecos(
      page,
      { pix: '591,52', debito: '610,60', credito: '630,95' },
      'pix_dinheiro',
      'Forma registrada'
    );
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro J — clinic_user vê duração e forma de pagamento, mas não o card "Preço sugerido"; precificacao_procedimentos é negado a clinic_user, clinic_admin de outra clínica e consultor (mesmo com opt-in)', async ({
    page,
  }) => {
    const idG = ctx.idRoteiroG!;
    const errosPermissao: string[] = [];
    page.on('console', (msg) => {
      if (/permission|insufficient permissions/i.test(msg.text())) errosPermissao.push(msg.text());
    });

    await loginAs(
      page,
      { email: TEST_USERS.clinicUserA.email, password: TEST_PASSWORD },
      '/clinic/dashboard'
    );

    // J.1/J.2
    await page.goto(`/clinic/requests/${idG}`);
    const detalhes = cardPorTitulo(page, 'Detalhes do Procedimento');
    await expect(detalhes.getByText('60 min', { exact: true })).toBeVisible();
    await expect(detalhes.getByText('Pix/Dinheiro', { exact: true })).toBeVisible();
    await expect(cardPorTitulo(page, 'Produtos Consumidos')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Preço sugerido' })).toHaveCount(0);
    await expect(page.getByText('Estimativa atual')).toHaveCount(0);

    // J.3 — a tela nem tenta ler financeiro/precificacao (nenhum erro de permissão no console)
    expect(errosPermissao).toEqual([]);

    // J.4 — rules (get e list), com controle positivo do clinic_admin A
    const doc = `tenants/${TENANT_A}/precificacao_procedimentos/${idG}`;
    const colecao = `tenants/${TENANT_A}/precificacao_procedimentos`;
    expect(await statusLeitura(await idToken(TEST_USERS.clinicAdminA.email), doc)).toBe(200);
    for (const email of [
      TEST_USERS.clinicUserA.email,
      TEST_USERS.clinicAdminB.email,
      TEST_USERS.consultant.email,
    ]) {
      const token = await idToken(email);
      expect(await statusLeitura(token, doc), `get como ${email}`).toBe(403);
      expect(await statusLeitura(token, colecao), `list como ${email}`).toBe(403);
    }
    // Consultor COM opt-in financeiro continua sem acesso ao snapshot.
    try {
      await custoHoraRef(TENANT_A).update({
        compartilhar_com_consultor: true,
        compartilhado_com_consultant_id: TEST_USERS.consultant.uid,
      });
      const token = await idToken(TEST_USERS.consultant.email);
      expect(await statusLeitura(token, `tenants/${TENANT_A}/financeiro/custo_hora`)).toBe(200);
      expect(await statusLeitura(token, doc)).toBe(403);
      expect(await statusLeitura(token, colecao)).toBe(403);
    } finally {
      await custoHoraRef(TENANT_A).update({
        compartilhar_com_consultor: false,
        compartilhado_com_consultant_id: null,
      });
    }

    // J.5
    await page.goto('/clinic/requests/new');
    await expect(page).toHaveURL(/\/clinic\/requests$/);
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro K — sem configuração de custos: CTA "Configurar custos fixos", nenhum snapshot gravado; após restaurar, o detalhe mostra "Estimativa atual"', async ({
    page,
  }) => {
    const backup = (await custoHoraRef(TENANT_A).get()).data()!;
    let id: string | undefined;
    try {
      // K.1
      await custoHoraRef(TENANT_A).delete();

      // K.2
      await loginClinicAdminA(page);
      await page.goto('/clinic/requests/new');
      await esperarInventarioCarregado(page);
      await aplicarProtocolo(page, PROTOCOLOS.p1.nome);
      await page.locator('#dt-procedimento').fill('2026-10-21');
      await expect(page.locator('#duracao')).toHaveValue('60');
      const bloco = cardPorTitulo(page, 'Preço sugerido');
      await expect(
        bloco.getByText(/Configure seus custos fixos para ver o preço sugerido/)
      ).toBeVisible();
      await expect(bloco).toContainText(/Material: R\$\s*200[.,]00/);
      await expect(bloco.getByRole('button', { name: 'Configurar custos fixos' })).toBeVisible();
      await expect(page.getByTestId('preco-pix_dinheiro')).toHaveCount(0);

      // K.3
      id = await confirmarProcedimento(page);
      await expect(
        page.getByText('Procedimento salvo, mas a precificação não foi registrada')
      ).toHaveCount(0);
      const sol = (await db().doc(`tenants/${TENANT_A}/solicitacoes/${id}`).get()).data()!;
      expect(sol.duracao_minutos).toBe(60);
      expect(sol.forma_pagamento).toBe('pix_dinheiro');
      expect(
        (await db().doc(`tenants/${TENANT_A}/precificacao_procedimentos/${id}`).get()).exists
      ).toBe(false);

      // K.4 — detalhe com o CTA e o material
      const card = cardPorTitulo(page, 'Preço sugerido');
      await expect(
        card.getByText(/Configure seus custos fixos para ver o preço sugerido/)
      ).toBeVisible();
      await expect(card).toContainText(brlContido('200,00'));
      await expect(page.getByTestId('preco-pix_dinheiro')).toHaveCount(0);
      await card.getByRole('button', { name: 'Configurar custos fixos' }).click();
      await expect(page).toHaveURL(/\/clinic\/my-clinic\?tab=fixed_costs/);

      // K.5 — restaura e recarrega o detalhe
      await custoHoraRef(TENANT_A).set(backup);
      await page.goto(`/clinic/requests/${id}`);
      const card2 = cardPorTitulo(page, 'Preço sugerido');
      await expect(card2.getByText('Estimativa atual')).toBeVisible();
      await esperarPrecos(
        page,
        { pix: '551,66', debito: '569,45', credito: '588,44' },
        'pix_dinheiro',
        'Forma registrada'
      );
    } finally {
      await custoHoraRef(TENANT_A).set(backup);
      // K.6 — libera a reserva de L1
      if (id) await cancelarProcedimento(page, id);
    }
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro L — markup legado (cartao_pct) é lido como débito = crédito = cartão e regravado no formato v1.3 sem cartao_pct (RN-21)', async ({
    page,
  }) => {
    // L.1
    const l1 = (await db().doc(`tenants/${TENANT_A}/inventory/${LOTES.l1}`).get()).data()!;
    expect(l1.quantidade_disponivel).toBe(10);
    const backup = (await custoHoraRef(TENANT_A).get()).data()!;
    try {
      await custoHoraRef(TENANT_A).update({
        markup: { imposto_pct: 6, cartao_pct: 3, comissao_pct: 0, margem_pct: 30 },
      });

      // L.2
      await loginClinicAdminA(page);
      await abrirCustosFixos(page);
      await expect(page.locator('#markup-debito_pct')).toHaveValue('3');
      await expect(page.locator('#markup-credito_pct')).toHaveValue('3');
      await expect(divisor(page, 'Pix/Dinheiro')).toHaveText('0,64');
      await expect(divisor(page, 'Débito')).toHaveText('0,61');
      await expect(divisor(page, 'Crédito')).toHaveText('0,61');

      // L.3
      await page.goto('/clinic/protocolos');
      const p1 = cardPorTitulo(page, PROTOCOLOS.p1.nome);
      await expect(valor(p1, 'Preço Pix/Dinheiro')).toHaveText(brl('598,53'));
      await expect(valor(p1, 'Preço Crédito')).toHaveText(brl('627,97'));

      // L.4
      await abrirCustosFixos(page);
      await expect(page.locator('#markup-debito_pct')).toHaveValue('3');
      await salvarCustos(page);
      const doc = await lerCustoHora();
      expect(doc.markup).toEqual({
        imposto_pct: 6,
        debito_pct: 3,
        credito_pct: 3,
        comissao_pct: 0,
        margem_pct: 30,
      });
    } finally {
      await custoHoraRef(TENANT_A).set(backup);
    }
  });

  // ------------------------------------------------------------------------------------------
  test('Roteiro M — o mês de referência é o da data do procedimento (D12): novembro/2026 usa 184 h; 01/11 não cai em outubro (RN-31)', async ({
    page,
  }) => {
    await loginClinicAdminA(page);
    await page.goto('/clinic/requests/new');
    await esperarInventarioCarregado(page);

    // M.1/M.2
    await page.locator('#dt-procedimento').fill('2026-11-05');
    await aplicarProtocolo(page, PROTOCOLOS.p1.nome);
    const bloco = cardPorTitulo(page, 'Preço sugerido');
    await expect(bloco.getByText(/custos de novembro\/2026/)).toBeVisible();
    await expect(valor(bloco, 'Hora clínica')).toHaveText(brl('163,04'));
    await expect(valor(bloco, 'Material')).toHaveText(brl('200,00'));
    await expect(valor(bloco, 'Custo real')).toHaveText(brl('363,04'));
    await esperarPrecos(
      page,
      { pix: '567,26', debito: '585,55', credito: '605,07' },
      'pix_dinheiro',
      'Forma escolhida'
    );

    // M.3
    await page.locator('#dt-procedimento').fill('2026-10-20');
    await expect(bloco.getByText(/custos de outubro\/2026/)).toBeVisible();
    await expect(valor(bloco, 'Hora clínica')).toHaveText(brl('153,06'));
    await expect(page.getByTestId('preco-pix_dinheiro')).toContainText(brlContido('551,66'));
    await page.locator('#dt-procedimento').fill('2026-11-01');
    await expect(bloco.getByText(/custos de novembro\/2026/)).toBeVisible();
    await expect(valor(bloco, 'Hora clínica')).toHaveText(brl('163,04'));

    // M.4
    const id = await confirmarProcedimento(page);
    try {
      const snap = (
        await db().doc(`tenants/${TENANT_A}/precificacao_procedimentos/${id}`).get()
      ).data()!;
      expect(snap.mes_referencia).toBe('2026-11');
      expect(snap.custo_hora).toBeCloseTo(163.0435, 3);
      expect(snap.precos_sugeridos.pix_dinheiro).toBeCloseTo(567.2554, 3);
      expect(snap.precos_sugeridos.debito).toBeCloseTo(585.554, 3);
      expect(snap.precos_sugeridos.credito).toBeCloseTo(605.0725, 3);
      await expect(
        cardPorTitulo(page, 'Preço sugerido').getByText(/com os custos de novembro\/2026/)
      ).toBeVisible();
    } finally {
      // M.5
      await cancelarProcedimento(page, id);
    }
  });
});
