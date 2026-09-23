import { test, expect, Page } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import {
  TEST_PASSWORD,
  TEST_TENANTS,
  TEST_USERS,
  TEST_LEGAL_DOCUMENTS,
} from './fixtures/seed-data';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Cobertura retroativa (Modo B) de:
 * - ONLY_FOR_DEVS/PO_BA_Docs/UC-52-consultar-projecao-de-reposicao-de-estoque.md (v1.1, Aprovado)
 * - ONLY_FOR_DEVS/TO_DO/FEAT-projecao-reposicao-estoque.md (v1.2, Em execução) — Seções 6/7/9
 *
 * Cobre: Fluxo Principal (passos 1-6, clínica e Consultor), Fluxo Alternativo 7a (produto com
 * dados insuficientes mesmo na janela mais longa), Fluxo Alternativo 7b (nenhum produto com
 * projeção próxima → card do Dashboard em estado vazio) e Fluxo Alternativo 7c (Consultor
 * tentando acessar uma clínica não vinculada). RN-03/RN-04/RN-05/RN-09/RF-06/RF-07/RF-08 são
 * exercitadas diretamente pelas asserções abaixo.
 *
 * ============================================================================================
 * ACHADO CRÍTICO — ENCONTRADO PELO qa-agent E JÁ CORRIGIDO (commit 3137a42) ANTES DESTE SPEC
 * SER EXECUTADO CONTRA O EMULADOR PELA PRIMEIRA VEZ:
 * ============================================================================================
 * `src/lib/services/projectionService.ts`, dentro de `getReplenishmentProjections()`, lia
 * `produto.codigo_produto` para indexar os eventos de consumo de cada `Solicitacao concluida`,
 * mas o campo REAL gravado em cada item de `produtos_solicitados` é `produto_codigo`, não
 * `codigo_produto` — confirmado em `src/types/index.ts` (`ProdutoSolicitado.produto_codigo`) e
 * em `solicitacaoService.ts` (`buildProdutosDetalhados`). Sem a correção, `eventsByCodigo`
 * nunca era populado com a chave certa e TODO produto aparecia sempre como "Dados insuficientes
 * para projeção", mesmo com histórico de consumo real abundante. O mesmo engano pré-existe,
 * fora do escopo desta branch, em `src/lib/services/reportService.ts`
 * (`generateConsumptionReport`, UC-47) — não corrigido aqui.
 * Todos os 5 testes deste arquivo, incluindo "produto com consumo suficiente..." (que exercita
 * o Fluxo Principal completo, RN-01/RN-02/RN-03/RF-02), passam contra o código já corrigido.
 *
 * Assunções assumidas nesta rodada (Modo B, passo 3 do guia do agente — confirmar com o
 * revisor humano):
 *
 * 1. `tests/e2e/fixtures/seed-data.ts`/`scripts/seed-emulator.ts` não semeiam nenhum item de
 *    `inventory` nem nenhuma `Solicitacao` para nenhum tenant — só usuários/tenants/documentos
 *    legais. Como este é o primeiro spec E2E a exercitar telas de inventário/consumo, cada teste
 *    abaixo semeia e remove (via Admin SDK, `try/finally`) seus próprios documentos em
 *    `tenants/test-clinic-a/inventory` e `tenants/test-clinic-a/solicitacoes`, com `codigo_produto`
 *    únicos por teste — mesma técnica de "grava/restaura via Admin SDK dentro do teste" já usada
 *    em UC-04 (`withTemporaryClaims`/`withTenantActive`) e UC-09 (`withTemporaryTermsAcceptance`,
 *    replicada aqui para o Consultor). Nenhum usuário novo foi inventado — todos os cenários
 *    usam só `clinicAdminA`/`consultant` já existentes em `TEST_USERS`.
 * 2. `clinicAdminA` já tem aceite dos dois documentos legais no seed (`scripts/seed-emulator.ts`),
 *    então `loginAs` (`tests/e2e/helpers/auth.ts`) funciona direto para ele. `consultant` NÃO tem
 *    nenhum aceite no seed (de propósito, ver comentário do próprio `seed-emulator.ts`) e
 *    `loginAs` não aceita `/consultant/dashboard` como destino — por isso os testes de Consultor
 *    usam `submitLoginForm` + `withTemporaryTermsAcceptance` local, réplica exata da técnica já
 *    documentada e usada em `tests/e2e/UC-04-fazer-login-com-redirecionamento-por-papel.spec.ts`.
 * 3. `tests/e2e/fixtures/seed-data.ts` só vincula `test-clinic-a` ao consultor
 *    (`authorized_tenants: [TEST_TENANTS.clinicA.tenant_id]`) — `test-clinic-b` é usado como o
 *    tenant "não autorizado" no teste do Fluxo Alternativo 7c, sem precisar de nenhum tenant novo.
 * 4. `playwright.config.ts` roda com `fullyParallel: false`/`workers: 1` e o emulador é semeado
 *    uma única vez para toda a suíte — os testes abaixo limpam (`.delete()`) tudo que criam no
 *    `finally`, para não vazar dados de inventário/consumo para specs futuros que também usem
 *    `test-clinic-a`.
 */

