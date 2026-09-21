import { test, expect } from '@playwright/test';
import { FieldValue } from 'firebase-admin/firestore';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminAuth, getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_USERS } from './fixtures/seed-data';

/**
 * Cobertura retroativa (Modo B) de:
 * ONLY_FOR_DEVS/PO_BA_Docs/UC-06-trocar-senha-obrigatoria-no-primeiro-acesso.md (v1.6)
 *
 * Cobre: Fluxo Principal (passos 1-11), Fluxo Alternativo 7a (usuário não
 * autenticado acessa /change-password diretamente), Fluxo Alternativo 7b
 * (falha ao limpar a flag no backend + retry sem reautenticação — corrigido
 * no commit `c3f18d4`), Fluxo de Exceção 8a (senha atual incorreta) e Fluxo
 * de Exceção 8d (quatro variações de falha de validação no frontend: senha
 * curta, senha sem nenhuma letra — RN-02, commit `1254abb` —, confirmação
 * divergente, nova senha igual à atual).
 *
 * SUPOSIÇÃO ASSUMIDA NESTA RODADA (Modo B — favor confirmar na revisão):
 * O seed determinístico atual (tests/e2e/fixtures/seed-data.ts /
 * scripts/seed-emulator.ts) não contém nenhum usuário com a custom claim
 * `requirePasswordChange: true` — essa claim só nasce via UC-28 (criação de
 * consultor) ou UC-30/UC-37 (redefinição manual de senha pelo System
 * Admin), nenhum dos quais faz parte do seed hoje. Em vez de reexecutar
 * esses UCs inteiros só para chegar à pré-condição deste UC-06, esta suíte
 * simula a pré-condição diretamente via Admin SDK (`setCustomUserClaims`)
 * sobre um usuário JÁ SEEDADO — `TEST_USERS.clinicAdminA` — sem inventar
 * nenhum usuário novo. Esse usuário foi escolhido (em vez de clinicUserA/
 * clinicAdminB) porque é um dos dois únicos usuários do seed com aceite
 * completo dos documentos legais (`user_document_acceptances`, ver
 * scripts/seed-emulator.ts): sem isso, o `TermsInterceptor` — que envolve
 * toda a árvore de rotas autenticadas, inclusive `/change-password`, que
 * NÃO está em `PUBLIC_ROUTES` — redirecionaria para `/accept-terms` antes
 * mesmo do formulário de troca de senha aparecer, mascarando o cenário sob
 * teste. `systemAdmin` também tem aceite completo, mas é excluído pela
 * RN-06 do próprio UC (system_admin nunca passa por este fluxo).
 *
 * Como toda a suíte compartilha um único emulador semeado uma única vez
 * (playwright.config.ts: `fullyParallel: false`, `workers: 1`), os testes
 * que efetivamente completam a troca de senha (Fluxo Principal e 7b) mudam
 * a senha REAL de `clinicAdminA` no Auth emulado — por isso `afterEach`
 * restaura, a cada teste deste arquivo, tanto as custom claims quanto a
 * senha (`TEST_PASSWORD`) e os campos gravados em `users/{uid}` ao estado
 * original do seed, para não quebrar outros specs (ex.: UC-01, Fluxo
 * Alternativo 7a) que logam como `clinicAdminA` esperando `TEST_PASSWORD`.
 *
 * NÃO cobertos nesta rodada (limitação da infraestrutura de testes atual,
 * não do UC em si):
 * - 8b (`auth/weak-password` do Firebase Auth): inalcançável por uma
 *   submissão normal via UI — `validatePassword(newPassword, { minLength: 6 })`
 *   já reprova no frontend (Fluxo de Exceção 8d) qualquer senha fraca antes
 *   de `updatePassword` ser chamado.
 * - 8c (`auth/requires-recent-login`): a reautenticação do passo 6 evita
 *   isso na prática; forçar uma sessão "antiga demais" no meio do teste
 *   exigiria manipular o relógio/token do Firebase Auth Emulator, sem
 *   mecanismo disponível hoje nesta suíte.
 * - 8e (erro genérico não mapeado do Firebase Auth): exigiria injetar uma
 *   falha arbitrária dentro do SDK client-side do Firebase Auth no meio do
 *   fluxo — fora do alcance da interceptação de rede (`page.route`) usada
 *   nesta suíte para simular falhas de API (ver 7b, que intercepta a
 *   chamada de backend, não o SDK client-side).
 */

const CLINIC_ADMIN_A = TEST_USERS.clinicAdminA;

async function grantRequirePasswordChange(): Promise<void> {
  const auth = getEmulatorAdminAuth();
  await auth.setCustomUserClaims(CLINIC_ADMIN_A.uid, {
    ...CLINIC_ADMIN_A.claims,
    requirePasswordChange: true,
  });
}

