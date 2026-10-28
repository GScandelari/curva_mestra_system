import { test, expect, Page, Locator } from '@playwright/test';
import crypto from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminAuth, getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_TENANTS, TEST_USERS } from './fixtures/seed-data';

/**
 * Caderno da feature (Modo A, spec ainda em TO_DO — exceção explícita: o
 * caderno entra no mesmo PR da task) de:
 * ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-toggle-visibilidade-senha.md (v1.1) — §8.2 (função
 * `expectToggle`, tabela de 14 cenários e "Observações para o qa-agent e o
 * revisor"), STEP 6 e roteiro manual do STEP 8.
 *
 * UX-060 (P2) + parte "mostrar senha" do UX-017 (P1). Componente sob teste:
 * src/components/ui/password-input.tsx (D1 = B, padrão GOV.UK): `aria-label`
 * alterna "Mostrar senha"/"Ocultar senha", SEM `aria-pressed`, com
 * `aria-controls` apontando para o `id` do campo.
 *
 * Mapeamento cenário (§8.2) → UC / tela:
 *  1. Login: alternância básica, valor preservado, atributos (UC-04, STEP 8 #1-3)
 *  2. Login: o botão não envia o formulário (UC-04, RF-06, STEP 8 #2)
 *  3. Login: navegação por teclado Tab/Espaço (UC-04, RNF-01, STEP 8 #4)
 *  4. Login com a senha visível funciona (UC-04, STEP 8 #5)
 *  5. Clique de mouse não tira o foco do campo (UC-04, RNF-01, STEP 8 #2)
 *  6. Perfil do system_admin: 3 estados independentes (UC-38, RF-04, STEP 8 #10)
 *  7. Perfil da clínica: 3 estados independentes (UC-41, RF-04, STEP 8 #10)
 *  8. Troca obrigatória de senha (UC-06, STEP 8 #16)
 *  9. Redefinição por token (UC-08, STEP 8 #16)
 * 10. "Adicionar Novo Usuário" pela clínica + reinício ao reabrir (UC-40, RF-05/RF-09, STEP 8 #11)
 * 11. "Adicionar Novo Usuário" pelo admin (UC-39, STEP 8 #12)
 * 12. "Definir Senha Manualmente" de usuário (UC-36/UC-37, regressão UX-017, STEP 8 #13)
 * 13. "Definir Senha Manualmente" de consultor (UC-30, regressão UX-017, STEP 8 #13)
 * 14. Guarda de regressão "nenhum campo de senha sem toggle" — executada como
 *     `test.step` dentro dos cenários 1, 6, 7 e 10-13, logo depois de abrir
 *     cada tela (evita 6 logins extras só para repetir a navegação).
 *
 * Regras seguidas (§8.2 "Observações" e brief do coordenador):
 * - Botão sempre localizado por `button[aria-controls="<id>"]`; o nome
 *   acessível só é VERIFICADO, nunca usado para clicar (ele muda a cada clique).
 * - Campo sempre localizado por `#id`; nunca `getByLabel('Senha')` (casaria
 *   também com o botão "Mostrar senha" e violaria o modo estrito).
 * - Estado verificado por `toHaveAttribute('type', ...)` — `input[type=password]`
 *   não tem papel ARIA.
 * - Somente leitura em relação às senhas semeadas: nenhum cenário envia troca
 *   de senha, criação de usuário nem "Definir Senha". O cenário 4 faz apenas
 *   um login normal com `TEST_PASSWORD`.
 * - Sem mock e sem `page.route`: todo o estado vem do Emulator Suite. O
 *   cenário 2 apenas OBSERVA requisições (`page.on('request')`), sem interceptar.
 * - Os cenários 8 e 9 alteram o emulador; a pré-condição é criada no
 *   `beforeEach` e desfeita no `afterEach` do próprio `describe` (o Playwright
 *   roda o `afterEach` mesmo quando o teste falha), nos padrões de
 *   UC-06-...spec.ts (grant/restoreClinicAdminA) e UC-08-...spec.ts (8d).
 * - A varredura axe dos perfis fica em _infra-a11y-axe-mobile.spec.ts
 *   (A11Y_ROUTES, STEP 7) e não é duplicada aqui. Sem tag `@mobile`.
 *
 * Assunções para a revisão humana (favor confirmar):
 * A1. Cenário 2: "o formulário não foi enviado" é provado de forma
 *     determinística — depois que o rótulo do botão já mudou para "Ocultar
 *     senha" (prova de que o React re-renderizou após o clique), o botão
 *     "Entrar" continua com o texto "Entrar" (um envio teria colocado
 *     "Entrando..." no MESMO render, `setLoading(true)` em handleSubmit), o
 *     campo segue habilitado, não há mensagem de erro e nenhuma requisição
 *     `accounts:signInWithPassword` saiu para o Auth Emulator. O e-mail é
 *     preenchido com o do systemAdmin e a senha com um valor errado: se o
 *     botão enviasse o formulário, a validação HTML `required` não o barraria.
 * A2. Cenário 8: a restauração reaplica as claims originais do seed e remove
 *     `requirePasswordChange`/`passwordChangedAt` de `users/{uid}` (mesmo
 *     `restoreClinicAdminA` do UC-06), mas NÃO redefine a senha — este caderno
 *     nunca envia o formulário, então a senha semeada não muda. Há asserção via
 *     Admin SDK de que a claim continua `true` ao final do teste (nada foi
 *     enviado).
 * A3. Cenário 9: o token é escrito direto em `password_reset_tokens` (formato
 *     de `createPasswordResetToken`, igual ao UC-08 8d, mas com
 *     `expires_at = agora + 30 min`) e o documento é apagado no `afterEach`.
 *     Há asserção via Admin SDK de que o token continua sem `used_at`.
 * A4. Cenário 10: o botão "Adicionar Usuário" de UsersTab fica desabilitado
 *     quando a clínica atinge `max_users` (5 no seed de clinicA). Se outros
 *     specs da suíte criarem usuários em clinicA o bastante para atingir o
 *     limite, este cenário (e o 11, que tem a mesma regra em
 *     admin/tenants/[id]) falha — hoje o seed tem 2 usuários em clinicA.
 * A5. Os campos são preenchidos com valores fictícios antes de alternar, para
 *     que "valor preservado" (RF-02) seja uma verificação real e não `''`.
 * A6. Cenário 9 (STEP 8 #16): o foco inicial é conferido em `#newPassword`
 *     (`autoFocus`), não no botão — o formulário só monta depois da validação
 *     do token, por isso a espera pelo heading "Nova Senha" vem antes.
 */

