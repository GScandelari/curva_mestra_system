import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_TENANTS, TEST_USERS } from './fixtures/seed-data';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Cobertura (Modo A, a partir de `ONLY_FOR_DEVS/TO_DO/FEAT-relatorios-gerenciais-custeio-procedimento.md`,
 * v1.0, Seções 6/7, Steps 1-6 já commitados na branch `feature/uc51-custeio-procedimento-historico-lote`)
 * de:
 * - `ONLY_FOR_DEVS/PO_BA_Docs/UC-51-gerar-relatorios-gerenciais-avancados-e-custeio-por-procedimento.md`
 *   (v1.1, Aprovado) — Fluxo Principal (Custo por Procedimento) e Fluxo Alternativo 7a
 *   (Histórico do Lote).
 *
 * ESCOPO DESTA RODADA (Branch A): **NÃO cobre** os Fluxos Alternativos 7b (Fechamento Executivo
 * Mensal) nem 7c (Mix de Produtos por Trimestre) — dependem de `jspdf`/`jspdf-autotable`, ainda
 * não instalados (Branch B, Step 8 em diante, ainda não criada). Este spec será estendido quando
 * a Branch B existir (mesmo arquivo, conforme `FEAT-...md` Seção 5.1).
 *
 * Cobre: gating `clinic_admin` vs. `clinic_user` (RF-10), Custo por Procedimento com produto de
 * lote único (RN-01) e multi-lote (RN-02, com expansão de detalhamento por lote), Histórico do
 * Lote via seleção manual (RF-05) e via ponto de entrada a partir de `/clinic/inventory/{id}`
 * (RF-06), e estado vazio do Histórico do Lote (RF-12).
 *
 * ============================================================================================
 * ACHADO — já corrigido antes deste spec ser finalizado:
 * ============================================================================================
 * RN-02 do UC-51 define `custo_unitario_medio` (ex.: lote A 10un R$5 + lote B 2un R$8 -> custo
 * total R$66, custo médio ponderado R$5,50) como o cálculo central que justifica este UC. O
 * `qa-agent` encontrou, ao gerar a primeira versão deste spec, que o campo
 * `ProductCostSummary.custo_unitario_medio` (já calculado corretamente por `costingService.ts`,
 * coberto por `src/__tests__/costingService.test.ts`) não era renderizado em nenhum lugar da UI
 * — nem na tabela "Custo por Procedimento", nem no export Excel, nem no detalhamento expandido
 * por lote (que só mostrava o valor unitário de cada lote individualmente). O revisor humano
 * (usuário) confirmou que deveria ser exibido; foi adicionada a coluna "Custo Unitário Médio"
 * entre "Custo Total" e "Ticket Médio de Custo" na tabela e no export Excel. Os testes abaixo já
 * refletem essa coluna nova (índice 7) e confirmam explicitamente que R$5,50 aparece em tela no
 * cenário multi-lote (RN-02).
 *
 * Assunções assumidas nesta rodada (a confirmar com o revisor humano):
 * 1. `tests/e2e/fixtures/seed-data.ts`/`scripts/seed-emulator.ts` não semeiam nenhum item de
 *    `inventory` nem nenhuma `Solicitacao` — cada teste abaixo semeia e remove (via Admin SDK,
 *    `try/finally`) seus próprios documentos em `tenants/test-clinic-a/inventory` e
 *    `tenants/test-clinic-a/solicitacoes`, com `codigo_produto` únicos por teste, mesma técnica
 *    já usada em `tests/e2e/UC-52-consultar-projecao-de-reposicao-de-estoque.spec.ts`. Nenhum
 *    usuário novo foi inventado — todos os cenários usam `clinicAdminA`/`clinicUserA` já
 *    existentes em `TEST_USERS`.
 * 2. Os campos de `ProdutoSolicitado` usados no seed são `produto_codigo`/`produto_nome` (não
 *    `codigo_produto`/`nome_produto`), conforme `src/types/index.ts` e o precedente documentado
 *    no cabeçalho do spec de UC-52 — `getConsumptionRecords` (`costingService.ts`) já lê os
 *    nomes corretos, confirmado por leitura direta do código antes de escrever este spec.
 * 3. Os testes que preenchem "Data Início"/"Data Fim" usam uma janela folgada
 *    (20 dias atrás até amanhã) para evitar falsos negativos por truncamento de fuso horário
 *    entre o `Date` gerado no teste (Node) e o `<input type="date">` (sempre UTC/meia-noite).
 * 4. `playwright.config.ts` roda com `fullyParallel: false`/`workers: 1` — os testes abaixo
 *    limpam tudo que criam no `finally`, para não vazar dados entre testes/specs que também
 *    usem `test-clinic-a`.
 */

