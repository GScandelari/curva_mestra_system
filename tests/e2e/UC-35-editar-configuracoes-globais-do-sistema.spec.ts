import { test, expect, type Page } from '@playwright/test';
import { Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_USERS } from './fixtures/seed-data';

/**
 * Cobertura (Modo A) de:
 * - `ONLY_FOR_DEVS/TASK_COMPLETED/BUGFIX-admin-settings-sobrescrita-falha-leitura.md` (§6.3, §8.2 e STEP 5)
 * - `ONLY_FOR_DEVS/PO_BA_Docs/UC-35-editar-configuracoes-globais-do-sistema.md` (v2.0, RN-01/RN-07)
 *
 * Cenários (tabela da §8.2):
 * 1. Falha de leitura bloqueia formulário e salvamento (UX-046).
 * 2. "Tentar novamente" recupera os valores reais depois que a rede volta.
 * 3. Documento inexistente: Alert informativo; salvar cria o documento só com os 6 campos.
 * 4. Documento existente: a gravação com `merge` preserva campo desconhecido.
 * 5. Conflito concorrente (D1): a gravação é recusada, nada é revertido, nada é auditado.
 *
 * Como a falha de leitura é simulada (D2, §8.2): `page.route` aborta na rede as requisições do
 * navegador ao emulador do Firestore (`**\/google.firestore.v1.Firestore/**`, que cobre
 * `Listen/channel` e `Write/channel` do WebChannel). Nenhuma resposta é fabricada; o Admin SDK
 * roda no processo do teste e não passa pela rota. A rota é instalada DEPOIS do `loginAs` e
 * ANTES do `page.goto('/admin/settings')`, que é navegação completa e cria um SDK novo.
 *
 * Higiene obrigatória (STEP 5, ação 2): `beforeEach` e `afterEach` apagam `system_settings/global`.
 * Um documento que sobre com `maintenance_mode: true` ou `registration_enabled: false` quebra os
 * demais specs (não-admins vão para `/maintenance` e `/api/access-requests` recusa cadastros).
 *
 * Assunções (a confirmar na revisão humana):
 * 1. O glob da rota pega o transporte real do SDK no emulador. O teste espera um `requestfailed`
 *    nessa URL antes de qualquer asserção, para que um glob errado falhe de forma explícita em vez
 *    de mascarar o cenário. Se falhar, conferir as URLs no trace e ajustar o glob; não trocar de
 *    técnica (§8.2).
 * 2. Cenário 2 depende do backoff de reconexão do SDK (§4.3); por isso `toPass` com 30 s e cliques
 *    repetidos. Se ficar intermitente, a alternativa prevista é `page.reload()` após o `unroute`
 *    (§10), registrando a troca neste cabeçalho.
 * 3. Além da tabela, os cenários 3 e 5 conferem `audit_log` (DoD §9: "conflito não gera log de
 *    auditoria"). Entradas `entity_type == 'system_settings'` criadas durante cada teste são
 *    removidas no `afterEach` (as preexistentes, ex.: de UC-53, não são tocadas).
 * 4. Nenhum usuário novo: só `TEST_USERS.systemAdmin`.
 */

const SETTINGS_PATH = 'system_settings/global';
const FIRESTORE_GLOB = '**/google.firestore.v1.Firestore/**';
const EXPECTED_KEYS = [
  'maintenance_message',
  'maintenance_mode',
  'registration_enabled',
  'session_timeout_minutes',
  'updated_at',
  'updated_by',
];

function settingsRef() {
  return getEmulatorAdminFirestore().doc(SETTINGS_PATH);
}

async function systemSettingsAuditIds(): Promise<Set<string>> {
  const snap = await getEmulatorAdminFirestore()
    .collection('audit_log')
    .where('entity_type', '==', 'system_settings')
    .get();
  return new Set(snap.docs.map((d) => d.id));
}

let auditIdsBefore = new Set<string>();

test.beforeEach(async () => {
  await settingsRef().delete();
  auditIdsBefore = await systemSettingsAuditIds();
});

// Roda mesmo quando o teste falha: o documento nunca pode sobrar no emulador.
test.afterEach(async () => {
  await settingsRef().delete();
  const db = getEmulatorAdminFirestore();
  const idsNow = await systemSettingsAuditIds();
  const created = [...idsNow].filter((id) => !auditIdsBefore.has(id));
  await Promise.all(created.map((id) => db.collection('audit_log').doc(id).delete()));
});