async function submitLoginForm(
  page: Page,
  credentials: { email: string; password: string }
): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/**
 * Concede aceite temporário dos dois documentos legais do seed ao Consultor (que não tem
 * nenhum aceite gravado por padrão em `scripts/seed-emulator.ts`) e revoga ao final — evita que
 * `TermsInterceptor` desvie o teste para `/accept-terms` antes das asserções deste UC. Réplica
 * exata da técnica em `tests/e2e/UC-04-fazer-login-com-redirecionamento-por-papel.spec.ts`.
 */
async function withTemporaryTermsAcceptance<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  const db = getEmulatorAdminFirestore();
  const now = Timestamp.now();
  const legalDocs = Object.values(TEST_LEGAL_DOCUMENTS);
  const refs = legalDocs.map((legalDoc) =>
    db.collection('user_document_acceptances').doc(`${uid}_${legalDoc.id}`)
  );
  for (let i = 0; i < refs.length; i++) {
    await refs[i].set({
      user_id: uid,
      document_id: legalDocs[i].id,
      document_version: '1.0',
      accepted_at: now,
    });
  }
  try {
    return await fn();
  } finally {
    for (const ref of refs) await ref.delete();
  }
}

/** Data `n` dias atrás, para popular `dt_procedimento` de `Solicitacao` de teste. */
function daysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date;
}

/**
 * Cria um item de `tenants/{tenantId}/inventory` fiel ao schema real gravado por
 * `src/lib/services/inventoryService.ts` (`dt_validade` como Timestamp, não string — ver
 * `InventoryItem.dt_validade` no orquestrador). Retorna o `DocumentReference` para cleanup.
 */
async function seedInventoryItem(
  tenantId: string,
  params: { codigo_produto: string; nome_produto: string; quantidade_disponivel: number }
) {
  const db = getEmulatorAdminFirestore();
  const now = Timestamp.now();
  const ref = db.collection(`tenants/${tenantId}/inventory`).doc();
  await ref.set({
    tenant_id: tenantId,
    codigo_produto: params.codigo_produto,
    nome_produto: params.nome_produto,
    lote: 'LOTE-QA-UC52',
    quantidade_inicial: params.quantidade_disponivel,
    quantidade_disponivel: params.quantidade_disponivel,
    quantidade_reservada: 0,
    dt_validade: Timestamp.fromDate(new Date('2027-12-31T00:00:00Z')),
    valor_unitario: 100,
    nf_numero: 'QA-NF-UC52',
    active: true,
    created_at: now,
    updated_at: now,
  });
  return ref;
}