const SHOW_LABEL = 'Mostrar senha';
const HIDE_LABEL = 'Ocultar senha';

const SYSTEM_ADMIN = TEST_USERS.systemAdmin;
const CLINIC_ADMIN_A = TEST_USERS.clinicAdminA;
const SYSTEM_ADMIN_CREDENTIALS = { email: SYSTEM_ADMIN.email, password: TEST_PASSWORD };
const CLINIC_ADMIN_A_CREDENTIALS = { email: CLINIC_ADMIN_A.email, password: TEST_PASSWORD };

const RESET_TOKENS_COLLECTION = 'password_reset_tokens';
const USERS_SEARCH_PLACEHOLDER = 'Buscar por nome, email ou clínica...';

/** Valor fictício digitado nos campos — nunca enviado. */
const DUMMY_VALUE = 'QualquerCoisa1';

function field(page: Page, inputId: string): Locator {
  return page.locator(`#${inputId}`);
}

/** Botão "olho" do campo, localizado SEMPRE por `aria-controls` (§8.2). */
function toggle(page: Page, inputId: string): Locator {
  return page.locator(`button[aria-controls="${inputId}"]`);
}

/** Estado oculto: campo `password`, rótulo "Mostrar senha", sem `aria-pressed` (D1 = B). */
async function expectHidden(page: Page, inputId: string): Promise<void> {
  await expect(field(page, inputId)).toHaveAttribute('type', 'password');
  const button = toggle(page, inputId);
  await expect(button).toHaveAttribute('aria-label', SHOW_LABEL);
  await expect(button).toHaveAccessibleName(SHOW_LABEL);
  await expect(button).not.toHaveAttribute('aria-pressed');
}

/** Estado visível: campo `text`, rótulo "Ocultar senha", sem `aria-pressed` (D1 = B). */
async function expectVisible(page: Page, inputId: string): Promise<void> {
  await expect(field(page, inputId)).toHaveAttribute('type', 'text');
  const button = toggle(page, inputId);
  await expect(button).toHaveAttribute('aria-label', HIDE_LABEL);
  await expect(button).toHaveAccessibleName(HIDE_LABEL);
  await expect(button).not.toHaveAttribute('aria-pressed');
}