/** Data `n` dias atrás (ou à frente, se negativo), para `dt_procedimento`/`dt_entrada` de teste. */
function daysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date;
}

/** Formato `YYYY-MM-DD` esperado por `<input type="date">`. */
function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** Mesmo formato usado pela UI (`date.toLocaleDateString('pt-BR')`) para montar expectativas. */
function formatBR(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

const PERIODO_INICIO = isoDate(daysAgo(20));
const PERIODO_FIM = isoDate(daysAgo(-1)); // "amanhã" -- folga proposital contra fuso horário

/**
 * Cria um item de `tenants/{tenantId}/inventory` fiel ao schema real gravado por
 * `src/lib/services/inventoryService.ts`.
 */
async function seedInventoryItem(
  tenantId: string,
  params: {
    codigo_produto: string;
    nome_produto: string;
    lote: string;
    quantidade_inicial: number;
    valor_unitario: number;
    dt_entrada?: Date;
  }
) {
  const db = getEmulatorAdminFirestore();
  const now = Timestamp.now();
  const ref = db.collection(`tenants/${tenantId}/inventory`).doc();
  await ref.set({
    tenant_id: tenantId,
    produto_id: `produto-${params.codigo_produto}`,
    codigo_produto: params.codigo_produto,
    nome_produto: params.nome_produto,
    lote: params.lote,
    quantidade_inicial: params.quantidade_inicial,
    quantidade_disponivel: params.quantidade_inicial,
    quantidade_reservada: 0,
    dt_validade: Timestamp.fromDate(new Date('2027-12-31T00:00:00Z')),
    dt_entrada: Timestamp.fromDate(params.dt_entrada ?? now.toDate()),
    valor_unitario: params.valor_unitario,
    nf_numero: 'QA-NF-UC51',
    active: true,
    created_at: now,
    updated_at: now,
  });
  return ref;
}

/**
 * Cria uma `Solicitacao` com `status: 'concluida'`, fiel ao schema gravado por
 * `buildProdutosDetalhados` (`src/lib/services/solicitacaoService.ts`) -- em particular,
 * `produto_codigo`/`produto_nome` (não `codigo_produto`/`nome_produto`).
 */
async function seedSolicitacaoConcluida(
  tenantId: string,
  params: {
    dtProcedimento: Date;
    produtoCodigo: string;
    produtoNome: string;
    lote: string;
    quantidade: number;
    valorUnitario: number;
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
        lote: params.lote,
        quantidade: params.quantidade,
        quantidade_disponivel_antes: 999,
        valor_unitario: params.valorUnitario,
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

test.describe('UC-51 — Gerar Relatórios Gerenciais Avançados e Custeio por Procedimento', () => {
  test.describe('Gating por papel (RF-10)', () => {
    test('clinic_admin vê os cards "Custo por Procedimento" e "Histórico do Lote", além dos 3 já existentes de UC-47', async ({
      page,
    }) => {
      await loginAs(
        page,
        { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
        '/clinic/dashboard'
      );
      await page.goto('/clinic/reports');

      await expect(
        page.getByRole('heading', { name: 'Valor do Estoque', exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Produtos Vencendo', exact: true })
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Consumo', exact: true })).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Custo por Procedimento', exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Histórico do Lote', exact: true })
      ).toBeVisible();
    });

    test('clinic_user NÃO vê nenhum dos 2 novos cards, mantendo acesso idêntico aos 3 já existentes de UC-47', async ({
      page,
    }) => {
      await loginAs(
        page,
        { email: TEST_USERS.clinicUserA.email, password: TEST_PASSWORD },
        '/clinic/dashboard'
      );
      await page.goto('/clinic/reports');

      await expect(
        page.getByRole('heading', { name: 'Valor do Estoque', exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Produtos Vencendo', exact: true })
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Consumo', exact: true })).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Custo por Procedimento', exact: true })
      ).toHaveCount(0);
      await expect(
        page.getByRole('heading', { name: 'Histórico do Lote', exact: true })
      ).toHaveCount(0);
    });
  });

  test.describe('Fluxo Principal — Custo por Procedimento', () => {
    test('produto com um único lote consumido no período: custo do período é a soma direta quantidade × valor_unitario (RN-01)', async ({
      page,
    }) => {
      const codigo = 'QA-CUSTO-UNICO-001';
      const nome = 'Toxina Botulínica QA (lote único)';
      const lote = 'LOTE-UNICO-QA51';

      const itemRef = await seedInventoryItem(TEST_TENANTS.clinicA.tenant_id, {
        codigo_produto: codigo,
        nome_produto: nome,
        lote,
        quantidade_inicial: 10,
        valor_unitario: 15,
      });
      // custo_total = 4 x 15 = 60,00; ticket_medio_custo = 60 / 1 procedimento = 60,00
      const solicitacaoRef = await seedSolicitacaoConcluida(TEST_TENANTS.clinicA.tenant_id, {
        dtProcedimento: daysAgo(5),
        produtoCodigo: codigo,
        produtoNome: nome,
        lote,
        quantidade: 4,
        valorUnitario: 15,
        inventoryItemId: itemRef.id,
      });

      try {
        await loginAs(
          page,
          { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
          '/clinic/dashboard'
        );
        await page.goto('/clinic/reports');

        const custoCard = page.locator(
          'div.bg-white.p-6.rounded-lg.shadow-sm.border.border-gray-200',
          { hasText: 'Custo por Procedimento' }
        );
        await custoCard.locator('input[type="date"]').nth(0).fill(PERIODO_INICIO);
        await custoCard.locator('input[type="date"]').nth(1).fill(PERIODO_FIM);
        await custoCard.getByRole('button', { name: 'Gerar Relatório' }).click();

        const panel = page.locator('div.border-2.border-indigo-200');
        await expect(
          panel.getByRole('heading', { name: 'Relatório de Custo por Procedimento' })
        ).toBeVisible({ timeout: 15000 });

        // Cards de totais do período (só nosso produto existe no período nesta rodada isolada).
        await expect(panel.locator('p.text-indigo-900')).toContainText(/60,00/);
        await expect(panel.locator('p.text-blue-900')).toContainText(/60,00/);
        await expect(panel.locator('p.text-purple-900')).toHaveText('1');

        const row = panel.getByRole('row', { name: new RegExp(codigo) });
        const cells = row.locator('td');
        await expect(cells.nth(1)).toHaveText(codigo);
        await expect(cells.nth(2)).toHaveText(nome);
        await expect(cells.nth(3)).toHaveText('Sem Categoria');
        await expect(cells.nth(4)).toHaveText('4');
        await expect(cells.nth(5)).toHaveText('1');
        await expect(cells.nth(6)).toContainText(/60,00/); // custo_total
        await expect(cells.nth(7)).toContainText(/15,00/); // custo_unitario_medio = 60 / 4
        await expect(cells.nth(8)).toContainText(/60,00/); // ticket_medio_custo = 60 / 1

        // Lote único (lotes_distintos = 1): linha não deve ter o ícone de expansão (chevron).
        await expect(cells.nth(0).locator('svg')).toHaveCount(0);
      } finally {
        await solicitacaoRef.delete();
        await itemRef.delete();
      }
    });

    test('produto com múltiplos lotes consumidos no período: custo total é a soma real por lote (RN-02), com expansão do detalhamento', async ({
      page,
    }) => {
      const codigo = 'QA-CUSTO-MULTI-001';
      const nome = 'Ácido Hialurônico QA (multi-lote)';
      const loteA = 'LOTE-A-QA51';
      const loteB = 'LOTE-B-QA51';
      const dtEntradaA = daysAgo(60);
      const dtEntradaB = daysAgo(30);

      // Exemplo numérico confirmado no UC-51 (RN-02, Seção 9 e Seção 14 item 1):
      // lote A: 10un a R$5,00 (consumidas as 10) + lote B: entrou com 10un a R$8,00 (só 2
      // consumidas) -> custo total = 10x5 + 2x8 = R$66,00; custo médio ponderado = R$66/12 =
      // R$5,50 (calculado e testado unitariamente, mas não exibido na UI -- ver cabeçalho deste
      // arquivo, seção "ACHADO").
      const itemA = await seedInventoryItem(TEST_TENANTS.clinicA.tenant_id, {
        codigo_produto: codigo,
        nome_produto: nome,
        lote: loteA,
        quantidade_inicial: 10,
        valor_unitario: 5,
        dt_entrada: dtEntradaA,
      });
      const itemB = await seedInventoryItem(TEST_TENANTS.clinicA.tenant_id, {
        codigo_produto: codigo,
        nome_produto: nome,
        lote: loteB,
        quantidade_inicial: 10,
        valor_unitario: 8,
        dt_entrada: dtEntradaB,
      });
      const solicitacaoA = await seedSolicitacaoConcluida(TEST_TENANTS.clinicA.tenant_id, {
        dtProcedimento: daysAgo(10),
        produtoCodigo: codigo,
        produtoNome: nome,
        lote: loteA,
        quantidade: 10,
        valorUnitario: 5,
        inventoryItemId: itemA.id,
      });
      const solicitacaoB = await seedSolicitacaoConcluida(TEST_TENANTS.clinicA.tenant_id, {
        dtProcedimento: daysAgo(5),
        produtoCodigo: codigo,
        produtoNome: nome,
        lote: loteB,
        quantidade: 2,
        valorUnitario: 8,
        inventoryItemId: itemB.id,
      });

      try {
        await loginAs(
          page,
          { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
          '/clinic/dashboard'
        );
        await page.goto('/clinic/reports');

        const custoCard = page.locator(
          'div.bg-white.p-6.rounded-lg.shadow-sm.border.border-gray-200',
          { hasText: 'Custo por Procedimento' }
        );
        await custoCard.locator('input[type="date"]').nth(0).fill(PERIODO_INICIO);
        await custoCard.locator('input[type="date"]').nth(1).fill(PERIODO_FIM);
        await custoCard.getByRole('button', { name: 'Gerar Relatório' }).click();

        const panel = page.locator('div.border-2.border-indigo-200');
        await expect(
          panel.getByRole('heading', { name: 'Relatório de Custo por Procedimento' })
        ).toBeVisible({ timeout: 15000 });

        // Custo Total do Período = R$66,00; Ticket Médio de Custo Geral = 66/2 procedimentos =
        // R$33,00; Total de Procedimentos = 2.
        await expect(panel.locator('p.text-indigo-900')).toContainText(/66,00/);
        await expect(panel.locator('p.text-blue-900')).toContainText(/33,00/);
        await expect(panel.locator('p.text-purple-900')).toHaveText('2');

        const row = panel.getByRole('row', { name: new RegExp(codigo) });
        const cells = row.locator('td');
        await expect(cells.nth(1)).toHaveText(codigo);
        await expect(cells.nth(2)).toHaveText(nome);
        await expect(cells.nth(4)).toHaveText('12'); // quantidade_consumida = 10 + 2
        await expect(cells.nth(5)).toHaveText('2'); // lotes_distintos
        await expect(cells.nth(6)).toContainText(/66,00/); // custo_total
        // custo_unitario_medio (RN-02) = 66 / 12 = R$5,50 -- exatamente o exemplo numérico
        // confirmado pelo usuário no UC-51, agora visível na tabela (ver "ACHADO" no cabeçalho).
        await expect(cells.nth(7)).toContainText(/5,50/);
        await expect(cells.nth(8)).toContainText(/33,00/); // ticket_medio_custo (RN-03)

        // Lote múltiplo: chevron de expansão presente.
        await expect(cells.nth(0).locator('svg')).toHaveCount(1);

        // RF-03: expandir o detalhamento por lote, em ordem cronológica de dt_entrada
        // (lote A entrou antes do lote B).
        await row.click();
        const detailRows = panel.locator('table table tbody tr');
        await expect(detailRows).toHaveCount(2);

        await expect(detailRows.nth(0)).toContainText(loteA);
        await expect(detailRows.nth(0)).toContainText('10');
        await expect(detailRows.nth(0)).toContainText(/5,00/);
        await expect(detailRows.nth(0)).toContainText(formatBR(dtEntradaA));

        await expect(detailRows.nth(1)).toContainText(loteB);
        await expect(detailRows.nth(1)).toContainText('2');
        await expect(detailRows.nth(1)).toContainText(/8,00/);
        await expect(detailRows.nth(1)).toContainText(formatBR(dtEntradaB));
      } finally {
        await solicitacaoA.delete();
        await solicitacaoB.delete();
        await itemA.delete();
        await itemB.delete();
      }
    });
  });

  test.describe('Fluxo Alternativo 7a — Histórico do Lote', () => {
    test('seleção manual (2 selects em cascata produto → lote) exibe a tabela cronológica com saldo decrescente (RF-05)', async ({
      page,
    }) => {
      const codigo = 'QA-LOTE-HIST-001';
      const nome = 'Preenchedor QA (histórico manual)';
      const lote = 'LOTE-HIST-QA51';
      const dtEvento1 = daysAgo(20);
      const dtEvento2 = daysAgo(10);

      const itemRef = await seedInventoryItem(TEST_TENANTS.clinicA.tenant_id, {
        codigo_produto: codigo,
        nome_produto: nome,
        lote,
        quantidade_inicial: 20,
        valor_unitario: 10,
      });
      // saldo após evento 1: 20 - 5 = 15; saldo após evento 2: 15 - 3 = 12
      const solicitacao1 = await seedSolicitacaoConcluida(TEST_TENANTS.clinicA.tenant_id, {
        dtProcedimento: dtEvento1,
        produtoCodigo: codigo,
        produtoNome: nome,
        lote,
        quantidade: 5,
        valorUnitario: 10,
        inventoryItemId: itemRef.id,
      });
      const solicitacao2 = await seedSolicitacaoConcluida(TEST_TENANTS.clinicA.tenant_id, {
        dtProcedimento: dtEvento2,
        produtoCodigo: codigo,
        produtoNome: nome,
        lote,
        quantidade: 3,
        valorUnitario: 10,
        inventoryItemId: itemRef.id,
      });

      try {
        await loginAs(
          page,
          { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
          '/clinic/dashboard'
        );
        await page.goto('/clinic/reports');

        const loteCard = page.locator(
          'div.bg-white.p-6.rounded-lg.shadow-sm.border.border-gray-200',
          { hasText: 'Histórico do Lote' }
        );
        const produtoSelect = loteCard.locator('select').nth(0);
        const loteSelect = loteCard.locator('select').nth(1);

        // Aguarda a lista de produtos/lotes (carregada via Firestore) antes de selecionar.
        await expect(produtoSelect.locator(`option[value="${codigo}"]`)).toHaveCount(1, {
          timeout: 15000,
        });
        await produtoSelect.selectOption({ value: codigo });
        await expect(loteSelect.locator(`option[value="${itemRef.id}"]`)).toHaveCount(1);
        await loteSelect.selectOption({ value: itemRef.id });

        await loteCard.getByRole('button', { name: 'Gerar Relatório' }).click();

        const panel = page.locator('div.border-2.border-teal-200');
        await expect(panel).toContainText(nome, { timeout: 15000 });
        await expect(panel).toContainText(lote);

        const rows = panel.locator('tbody tr');
        await expect(rows).toHaveCount(2);

        const row1Cells = rows.nth(0).locator('td');
        await expect(row1Cells.nth(0)).toContainText(formatBR(dtEvento1));
        await expect(row1Cells.nth(2)).toHaveText('5');
        await expect(row1Cells.nth(3)).toHaveText('15');

        const row2Cells = rows.nth(1).locator('td');
        await expect(row2Cells.nth(0)).toContainText(formatBR(dtEvento2));
        await expect(row2Cells.nth(2)).toHaveText('3');
        await expect(row2Cells.nth(3)).toHaveText('12');
      } finally {
        await solicitacao1.delete();
        await solicitacao2.delete();
        await itemRef.delete();
      }
    });

    test('ponto de entrada a partir de /clinic/inventory/{id}: "Ver Histórico do Lote" carrega o relatório automaticamente, sem clique adicional (RF-06)', async ({
      page,
    }) => {
      const codigo = 'QA-LOTE-ENTRY-001';
      const nome = 'Fio de PDO QA (ponto de entrada)';
      const lote = 'LOTE-ENTRY-QA51';
      const dtEvento = daysAgo(3);

      const itemRef = await seedInventoryItem(TEST_TENANTS.clinicA.tenant_id, {
        codigo_produto: codigo,
        nome_produto: nome,
        lote,
        quantidade_inicial: 8,
        valor_unitario: 12,
      });
      // saldo após o evento: 8 - 2 = 6
      const solicitacaoRef = await seedSolicitacaoConcluida(TEST_TENANTS.clinicA.tenant_id, {
        dtProcedimento: dtEvento,
        produtoCodigo: codigo,
        produtoNome: nome,
        lote,
        quantidade: 2,
        valorUnitario: 12,
        inventoryItemId: itemRef.id,
      });

      try {
        await loginAs(
          page,
          { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
          '/clinic/dashboard'
        );

        await page.goto(`/clinic/inventory/${itemRef.id}`);
        await expect(page.getByRole('heading', { name: nome })).toBeVisible();

        await page.getByRole('button', { name: 'Ver Histórico do Lote' }).click();
        await expect(page).toHaveURL(
          new RegExp(`/clinic/reports\\?report=lot-history&inventoryItemId=${itemRef.id}`)
        );

        // Carrega automaticamente -- nenhum clique em "Gerar Relatório" foi disparado aqui.
        const panel = page.locator('div.border-2.border-teal-200');
        await expect(panel).toContainText(nome, { timeout: 15000 });
        await expect(panel).toContainText(lote);

        const rows = panel.locator('tbody tr');
        await expect(rows).toHaveCount(1);
        const cells = rows.nth(0).locator('td');
        await expect(cells.nth(0)).toContainText(formatBR(dtEvento));
        await expect(cells.nth(2)).toHaveText('2');
        await expect(cells.nth(3)).toHaveText('6');
      } finally {
        await solicitacaoRef.delete();
        await itemRef.delete();
      }
    });

    test('lote sem nenhuma Solicitação concluída exibe estado vazio, não erro (RF-12)', async ({
      page,
    }) => {
      const codigo = 'QA-LOTE-VAZIO-001';
      const nome = 'Bioestimulador QA (sem consumo)';
      const lote = 'LOTE-VAZIO-QA51';

      const itemRef = await seedInventoryItem(TEST_TENANTS.clinicA.tenant_id, {
        codigo_produto: codigo,
        nome_produto: nome,
        lote,
        quantidade_inicial: 6,
        valor_unitario: 20,
      });

      try {
        await loginAs(
          page,
          { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
          '/clinic/dashboard'
        );
        await page.goto('/clinic/reports');

        const loteCard = page.locator(
          'div.bg-white.p-6.rounded-lg.shadow-sm.border.border-gray-200',
          { hasText: 'Histórico do Lote' }
        );
        const produtoSelect = loteCard.locator('select').nth(0);
        const loteSelect = loteCard.locator('select').nth(1);

        await expect(produtoSelect.locator(`option[value="${codigo}"]`)).toHaveCount(1, {
          timeout: 15000,
        });
        await produtoSelect.selectOption({ value: codigo });
        await expect(loteSelect.locator(`option[value="${itemRef.id}"]`)).toHaveCount(1);
        await loteSelect.selectOption({ value: itemRef.id });

        await loteCard.getByRole('button', { name: 'Gerar Relatório' }).click();

        const panel = page.locator('div.border-2.border-teal-200');
        await expect(panel).toContainText(nome, { timeout: 15000 });
        await expect(
          panel.getByText('Nenhum procedimento concluído consumiu este lote')
        ).toBeVisible();
        await expect(panel.locator('tbody tr')).toHaveCount(0);
      } finally {
        await itemRef.delete();
      }
    });
  });
});