/**
 * Cria uma `Solicitacao` com `status: 'concluida'`, fiel ao schema gravado por
 * `buildProdutosDetalhados` (`src/lib/services/solicitacaoService.ts`) — em particular,
 * `produto_codigo` (não `codigo_produto`, ver ACHADO CRÍTICO no cabeçalho do arquivo).
 */
async function seedSolicitacaoConcluida(
  tenantId: string,
  params: {
    dtProcedimento: Date;
    produtoCodigo: string;
    produtoNome: string;
    quantidade: number;
    inventoryItemId: string;
  }
) {
  const db = getEmulatorAdminFirestore();
  const now = Timestamp.now();
  const ref = db.collection(`tenants/${tenantId}/solicitacoes`).doc();
  await ref.set({
    tenant_id: tenantId,
    tipo: 'efetuado',
    dt_procedimento: Timestamp.fromDate(params.dtProcedimento),
    produtos_solicitados: [
      {
        inventory_item_id: params.inventoryItemId,
        produto_codigo: params.produtoCodigo,
        produto_nome: params.produtoNome,
        lote: 'LOTE-QA-UC52',
        quantidade: params.quantidade,
        quantidade_disponivel_antes: 999,
        valor_unitario: 100,
      },
    ],
    status: 'concluida',
    created_by: TEST_USERS.clinicAdminA.uid,
    created_by_name: TEST_USERS.clinicAdminA.name,
    created_at: now,
    updated_at: now,
  });
  return ref;
}