/**
 * Função auxiliar da §8.2: estado inicial oculto → clique revela (valor
 * preservado) → clique oculta de novo (valor preservado). Também confere que o
 * botão é `type="button"` (RF-06) e aponta para o campo certo.
 */
async function expectToggle(page: Page, inputId: string): Promise<void> {
  const input = field(page, inputId);
  const button = toggle(page, inputId);
  await expect(button).toHaveCount(1);
  await expect(button).toHaveAttribute('type', 'button');

  const valueBefore = await input.inputValue();

  await expectHidden(page, inputId);

  await button.click();
  await expectVisible(page, inputId);
  await expect(input).toHaveValue(valueBefore);

  await button.click();
  await expectHidden(page, inputId);
  await expect(input).toHaveValue(valueBefore);
}

/**
 * Cenário 14 (guarda de regressão): todo `input[type="password"]` visível na
 * tela tem `id` e exatamente um `button[aria-controls=<id>]`. Deve rodar logo
 * depois de abrir a tela, antes de qualquer alternância.
 */
async function expectEveryPasswordFieldHasToggle(page: Page, scope?: Locator): Promise<void> {
  await test.step('Cenário 14 — nenhum campo de senha sem toggle', async () => {
    const root = scope ?? page.locator('body');
    const passwordFields = root.locator('input[type="password"]');
    const count = await passwordFields.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const id = await passwordFields.nth(i).getAttribute('id');
      expect(id, `campo de senha #${i} sem id`).toBeTruthy();
      await expect(toggle(page, id as string)).toHaveCount(1);
    }
  });
}

/**
 * Cenários 6 e 7 (RF-04): revelar só "Nova Senha" deixa "Senha Atual" e
 * "Confirmar Nova Senha" mascaradas; depois, `expectToggle` nos 3 campos.
 */
async function expectThreeIndependentFields(page: Page): Promise<void> {
  await field(page, 'currentPassword').fill('SenhaAtual1');
  await field(page, 'newPassword').fill('NovaSenha12');
  await field(page, 'confirmPassword').fill('NovaSenha12');

  await toggle(page, 'newPassword').click();
  await expectVisible(page, 'newPassword');
  await expectHidden(page, 'currentPassword');
  await expectHidden(page, 'confirmPassword');

  await toggle(page, 'newPassword').click();
  await expectHidden(page, 'newPassword');

  for (const id of ['currentPassword', 'newPassword', 'confirmPassword']) {
    await expectToggle(page, id);
  }
}

/**
 * Cenários 12 e 13 (regressão UX-017): um botão por campo, cada um com nome
 * próprio; revelar "Nova Senha" não revela nem renomeia o de "Confirmar Senha".
 */
async function expectSetPasswordFieldsIndependent(page: Page): Promise<void> {
  for (const id of ['newPassword', 'confirmPassword']) {
    await expect(toggle(page, id)).toHaveCount(1);
    await expect(toggle(page, id)).toHaveAttribute('aria-label', SHOW_LABEL);
    await expect(toggle(page, id)).not.toHaveAttribute('aria-pressed');
    await expect(field(page, id)).toHaveAttribute('autocomplete', 'new-password');
  }

  await field(page, 'newPassword').fill(DUMMY_VALUE);
  await field(page, 'confirmPassword').fill(DUMMY_VALUE);

  await toggle(page, 'newPassword').click();
  await expectVisible(page, 'newPassword');
  // Antes (UX-017), um único botão revelava os dois campos.
  await expectHidden(page, 'confirmPassword');

  await toggle(page, 'newPassword').click();
  await expectHidden(page, 'newPassword');

  await expectToggle(page, 'newPassword');
  await expectToggle(page, 'confirmPassword');
}

/** UC-06 (padrão de UC-06-...spec.ts): simula a pré-condição da troca obrigatória. */
async function grantRequirePasswordChange(): Promise<void> {
  await getEmulatorAdminAuth().setCustomUserClaims(CLINIC_ADMIN_A.uid, {
    ...CLINIC_ADMIN_A.claims,
    requirePasswordChange: true,
  });
}

