import { test, expect, Page } from '@playwright/test';
import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminFirestore, getEmulatorAdminAuth } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_USERS } from './fixtures/seed-data';

/**
 * Cobertura retroativa (Modo B) de:
 * ONLY_FOR_DEVS/PO_BA_Docs/UC-08-system-admin-envia-link-de-redefinicao-de-senha.md (v1.2.2)
 *
 * Cobre: Fluxo Principal (variante usuário, passos 1-19 completos, incluindo a
 * continuação self-service do usuário-alvo e RN-06; e variante consultor,
 * passos 1-12, mesma tela `admin/consultants/[id]`), Fluxo Alternativo 7a
 * (admin cancela a confirmação) e 7b (link já usado), e Fluxos de Exceção 8a
 * (alvo é system_admin, RN-05), 8b (usuário/consultor não encontrado, duas
 * variantes de rota), 8c (consultor sem `user_id` vinculado), 8d (token
 * expirado), 8e (token inválido/inexistente) e 8f (nova senha inválida, RN-08,
 * três sub-casos).
 *
 * Suposições assumidas nesta rodada (Modo B, a confirmar pelo revisor humano):
 * - RN-06 (remoção de `requirePasswordChange`) é exercitada setando essa claim
 *   manualmente como `true` no usuário-alvo (`qa-clinic-user-a`) ANTES do
 *   fluxo, via Admin SDK, já que nenhum usuário semeado nasce com essa claim.
 *   Isso é setup de teste sobre um usuário já semeado (não um usuário novo) e
 *   deixa a claim residual como `false` (não removida, igual ao comportamento
 *   real da API) até a próxima re-semeadura completa do emulador.
 * - Exceção 8a só é alcançável via chamada direta à API
 *   (`POST /api/users/{id}/reset-password`) — a UI de `/admin/users` já
 *   esconde o botão "Editar" para linhas com `role: "system_admin"` (conferido
 *   nesta suíte), então não há caminho de clique real que dispare esse 403;
 *   por isso o teste também confirma essa ausência de botão antes de chamar a
 *   API diretamente, usando um ID token obtido via REST do Auth Emulator.
 * - Exceção 8c (consultor sem `user_id`) exige um documento
 *   `consultants/{id}` sem esse campo, estado que não existe no seed atual e
 *   que a UI normal nunca produz — o documento é criado ad-hoc via Admin SDK
 *   dentro do próprio teste (não é um novo usuário de Auth, apenas um
 *   documento Firestore isolado, id `qa-uc08-consultant-no-user-id`).
 * - Exceção 8d (token expirado) é montada escrevendo diretamente um documento
 *   em `password_reset_tokens` com `expires_at` no passado, replicando o
 *   formato exato gravado por `createPasswordResetToken`
 *   (`src/lib/services/passwordResetService.ts`) — não há como produzir um
 *   token realmente expirado em segundos dentro de um teste automatizado.
 * - RN-04 (ausência de rate-limiting) e RNF-03 (auditoria sobrescreve, não
 *   acumula histórico) são observações do UC sem comportamento adicional a
 *   testar além do que os fluxos acima já cobrem — não geraram testes
 *   dedicados.
 */

const RESET_TOKENS_COLLECTION = 'password_reset_tokens';
const EMAIL_QUEUE_COLLECTION = 'email_queue';
const SEARCH_PLACEHOLDER = 'Buscar por nome, email ou clínica...';

/** Réplica de `maskEmail` (passwordResetService.ts) só para montar a expectativa do teste. */
function maskEmailLikeApp(email: string): string {
  const [localPart, domain] = email.split('@');
  const maskedLocal =
    localPart.length <= 2
      ? localPart[0] + '***'
      : localPart[0] + '***' + localPart[localPart.length - 1];
  return `${maskedLocal}@${domain}`;
}

