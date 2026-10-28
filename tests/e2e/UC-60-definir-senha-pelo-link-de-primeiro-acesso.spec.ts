import { test, expect, Page, Browser, BrowserContext, APIRequestContext } from '@playwright/test';
import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminAuth, getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_USERS } from './fixtures/seed-data';

/**
 * Caderno da feature (Modo A, spec ainda em TO_DO — o caderno entra no mesmo
 * PR da task) de:
 * ONLY_FOR_DEVS/TO_DO/FEAT-padronizacao-emails-e-links-de-senha.md — §8.2
 * "Playwright + Emulator Suite", bloco "Novo: UC-60-..." (cenários 1 a 10),
 * STEP 12. O número do UC ("UC-60 — Definir senha pelo link de primeiro
 * acesso") ainda depende da confirmação do `uml-use-case-writer` (§8.3).
 *
 * REVISÃO HUMANA OBRIGATÓRIA: spec gerado por IA (qa-agent). Só vira gate de
 * CI depois de rodado localmente (`npm run test:e2e`) e aprovado em PR.
 *
 * Mapeamento teste → cenário da §8.2:
 *  1. clinic_admin cria usuário sem campo de senha; e-mail generic_user_welcome
 *     com link, banner e alt; claims sem requirePasswordChange.
 *  2. Abrir o link e recarregar não altera o token (GET não queima).
 *  3. "Definir minha senha" → salvar → login cai no dashboard, sem /change-password.
 *  4. Reabrir o link já usado: "já foi utilizado" + "Solicitar nova senha".
 *  5. Abrir sem concluir: recarregar mantém o formulário (DN-02); outro
 *     contexto de navegador vê o link como já utilizado.
 *  6. Sessão vencida (session_expires_at no passado): envio falha com
 *     orientação para pedir nova senha.
 *  7. Token first_access com expires_at no passado (72 h): "expirou".
 *  8. System admin cria consultor: consultant_welcome com link; fluxo completo.
 *  9. Aprovação de solicitação: welcome_approval com /reset-password/ (sem
 *     mode=resetPassword).
 * 10. /admin/tenants/new sem campo de senha (DN-01): generic_user_welcome para
 *     o admin da clínica; nenhum requirePasswordChange.
 *
 * Assunções para a revisão humana (favor confirmar):
 * A1. Os cenários 2 a 6 criam o usuário por `POST /api/users/create` (mesma
 *     rota que a UsersTab usa no cenário 1), autenticado como clinicAdminA via
 *     REST do Auth Emulator (padrão UC-02/UC-08) — repetir a criação pela UI
 *     em cada teste só somaria tempo sem cobrir nada novo.
 * A2. O token cru é extraído do corpo do e-mail em `email_queue` (único lugar
 *     onde ele existe) e a navegação usa o caminho relativo
 *     `/reset-password/<token>` — independente da base do link (as
 *     asserções de conteúdo só olham o caminho do link e do banner).
 * A3. Usuários novos não têm aceite dos documentos legais, e o
 *     TermsInterceptor levaria para /accept-terms depois do login. Antes de
 *     logar (cenários 3 e 8), o teste grava, via Admin SDK, o aceite de todos
 *     os `legal_documents` ativos para o usuário recém-criado — setup, não
 *     parte do que está sendo verificado.
 * A4. Cenário 4: depois de salvar a senha o token fica com `used_at`, então a
 *     mensagem exibida é a de `used` ("Este link já foi utilizado. Solicite
 *     uma nova senha."). A mensagem "Este link de primeiro acesso já foi
 *     utilizado..." (estado `opened`) é a do cenário 5 (aberto e não concluído).
 * A5. Cenário 6: o link é aberto de verdade (sessão real gravada na aba) e só
 *     então o `session_expires_at` do doc é movido para o passado via Admin
 *     SDK — a sessão continua válida no sessionStorage (o cliente usa a
 *     validade devolvida na abertura), e quem recusa é o servidor no envio.
 * A6. Cenário 7: o doc de token é gravado direto em `password_reset_tokens`
 *     (formato de `createPasswordToken`, purpose first_access) para o usuário
 *     semeado clinicUserA, e apagado ao final (padrão UC-08 8d / UX-060 A3).
 * A7. Limpeza: todo usuário criado aqui (Auth, `users`, aceites, tokens e,
 *     quando houver, `consultants` e `tenants`) é removido no `afterEach`.
 *     Importante para clinicA, que tem `max_users: 5` e é usada por specs
 *     posteriores (UX-060).
 * A8. O self-service do usuário-alvo (abrir link, salvar senha, logar) roda em
 *     um contexto de navegador novo, sem a sessão do admin que criou a conta —
 *     como um usuário real chegando pelo e-mail.
 */