async function restoreClinicAdminA(): Promise<void> {
  const auth = getEmulatorAdminAuth();
  const db = getEmulatorAdminFirestore();
  // Restaura claims e senha originais do seed -- necessário mesmo quando o
  // teste não chegou a trocar a senha de verdade (idempotente e barato).
  await auth.setCustomUserClaims(CLINIC_ADMIN_A.uid, CLINIC_ADMIN_A.claims);
  await auth.updateUser(CLINIC_ADMIN_A.uid, { password: TEST_PASSWORD });
  await db.doc(`users/${CLINIC_ADMIN_A.uid}`).update({
    requirePasswordChange: FieldValue.delete(),
    passwordChangedAt: FieldValue.delete(),
  });
}

test.describe('UC-06 — Trocar Senha Obrigatória no Primeiro Acesso', () => {
  test.beforeEach(async () => {
    await grantRequirePasswordChange();
  });

  test.afterEach(async () => {
    await restoreClinicAdminA();
  });

  test.describe('Fluxo Principal', () => {
    test('usuário troca a senha com sucesso e é redirecionado ao dashboard do seu papel (passos 1-11)', async ({
      page,
    }) => {
      // Passo 1 (via UC-04): login com requirePasswordChange=true redireciona
      // direto para /change-password, antes de qualquer outra tela.
      await loginAs(
        page,
        { email: CLINIC_ADMIN_A.email, password: TEST_PASSWORD },
        '/change-password'
      );

      // Passo 3: formulário "Trocar Senha", alerta de senha temporária, três campos.
      await expect(page.getByRole('heading', { name: 'Trocar Senha' })).toBeVisible();
      await expect(
        page.getByText(
          'Você está usando uma senha temporária. Por segurança, defina uma nova senha.'
        )
      ).toBeVisible();
      await expect(page.locator('#currentPassword')).toBeVisible();
      await expect(page.locator('#newPassword')).toBeVisible();
      await expect(page.locator('#confirmPassword')).toBeVisible();

      // Passos 4-7: preenche e submete -- nova senha diferente da atual, com
      // pelo menos uma letra (RN-02) e >= 6 caracteres.
      await page.locator('#currentPassword').fill(TEST_PASSWORD);
      await page.locator('#newPassword').fill('NovaSenha456');
      await page.locator('#confirmPassword').fill('NovaSenha456');
      await page.getByRole('button', { name: 'Definir Nova Senha' }).click();

      // Passo 10: response.ok === true -> redireciona por role.
      // clinic_admin -> /clinic/dashboard.
      await expect(page).toHaveURL(/\/clinic\/dashboard/);

      // Pós-condição de sucesso (Firebase Auth, via Admin SDK): a claim
      // requirePasswordChange é REMOVIDA (desestruturação), não setada para
      // false -- ver route.ts, passo 9 do UC.
      const userRecord = await getEmulatorAdminAuth().getUser(CLINIC_ADMIN_A.uid);
      expect(userRecord.customClaims?.requirePasswordChange).toBeUndefined();

      // Pós-condição de sucesso (Firestore): users/{uid} atualizado.
      const userDoc = await getEmulatorAdminFirestore().doc(`users/${CLINIC_ADMIN_A.uid}`).get();
      const userData = userDoc.data();
      expect(userData?.requirePasswordChange).toBe(false);
      expect(userData?.passwordChangedAt).toBeTruthy();
    });
  });

  test.describe('Fluxo Alternativo 7a — usuário não autenticado acessa /change-password diretamente', () => {
    test('redireciona para /login sem exibir o formulário (passos 1-3)', async ({ page }) => {
      await page.goto('/change-password');

      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole('heading', { name: 'Trocar Senha' })).toHaveCount(0);
    });
  });

  test.describe('Fluxo Alternativo 7b — falha ao limpar a flag no backend, com retry sem reautenticação (corrigido, commit c3f18d4)', () => {
    test('primeira submissão falha após a senha já ter sido trocada; retry sem campos de senha conclui com sucesso', async ({
      page,
    }) => {
      let attempt = 0;
      await page.route('**/api/users/clear-password-change-flag', async (route) => {
        attempt += 1;
        if (attempt === 1) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Erro forçado pelo teste' }),
          });
          return;
        }
        await route.continue();
      });

      await loginAs(
        page,
        { email: CLINIC_ADMIN_A.email, password: TEST_PASSWORD },
        '/change-password'
      );

      await page.locator('#currentPassword').fill(TEST_PASSWORD);
      await page.locator('#newPassword').fill('OutraSenha789');
      await page.locator('#confirmPassword').fill('OutraSenha789');
      await page.getByRole('button', { name: 'Definir Nova Senha' }).click();

      // Passo 2 do fluxo 7b: erro explícito exibido -- a senha JÁ foi
      // trocada no Firebase Auth (passo 7 do fluxo principal); o sistema não
      // avança para o redirecionamento.
      await expect(
        page.getByText(
          'Sua senha foi alterada com sucesso, mas houve um erro ao concluir o processo. Clique em "Tentar novamente" abaixo.'
        )
      ).toBeVisible();

      // Passo 3: os três campos de senha ficam ocultos; botão vira "Tentar novamente".
      await expect(page.locator('#currentPassword')).toHaveCount(0);
      await expect(page.locator('#newPassword')).toHaveCount(0);
      await expect(page.locator('#confirmPassword')).toHaveCount(0);
      const retryButton = page.getByRole('button', { name: 'Tentar novamente' });
      await expect(retryButton).toBeVisible();

      // Passos 4-6: retry sem reautenticar (nenhum campo de senha visível na
      // tela) -- desta vez a API responde com sucesso.
      await retryButton.click();
      await expect(page).toHaveURL(/\/clinic\/dashboard/);
      expect(attempt).toBe(2);

      const userRecord = await getEmulatorAdminAuth().getUser(CLINIC_ADMIN_A.uid);
      expect(userRecord.customClaims?.requirePasswordChange).toBeUndefined();
    });
  });

  test.describe('Fluxo de Exceção 8a — senha atual incorreta', () => {
    test('exibe "Senha atual incorreta" e não altera a senha nem as claims (garantia mínima de falha)', async ({
      page,
    }) => {
      await loginAs(
        page,
        { email: CLINIC_ADMIN_A.email, password: TEST_PASSWORD },
        '/change-password'
      );

      await page.locator('#currentPassword').fill('SenhaErradaDeProposito1');
      await page.locator('#newPassword').fill('NovaSenha456');
      await page.locator('#confirmPassword').fill('NovaSenha456');
      await page.getByRole('button', { name: 'Definir Nova Senha' }).click();

      await expect(page.getByText('Senha atual incorreta')).toBeVisible();

      // Caso de uso retorna ao passo 4: campos de senha continuam visíveis.
      await expect(page.locator('#currentPassword')).toBeVisible();

      // Garantia mínima de falha (Firebase Auth, via Admin SDK): claims
      // inalteradas -- requirePasswordChange continua true.
      const userRecord = await getEmulatorAdminAuth().getUser(CLINIC_ADMIN_A.uid);
      expect(userRecord.customClaims?.requirePasswordChange).toBe(true);
    });
  });

  test.describe('Fluxo de Exceção 8d — falha de validação no frontend', () => {
    test('nova senha com menos de 6 caracteres é reprovada', async ({ page }) => {
      await loginAs(
        page,
        { email: CLINIC_ADMIN_A.email, password: TEST_PASSWORD },
        '/change-password'
      );

      await page.locator('#currentPassword').fill(TEST_PASSWORD);
      await page.locator('#newPassword').fill('abc12');
      await page.locator('#confirmPassword').fill('abc12');
      await page.getByRole('button', { name: 'Definir Nova Senha' }).click();

      await expect(page.getByText('Senha deve ter pelo menos 6 caracteres')).toBeVisible();
    });

    test('nova senha sem nenhuma letra é reprovada (RN-02, commit 1254abb)', async ({ page }) => {
      await loginAs(
        page,
        { email: CLINIC_ADMIN_A.email, password: TEST_PASSWORD },
        '/change-password'
      );

      await page.locator('#currentPassword').fill(TEST_PASSWORD);
      await page.locator('#newPassword').fill('123456');
      await page.locator('#confirmPassword').fill('123456');
      await page.getByRole('button', { name: 'Definir Nova Senha' }).click();

      await expect(page.getByText('Senha deve conter pelo menos uma letra')).toBeVisible();
    });

    test('confirmação divergente da nova senha é reprovada', async ({ page }) => {
      await loginAs(
        page,
        { email: CLINIC_ADMIN_A.email, password: TEST_PASSWORD },
        '/change-password'
      );

      await page.locator('#currentPassword').fill(TEST_PASSWORD);
      await page.locator('#newPassword').fill('NovaSenha456');
      await page.locator('#confirmPassword').fill('OutraSenhaXYZ');
      await page.getByRole('button', { name: 'Definir Nova Senha' }).click();

      await expect(page.getByText('As senhas não coincidem')).toBeVisible();
    });

    test('nova senha igual à senha atual é reprovada', async ({ page }) => {
      await loginAs(
        page,
        { email: CLINIC_ADMIN_A.email, password: TEST_PASSWORD },
        '/change-password'
      );

      await page.locator('#currentPassword').fill(TEST_PASSWORD);
      await page.locator('#newPassword').fill(TEST_PASSWORD);
      await page.locator('#confirmPassword').fill(TEST_PASSWORD);
      await page.getByRole('button', { name: 'Definir Nova Senha' }).click();

      await expect(page.getByText('A nova senha deve ser diferente da senha atual')).toBeVisible();

      // Garantia mínima de falha: claims inalteradas.
      const userRecord = await getEmulatorAdminAuth().getUser(CLINIC_ADMIN_A.uid);
      expect(userRecord.customClaims?.requirePasswordChange).toBe(true);
    });
  });
});