/** Réplica de `hashToken` (passwordResetService.ts) só para montar a expectativa do teste. */
function hashTokenLikeApp(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Extrai o token bruto (64 chars hex) do HTML do e-mail enfileirado em
 * `email_queue`, simulando o link que o usuário-alvo realmente clicaria no
 * e-mail recebido (passo 13 do Fluxo Principal). O token bruto nunca é
 * persistido em nenhum outro lugar (RN-01) — este é o único ponto legítimo de
 * onde um teste consegue obtê-lo.
 */
function extractResetTokenFromEmailBody(body: string): string {
  const match = body.match(/reset-password\/([0-9a-f]{64})/);
  if (!match) {
    throw new Error('Token de reset não encontrado no corpo do e-mail enfileirado.');
  }
  return match[1];
}

async function getLatestResetTokenRawForUid(uid: string): Promise<string> {
  const db = getEmulatorAdminFirestore();
  const snap = await db
    .collection(EMAIL_QUEUE_COLLECTION)
    .where('metadata.user_id', '==', uid)
    .where('type', '==', 'password_reset')
    .get();
  expect(snap.empty).toBe(false);
  // Pega o e-mail enfileirado mais recente (por `created_at`), robusto mesmo
  // se mais de um token já tiver sido gerado para o mesmo uid nesta suíte.
  const docs = snap.docs.sort(
    (a, b) => (b.data().created_at?.toMillis?.() ?? 0) - (a.data().created_at?.toMillis?.() ?? 0)
  );
  return extractResetTokenFromEmailBody(docs[0].data().body as string);
}

/**
 * Faz login via REST direto no Auth Emulator (fora do browser) para obter um
 * ID token utilizável em chamadas de API cruas via `request`/`page.request`.
 * Necessário apenas para os cenários de exceção que a UI propositalmente não
 * expõe (8a, 8b, 8c) — não há caminho de clique real para chegar a eles.
 */
async function getIdTokenViaAuthEmulator(email: string, password: string): Promise<string> {
  const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!authEmulatorHost) {
    throw new Error(
      'FIREBASE_AUTH_EMULATOR_HOST não definido — este spec só roda via `firebase emulators:exec` ' +
        '(npm run test:e2e), igual às demais suítes desta pasta.'
    );
  }
  const response = await fetch(
    `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await response.json();
  if (!data.idToken) {
    throw new Error(`Falha ao autenticar ${email} via Auth Emulator REST: ${JSON.stringify(data)}`);
  }
  return data.idToken as string;
}

/** Passos 1-2: abre `/admin/users`, busca pelo e-mail e clica em "Editar" na linha correspondente. */
async function openEditDialogForUser(page: Page, email: string): Promise<void> {
  await page.goto('/admin/users');
  await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill(email);
  const row = page.locator('tr').filter({ hasText: email });
  await row.getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('UC-08 — System Admin Envia Link de Redefinição de Senha', () => {
  test.describe('Fluxo Principal', () => {
    test('variante usuário: admin envia o link, usuário-alvo completa a redefinição e RN-06 remove requirePasswordChange (passos 1-19)', async ({
      page,
    }) => {
      const target = TEST_USERS.clinicUserA;
      const adminAuth = getEmulatorAdminAuth();

      // Este teste muda a senha REAL de clinicUserA (self-service, passo 15) --
      // sem restaurar TEST_PASSWORD ao final, qualquer spec que rode depois
      // (ordem alfabética de arquivo, workers:1) e tente logar como
      // clinicUserA com a senha padrão falharia (achado empírico: UC-09
      // ficava preso em /login por causa exatamente disso). try/finally
      // garante a restauração mesmo se alguma asserção no meio falhar.
      try {
        // Setup: simula que o usuário-alvo tinha uma troca de senha obrigatória
        // pendente (UC-06), para poder observar RN-06 removê-la ao final deste
        // fluxo. Nenhum usuário semeado nasce com essa claim.
        await adminAuth.setCustomUserClaims(target.uid, {
          ...target.claims,
          requirePasswordChange: true,
        });

        // Passo 1: System Admin loga e acessa /admin/users.
        await loginAs(
          page,
          { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
          '/admin/dashboard'
        );
        await openEditDialogForUser(page, target.email);
        await expect(
          page.getByText(`Edite as informações do usuário ${target.email}`)
        ).toBeVisible();

        // Passo 2: clica no botão de redefinir senha (distinto de "Definir Senha Manualmente").
        await page.getByRole('button', { name: 'Enviar Link de Reset' }).click();

        // Passo 3: AlertDialog padrão do sistema (RNF-02), não confirm() nativo.
        const confirmDialog = page.getByRole('alertdialog');
        await expect(confirmDialog.getByRole('heading', { name: 'Redefinir senha' })).toBeVisible();
        await expect(confirmDialog).toContainText(
          `Tem certeza que deseja redefinir a senha de ${target.email}?`
        );
        await expect(confirmDialog).toContainText(
          'Um email será enviado com um link seguro para o usuário definir uma nova senha.'
        );

        // Passos 4-12: confirma, API cria token + enfileira e-mail + audita.
        await confirmDialog.getByRole('button', { name: 'Confirmar' }).click();
        await expect(page.getByText('Email enviado com sucesso!')).toBeVisible();
        await expect(page.getByText('Enviado para:')).toContainText(target.email);

        const db = getEmulatorAdminFirestore();

        // Pós-condição (Parte 1): token criado com hash SHA-256, expiração de
        // ~30min, sem o token bruto persistido em nenhum campo (RN-01/RN-02).
        const tokenSnap = await db
          .collection(RESET_TOKENS_COLLECTION)
          .where('user_id', '==', target.uid)
          .get();
        expect(tokenSnap.size).toBe(1);
        const tokenDoc = tokenSnap.docs[0].data();
        expect(tokenDoc.user_email).toBe(target.email);
        expect(tokenDoc.created_by).toBe(TEST_USERS.systemAdmin.uid);
        expect(tokenDoc.used_at).toBeUndefined();
        expect((tokenDoc as Record<string, unknown>).token).toBeUndefined();
        expect((tokenDoc as Record<string, unknown>).raw_token).toBeUndefined();
        const expiresAtMs = (tokenDoc.expires_at as Timestamp).toMillis();
        const expectedExpiryMs = Date.now() + 30 * 60 * 1000;
        expect(Math.abs(expiresAtMs - expectedExpiryMs)).toBeLessThan(60_000);

        // Pós-condição: e-mail enfileirado em email_queue (type: password_reset).
        const rawToken = await getLatestResetTokenRawForUid(target.uid);
        expect(hashTokenLikeApp(rawToken)).toBe(tokenDoc.token_hash);
        const emailSnap = await db
          .collection(EMAIL_QUEUE_COLLECTION)
          .where('metadata.user_id', '==', target.uid)
          .get();
        expect(emailSnap.size).toBe(1);
        expect(emailSnap.docs[0].data().to).toBe(target.email);
        expect(emailSnap.docs[0].data().type).toBe('password_reset');

        // Pós-condição: auditoria no documento do usuário-alvo.
        const userDocAfterRequest = await db.doc(`users/${target.uid}`).get();
        expect(userDocAfterRequest.data()?.passwordResetRequestedBy).toBe(
          TEST_USERS.systemAdmin.uid
        );
        expect(userDocAfterRequest.data()?.passwordResetRequestedAt).toBeTruthy();

        // Passo 13: usuário-alvo (self-service) chega em /reset-password/{token}
        // a partir do e-mail recebido. Um usuário real chegaria aqui SEM sessão
        // ativa (link de e-mail, outro dispositivo/aba) -- limpa a sessão do
        // system_admin ainda ativa neste `page` antes de navegar, senão o
        // useEffect reativo de "já autenticado" de /login (mesmo padrão do
        // achado UC-04-Q4) intercepta o redirect final do passo 19 e manda o
        // admin de volta para /admin/dashboard em vez de deixar em /login.
        await page.evaluate(() => {
          sessionStorage.clear();
          localStorage.clear();
        });
        await page.goto(`/reset-password/${rawToken}`);

        // Passo 14: token validado sem ser consumido, e-mail mascarado exibido (RNF-01).
        await expect(page.getByRole('heading', { name: 'Nova Senha' })).toBeVisible();
        await expect(page.getByText(maskEmailLikeApp(target.email))).toBeVisible();

        // Passo 15: nova senha válida (RN-08: validatePassword compartilhada).
        const newPassword = 'NovaSenha123';
        await page.locator('#newPassword').fill(newPassword);
        await page.locator('#confirmPassword').fill(newPassword);

        // Passos 16-18: submete, API consome o token e atualiza a senha.
        await page.getByRole('button', { name: 'Definir Nova Senha' }).click();
        await expect(page.getByRole('heading', { name: 'Senha Redefinida!' })).toBeVisible();

        // Passo 19: redireciona para /login após 3s.
        await expect(page).toHaveURL(/\/login/, { timeout: 8000 });

        // Pós-condição (Parte 2, Esperado Firebase Auth): a senha nova
        // realmente funciona — a evidência mais forte possível sem conseguir
        // ler a senha em si é logar com sucesso usando o valor definido.
        await loginAs(page, { email: target.email, password: newPassword }, '/clinic/dashboard');

        // Pós-condição (Esperado Firestore): token marcado como usado.
        const tokenAfter = await db
          .collection(RESET_TOKENS_COLLECTION)
          .doc(tokenSnap.docs[0].id)
          .get();
        expect(tokenAfter.data()?.used_at).toBeTruthy();

        // Pós-condição (Esperado Custom Claims, RN-06): requirePasswordChange
        // removido/zerado — a claim que setamos como true no início da rodada
        // agora é false, exatamente como a API faz.
        const userRecordAfter = await adminAuth.getUser(target.uid);
        expect(userRecordAfter.customClaims?.requirePasswordChange).toBe(false);

        // Pós-condição (Esperado Firestore): users/{uid} também reflete a troca.
        const userDocFinal = await db.doc(`users/${target.uid}`).get();
        expect(userDocFinal.data()?.requirePasswordChange).toBe(false);
        expect(userDocFinal.data()?.passwordChangedAt).toBeTruthy();
      } finally {
        await adminAuth.updateUser(target.uid, { password: TEST_PASSWORD });
      }
    });

    test('variante consultor: admin envia o link pela tela admin/consultants/[id] (passos 1-12, rota api/consultants/{id}/reset-password)', async ({
      page,
    }) => {
      const target = TEST_USERS.consultant;

      await loginAs(
        page,
        { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
        '/admin/dashboard'
      );

      // Passo 1: tela de edição do consultor (variante de UC-29).
      await page.goto(`/admin/consultants/${target.uid}`);
      await expect(page.getByRole('heading', { name: 'Gerenciamento de Senha' })).toBeVisible();

      // Passo 2.
      await page.getByRole('button', { name: 'Enviar Link de Reset' }).click();

      // Passo 3: mesmo AlertDialog padrão, texto adaptado para "consultor".
      const confirmDialog = page.getByRole('alertdialog');
      await expect(confirmDialog.getByRole('heading', { name: 'Redefinir senha' })).toBeVisible();
      await expect(confirmDialog).toContainText(
        `Tem certeza que deseja redefinir a senha de ${target.email}?`
      );
      await expect(confirmDialog).toContainText(
        'Um email será enviado com um link seguro para o consultor definir uma nova senha.'
      );

      // Passos 4-12.
      await confirmDialog.getByRole('button', { name: 'Confirmar' }).click();
      await expect(page.getByText('Email enviado com sucesso!')).toBeVisible();
      await expect(page.getByText('Enviado para:')).toContainText(target.email);

      const db = getEmulatorAdminFirestore();

      // Pós-condição: token criado sem tenant_id (rota de consultores não
      // recebe tenantId — diferente da rota de usuários).
      const tokenSnap = await db
        .collection(RESET_TOKENS_COLLECTION)
        .where('user_id', '==', target.uid)
        .get();
      expect(tokenSnap.size).toBe(1);
      const tokenDoc = tokenSnap.docs[0].data();
      expect(tokenDoc.user_email).toBe(target.email);
      expect(tokenDoc.created_by).toBe(TEST_USERS.systemAdmin.uid);
      expect(tokenDoc.tenant_id).toBeUndefined();

      // Pós-condição: e-mail enfileirado com metadata.consultant_id.
      const emailSnap = await db
        .collection(EMAIL_QUEUE_COLLECTION)
        .where('metadata.consultant_id', '==', target.uid)
        .get();
      expect(emailSnap.size).toBe(1);
      expect(emailSnap.docs[0].data().to).toBe(target.email);

      // Pós-condição: auditoria no documento do consultor-alvo.
      const consultantDocAfter = await db.doc(`consultants/${target.uid}`).get();
      expect(consultantDocAfter.data()?.passwordResetRequestedBy).toBe(TEST_USERS.systemAdmin.uid);
      expect(consultantDocAfter.data()?.passwordResetRequestedAt).toBeTruthy();

      // A continuação self-service (passos 13-19) já é coberta integralmente
      // pelo teste da variante usuário acima — o mecanismo de
      // /reset-password/[token] a partir daqui é idêntico para as duas rotas.
    });
  });

  test.describe('Fluxo Alternativo 7a — admin cancela a confirmação', () => {
    test('clicar em "Cancelar" fecha o diálogo sem chamar a API e sem criar nenhum token (passos 1-3)', async ({
      page,
    }) => {
      const target = TEST_USERS.clinicAdminA;

      let apiCalled = false;
      await page.route('**/api/users/*/reset-password', (route) => {
        apiCalled = true;
        return route.continue();
      });

      await loginAs(
        page,
        { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
        '/admin/dashboard'
      );
      await openEditDialogForUser(page, target.email);

      await page.getByRole('button', { name: 'Enviar Link de Reset' }).click();
      const confirmDialog = page.getByRole('alertdialog');
      await expect(confirmDialog).toBeVisible();

      // Passo 1 do fluxo 7a.
      await confirmDialog.getByRole('button', { name: 'Cancelar' }).click();

      // Passo 2: diálogo fecha, nenhuma chamada à API.
      await expect(confirmDialog).toHaveCount(0);
      expect(apiCalled).toBe(false);
      await expect(page.getByText('Email enviado com sucesso!')).toHaveCount(0);

      // Passo 3: caso de uso encerrado sem efeito — nenhum token criado.
      const db = getEmulatorAdminFirestore();
      const tokenSnap = await db
        .collection(RESET_TOKENS_COLLECTION)
        .where('user_id', '==', target.uid)
        .get();
      expect(tokenSnap.empty).toBe(true);
    });
  });

  test.describe('Fluxo Alternativo 7b — usuário-alvo acessa o link após já tê-lo usado', () => {
    test('reabrir o mesmo link consumido exibe "Link Inválido" com a mensagem de link já utilizado (a partir do passo 13)', async ({
      page,
    }) => {
      const target = TEST_USERS.clinicAdminB;
      const adminAuth = getEmulatorAdminAuth();

      // Este teste muda a senha REAL de clinicAdminB (self-service, passo 13)
      // para deixar o link "já usado" -- sem restaurar TEST_PASSWORD ao final,
      // qualquer spec que rode depois (ordem alfabética de arquivo, workers:1)
      // e dependa da senha padrão de clinicAdminB falharia (mesma classe de
      // achado do teste "variante usuário" acima, que afetava clinicUserA e
      // travava specs de UC-09). try/finally garante restauração mesmo se
      // alguma asserção no meio falhar.
      try {
        // Setup: gera e consome um token real via UI, ponta a ponta (mesmo
        // mecanismo do Fluxo Principal), só para deixar o link "já usado".
        await loginAs(
          page,
          { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
          '/admin/dashboard'
        );
        await openEditDialogForUser(page, target.email);
        await page.getByRole('button', { name: 'Enviar Link de Reset' }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar' }).click();
        await expect(page.getByText('Email enviado com sucesso!')).toBeVisible();

        const rawToken = await getLatestResetTokenRawForUid(target.uid);

        // Mesmo achado do teste "variante usuário": limpa a sessão do
        // system_admin antes de completar a redefinição como o usuário-alvo.
        await page.evaluate(() => {
          sessionStorage.clear();
          localStorage.clear();
        });
        await page.goto(`/reset-password/${rawToken}`);
        await expect(page.getByRole('heading', { name: 'Nova Senha' })).toBeVisible();
        await page.locator('#newPassword').fill('SenhaUsada123');
        await page.locator('#confirmPassword').fill('SenhaUsada123');
        await page.getByRole('button', { name: 'Definir Nova Senha' }).click();
        await expect(page.getByRole('heading', { name: 'Senha Redefinida!' })).toBeVisible();

        // Passo 1 do fluxo 7b: reabre o MESMO link, agora já usado.
        await page.goto(`/reset-password/${rawToken}`);

        // Passo 2.
        await expect(page.getByRole('heading', { name: 'Link Inválido' })).toBeVisible();
        await expect(
          page.getByText('Este link já foi utilizado. Solicite um novo reset de senha.')
        ).toBeVisible();
        await expect(
          page.getByText(
            'Se você precisa redefinir sua senha, entre em contato com o administrador do sistema.'
          )
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Voltar ao Login' })).toBeVisible();
      } finally {
        await adminAuth.updateUser(target.uid, { password: TEST_PASSWORD });
      }
    });
  });

  test.describe('Fluxos de Exceção', () => {
    test('8a — alvo é system_admin: 403 (RN-05), inalcançável pela UI porque o botão "Editar" não existe para essa linha', async ({
      page,
      request,
    }) => {
      await loginAs(
        page,
        { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
        '/admin/dashboard'
      );

      // Confirma a premissa: a UI de /admin/users nunca oferece "Editar" para
      // uma linha com role system_admin — por isso este cenário só é
      // alcançável chamando a API diretamente.
      await page.goto('/admin/users');
      await page.getByPlaceholder(SEARCH_PLACEHOLDER).fill(TEST_USERS.systemAdmin.email);
      const systemAdminRow = page.locator('tr').filter({ hasText: TEST_USERS.systemAdmin.email });
      await expect(systemAdminRow).toBeVisible();
      await expect(systemAdminRow.getByRole('button', { name: 'Editar' })).toHaveCount(0);

      // Passos 6-8a: chamada direta à API com um Bearer token de system_admin válido.
      const idToken = await getIdTokenViaAuthEmulator(TEST_USERS.systemAdmin.email, TEST_PASSWORD);
      const response = await request.post(
        `/api/users/${TEST_USERS.systemAdmin.uid}/reset-password`,
        {
          headers: { Authorization: `Bearer ${idToken}` },
        }
      );

      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Não é permitido redefinir senha de administradores do sistema');

      // Garantia mínima de falha: nenhum token criado para o próprio system_admin.
      const db = getEmulatorAdminFirestore();
      const tokenSnap = await db
        .collection(RESET_TOKENS_COLLECTION)
        .where('user_id', '==', TEST_USERS.systemAdmin.uid)
        .get();
      expect(tokenSnap.empty).toBe(true);
    });

    test('8b — usuário não encontrado retorna 404 (rota api/users/{id}/reset-password)', async ({
      request,
    }) => {
      const idToken = await getIdTokenViaAuthEmulator(TEST_USERS.systemAdmin.email, TEST_PASSWORD);
      const response = await request.post('/api/users/uc08-uid-inexistente/reset-password', {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Usuário não encontrado');
    });

    test('8b — consultor não encontrado retorna 404 (rota api/consultants/{id}/reset-password)', async ({
      request,
    }) => {
      const idToken = await getIdTokenViaAuthEmulator(TEST_USERS.systemAdmin.email, TEST_PASSWORD);
      const response = await request.post(
        '/api/consultants/uc08-consultor-inexistente/reset-password',
        {
          headers: { Authorization: `Bearer ${idToken}` },
        }
      );

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Consultor não encontrado');
    });

    test('8c — consultor sem usuário de autenticação vinculado retorna 400', async ({
      request,
    }) => {
      const consultantId = 'qa-uc08-consultant-no-user-id';
      const db = getEmulatorAdminFirestore();
      // Setup: documento ad-hoc de consultants/ SEM user_id, estado que a UI
      // normal nunca produz (todo consultor criado via app já nasce com
      // user_id vinculado) — necessário só para alcançar esta exceção.
      await db.doc(`consultants/${consultantId}`).set({
        code: 'QA9999',
        name: 'Consultor QA Sem Vínculo',
        email: 'qa-uc08-sem-vinculo@example.com',
        status: 'active',
      });

      const idToken = await getIdTokenViaAuthEmulator(TEST_USERS.systemAdmin.email, TEST_PASSWORD);
      const response = await request.post(`/api/consultants/${consultantId}/reset-password`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Consultor não possui usuário de autenticação vinculado');
    });

    test('8d — token expirado exibe "Link Inválido" com a mensagem de expiração (a partir do passo 14)', async ({
      page,
    }) => {
      const target = TEST_USERS.clinicAdminA;
      const rawToken = crypto.randomBytes(32).toString('hex');
      const db = getEmulatorAdminFirestore();
      // Setup: escreve diretamente um token já expirado (formato idêntico ao
      // gravado por createPasswordResetToken) — não há como esperar 30min
      // reais dentro de um teste automatizado.
      await db.collection(RESET_TOKENS_COLLECTION).add({
        token_hash: hashTokenLikeApp(rawToken),
        user_id: target.uid,
        user_email: target.email,
        expires_at: Timestamp.fromMillis(Date.now() - 60_000),
        created_at: Timestamp.now(),
        created_by: TEST_USERS.systemAdmin.uid,
      });

      await page.goto(`/reset-password/${rawToken}`);

      await expect(page.getByRole('heading', { name: 'Link Inválido' })).toBeVisible();
      await expect(
        page.getByText('Este link expirou. Solicite um novo reset de senha.')
      ).toBeVisible();
    });

    test('8e — token inválido/inexistente exibe "Link Inválido" com "Token inválido ou expirado" (a partir do passo 14)', async ({
      page,
    }) => {
      const bogusToken = 'a'.repeat(64);

      await page.goto(`/reset-password/${bogusToken}`);

      await expect(page.getByRole('heading', { name: 'Link Inválido' })).toBeVisible();
      await expect(page.getByText('Token inválido ou expirado')).toBeVisible();
    });

    test('8f — nova senha inválida é reprovada no formulário, sem nenhuma chamada à API (RN-08, três sub-casos)', async ({
      page,
    }) => {
      const target = TEST_USERS.clinicAdminA;

      let apiCalled = false;
      await page.route('**/api/auth/reset-password', (route) => {
        apiCalled = true;
        return route.continue();
      });

      // Setup: gera um token real via UI, do jeito que passo 1-12 fariam.
      await loginAs(
        page,
        { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
        '/admin/dashboard'
      );
      await openEditDialogForUser(page, target.email);
      await page.getByRole('button', { name: 'Enviar Link de Reset' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar' }).click();
      await expect(page.getByText('Email enviado com sucesso!')).toBeVisible();

      const rawToken = await getLatestResetTokenRawForUid(target.uid);
      await page.goto(`/reset-password/${rawToken}`);
      await expect(page.getByRole('heading', { name: 'Nova Senha' })).toBeVisible();

      const submitButton = page.getByRole('button', { name: 'Definir Nova Senha' });

      // Sub-caso 1: menos de 6 caracteres.
      await page.locator('#newPassword').fill('123');
      await page.locator('#confirmPassword').fill('123');
      await submitButton.click();
      await expect(page.getByText('Senha deve ter pelo menos 6 caracteres')).toBeVisible();

      // Sub-caso 2: 6+ caracteres, mas sem nenhuma letra (RN-08, checagem nova
      // desde o commit 1254abb — antes só validava o tamanho).
      await page.locator('#newPassword').fill('123456');
      await page.locator('#confirmPassword').fill('123456');
      await submitButton.click();
      await expect(page.getByText('Senha deve conter pelo menos uma letra')).toBeVisible();

      // Sub-caso 3: senha válida, mas confirmação diferente.
      await page.locator('#newPassword').fill('Abcdef1');
      await page.locator('#confirmPassword').fill('Different1');
      await submitButton.click();
      await expect(page.getByText('As senhas não coincidem')).toBeVisible();

      // Em nenhum dos três sub-casos a validação chegou a sair do frontend.
      expect(apiCalled).toBe(false);
    });
  });
});