const EMAIL_QUEUE = 'email_queue';
const TOKENS = 'password_reset_tokens';

const FIRST_ACCESS_TTL_MS = 72 * 60 * 60 * 1000;
const SESSION_TTL_MS = 30 * 60 * 1000;

const MSG_OPENED = 'Este link de primeiro acesso já foi utilizado. Solicite uma nova senha.';
const MSG_USED = 'Este link já foi utilizado. Solicite uma nova senha.';
const MSG_EXPIRED = 'Este link expirou. Solicite uma nova senha.';
const MSG_SESSION_EXPIRED = 'Sua sessão para definir a senha expirou. Solicite uma nova senha.';

const NEW_PASSWORD = 'PrimeiroAcesso1';

type WelcomeType = 'generic_user_welcome' | 'consultant_welcome' | 'welcome_approval';

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function uniqueEmail(scenario: string): string {
  return `qa-uc60-${scenario}-${uniqueSuffix()}@example.com`;
}

/** Réplica de `hashToken` (passwordResetService.ts). */
function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Réplica de `maskEmail` (passwordResetService.ts). */
function maskEmailLikeApp(email: string): string {
  const [localPart, domain] = email.split('@');
  const maskedLocal =
    localPart.length <= 2
      ? localPart[0] + '***'
      : localPart[0] + '***' + localPart[localPart.length - 1];
  return `${maskedLocal}@${domain}`;
}

function baseURL(): string {
  const url = test.info().project.use.baseURL;
  if (!url) throw new Error('baseURL não configurada em playwright.config.ts');
  return url;
}

/** Contexto novo, sem sessão do admin (A8). */
async function newVisitorContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ baseURL: baseURL() });
}

/** ID token real via REST do Auth Emulator (mesmo padrão de UC-02/UC-08). */
async function getIdTokenViaAuthEmulator(email: string, password: string): Promise<string> {
  const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!authEmulatorHost) {
    throw new Error(
      'FIREBASE_AUTH_EMULATOR_HOST não definido — este spec só roda via `firebase emulators:exec` (npm run test:e2e).'
    );
  }
  const res = await fetch(
    `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!data.idToken) {
    throw new Error(`Falha ao autenticar ${email} via Auth Emulator REST: ${JSON.stringify(data)}`);
  }
  return data.idToken as string;
}

/** E-mail enfileirado (por destinatário e tipo de template); espera ele aparecer. */
async function waitForQueuedEmail(
  to: string,
  type: WelcomeType
): Promise<FirebaseFirestore.DocumentData> {
  const db = getEmulatorAdminFirestore();
  let found: FirebaseFirestore.DocumentData | undefined;
  await expect
    .poll(
      async () => {
        const snap = await db
          .collection(EMAIL_QUEUE)
          .where('to', '==', to)
          .where('type', '==', type)
          .get();
        found = snap.empty ? undefined : snap.docs[0].data();
        return snap.size;
      },
      { message: `e-mail ${type} para ${to} em email_queue` }
    )
    .toBe(1);
  return found!;
}

/** Token cru (64 hex) do link `/reset-password/<token>` no corpo do e-mail. */
function extractTokenFromBody(body: string): string {
  const match = body.match(/\/reset-password\/([0-9a-f]{64})/);
  if (!match) throw new Error('Link /reset-password/<token> não encontrado no corpo do e-mail.');
  return match[1];
}

/** Doc do token em `password_reset_tokens` pelo hash do token cru. */
async function getTokenDoc(
  rawToken: string
): Promise<FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>> {
  const snap = await getEmulatorAdminFirestore()
    .collection(TOKENS)
    .where('token_hash', '==', sha256Hex(rawToken))
    .get();
  expect(snap.size).toBe(1);
  return snap.docs[0];
}

/**
 * Asserções comuns do e-mail de boas-vindas com link de primeiro acesso (§6.2):
 * link /reset-password/, banner do layout novo (com alt) e metadata da fila.
 */
function expectFirstAccessEmail(
  emailDoc: FirebaseFirestore.DocumentData,
  opts: { type: WelcomeType; bannerFile: string; bannerAlt?: string; userId: string }
): string {
  const body = emailDoc.body as string;
  expect(emailDoc.status).toBe('pending');
  expect(emailDoc.type).toBe(opts.type);
  expect(emailDoc.metadata?.origin).toBe('first_access');
  expect(emailDoc.metadata?.user_id).toBe(opts.userId);
  expect(body).toContain('/reset-password/');
  expect(body).not.toContain('mode=resetPassword');
  expect(body).toMatch(new RegExp(`<img[^>]+src="[^"]*/email/v1/${opts.bannerFile}"`));
  if (opts.bannerAlt) {
    expect(body).toContain(`alt="${opts.bannerAlt}"`);
  }
  return extractTokenFromBody(body);
}

