import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_TENANTS, TEST_USERS } from './fixtures/seed-data';

/**
 * Cobertura (Modo A/B) de:
 * - `ONLY_FOR_DEVS/PO_BA_Docs/UC-53-consultar-e-exportar-trilha-de-auditoria.md` (v1.0)
 * - `ONLY_FOR_DEVS/TO_DO/FEAT-trilha-de-auditoria-consultar-exportar.md` (Seção 6.3 e Step 15)
 *
 * Cenários: (1) escrita instrumentada real (edição de clínica pela UI) gera entrada visível;
 * (2) visão System Admin unificada e cross-tenant vs. Clinic Admin restrito ao próprio tenant
 * (RN-04/RNF-03); (3) filtros clínica/categoria/ação/ator (passo 7, 7c); (4) estado vazio (7a);
 * (5) tenant só com inventory_activity (7b/RN-10); (6) clinic_user bloqueado e sem menu (8b);
 * (7) exportação CSV e PDF (7d/7e/RN-07).
 *
 * Assunções (a confirmar na revisão humana):
 * 1. O seed base não contém `audit_log` nem `inventory_activity`; cada teste semeia via Admin SDK
 *    entradas com marcador único `QA-UC53-...` na descrição e as remove no `finally`, para não
 *    vazar dados entre specs (workers: 1, mesmo emulador).
 * 2. Asserções de linha são escopadas ao marcador (não a contagens absolutas), exceto os
 *    cenários 7a/7b, que pressupõem que nenhum outro spec deixa lixo em `audit_log`/
 *    `inventory_activity` das clínicas usadas.
 * 3. Nenhum usuário novo foi criado — só os de TEST_USERS.
 */

const TENANT_A = TEST_TENANTS.clinicA.tenant_id;
const TENANT_B = TEST_TENANTS.clinicB.tenant_id;

const createdRefs: DocumentReference[] = [];

async function seedAuditLog(params: {
  tenantId: string | null;
  entityType: string;
  action: string;
  descricao: string;
  actorName: string;
  secondsAgo?: number;
}) {
  const db = getEmulatorAdminFirestore();
  const ref = db.collection('audit_log').doc();
  await ref.set({
    tenant_id: params.tenantId,
    entity_type: params.entityType,
    entity_id: 'qa-entity',
    action: params.action,
    descricao: params.descricao,
    actor_id: TEST_USERS.systemAdmin.uid,
    actor_name: params.actorName,
    actor_role: 'system_admin',
    timestamp: Timestamp.fromDate(new Date(Date.now() - (params.secondsAgo ?? 5) * 1000)),
  });
  createdRefs.push(ref);
  return ref;
}

async function seedInventoryActivity(params: {
  tenantId: string;
  tipo: string;
  descricao: string;
  actorName: string;
  secondsAgo?: number;
}) {
  const db = getEmulatorAdminFirestore();
  const ref = db.collection(`tenants/${params.tenantId}/inventory_activity`).doc();
  await ref.set({
    tenant_id: params.tenantId,
    inventory_item_id: 'qa-item',
    produto_codigo: 'QA-UC53',
    produto_nome: 'Produto QA UC53',
    lote: 'LOTE-QA-UC53',
    tipo: params.tipo,
    quantidade: 1,
    quantidade_anterior: 10,
    quantidade_posterior: 9,
    descricao: params.descricao,
    solicitacao_id: 'qa-solicitacao',
    created_by: TEST_USERS.clinicAdminA.uid,
    created_by_name: params.actorName,
    timestamp: Timestamp.fromDate(new Date(Date.now() - (params.secondsAgo ?? 5) * 1000)),
  });
  createdRefs.push(ref);
  return ref;
}

test.afterEach(async () => {
  const refs = createdRefs.splice(0, createdRefs.length);
  await Promise.all(refs.map((ref) => ref.delete().catch(() => undefined)));
});