async function loginSystemAdmin(page: Page) {
  await loginAs(
    page,
    { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
    '/admin/dashboard'
  );
}

/** Toast real (exclui a cópia anunciada pelo Radix em `role="status"`), padrão do UC-02. */
function toastText(page: Page, text: string) {
  return page.getByText(text).and(page.locator(':not([role="status"])'));
}

async function readSettings(): Promise<DocumentData | undefined> {
  const snap = await settingsRef().get();
  return snap.exists ? snap.data() : undefined;
}

test.describe('UC-35 — Editar Configurações Globais do Sistema', () => {
  // Next dev compila /admin/settings sob demanda e o cenário 1+2 inclui backoff de reconexão.
  test.setTimeout(120_000);

  test('cenários 1 e 2: falha de leitura bloqueia formulário e salvamento; "Tentar novamente" recupera os valores reais (UX-046, RN-01)', async ({
    page,
  }) => {
    // Preparação (§8.2, cenário 1): documento com valores não padrão.
    const seeded = {
      session_timeout_minutes: 45,
      maintenance_mode: true,
      maintenance_message: 'Teste E2E',
      registration_enabled: false,
      updated_at: Timestamp.now(),
    };
    await settingsRef().set(seeded);
    const before = await readSettings();

    await loginSystemAdmin(page);

    // Rota DEPOIS do login e ANTES da navegação completa (STEP 5, ação 3).
    await page.route(FIRESTORE_GLOB, (route) => route.abort());
    const firestoreBlocked = page.waitForEvent('requestfailed', (req) =>
      req.url().includes('google.firestore.v1.Firestore')
    );
    await page.goto('/admin/settings');
    // Garante que o glob realmente interceptou o transporte do SDK (assunção 1).
    await firestoreBlocked;

    // Cenário 1 — estado de erro (§6.3, linha `error`).
    await expect(page.getByText('Não foi possível carregar as configurações')).toBeVisible();
    await expect(
      page.getByText(
        'As configurações em vigor não foram lidas. Para não substituí-las por engano, a edição fica bloqueada até a leitura dar certo.'
      )
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar Configurações' })).toHaveCount(0);
    await expect(page.getByLabel('Ativar modo de manutenção')).toHaveCount(0);
    await expect(page.getByLabel('Tempo de sessão (minutos)')).toHaveCount(0);
    await expect(page.getByLabel('Permitir novos registros')).toHaveCount(0);
    await expect(page.getByText('Integridade de Custom Claims', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible();

    // Via Admin SDK: o documento continua idêntico ao gravado (nada foi sobrescrito).
    const afterFailure = await readSettings();
    expect(afterFailure).toBeDefined();
    expect(Object.keys(afterFailure!).sort()).toEqual(Object.keys(before!).sort());
    expect(afterFailure!.session_timeout_minutes).toBe(45);
    expect(afterFailure!.maintenance_mode).toBe(true);
    expect(afterFailure!.maintenance_message).toBe('Teste E2E');
    expect(afterFailure!.registration_enabled).toBe(false);
    expect((afterFailure!.updated_at as Timestamp).isEqual(seeded.updated_at)).toBe(true);

    // Cenário 2 — a rede volta; "Tentar novamente" pode exigir mais de um clique (§4.3).
    await page.unroute(FIRESTORE_GLOB);
    const sessionInput = page.getByLabel('Tempo de sessão (minutos)');
    await expect(async () => {
      if (!(await sessionInput.isVisible())) {
        await page.getByRole('button', { name: 'Tentar novamente' }).click({ timeout: 5_000 });
      }
      await expect(sessionInput).toHaveValue('45', { timeout: 5_000 });
    }).toPass({ timeout: 30_000 });

    await expect(page.getByText('Não foi possível carregar as configurações')).toHaveCount(0);
    await expect(page.getByLabel('Ativar modo de manutenção')).toBeChecked();
    await expect(page.getByLabel('Mensagem de manutenção')).toHaveValue('Teste E2E');
    await expect(page.getByLabel('Permitir novos registros')).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Salvar Configurações' })).toBeEnabled();
  });

  test('cenário 3: documento inexistente mostra os padrões e salvar cria o documento só com os 6 campos (UC-35 §8c, RN-07)', async ({
    page,
  }) => {
    // O beforeEach já apagou o documento (estado esperado pelo seed).
    expect(await readSettings()).toBeUndefined();

    await loginSystemAdmin(page);
    await page.goto('/admin/settings');

    await expect(page.getByText('Nenhuma configuração salva ainda')).toBeVisible();
    await expect(
      page.getByText(
        'Os valores abaixo são os padrões aplicados hoje pelo sistema. Ao salvar, eles passam a ficar registrados.'
      )
    ).toBeVisible();
    const sessionInput = page.getByLabel('Tempo de sessão (minutos)');
    await expect(sessionInput).toHaveValue('15');
    await expect(page.getByLabel('Ativar modo de manutenção')).not.toBeChecked();
    await expect(page.getByLabel('Permitir novos registros')).toBeChecked();

    await sessionInput.fill('30');
    await page.getByRole('button', { name: 'Salvar Configurações' }).click();
    await expect(toastText(page, 'Configurações salvas com sucesso')).toBeVisible();

    // Via Admin SDK: chaves exatas, sem `id`, timeout gravado.
    await expect.poll(async () => (await readSettings())?.session_timeout_minutes).toBe(30);
    const data = (await readSettings())!;
    expect(Object.keys(data).sort()).toEqual(EXPECTED_KEYS);
    expect(data).not.toHaveProperty('id');
    expect(data.maintenance_mode).toBe(false);
    expect(data.maintenance_message).toBe('');
    expect(data.registration_enabled).toBe(true);
    expect(data.updated_by).toBe(TEST_USERS.systemAdmin.uid);
    expect(data.updated_at).toBeInstanceOf(Timestamp);

    // Salvamento bem-sucedido gera entrada de auditoria (UC-35 passo 11).
    await expect
      .poll(
        async () =>
          [...(await systemSettingsAuditIds())].filter((id) => !auditIdsBefore.has(id)).length
      )
      .toBe(1);
  });

  test('cenário 4: documento existente — salvar com merge preserva campo desconhecido (RN-07)', async ({
    page,
  }) => {
    await settingsRef().set({
      session_timeout_minutes: 20,
      maintenance_mode: false,
      maintenance_message: '',
      registration_enabled: true,
      campo_extra: 'x',
      updated_at: Timestamp.now(),
    });

    await loginSystemAdmin(page);
    await page.goto('/admin/settings');

    const sessionInput = page.getByLabel('Tempo de sessão (minutos)');
    await expect(sessionInput).toHaveValue('20');
    await expect(page.getByText('Nenhuma configuração salva ainda')).toHaveCount(0);

    await sessionInput.fill('25');
    await page.getByRole('button', { name: 'Salvar Configurações' }).click();
    await expect(toastText(page, 'Configurações salvas com sucesso')).toBeVisible();

    await expect.poll(async () => (await readSettings())?.session_timeout_minutes).toBe(25);
    const data = (await readSettings())!;
    expect(data.campo_extra).toBe('x');
    expect(data).not.toHaveProperty('id');
    expect(data.registration_enabled).toBe(true);
    expect(data.maintenance_mode).toBe(false);
    expect(data.updated_by).toBe(TEST_USERS.systemAdmin.uid);
  });

  test('cenário 5: alteração concorrente bloqueia o salvamento sem reverter o valor nem gerar auditoria (D1, RN-01)', async ({
    page,
  }) => {
    // updated_at no passado, para que o Timestamp.now() da alteração concorrente seja diferente.
    await settingsRef().set({
      session_timeout_minutes: 20,
      maintenance_mode: false,
      maintenance_message: '',
      registration_enabled: true,
      updated_at: Timestamp.fromMillis(Date.now() - 60_000),
    });

    await loginSystemAdmin(page);
    await page.goto('/admin/settings');

    const sessionInput = page.getByLabel('Tempo de sessão (minutos)');
    await expect(sessionInput).toHaveValue('20');
    await expect(page.getByLabel('Permitir novos registros')).toBeChecked();

    // Outra sessão grava depois que a tela carregou.
    await settingsRef().update({ registration_enabled: false, updated_at: Timestamp.now() });

    await sessionInput.fill('35');
    await page.getByRole('button', { name: 'Salvar Configurações' }).click();

    // Estado `stale` (§6.3): Alert destrutivo, cards e "Salvar" não renderizados.
    await expect(page.getByText('As configurações foram alteradas em outra sessão')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar Configurações' })).toHaveCount(0);
    await expect(sessionInput).toHaveCount(0);
    await expect(toastText(page, 'Configurações salvas com sucesso')).toHaveCount(0);

    // Via Admin SDK: nada foi revertido nem gravado pela tela.
    const data = (await readSettings())!;
    expect(data.registration_enabled).toBe(false);
    expect(data.session_timeout_minutes).toBe(20);
    expect(data).not.toHaveProperty('updated_by');

    // Conflito não gera log de auditoria (DoD §9).
    const created = [...(await systemSettingsAuditIds())].filter((id) => !auditIdsBefore.has(id));
    expect(created).toHaveLength(0);

    // "Recarregar configurações" mostra os valores atuais.
    await page.getByRole('button', { name: 'Recarregar configurações' }).click();
    await expect(sessionInput).toHaveValue('20');
    await expect(page.getByLabel('Permitir novos registros')).not.toBeChecked();
    await expect(page.getByText('As configurações foram alteradas em outra sessão')).toHaveCount(0);
  });
});