/** Token recém-criado: first_access, 72 h, nunca aberto nem usado. */
function expectFreshFirstAccessToken(data: FirebaseFirestore.DocumentData, userId: string): void {
  expect(data.purpose).toBe('first_access');
  expect(data.user_id).toBe(userId);
  expect(data.used_at ?? null).toBeNull();
  expect(data.invalidated_at ?? null).toBeNull();
  expect(data.opened_at ?? null).toBeNull();
  const expiresAtMs = (data.expires_at as Timestamp).toMillis();
  expect(Math.abs(expiresAtMs - (Date.now() + FIRST_ACCESS_TTL_MS))).toBeLessThan(5 * 60_000);
}

/** Claims e doc `users` sem senha temporária (§6.2). */
async function expectNoForcedPasswordChange(uid: string): Promise<void> {
  const authUser = await getEmulatorAdminAuth().getUser(uid);
  expect(authUser.customClaims?.requirePasswordChange).toBeUndefined();
  const userDoc = (await getEmulatorAdminFirestore().doc(`users/${uid}`).get()).data();
  expect(userDoc?.requirePasswordChange).toBeUndefined();
  expect(userDoc?.skip_welcome_email).toBe(true);
}

/** Aceite de todos os documentos legais ativos (A3). */
async function acceptActiveLegalDocuments(uid: string): Promise<void> {
  const db = getEmulatorAdminFirestore();
  const docs = await db.collection('legal_documents').where('status', '==', 'ativo').get();
  for (const legalDoc of docs.docs) {
    await db.collection('user_document_acceptances').doc(`${uid}_${legalDoc.id}`).set({
      user_id: uid,
      document_id: legalDoc.id,
      document_version: legalDoc.data().version,
      accepted_at: Timestamp.now(),
    });
  }
}

function trackMainFrameNavigations(page: Page): string[] {
  const urls: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) urls.push(frame.url());
  });
  return urls;
}

async function expectFirstAccessIntro(page: Page, email: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Primeiro Acesso' })).toBeVisible();
  await expect(page.getByText(maskEmailLikeApp(email))).toBeVisible();
  await expect(page.getByRole('button', { name: 'Definir minha senha' })).toBeVisible();
}