test.describe('UC-52 — Consultar Projeção de Reposição de Estoque', () => {
  test.describe('Fluxo Principal (Dashboard/entrada) + Alternativos 7a/7b — Clínica', () => {
    test('produto sem nenhum histórico de consumo aparece como "Dados insuficientes para projeção" na tela "Projeções Gerais" (7a), acessível pelo botão "Ver Projeções" em Gerenciar Estoque (RF-08); o card do Dashboard permanece no estado vazio (7b) enquanto não houver produto com projeção calculada', async ({
      page,
    }) => {
      const codigo = 'QA-PROJ-INSUF-001';
      const nome = 'Ácido Hialurônico QA (sem histórico)';
      const itemRef = await seedInventoryItem(TEST_TENANTS.clinicA.tenant_id, {
        codigo_produto: codigo,
        nome_produto: nome,
        quantidade_disponivel: 50,
      });

      try {
        await loginAs(
          page,
          { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
          '/clinic/dashboard'
        );

        // Fluxo Alternativo 7b: sem nenhum produto com projeção calculada nos próximos 30
        // dias, o card "Projeção de Reposição" fica no estado vazio — sem contagem, sem botão.
        await expect(page.getByRole('heading', { name: 'Projeção de Reposição' })).toBeVisible();
        await expect(
          page.getByText('Nenhum produto com previsão de reposição próxima')
        ).toBeVisible({ timeout: 15000 });

        // RF-08: ponto de entrada real a partir de "Gerenciar Estoque" (independente do card
        // do Dashboard, que nesta rodada não tem botão por estar em 7b).
        await page.goto('/clinic/inventory');
        await expect(page.getByRole('heading', { name: 'Gerenciar Estoque' })).toBeVisible();
        await page.getByRole('button', { name: 'Ver Projeções' }).click();
        await expect(page).toHaveURL(/\/clinic\/inventory\/projections/);
        await expect(page.getByRole('heading', { name: 'Projeções Gerais' })).toBeVisible();

        // RN-04/RF-07: aviso de estimativa sempre visível, independente do estado dos dados.
        await expect(page.getByText('Isto é uma estimativa')).toBeVisible();
        await expect(
          page.getByText(/Estimativa baseada no histórico de consumo real/)
        ).toBeVisible();

        // Fluxo Alternativo 7a: produto sem nenhum evento de consumo -> "Dados insuficientes
        // para projeção", nunca uma data inventada (RF-06).
        const row = page.getByRole('row', { name: new RegExp(codigo) });
        await expect(row).toContainText(nome);
        await expect(row).toContainText('Dados insuficientes para projeção');

        // "Voltar" retorna para /clinic/inventory (mesmo padrão de InventoryView/audit).
        await page.getByRole('button', { name: 'Voltar' }).click();
        await expect(page).toHaveURL(/\/clinic\/inventory$/);
      } finally {
        await itemRef.delete();
      }
    });

    test('produto com apenas 1 data distinta de consumo nos últimos 90 dias continua "Dados insuficientes" (RN-03: critério exige ao menos 2 datas de calendário distintas por janela)', async ({
      page,
    }) => {
      const codigo = 'QA-PROJ-1DATA-001';
      const nome = 'Preenchedor QA (1 evento de consumo)';
      const itemRef = await seedInventoryItem(TEST_TENANTS.clinicA.tenant_id, {
        codigo_produto: codigo,
        nome_produto: nome,
        quantidade_disponivel: 20,
      });
      const solicitacaoRef = await seedSolicitacaoConcluida(TEST_TENANTS.clinicA.tenant_id, {
        dtProcedimento: daysAgo(5),
        produtoCodigo: codigo,
        produtoNome: nome,
        quantidade: 3,
        inventoryItemId: itemRef.id,
      });

      try {
        await loginAs(
          page,
          { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
          '/clinic/dashboard'
        );
        await page.goto('/clinic/inventory/projections');
        await expect(page.getByRole('heading', { name: 'Projeções Gerais' })).toBeVisible();

        const row = page.getByRole('row', { name: new RegExp(codigo) });
        await expect(row).toContainText('Dados insuficientes para projeção');
      } finally {
        await solicitacaoRef.delete();
        await itemRef.delete();
      }
    });
  });

  test.describe('Fluxo Principal — Clínica, produto com consumo suficiente (data estimada real)', () => {
    test('produto com >= 2 datas distintas de consumo concluído nos últimos 30 dias recebe data estimada de esgotamento e é contado no card "Projeção de Reposição" do Dashboard, que leva à tela detalhada (passos 2-6)', async ({
      page,
    }) => {
      const codigo = 'QA-PROJ-CALC-001';
      const nome = 'Toxina Botulínica QA (com histórico suficiente)';
      // quantidade_disponivel=4, consumo total=12 em 30 dias -> taxa=0,4/dia ->
      // esgota em ceil(4/0,4)=10 dias -> dentro do horizonte de destaque (30 dias, RF-02/RF-03)
      // e dentro da 1ª janela da cascata (30 dias, RN-03), então janela_usada_dias deve ser 30.
      const itemRef = await seedInventoryItem(TEST_TENANTS.clinicA.tenant_id, {
        codigo_produto: codigo,
        nome_produto: nome,
        quantidade_disponivel: 4,
      });
      const solicitacao1 = await seedSolicitacaoConcluida(TEST_TENANTS.clinicA.tenant_id, {
        dtProcedimento: daysAgo(5),
        produtoCodigo: codigo,
        produtoNome: nome,
        quantidade: 6,
        inventoryItemId: itemRef.id,
      });
      const solicitacao2 = await seedSolicitacaoConcluida(TEST_TENANTS.clinicA.tenant_id, {
        dtProcedimento: daysAgo(12),
        produtoCodigo: codigo,
        produtoNome: nome,
        quantidade: 6,
        inventoryItemId: itemRef.id,
      });

      try {
        await loginAs(
          page,
          { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
          '/clinic/dashboard'
        );

        // Fluxo Principal, passo 3: card mostra contagem >= 1 e o botão "Ver Projeções".
        await expect(page.getByRole('heading', { name: 'Projeção de Reposição' })).toBeVisible();
        await expect(
          page.getByText(/produtos? com previsão de esgotar em até 30 dias/)
        ).toBeVisible({ timeout: 15000 });

        // Passos 4-5: clique no card navega para a tela detalhada.
        await page.getByRole('button', { name: 'Ver Projeções' }).click();
        await expect(page).toHaveURL(/\/clinic\/inventory\/projections/);

        // Passo 6: linha do produto com data estimada real (não "Dados insuficientes") e a
        // janela de histórico usada (RN-04) — cascata deve escolher 30 dias (RN-03).
        const row = page.getByRole('row', { name: new RegExp(codigo) });
        await expect(row).not.toContainText('Dados insuficientes para projeção');
        await expect(row).toContainText(/\d+,\d{2}\s*un\.\/dia/);
        await expect(row).toContainText(/\d{2}\/\d{2}\/\d{4}/);
        await expect(row).toContainText('30 dias');
      } finally {
        await solicitacao1.delete();
        await solicitacao2.delete();
        await itemRef.delete();
      }
    });
  });

  test.describe('Fluxo Principal — Consultor (RN-09: mesma informação completa da clínica)', () => {
    test('Consultor vinculado vê a mesma tela "Projeções Gerais" que a clínica veria para o mesmo tenant, incluindo produtos com dados insuficientes', async ({
      page,
    }) => {
      const codigo = 'QA-PROJ-CONSULTOR-001';
      const nome = 'Fio de PDO QA (visão do Consultor)';
      const itemRef = await seedInventoryItem(TEST_TENANTS.clinicA.tenant_id, {
        codigo_produto: codigo,
        nome_produto: nome,
        quantidade_disponivel: 15,
      });

      try {
        await withTemporaryTermsAcceptance(TEST_USERS.consultant.uid, async () => {
          await submitLoginForm(page, {
            email: TEST_USERS.consultant.email,
            password: TEST_PASSWORD,
          });
          await expect(page).toHaveURL(/\/consultant\/dashboard/);

          // Ponto de entrada: detalhe da clínica vinculada (UC-48) -> Quick Action "Ver
          // Projeções" (RF-08).
          await page.goto(`/consultant/clinics/${TEST_TENANTS.clinicA.tenant_id}`);
          const viewProjectionsButton = page.getByRole('button', { name: 'Ver Projeções' });
          await expect(viewProjectionsButton).toBeVisible({ timeout: 15000 });
          await viewProjectionsButton.click();

          await expect(page).toHaveURL(
            new RegExp(`/consultant/clinics/${TEST_TENANTS.clinicA.tenant_id}/projections`)
          );
          await expect(page.getByRole('heading', { name: 'Projeções Gerais' })).toBeVisible();

          // RN-09: mesma informação completa (código, produto, quantidade, estado da
          // projeção) que a clínica veria para o mesmo item — nenhuma versão resumida.
          const row = page.getByRole('row', { name: new RegExp(codigo) });
          await expect(row).toContainText(nome);
          await expect(row).toContainText('15'); // quantidade_disponivel_total
          await expect(row).toContainText('Dados insuficientes para projeção');
        });
      } finally {
        await itemRef.delete();
      }
    });
  });

  test.describe('Fluxo Alternativo 7c — Consultor sem acesso ao tenant', () => {
    test('Consultor tenta acessar /consultant/clinics/{tenantId}/projections de uma clínica NÃO vinculada e é redirecionado para /consultant/clinics, sem carregar nenhum dado da clínica', async ({
      page,
    }) => {
      await withTemporaryTermsAcceptance(TEST_USERS.consultant.uid, async () => {
        await submitLoginForm(page, {
          email: TEST_USERS.consultant.email,
          password: TEST_PASSWORD,
        });
        await expect(page).toHaveURL(/\/consultant\/dashboard/);

        // test-clinic-b NÃO está em authorized_tenants do consultor
        // (tests/e2e/fixtures/seed-data.ts) — só test-clinic-a está vinculado (RN-08/UC-48).
        await page.goto(`/consultant/clinics/${TEST_TENANTS.clinicB.tenant_id}/projections`);
        await expect(page).toHaveURL(/\/consultant\/clinics$/);
      });
    });
  });
});