async function loginSystemAdmin(page: Page) {
  await loginAs(
    page,
    { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
    '/admin/dashboard'
  );
}

async function loginClinicAdmin(
  page: Page,
  user: typeof TEST_USERS.clinicAdminA | typeof TEST_USERS.clinicAdminB
) {
  await loginAs(page, { email: user.email, password: TEST_PASSWORD }, '/clinic/dashboard');
}

/** Linhas da tabela cuja descrição contém o marcador informado. */
function rowsWith(page: Page, text: string) {
  return page.getByTestId('audit-log-row').filter({ hasText: text });
}

test.describe('UC-53 — Consultar e Exportar Trilha de Auditoria', () => {
  // Next dev compila rotas sob demanda; a primeira visita às telas de auditoria é lenta.
  test.setTimeout(90_000);

  test.describe('Cenário 1 — escrita instrumentada real gera entrada visível', () => {
    test('system_admin edita dados cadastrais da clínica pela UI e a entrada aparece em /admin/audit-log (RN-02/RN-06)', async ({
      page,
    }) => {
      const db = getEmulatorAdminFirestore();
      const tenantRef = db.doc(`tenants/${TENANT_A}`);
      const originalName = TEST_TENANTS.clinicA.name;
      const novoNome = `${originalName} QA-UC53-EDIT`;

      try {
        await loginSystemAdmin(page);
        await page.goto(`/admin/tenants/${TENANT_A}`);

        await expect(page.locator('#name')).toHaveValue(originalName);
        await page.locator('#name').fill(novoNome);
        await page.getByRole('button', { name: 'Salvar Alterações' }).click();
        await expect(page.getByText('Clínica atualizada com sucesso!')).toBeVisible();

        // Asserção via Admin SDK: entrada gravada com o ator verificado (RNF-01).
        await expect
          .poll(
            async () => {
              const snap = await db
                .collection('audit_log')
                .where('entity_id', '==', TENANT_A)
                .where('actor_id', '==', TEST_USERS.systemAdmin.uid)
                .get();
              snap.docs.forEach((d) => createdRefs.push(d.ref));
              return snap.size;
            },
            { timeout: 15000 }
          )
          .toBeGreaterThan(0);
        const snap = await db.collection('audit_log').where('entity_id', '==', TENANT_A).get();
        const entry = snap.docs.map((d) => d.data()).find((d) => d.descricao.includes(novoNome));
        expect(entry).toBeDefined();
        expect(entry?.tenant_id).toBe(TENANT_A);
        expect(entry?.entity_type).toBe('tenant');
        expect(entry?.action).toBe('update');
        expect(entry?.actor_role).toBe('system_admin');

        // Visível na tela do System Admin.
        await page.goto('/admin/audit-log');
        const row = rowsWith(page, novoNome);
        await expect(row).toHaveCount(1);
        await expect(row.locator('td').nth(2)).toHaveText('Clínica');
        await expect(row.locator('td').nth(3)).toHaveText('Editar');
        // A coluna Clínica mostra o nome atual do tenant (já editado).
        await expect(row.locator('td').nth(5)).toHaveText(novoNome);
      } finally {
        await tenantRef.update({ name: originalName });
      }
    });
  });

  test.describe('Cenário 2 — visibilidade por papel (RN-04/RNF-03)', () => {
    test('system_admin vê audit_log + inventory_activity de várias clínicas, com coluna Clínica; entradas sem tenant mostram "—"', async ({
      page,
    }) => {
      await seedAuditLog({
        tenantId: TENANT_A,
        entityType: 'user',
        action: 'create',
        descricao: 'QA-UC53-VIS audit A',
        actorName: 'QA UC53 Ator Um',
      });
      await seedAuditLog({
        tenantId: TENANT_B,
        entityType: 'user',
        action: 'create',
        descricao: 'QA-UC53-VIS audit B',
        actorName: 'QA UC53 Ator Um',
      });
      await seedAuditLog({
        tenantId: null,
        entityType: 'master_product',
        action: 'update',
        descricao: 'QA-UC53-VIS audit global',
        actorName: 'QA UC53 Ator Um',
      });
      await seedInventoryActivity({
        tenantId: TENANT_A,
        tipo: 'reserva',
        descricao: 'QA-UC53-VIS estoque A',
        actorName: 'QA UC53 Ator Dois',
      });
      await seedInventoryActivity({
        tenantId: TENANT_B,
        tipo: 'consumo_imediato',
        descricao: 'QA-UC53-VIS estoque B',
        actorName: 'QA UC53 Ator Dois',
      });

      await loginSystemAdmin(page);
      await page.goto('/admin/audit-log');
      await expect(page.getByTestId('audit-log-view')).toBeVisible();
      await expect(page.locator('thead th', { hasText: 'Clínica' })).toBeVisible();

      await expect(rowsWith(page, 'QA-UC53-VIS')).toHaveCount(5);
      await expect(rowsWith(page, 'audit A').locator('td').nth(5)).toHaveText(
        TEST_TENANTS.clinicA.name
      );
      await expect(rowsWith(page, 'audit B').locator('td').nth(5)).toHaveText(
        TEST_TENANTS.clinicB.name
      );
      await expect(rowsWith(page, 'audit global').locator('td').nth(5)).toHaveText('—');
      await expect(rowsWith(page, 'estoque A').locator('td').nth(2)).toHaveText('Estoque');
      await expect(rowsWith(page, 'estoque B').locator('td').nth(5)).toHaveText(
        TEST_TENANTS.clinicB.name
      );
    });

    test('clinic_admin A vê só o próprio tenant (audit_log + inventory_activity) e NUNCA entradas da clínica B nem globais', async ({
      page,
    }) => {
      await seedAuditLog({
        tenantId: TENANT_A,
        entityType: 'user',
        action: 'create',
        descricao: 'QA-UC53-ISO audit A',
        actorName: 'QA UC53 Ator Um',
      });
      await seedAuditLog({
        tenantId: TENANT_B,
        entityType: 'user',
        action: 'create',
        descricao: 'QA-UC53-ISO audit B',
        actorName: 'QA UC53 Ator Um',
      });
      await seedAuditLog({
        tenantId: null,
        entityType: 'system_settings',
        action: 'update',
        descricao: 'QA-UC53-ISO audit global',
        actorName: 'QA UC53 Ator Um',
      });
      await seedInventoryActivity({
        tenantId: TENANT_A,
        tipo: 'reserva',
        descricao: 'QA-UC53-ISO estoque A',
        actorName: 'QA UC53 Ator Dois',
      });
      await seedInventoryActivity({
        tenantId: TENANT_B,
        tipo: 'reserva',
        descricao: 'QA-UC53-ISO estoque B',
        actorName: 'QA UC53 Ator Dois',
      });

      await loginClinicAdmin(page, TEST_USERS.clinicAdminA);
      await page.goto('/clinic/audit-log');
      await expect(page.getByTestId('audit-log-view')).toBeVisible();

      // Sem coluna Clínica na visão do Clinic Admin.
      await expect(page.locator('thead th', { hasText: 'Ator' })).toBeVisible();
      await expect(page.locator('thead th', { hasText: 'Clínica' })).toHaveCount(0);

      await expect(rowsWith(page, 'QA-UC53-ISO audit A')).toHaveCount(1);
      await expect(rowsWith(page, 'QA-UC53-ISO estoque A')).toHaveCount(1);
      await expect(rowsWith(page, 'QA-UC53-ISO audit B')).toHaveCount(0);
      await expect(rowsWith(page, 'QA-UC53-ISO estoque B')).toHaveCount(0);
      await expect(rowsWith(page, 'QA-UC53-ISO audit global')).toHaveCount(0);
    });
  });

  test.describe('Cenário 3 — filtros (passo 7 / 7c)', () => {
    test('System Admin filtra por clínica, categoria, ação e ator', async ({ page }) => {
      await seedAuditLog({
        tenantId: TENANT_A,
        entityType: 'user',
        action: 'create',
        descricao: 'QA-UC53-FLT usuario A',
        actorName: 'QA UC53 Ator Um',
      });
      await seedAuditLog({
        tenantId: TENANT_B,
        entityType: 'tenant',
        action: 'suspend',
        descricao: 'QA-UC53-FLT clinica B',
        actorName: 'QA UC53 Ator Tres',
      });
      await seedAuditLog({
        tenantId: null,
        entityType: 'master_product',
        action: 'update',
        descricao: 'QA-UC53-FLT global',
        actorName: 'QA UC53 Ator Um',
      });
      await seedInventoryActivity({
        tenantId: TENANT_A,
        tipo: 'reserva',
        descricao: 'QA-UC53-FLT estoque A',
        actorName: 'QA UC53 Ator Dois',
      });

      await loginSystemAdmin(page);
      await page.goto('/admin/audit-log');
      await expect(rowsWith(page, 'QA-UC53-FLT')).toHaveCount(4);

      // 7c: filtro por clínica oculta também entradas sem tenant_id.
      await page.getByLabel('Clínica').selectOption(TENANT_A);
      await expect(rowsWith(page, 'QA-UC53-FLT')).toHaveCount(2);
      await expect(rowsWith(page, 'FLT usuario A')).toHaveCount(1);
      await expect(rowsWith(page, 'FLT estoque A')).toHaveCount(1);
      await expect(rowsWith(page, 'FLT global')).toHaveCount(0);
      await expect(rowsWith(page, 'FLT clinica B')).toHaveCount(0);

      // Filtro por clínica B.
      await page.getByLabel('Clínica').selectOption(TENANT_B);
      await expect(rowsWith(page, 'QA-UC53-FLT')).toHaveCount(1);
      await expect(rowsWith(page, 'FLT clinica B')).toHaveCount(1);
      await page.getByLabel('Clínica').selectOption('');

      // Categoria.
      await page.getByLabel('Categoria').selectOption('Produto Master');
      await expect(rowsWith(page, 'QA-UC53-FLT')).toHaveCount(1);
      await expect(rowsWith(page, 'FLT global')).toHaveCount(1);
      await page.getByLabel('Categoria').selectOption('Estoque');
      await expect(rowsWith(page, 'QA-UC53-FLT')).toHaveCount(1);
      await expect(rowsWith(page, 'FLT estoque A')).toHaveCount(1);
      await page.getByLabel('Categoria').selectOption('');

      // Ação.
      await page.getByLabel('Ação').selectOption('Suspender');
      await expect(rowsWith(page, 'QA-UC53-FLT')).toHaveCount(1);
      await expect(rowsWith(page, 'FLT clinica B')).toHaveCount(1);
      await page.getByLabel('Ação').selectOption('');

      // Ator (busca textual, case-insensitive).
      await page.getByLabel('Ator').fill('qa uc53 ator um');
      await expect(rowsWith(page, 'QA-UC53-FLT')).toHaveCount(2);
      await expect(rowsWith(page, 'FLT usuario A')).toHaveCount(1);
      await expect(rowsWith(page, 'FLT global')).toHaveCount(1);
      await expect(page.getByTestId('audit-log-count')).toHaveText('2 registro(s) exibido(s)');

      // Combinação sem resultado (7a com itens carregados) e "Limpar filtros".
      await page.getByLabel('Clínica').selectOption(TENANT_B);
      await expect(page.getByTestId('audit-log-empty')).toHaveText(
        'Nenhum registro corresponde aos filtros aplicados.'
      );
      await page.getByRole('button', { name: 'Limpar filtros' }).click();
      await expect(rowsWith(page, 'QA-UC53-FLT')).toHaveCount(4);
    });

    test('Clinic Admin filtra por categoria e ator (sem filtro de clínica)', async ({ page }) => {
      await seedAuditLog({
        tenantId: TENANT_A,
        entityType: 'user',
        action: 'create',
        descricao: 'QA-UC53-CFLT usuario',
        actorName: 'QA UC53 Ator Um',
      });
      await seedInventoryActivity({
        tenantId: TENANT_A,
        tipo: 'consumo_imediato',
        descricao: 'QA-UC53-CFLT estoque',
        actorName: 'QA UC53 Ator Dois',
      });

      await loginClinicAdmin(page, TEST_USERS.clinicAdminA);
      await page.goto('/clinic/audit-log');
      await expect(rowsWith(page, 'QA-UC53-CFLT')).toHaveCount(2);
      await expect(page.getByLabel('Clínica')).toHaveCount(0);

      await page.getByLabel('Categoria').selectOption('Usuário');
      await expect(rowsWith(page, 'QA-UC53-CFLT')).toHaveCount(1);
      await expect(rowsWith(page, 'CFLT usuario')).toHaveCount(1);
      await page.getByLabel('Categoria').selectOption('');

      await page.getByLabel('Ator').fill('Ator Dois');
      await expect(rowsWith(page, 'QA-UC53-CFLT')).toHaveCount(1);
      await expect(rowsWith(page, 'CFLT estoque')).toHaveCount(1);
    });
  });

  test.describe('Cenário 4 — estado vazio (7a)', () => {
    test('tenant sem nenhuma entrada: exibe mensagem de vazio e desabilita exportação', async ({
      page,
    }) => {
      // Clínica B não possui audit_log nem inventory_activity no seed base.
      await loginClinicAdmin(page, TEST_USERS.clinicAdminB);
      await page.goto('/clinic/audit-log');

      await expect(page.getByTestId('audit-log-empty')).toHaveText(
        'Nenhum registro de auditoria encontrado.'
      );
      await expect(page.getByTestId('audit-log-row')).toHaveCount(0);
      await expect(page.getByTestId('audit-log-count')).toHaveText('0 registro(s) exibido(s)');
      await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeDisabled();
    });
  });

  test.describe('Cenário 5 — tenant só com inventory_activity (7b / RN-10)', () => {
    test('clinic_admin sem ações administrativas vê a lista normalmente, somente com categoria "Estoque"', async ({
      page,
    }) => {
      await seedInventoryActivity({
        tenantId: TENANT_A,
        tipo: 'reserva',
        descricao: 'QA-UC53-7B estoque 1',
        actorName: 'QA UC53 Ator Dois',
        secondsAgo: 10,
      });
      await seedInventoryActivity({
        tenantId: TENANT_A,
        tipo: 'consumo_imediato',
        descricao: 'QA-UC53-7B estoque 2',
        actorName: 'QA UC53 Ator Dois',
        secondsAgo: 20,
      });

      await loginClinicAdmin(page, TEST_USERS.clinicAdminA);
      await page.goto('/clinic/audit-log');

      await expect(page.getByTestId('audit-log-empty')).toHaveCount(0);
      await expect(rowsWith(page, 'QA-UC53-7B')).toHaveCount(2);

      // Nenhuma entrada de audit_log para o tenant: todas as linhas são "Estoque".
      const rows = page.getByTestId('audit-log-row');
      const total = await rows.count();
      expect(total).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < total; i++) {
        await expect(rows.nth(i).locator('td').nth(2)).toHaveText('Estoque');
      }
      // Ordenação por timestamp decrescente (mais recente primeiro).
      await expect(rows.nth(0)).toContainText('QA-UC53-7B estoque 1');
      await expect(rows.nth(1)).toContainText('QA-UC53-7B estoque 2');
    });
  });

  test.describe('Cenário 6 — clinic_user bloqueado (8b)', () => {
    test('clinic_user é redirecionado de /clinic/audit-log para /clinic/dashboard e não vê o item de menu', async ({
      page,
    }) => {
      await loginAs(
        page,
        { email: TEST_USERS.clinicUserA.email, password: TEST_PASSWORD },
        '/clinic/dashboard'
      );
      await expect(page.getByRole('link', { name: 'Trilha de Auditoria' })).toHaveCount(0);

      await page.goto('/clinic/audit-log');
      await expect(page).toHaveURL(/\/clinic\/dashboard/);
      await expect(page.getByTestId('audit-log-view')).toHaveCount(0);
    });

    test('clinic_admin vê o item de menu "Trilha de Auditoria" e navega até a tela', async ({
      page,
    }) => {
      await loginClinicAdmin(page, TEST_USERS.clinicAdminA);
      const link = page.getByRole('link', { name: 'Trilha de Auditoria' }).first();
      // O Next dev faz Fast Refresh logo apos o login; um clique nesse instante pode ser
      // descartado (nao e bug de produto) -- por isso o clique e repetido ate navegar.
      await expect(async () => {
        await link.click();
        await expect(page).toHaveURL(new RegExp('/clinic/audit-log'), { timeout: 5000 });
      }).toPass({ timeout: 45_000 });
      await expect(page).toHaveURL(/\/clinic\/audit-log/);
      await expect(page.getByTestId('audit-log-view')).toBeVisible();
    });
  });

  test.describe('Cenário 7 — exportação (7d/7e/RN-07)', () => {
    test('System Admin exporta CSV com exatamente os itens filtrados e PDF válido', async ({
      page,
    }) => {
      await seedAuditLog({
        tenantId: TENANT_A,
        entityType: 'user',
        action: 'create',
        descricao: 'QA-UC53-EXP usuario A',
        actorName: 'QA UC53 Ator Um',
      });
      await seedInventoryActivity({
        tenantId: TENANT_A,
        tipo: 'reserva',
        descricao: 'QA-UC53-EXP estoque A',
        actorName: 'QA UC53 Ator Dois',
      });
      await seedAuditLog({
        tenantId: TENANT_B,
        entityType: 'tenant',
        action: 'suspend',
        descricao: 'QA-UC53-EXP clinica B',
        actorName: 'QA UC53 Ator Tres',
      });

      await loginSystemAdmin(page);
      await page.goto('/admin/audit-log');
      await expect(rowsWith(page, 'QA-UC53-EXP')).toHaveCount(3);

      // Filtro em vigor: só a clínica B.
      await page.getByLabel('Clínica').selectOption(TENANT_B);
      await expect(rowsWith(page, 'QA-UC53-EXP')).toHaveCount(1);
      const displayed = await page.getByTestId('audit-log-row').count();

      const csvPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Exportar CSV' }).click();
      const csv = await csvPromise;
      expect(csv.suggestedFilename()).toMatch(/^trilha_auditoria_\d{4}-\d{2}-\d{2}\.csv$/);
      const csvPath = await csv.path();
      const content = readFileSync(csvPath, 'utf-8');
      const lines = content.split('\n');
      expect(lines[0]).toBe('Data/Hora,Ator,Categoria,Ação,Descrição,Clínica');
      expect(lines.length - 1).toBe(displayed);
      expect(content).toContain('QA-UC53-EXP clinica B');
      expect(content).toContain('QA UC53 Ator Tres');
      expect(content).toContain(TEST_TENANTS.clinicB.name);
      expect(content).not.toContain('QA-UC53-EXP usuario A');
      expect(content).not.toContain('QA-UC53-EXP estoque A');

      // 7e: PDF com o mesmo filtro.
      const pdfPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Exportar PDF' }).click();
      const pdf = await pdfPromise;
      expect(pdf.suggestedFilename()).toMatch(/^trilha_auditoria_\d{4}-\d{2}-\d{2}\.pdf$/);
      const pdfBytes = readFileSync(await pdf.path());
      expect(pdfBytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    });

    test('Clinic Admin exporta CSV sem coluna Clínica, respeitando filtro de ator', async ({
      page,
    }) => {
      await seedAuditLog({
        tenantId: TENANT_A,
        entityType: 'user',
        action: 'create',
        descricao: 'QA-UC53-CEXP usuario',
        actorName: 'QA UC53 Ator Um',
      });
      await seedInventoryActivity({
        tenantId: TENANT_A,
        tipo: 'reserva',
        descricao: 'QA-UC53-CEXP estoque',
        actorName: 'QA UC53 Ator Dois',
      });

      await loginClinicAdmin(page, TEST_USERS.clinicAdminA);
      await page.goto('/clinic/audit-log');
      await expect(rowsWith(page, 'QA-UC53-CEXP')).toHaveCount(2);
      await page.getByLabel('Ator').fill('QA UC53 Ator Um');
      await expect(rowsWith(page, 'QA-UC53-CEXP')).toHaveCount(1);
      const displayed = await page.getByTestId('audit-log-row').count();

      const csvPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Exportar CSV' }).click();
      const csv = await csvPromise;
      expect(csv.suggestedFilename()).toMatch(/^trilha_auditoria_\d{4}-\d{2}-\d{2}\.csv$/);
      const lines = readFileSync(await csv.path(), 'utf-8').split('\n');
      expect(lines[0]).toBe('Data/Hora,Ator,Categoria,Ação,Descrição');
      expect(lines.length - 1).toBe(displayed);
      const body = lines.join('\n');
      expect(body).toContain('QA-UC53-CEXP usuario');
      expect(body).not.toContain('QA-UC53-CEXP estoque');
    });
  });
});