/** Clica em "Definir minha senha" e espera o formulário. */
async function openFirstAccess(page: Page): Promise<void> {
  const opened = page.waitForResponse(
    (res) =>
      res.url().includes('/api/auth/password-token/open') && res.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Definir minha senha' }).click();
  expect((await opened).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Defina sua Senha' })).toBeVisible();
}

async function fillAndSubmitPassword(page: Page, password: string): Promise<void> {
  await page.locator('#newPassword').fill(password);
  await page.locator('#confirmPassword').fill(password);
  await page.getByRole('button', { name: 'Salvar Senha' }).click();
}

/** Fluxo completo a partir do link: intro → abrir → salvar → "Senha Definida!". */
async function completeFirstAccess(page: Page, rawToken: string, password: string): Promise<void> {
  await page.goto(`/reset-password/${rawToken}`);
  await expect(page.getByRole('heading', { name: 'Primeiro Acesso' })).toBeVisible();
  await openFirstAccess(page);
  await fillAndSubmitPassword(page, password);
  await expect(page.getByRole('heading', { name: 'Senha Definida!' })).toBeVisible();
}

async function expectInvalidLink(page: Page, message: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Link Inválido' })).toBeVisible();
  await expect(page.getByText(message)).toBeVisible();
  const requestNew = page.getByRole('link', { name: 'Solicitar nova senha' });
  await expect(requestNew).toBeVisible();
  await expect(requestNew).toHaveAttribute('href', '/forgot-password');
  await expect(page.getByRole('button', { name: 'Definir minha senha' })).toHaveCount(0);
}

// ---------------------------------------------------------------------------
// Criação de contas e limpeza
// ---------------------------------------------------------------------------

interface CreatedAccount {
  uid: string;
  consultantDocId?: string;
  tenantId?: string;
}

const created: CreatedAccount[] = [];
const extraTokenDocIds: string[] = [];

/** A1: cria um clinic_user em clinicA pela mesma rota da UsersTab. */
async function createClinicUserViaApi(
  request: APIRequestContext,
  email: string,
  displayName: string
): Promise<{ uid: string; rawToken: string }> {
  const idToken = await getIdTokenViaAuthEmulator(TEST_USERS.clinicAdminA.email, TEST_PASSWORD);
  const response = await request.post('/api/users/create', {
    headers: { Authorization: `Bearer ${idToken}` },
    data: { email, displayName, role: 'clinic_user' },
  });
  expect(response.status()).toBe(201);
  const uid = (await response.json()).user.uid as string;
  created.push({ uid });

  const emailDoc = await waitForQueuedEmail(email, 'generic_user_welcome');
  return { uid, rawToken: extractTokenFromBody(emailDoc.body as string) };
}

async function cleanupAccount(account: CreatedAccount): Promise<void> {
  const db = getEmulatorAdminFirestore();
  await getEmulatorAdminAuth()
    .deleteUser(account.uid)
    .catch(() => undefined);
  await db
    .doc(`users/${account.uid}`)
    .delete()
    .catch(() => undefined);
  const acceptances = await db
    .collection('user_document_acceptances')
    .where('user_id', '==', account.uid)
    .get();
  for (const doc of acceptances.docs) await doc.ref.delete();
  const tokens = await db.collection(TOKENS).where('user_id', '==', account.uid).get();
  for (const doc of tokens.docs) await doc.ref.delete();
  if (account.consultantDocId) {
    await db
      .doc(`consultants/${account.consultantDocId}`)
      .delete()
      .catch(() => undefined);
  }
  if (account.tenantId) {
    await db
      .doc(`tenants/${account.tenantId}`)
      .delete()
      .catch(() => undefined);
  }
}

test.afterEach(async () => {
  while (created.length > 0) {
    await cleanupAccount(created.pop()!);
  }
  const db = getEmulatorAdminFirestore();
  while (extraTokenDocIds.length > 0) {
    await db
      .collection(TOKENS)
      .doc(extraTokenDocIds.pop()!)
      .delete()
      .catch(() => undefined);
  }
});

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

test.describe('UC-60 — Definir senha pelo link de primeiro acesso', () => {
  test.describe('Criação de usuário pela clínica (UC-40)', () => {
    test('cenário 1 — clinic_admin cria usuário sem campo de senha; generic_user_welcome com link, banner e alt; claims sem requirePasswordChange', async ({
      page,
    }) => {
      const email = uniqueEmail('clinica');
      const displayName = `QA UC60 Usuario ${uniqueSuffix()}`;

      await loginAs(
        page,
        { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
        '/clinic/dashboard'
      );
      await page.goto('/clinic/my-clinic');
      await page.getByRole('tab', { name: 'Usuários' }).click();

      const openButton = page.getByRole('button', { name: 'Adicionar Usuário' });
      await expect(openButton).toBeEnabled();
      await openButton.click();
      const dialog = page.getByRole('dialog', { name: 'Adicionar Novo Usuário' });
      await expect(dialog).toBeVisible();

      // Sem campo de senha: o usuário define a própria pelo link.
      await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
      await expect(dialog.getByText('Senha', { exact: true })).toHaveCount(0);
      await expect(dialog).toContainText('link para definir a própria senha');

      await dialog.locator('#name').fill(displayName);
      await dialog.locator('#email').fill(email);

      const createResponse = page.waitForResponse(
        (res) => res.url().includes('/api/users/create') && res.request().method() === 'POST'
      );
      await dialog.getByRole('button', { name: 'Criar Usuário' }).click();
      const response = await createResponse;
      expect(response.status()).toBe(201);
      const uid = (await response.json()).user.uid as string;
      created.push({ uid });

      await expect(dialog).toBeHidden();
      await expect(page.locator('tr').filter({ hasText: email })).toBeVisible();

      // Esperado (Firestore): e-mail no layout novo, com o link de primeiro acesso.
      const emailDoc = await waitForQueuedEmail(email, 'generic_user_welcome');
      expect(emailDoc.metadata?.tenant_id).toBe(TEST_USERS.clinicAdminA.tenant_id);
      const rawToken = expectFirstAccessEmail(emailDoc, {
        type: 'generic_user_welcome',
        bannerFile: 'banner-generic-user-welcome.png',
        bannerAlt: 'Bem-vindo ao Curva Mestra! — Portal da Clínica',
        userId: uid,
      });

      // Esperado (Firestore): token first_access de 72 h para este usuário.
      const tokenDoc = await getTokenDoc(rawToken);
      expectFreshFirstAccessToken(tokenDoc.data(), uid);
      expect(tokenDoc.data().created_by).toBe(TEST_USERS.clinicAdminA.uid);

      // Esperado (Custom Claims / users): sem requirePasswordChange.
      const authUser = await getEmulatorAdminAuth().getUser(uid);
      expect(authUser.customClaims?.role).toBe('clinic_user');
      expect(authUser.customClaims?.tenant_id).toBe(TEST_USERS.clinicAdminA.tenant_id);
      expect(authUser.customClaims?.active).toBe(true);
      expect(authUser.providerData.some((p) => p.providerId === 'password')).toBe(false);
      await expectNoForcedPasswordChange(uid);
    });
  });

  test.describe('Link de primeiro acesso', () => {
    test('cenário 2 — abrir o link e recarregar não altera o token (opened_at continua nulo)', async ({
      page,
      request,
    }) => {
      const email = uniqueEmail('get');
      const { uid, rawToken } = await createClinicUserViaApi(request, email, 'QA UC60 Get');

      await page.goto(`/reset-password/${rawToken}`);
      await expectFirstAccessIntro(page, email);

      let tokenData = (await getTokenDoc(rawToken)).data();
      expect(tokenData.opened_at ?? null).toBeNull();
      expect(tokenData.session_hash ?? null).toBeNull();
      expect(tokenData.used_at ?? null).toBeNull();

      await page.reload();
      await expectFirstAccessIntro(page, email);

      tokenData = (await getTokenDoc(rawToken)).data();
      expectFreshFirstAccessToken(tokenData, uid);
      expect(tokenData.session_hash ?? null).toBeNull();
    });

    test('cenário 3 — "Definir minha senha", salvar e logar: vai para o dashboard sem passar por /change-password', async ({
      browser,
      request,
    }) => {
      test.setTimeout(60_000);
      const email = uniqueEmail('fluxo');
      const { uid, rawToken } = await createClinicUserViaApi(request, email, 'QA UC60 Fluxo');

      const context = await newVisitorContext(browser);
      try {
        const page = await context.newPage();
        await completeFirstAccess(page, rawToken, NEW_PASSWORD);
        await expect(page).toHaveURL(/\/login/, { timeout: 8000 });

        // Esperado (Firestore): token consumido.
        const tokenData = (await getTokenDoc(rawToken)).data();
        expect(tokenData.opened_at).toBeTruthy();
        expect(tokenData.used_at).toBeTruthy();

        // Esperado (Firebase Auth): e-mail verificado, sem troca obrigatória.
        const authUser = await getEmulatorAdminAuth().getUser(uid);
        expect(authUser.emailVerified).toBe(true);
        expect(authUser.customClaims?.requirePasswordChange).toBeUndefined();

        await acceptActiveLegalDocuments(uid); // A3
        const navigations = trackMainFrameNavigations(page);
        await loginAs(page, { email, password: NEW_PASSWORD }, '/clinic/dashboard');
        await expect(page).toHaveURL(/\/clinic\/dashboard/);
        expect(navigations.some((url) => url.includes('/change-password'))).toBe(false);
      } finally {
        await context.close();
      }
    });

    test('cenário 4 — reabrir o link já usado mostra "já foi utilizado" e o link "Solicitar nova senha"', async ({
      browser,
      request,
    }) => {
      test.setTimeout(60_000);
      const email = uniqueEmail('reuso');
      const { rawToken } = await createClinicUserViaApi(request, email, 'QA UC60 Reuso');

      const context = await newVisitorContext(browser);
      try {
        const page = await context.newPage();
        await completeFirstAccess(page, rawToken, NEW_PASSWORD);

        await page.goto(`/reset-password/${rawToken}`);
        await expectInvalidLink(page, MSG_USED); // A4

        await page.getByRole('link', { name: 'Solicitar nova senha' }).click();
        await expect(page).toHaveURL(/\/forgot-password/);
      } finally {
        await context.close();
      }
    });

    test('cenário 5 — aberto e não concluído: recarregar a aba mantém o formulário (DN-02); outro navegador vê o link como já utilizado', async ({
      browser,
      request,
    }) => {
      const email = uniqueEmail('sessao');
      const { rawToken } = await createClinicUserViaApi(request, email, 'QA UC60 Sessao');

      const contextA = await newVisitorContext(browser);
      const contextB = await newVisitorContext(browser);
      try {
        const pageA = await contextA.newPage();
        await pageA.goto(`/reset-password/${rawToken}`);
        await expect(pageA.getByRole('heading', { name: 'Primeiro Acesso' })).toBeVisible();
        await openFirstAccess(pageA);

        // Esperado (Firestore): aberto, com sessão de 30 min, ainda não usado.
        const tokenData = (await getTokenDoc(rawToken)).data();
        expect(tokenData.opened_at).toBeTruthy();
        expect(tokenData.session_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(tokenData.used_at ?? null).toBeNull();
        const openedAtMs = (tokenData.opened_at as Timestamp).toMillis();
        const sessionExpiresMs = (tokenData.session_expires_at as Timestamp).toMillis();
        expect(sessionExpiresMs - openedAtMs).toBe(SESSION_TTL_MS);

        // Mesma aba, recarregada: o formulário continua (sessão no sessionStorage).
        await pageA.reload();
        await expect(pageA.getByRole('heading', { name: 'Defina sua Senha' })).toBeVisible();
        await expect(pageA.locator('#newPassword')).toBeVisible();
        const storedKey = `cm_first_access_session:${sha256Hex(rawToken)}`;
        expect(await pageA.evaluate((key) => sessionStorage.getItem(key) !== null, storedKey)).toBe(
          true
        );

        // Outro contexto de navegador (sem a sessão): link já utilizado.
        const pageB = await contextB.newPage();
        await pageB.goto(`/reset-password/${rawToken}`);
        await expectInvalidLink(pageB, MSG_OPENED);

        // Nada foi consumido por nenhuma das duas abas.
        expect((await getTokenDoc(rawToken)).data().used_at ?? null).toBeNull();
      } finally {
        await contextA.close();
        await contextB.close();
      }
    });

    test('cenário 6 — sessão expirada: o envio da senha é recusado com orientação para pedir nova senha', async ({
      browser,
      request,
    }) => {
      const email = uniqueEmail('sessao-vencida');
      const { uid, rawToken } = await createClinicUserViaApi(
        request,
        email,
        'QA UC60 Sessao Vencida'
      );

      const context = await newVisitorContext(browser);
      try {
        const page = await context.newPage();
        await page.goto(`/reset-password/${rawToken}`);
        await expect(page.getByRole('heading', { name: 'Primeiro Acesso' })).toBeVisible();
        await openFirstAccess(page);

        // A5: a sessão vence no servidor (doc com session_expires_at no passado).
        const tokenRef = (await getTokenDoc(rawToken)).ref;
        await tokenRef.update({ session_expires_at: Timestamp.fromMillis(Date.now() - 60_000) });

        const submitResponse = page.waitForResponse(
          (res) =>
            res.url().includes('/api/auth/reset-password') && res.request().method() === 'POST'
        );
        await fillAndSubmitPassword(page, NEW_PASSWORD);
        const response = await submitResponse;
        expect(response.status()).toBe(400);
        expect((await response.json()).reason).toBe('session_invalid');

        await expectInvalidLink(page, MSG_SESSION_EXPIRED);

        // Esperado (Firestore / Auth): token não consumido, senha não definida.
        expect((await tokenRef.get()).data()?.used_at ?? null).toBeNull();
        const authUser = await getEmulatorAdminAuth().getUser(uid);
        expect(authUser.emailVerified).toBe(false);
        expect(authUser.providerData.some((p) => p.providerId === 'password')).toBe(false);
      } finally {
        await context.close();
      }
    });

    test('cenário 7 — token first_access com expires_at no passado (72 h): "Link Inválido" com a mensagem de expiração', async ({
      page,
    }) => {
      const target = TEST_USERS.clinicUserA;
      const rawToken = crypto.randomBytes(32).toString('hex');
      const db = getEmulatorAdminFirestore();
      // A6: formato de createPasswordToken, purpose first_access, vencido.
      const ref = await db.collection(TOKENS).add({
        token_hash: sha256Hex(rawToken),
        purpose: 'first_access',
        user_id: target.uid,
        user_email: target.email,
        tenant_id: target.tenant_id,
        created_by: TEST_USERS.clinicAdminA.uid,
        expires_at: Timestamp.fromMillis(Date.now() - 60_000),
        created_at: Timestamp.fromMillis(Date.now() - FIRST_ACCESS_TTL_MS - 60_000),
        used_at: null,
        invalidated_at: null,
      });
      extraTokenDocIds.push(ref.id);

      await page.goto(`/reset-password/${rawToken}`);
      await expectInvalidLink(page, MSG_EXPIRED);

      // O GET não altera o token vencido.
      const after = (await ref.get()).data();
      expect(after?.opened_at ?? null).toBeNull();
      expect(after?.used_at ?? null).toBeNull();
    });
  });

  test.describe('Outros pontos de criação de conta', () => {
    test('cenário 8 — system admin cria consultor: consultant_welcome com o link e fluxo completo de definição até o portal do consultor (UC-28)', async ({
      page,
      browser,
    }) => {
      test.setTimeout(90_000);
      const email = uniqueEmail('consultor');

      await loginAs(
        page,
        { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
        '/admin/dashboard'
      );
      await page.goto('/admin/consultants/new');
      await expect(page.locator('input[type="password"]')).toHaveCount(0);

      await page.locator('#name').fill('QA UC60 Consultor');
      await page.locator('#email').fill(email);
      await page.locator('#phone').fill('11987654321');

      const createResponse = page.waitForResponse(
        (res) => res.url().endsWith('/api/consultants') && res.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Criar Consultor' }).click();
      const response = await createResponse;
      expect(response.status()).toBe(200);
      const data = (await response.json()).data as { id: string; user_id: string };
      created.push({ uid: data.user_id, consultantDocId: data.id });
      await expect(page.getByText('Consultor Criado com Sucesso!').first()).toBeVisible();

      // Esperado (Firestore): consultant_welcome no layout novo com o link.
      const emailDoc = await waitForQueuedEmail(email, 'consultant_welcome');
      expect(emailDoc.metadata?.consultant_id).toBe(data.id);
      const rawToken = expectFirstAccessEmail(emailDoc, {
        type: 'consultant_welcome',
        bannerFile: 'banner-consultant-welcome.png',
        bannerAlt: 'Bem-vindo ao Curva Mestra! — Portal do Consultor',
        userId: data.user_id,
      });
      expectFreshFirstAccessToken((await getTokenDoc(rawToken)).data(), data.user_id);

      // Esperado (Custom Claims / users): consultor sem requirePasswordChange.
      const authUser = await getEmulatorAdminAuth().getUser(data.user_id);
      expect(authUser.customClaims?.role).toBe('clinic_consultant');
      expect(authUser.customClaims?.consultant_id).toBe(data.id);
      await expectNoForcedPasswordChange(data.user_id);

      // Self-service do consultor, em outro navegador (A8).
      const context = await newVisitorContext(browser);
      try {
        const consultantPage = await context.newPage();
        await completeFirstAccess(consultantPage, rawToken, NEW_PASSWORD);
        await expect(consultantPage).toHaveURL(/\/login/, { timeout: 8000 });
        expect((await getTokenDoc(rawToken)).data().used_at).toBeTruthy();

        await acceptActiveLegalDocuments(data.user_id); // A3
        const navigations = trackMainFrameNavigations(consultantPage);
        // loginAs não aceita /consultant/dashboard como destino (mesmo motivo de UC-04/UC-52).
        await consultantPage.goto('/login');
        await consultantPage.locator('#email').fill(email);
        await consultantPage.locator('#password').fill(NEW_PASSWORD);
        await consultantPage.getByRole('button', { name: 'Entrar' }).click();
        await expect(consultantPage).toHaveURL(/\/consultant\/dashboard/);
        expect(navigations.some((url) => url.includes('/change-password'))).toBe(false);
      } finally {
        await context.close();
      }
    });

    test('cenário 9 — aprovação de solicitação: welcome_approval contém /reset-password/ e não mode=resetPassword (UC-02)', async ({
      page,
    }) => {
      test.setTimeout(60_000);
      const email = uniqueEmail('aprovacao');
      const db = getEmulatorAdminFirestore();
      const now = Timestamp.now();
      // Mesmo schema de solicitação pendente usado por UC-02 (createPendingAccessRequest).
      const requestRef = await db.collection('access_requests').add({
        role: 'especialista',
        type: 'clinica',
        full_name: 'QA UC60 Aprovacao',
        email,
        phone: '11988776655',
        council_number: 'CRM-SP 606060',
        business_name: `Clínica QA UC60 ${uniqueSuffix()}`,
        status: 'pendente',
        created_at: now,
        updated_at: now,
      });

      await loginAs(
        page,
        { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
        '/admin/dashboard'
      );
      await page.goto('/admin/access-requests');
      const row = page.getByRole('row').filter({ hasText: email });
      await expect(row).toBeVisible();

      const approveResponse = page.waitForResponse(
        (res) =>
          res.url().includes(`/api/access-requests/${requestRef.id}/approve`) &&
          res.request().method() === 'POST'
      );
      await row.getByRole('button', { name: 'Aprovar' }).click();
      const response = await approveResponse;
      expect(response.status()).toBe(200);
      const { tenant_id, user_id } = (await response.json()).data as {
        tenant_id: string;
        user_id: string;
      };
      created.push({ uid: user_id, tenantId: tenant_id });

      // Esperado (Firestore): welcome_approval com o link próprio de primeiro acesso.
      const emailDoc = await waitForQueuedEmail(email, 'welcome_approval');
      expect(emailDoc.metadata?.tenant_id).toBe(tenant_id);
      const rawToken = expectFirstAccessEmail(emailDoc, {
        type: 'welcome_approval',
        bannerFile: 'banner-welcome-approval.png',
        bannerAlt: 'Aprovação de Solicitação de Acesso',
        userId: user_id,
      });
      expectFreshFirstAccessToken((await getTokenDoc(rawToken)).data(), user_id);

      // Esperado (Custom Claims / users).
      const authUser = await getEmulatorAdminAuth().getUser(user_id);
      expect(authUser.customClaims?.role).toBe('clinic_admin');
      expect(authUser.customClaims?.tenant_id).toBe(tenant_id);
      await expectNoForcedPasswordChange(user_id);
    });

    test('cenário 10 — /admin/tenants/new sem campo de senha (DN-01): generic_user_welcome com o link para o admin da clínica, sem requirePasswordChange (UC-21)', async ({
      page,
    }) => {
      test.setTimeout(60_000);
      const adminEmail = uniqueEmail('nova-clinica');

      await loginAs(
        page,
        { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
        '/admin/dashboard'
      );
      await page.goto('/admin/tenants/new');

      // Passo 1: dados da clínica (CNPJ válido de exemplo).
      await page.locator('#clinicName').fill(`Clínica QA UC60 ${uniqueSuffix()}`);
      await page.getByPlaceholder('00.000.000/0000-00').fill('11222333000181');
      await page.getByPlaceholder('contato@clinica.com').fill(`contato-${adminEmail}`);
      await page.getByRole('button', { name: 'Próximo' }).click();

      // Passo 2: dados do administrador — sem "Senha Temporária".
      await expect(page.getByRole('heading', { name: 'Dados do Administrador' })).toBeVisible();
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
      await expect(page.getByText(/Senha Tempor/i)).toHaveCount(0);
      await expect(
        page.getByText(
          'O administrador receberá por e-mail um link para definir a própria senha.',
          {
            exact: false,
          }
        )
      ).toBeVisible();
      await page.getByPlaceholder('Ex: João Silva').fill('QA UC60 Admin Clinica');
      await page.getByPlaceholder('joao@clinica.com').fill(adminEmail);
      await page.getByRole('button', { name: 'Próximo' }).click();

      // Passo 3: e-mail personalizado (mantido) e envio.
      const createResponse = page.waitForResponse(
        (res) => res.url().includes('/api/tenants/create') && res.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Criar Clínica e Enviar E-mail' }).click();
      const response = await createResponse;
      expect(response.status()).toBe(201);
      const { tenantId, userId } = (await response.json()) as { tenantId: string; userId: string };
      created.push({ uid: userId, tenantId });
      await expect(page).toHaveURL(/\/admin\/tenants$/);

      // Esperado (Firestore): generic_user_welcome com o link para o admin da clínica.
      const emailDoc = await waitForQueuedEmail(adminEmail, 'generic_user_welcome');
      expect(emailDoc.metadata?.tenant_id).toBe(tenantId);
      const rawToken = expectFirstAccessEmail(emailDoc, {
        type: 'generic_user_welcome',
        bannerFile: 'banner-generic-user-welcome.png',
        bannerAlt: 'Bem-vindo ao Curva Mestra! — Portal da Clínica',
        userId,
      });
      expectFreshFirstAccessToken((await getTokenDoc(rawToken)).data(), userId);

      // Esperado (Custom Claims / users): nenhum requirePasswordChange.
      const authUser = await getEmulatorAdminAuth().getUser(userId);
      expect(authUser.customClaims?.role).toBe('clinic_admin');
      expect(authUser.customClaims?.tenant_id).toBe(tenantId);
      expect(authUser.providerData.some((p) => p.providerId === 'password')).toBe(false);
      await expectNoForcedPasswordChange(userId);
    });
  });
});