/**
 * Restaura `clinicAdminA` ao estado do seed (padrão `restoreClinicAdminA` do
 * UC-06). A senha não é redefinida: este caderno nunca envia o formulário (A2).
 */
async function restoreClinicAdminA(): Promise<void> {
  await getEmulatorAdminAuth().setCustomUserClaims(CLINIC_ADMIN_A.uid, CLINIC_ADMIN_A.claims);
  await getEmulatorAdminFirestore().doc(`users/${CLINIC_ADMIN_A.uid}`).update({
    requirePasswordChange: FieldValue.delete(),
    passwordChangedAt: FieldValue.delete(),
  });
}

/** Réplica de `hashToken` (passwordResetService.ts), igual ao UC-08. */
function hashTokenLikeApp(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

test.describe('UX-060 — Mostrar/ocultar senha em todos os campos de senha', () => {
  test.describe('Login (UC-04)', () => {
    test('cenário 1 — alterna a visibilidade, preserva o valor e mantém os atributos do campo (STEP 8 #1-3)', async ({
      page,
    }) => {
      await page.goto('/login');
      await expect(field(page, 'password')).toBeVisible();
      await expectEveryPasswordFieldHasToggle(page);

      await field(page, 'password').fill(DUMMY_VALUE);
      await expectToggle(page, 'password');

      // RNF-04 e preservação do autoComplete original (Objetivo 4).
      const input = field(page, 'password');
      await expect(input).toHaveAttribute('autocomplete', 'current-password');
      await expect(input).toHaveAttribute('spellcheck', 'false');
      await expect(input).toHaveAttribute('autocapitalize', 'none');
      await expect(input).toHaveAttribute('autocorrect', 'off');
    });

    test('cenário 2 — clicar no olho não envia o formulário (RF-06, STEP 8 #2)', async ({
      page,
    }) => {
      // Apenas observa (não intercepta) as chamadas de login ao Auth Emulator.
      let signInRequests = 0;
      page.on('request', (request) => {
        if (request.url().includes('accounts:signInWithPassword')) signInRequests++;
      });

      await page.goto('/login');
      // E-mail válido + senha errada: se o botão enviasse o formulário, a
      // validação `required` não o barraria e apareceria erro de credencial (A1).
      await field(page, 'email').fill(SYSTEM_ADMIN.email);
      await field(page, 'password').fill(DUMMY_VALUE);

      await toggle(page, 'password').click();
      // Prova de re-render pós-clique; um envio teria mudado "Entrar" no mesmo render.
      await expectVisible(page, 'password');

      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
      await expect(field(page, 'password')).toBeEnabled();
      await expect(page.locator('form .text-destructive')).toHaveCount(0);
      expect(signInRequests).toBe(0);
    });

    test('cenário 3 — teclado: Tab chega ao olho, Espaço alterna, Tab segue para "Entrar" (RNF-01, STEP 8 #4)', async ({
      page,
    }) => {
      await page.goto('/login');
      await field(page, 'password').fill(DUMMY_VALUE);
      await field(page, 'password').focus();

      await page.keyboard.press('Tab');
      await expect(toggle(page, 'password')).toBeFocused();

      await page.keyboard.press('Space');
      await expect(field(page, 'password')).toHaveAttribute('type', 'text');
      await expect(toggle(page, 'password')).toBeFocused();
      await expect(toggle(page, 'password')).toHaveAttribute('aria-label', HIDE_LABEL);
      await expect(field(page, 'password')).toHaveValue(DUMMY_VALUE);

      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeFocused();
    });

    test('cenário 4 — login com a senha visível funciona normalmente (STEP 8 #5)', async ({
      page,
    }) => {
      await page.goto('/login');
      await field(page, 'email').fill(SYSTEM_ADMIN_CREDENTIALS.email);
      await field(page, 'password').fill(SYSTEM_ADMIN_CREDENTIALS.password);

      await toggle(page, 'password').click();
      await expectVisible(page, 'password');

      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/dashboard/);
    });

    test('cenário 5 — clicar no olho com o mouse não tira o foco do campo (RNF-01, STEP 8 #2)', async ({
      page,
    }) => {
      await page.goto('/login');
      await field(page, 'password').click();
      await field(page, 'password').fill(DUMMY_VALUE);
      await expect(field(page, 'password')).toBeFocused();

      await toggle(page, 'password').click();
      await expectVisible(page, 'password');
      await expect(field(page, 'password')).toBeFocused();
    });
  });

  test.describe('Perfis (UC-38, UC-41)', () => {
    test('cenário 6 — perfil do system_admin: 3 campos com estados independentes (UC-38, STEP 8 #10)', async ({
      page,
    }) => {
      await loginAs(page, SYSTEM_ADMIN_CREDENTIALS, '/admin/dashboard');
      await page.goto('/admin/profile');
      await expect(page.getByRole('heading', { name: 'Meu Perfil' })).toBeVisible();
      await expect(field(page, 'currentPassword')).toBeVisible();
      await expectEveryPasswordFieldHasToggle(page);

      await expect(field(page, 'newPassword')).toHaveAttribute('minlength', '8');
      await expectThreeIndependentFields(page);
      // Nada é enviado: o botão "Alterar Senha" nunca é clicado.
    });

    test('cenário 7 — perfil da clínica: 3 campos com estados independentes (UC-41, STEP 8 #10)', async ({
      page,
    }) => {
      await loginAs(page, CLINIC_ADMIN_A_CREDENTIALS, '/clinic/dashboard');
      await page.goto('/clinic/profile');
      await expect(page.getByRole('heading', { name: 'Meu Perfil' })).toBeVisible();
      await expect(field(page, 'currentPassword')).toBeVisible();
      await expectEveryPasswordFieldHasToggle(page);

      await expect(field(page, 'newPassword')).toHaveAttribute('minlength', '6');
      await expectThreeIndependentFields(page);
    });
  });

  test.describe('Troca obrigatória de senha (UC-06)', () => {
    test.beforeEach(async () => {
      await grantRequirePasswordChange();
    });

    // Roda mesmo se o teste falhar — sem isso clinicAdminA ficaria preso em
    // /change-password e quebraria o resto da suíte (§8.2, Observações).
    test.afterEach(async () => {
      await restoreClinicAdminA();
    });

    test('cenário 8 — cada um dos 3 campos tem o próprio olho, sem enviar o formulário (STEP 8 #16)', async ({
      page,
    }) => {
      await loginAs(page, CLINIC_ADMIN_A_CREDENTIALS, '/change-password');
      await expect(page.getByRole('heading', { name: 'Trocar Senha' })).toBeVisible();
      await expect(field(page, 'currentPassword')).toBeVisible();

      for (const id of ['currentPassword', 'newPassword', 'confirmPassword']) {
        await field(page, id).fill(DUMMY_VALUE);
        await expectToggle(page, id);
      }

      // Admin SDK: nada foi enviado — a claim continua pendente até o afterEach.
      const userRecord = await getEmulatorAdminAuth().getUser(CLINIC_ADMIN_A.uid);
      expect(userRecord.customClaims?.requirePasswordChange).toBe(true);
    });
  });

  test.describe('Redefinição por token (UC-08)', () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    let tokenDocId: string | undefined;

    test.beforeEach(async () => {
      const now = Date.now();
      const ref = await getEmulatorAdminFirestore()
        .collection(RESET_TOKENS_COLLECTION)
        .add({
          token_hash: hashTokenLikeApp(rawToken),
          user_id: CLINIC_ADMIN_A.uid,
          user_email: CLINIC_ADMIN_A.email,
          expires_at: Timestamp.fromMillis(now + 30 * 60_000),
          created_at: Timestamp.fromMillis(now),
          created_by: SYSTEM_ADMIN.uid,
        });
      tokenDocId = ref.id;
    });

    // Roda mesmo se o teste falhar: não deixa token válido sobrando no emulador.
    test.afterEach(async () => {
      if (tokenDocId) {
        await getEmulatorAdminFirestore()
          .collection(RESET_TOKENS_COLLECTION)
          .doc(tokenDocId)
          .delete();
        tokenDocId = undefined;
      }
    });

    test('cenário 9 — foco inicial no campo e um olho por campo, sem enviar o formulário (STEP 8 #16)', async ({
      page,
    }) => {
      await page.goto(`/reset-password/${rawToken}`);
      await expect(page.getByRole('heading', { name: 'Nova Senha' })).toBeVisible();

      // `autoFocus` continua no <input>, não no botão.
      await expect(field(page, 'newPassword')).toBeFocused();

      for (const id of ['newPassword', 'confirmPassword']) {
        await field(page, id).fill(DUMMY_VALUE);
        await expectToggle(page, id);
      }

      // Firestore (Admin SDK): o token não foi consumido — nada foi enviado.
      const tokenDoc = await getEmulatorAdminFirestore()
        .collection(RESET_TOKENS_COLLECTION)
        .doc(tokenDocId as string)
        .get();
      expect(tokenDoc.exists).toBe(true);
      expect(tokenDoc.data()?.used_at).toBeUndefined();
    });
  });

  test.describe('Diálogos de criação de usuário (UC-40, UC-39)', () => {
    test('cenário 10 — clínica: olho no campo de senha, autocomplete new-password e reinício ao reabrir (UC-40, STEP 8 #11)', async ({
      page,
    }) => {
      await loginAs(page, CLINIC_ADMIN_A_CREDENTIALS, '/clinic/dashboard');
      await page.goto('/clinic/my-clinic');
      await page.getByRole('tab', { name: 'Usuários' }).click();

      const openButton = page.getByRole('button', { name: 'Adicionar Usuário' });
      await expect(openButton).toBeEnabled();
      await openButton.click();
      const dialog = page.getByRole('dialog', { name: 'Adicionar Novo Usuário' });
      await expect(dialog).toBeVisible();
      await expectEveryPasswordFieldHasToggle(page, dialog);

      await expect(field(page, 'password')).toHaveAttribute('autocomplete', 'new-password');
      await field(page, 'password').fill(DUMMY_VALUE);
      await expectToggle(page, 'password');

      // RF-05: revelar, fechar com Esc e reabrir → volta oculto.
      await toggle(page, 'password').click();
      await expectVisible(page, 'password');
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();

      await openButton.click();
      await expect(dialog).toBeVisible();
      await expectHidden(page, 'password');
      // "Criar Usuário" nunca é clicado.
    });

    test('cenário 11 — admin no detalhe da clínica: olho no campo de senha do novo usuário (UC-39, STEP 8 #12)', async ({
      page,
    }) => {
      await loginAs(page, SYSTEM_ADMIN_CREDENTIALS, '/admin/dashboard');
      await page.goto(`/admin/tenants/${TEST_TENANTS.clinicA.tenant_id}`);

      const openButton = page.getByRole('button', { name: 'Adicionar Usuário' });
      await expect(openButton).toBeEnabled();
      await openButton.click();
      const dialog = page.getByRole('dialog', { name: 'Adicionar Novo Usuário' });
      await expect(dialog).toBeVisible();
      await expectEveryPasswordFieldHasToggle(page, dialog);

      await expect(field(page, 'newUserPassword')).toHaveAttribute('autocomplete', 'new-password');
      await field(page, 'newUserPassword').fill(DUMMY_VALUE);
      await expectToggle(page, 'newUserPassword');
    });
  });

  test.describe('Definir Senha Manualmente (UC-37, UC-30 — regressão UX-017)', () => {
    test('cenário 12 — usuário: um olho por campo, cada um com nome próprio (UC-37, STEP 8 #13)', async ({
      page,
    }) => {
      await loginAs(page, SYSTEM_ADMIN_CREDENTIALS, '/admin/dashboard');
      await page.goto('/admin/users');
      await page.getByPlaceholder(USERS_SEARCH_PLACEHOLDER).fill(TEST_USERS.clinicUserA.email);
      const row = page.locator('tr').filter({ hasText: TEST_USERS.clinicUserA.email });
      await row.getByRole('button', { name: 'Editar' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(field(page, 'newPassword')).toBeVisible();
      await expectEveryPasswordFieldHasToggle(page, dialog);

      await expectSetPasswordFieldsIndependent(page);
      // "Definir Senha" nunca é clicado.
    });

    test('cenário 13 — consultor: um olho por campo, cada um com nome próprio (UC-30, STEP 8 #13)', async ({
      page,
    }) => {
      await loginAs(page, SYSTEM_ADMIN_CREDENTIALS, '/admin/dashboard');
      await page.goto(`/admin/consultants/${TEST_USERS.consultant.uid}`);
      await expect(page.getByRole('heading', { name: 'Gerenciamento de Senha' })).toBeVisible();
      await expect(field(page, 'newPassword')).toBeVisible();
      await expectEveryPasswordFieldHasToggle(page);

      await expectSetPasswordFieldsIndependent(page);
      // "Definir Senha" nunca é clicado.
    });
  });
});
