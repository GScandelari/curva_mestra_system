import { test, expect, Page } from '@playwright/test';
import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminAuth, getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_TENANTS, TEST_USERS } from './fixtures/seed-data';

/**
 * UC-07 — Recuperar Senha Esquecida, reescrito para a recuperação com token
 * próprio do Curva Mestra (FEAT-padronizacao-emails-e-links-de-senha, seção
 * 8.2): `POST /api/auth/forgot-password` cria um token `password_reset` de
 * 30 min e enfileira o template `password_reset` em `email_queue` (o
 * emulador não roda functions — nenhum e-mail real é enviado). O token cru
 * só existe no corpo do e-mail enfileirado.
 *
 * Cobre: fluxo completo (pedido → e-mail → redefinição → login com a senha
 * nova → link reaproveitado inválido); resposta neutra para e-mail
 * inexistente e para usuário inativo (DN-07, sem fila e sem token); rate
 * limit (4ª tentativa → 429); um novo pedido invalida o link anterior
 * (regressão do STEP 3a); e-mail com formato inválido; erro de rede; e o
 * redirecionamento de usuário já autenticado (7a).
 *
 * Isolamento: cada teste cria o próprio usuário (e-mail único) e envia um
 * `x-forwarded-for` próprio, porque o rate limit por IP (10/h) é
 * compartilhado entre todas as requisições de localhost.
 *
 * Revisão humana obrigatória antes de virar gate de CI (CLAUDE.md, regra 8).
 */

const RESET_TOKENS_COLLECTION = 'password_reset_tokens';
const EMAIL_QUEUE_COLLECTION = 'email_queue';
const NEUTRAL_MESSAGE =
  'Se houver uma conta com este e-mail, você receberá um link para redefinir a senha. O link é válido por 30 minutos.';

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function uniqueEmail(scenario: string): string {
  return `qa-uc07-${scenario}-${uniqueSuffix()}@example.com`;
}

/** IP fictício por teste, para não dividir a cota do rate limit por IP. */
async function useOwnClientIp(page: Page): Promise<string> {
  const ip = `10.7.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': ip });
  return ip;
}

function hashTokenLikeApp(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function createClinicUser(email: string, active = true): Promise<string> {
  const adminAuth = getEmulatorAdminAuth();
  const user = await adminAuth.createUser({
    email,
    password: TEST_PASSWORD,
    displayName: 'QA UC-07',
  });
  await adminAuth.setCustomUserClaims(user.uid, {
    tenant_id: TEST_TENANTS.clinicA.tenant_id,
    role: 'clinic_user',
    is_system_admin: false,
    active,
  });
  return user.uid;
}

async function queuedEmailsTo(email: string) {
  const snap = await getEmulatorAdminFirestore()
    .collection(EMAIL_QUEUE_COLLECTION)
    .where('to', '==', email)
    .get();
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => (b.created_at?.toMillis?.() ?? 0) - (a.created_at?.toMillis?.() ?? 0));
}

function extractToken(body: string): string {
  const match = body.match(/reset-password\/([0-9a-f]{64})/);
  if (!match) throw new Error('Link de redefinição não encontrado no corpo do e-mail.');
  return match[1];
}

async function requestReset(page: Page, email: string): Promise<void> {
  await page.goto('/forgot-password');
  await page.locator('#email').fill(email);
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
}

async function signInViaAuthEmulator(email: string, password: string): Promise<boolean> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host) {
    throw new Error('FIREBASE_AUTH_EMULATOR_HOST não definido — rode via `npm run test:e2e`.');
  }
  const response = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await response.json();
  return Boolean(data.idToken);
}

test.describe('UC-07 — Recuperar Senha Esquecida', () => {
  test.describe('Fluxo Principal', () => {
    test('e-mail existente recebe o password_reset com link de 30 min; a senha é redefinida e o link não pode ser reutilizado', async ({
      page,
    }) => {
      await useOwnClientIp(page);
      const email = uniqueEmail('principal');
      const uid = await createClinicUser(email);

      // Passos 1-3: a partir de /login, "Esqueceu a senha?" → formulário.
      await page.goto('/login');
      await page.getByRole('link', { name: 'Esqueceu a senha?' }).click();
      await expect(page).toHaveURL(/\/forgot-password/);
      await expect(page.getByRole('heading', { name: 'Recuperar Senha' })).toBeVisible();
      await page.locator('#email').fill(email);
      await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();

      // Mensagem neutra (RF-05).
      await expect(page.getByText('Solicitação recebida!')).toBeVisible();
      await expect(page.getByText(NEUTRAL_MESSAGE)).toBeVisible();

      // E-mail enfileirado com o layout padrão e o link próprio.
      const emails = await queuedEmailsTo(email);
      expect(emails).toHaveLength(1);
      expect(emails[0].type).toBe('password_reset');
      expect(emails[0].metadata).toMatchObject({ user_id: uid, origin: 'self_service' });
      expect(emails[0].body).toContain('/email/v1/banner-password-reset.png');
      expect(emails[0].body).not.toContain('mode=resetPassword');
      const rawToken = extractToken(emails[0].body);

      // Token: finalidade password_reset, 30 min, só o hash persistido.
      const db = getEmulatorAdminFirestore();
      const tokenSnap = await db
        .collection(RESET_TOKENS_COLLECTION)
        .where('token_hash', '==', hashTokenLikeApp(rawToken))
        .get();
      expect(tokenSnap.size).toBe(1);
      const tokenDoc = tokenSnap.docs[0].data();
      expect(tokenDoc).toMatchObject({ purpose: 'password_reset', user_id: uid });
      expect(tokenDoc.created_by).toBe('self_service');
      const ttlMs = (tokenDoc.expires_at as Timestamp).toMillis() - Date.now();
      expect(Math.abs(ttlMs - 30 * 60_000)).toBeLessThan(60_000);

      // Redefinição pelo link.
      await page.goto(`/reset-password/${rawToken}`);
      await expect(page.getByRole('heading', { name: 'Nova Senha' })).toBeVisible();
      const newPassword = 'NovaSenhaUc07';
      await page.locator('#newPassword').fill(newPassword);
      await page.locator('#confirmPassword').fill(newPassword);
      await page.getByRole('button', { name: 'Definir Nova Senha' }).click();
      await expect(page.getByRole('heading', { name: 'Senha Redefinida!' })).toBeVisible();

      expect(await signInViaAuthEmulator(email, newPassword)).toBe(true);
      expect((await getEmulatorAdminAuth().getUser(uid)).emailVerified).toBe(true);

      // O mesmo link depois do uso fica inválido.
      await page.goto(`/reset-password/${rawToken}`);
      await expect(page.getByRole('heading', { name: 'Link Inválido' })).toBeVisible();
      await expect(
        page.getByText('Este link já foi utilizado. Solicite uma nova senha.')
      ).toBeVisible();
      await expect(page.getByRole('link', { name: 'Solicitar nova senha' })).toBeVisible();
    });

    test('um novo pedido invalida o link anterior (regressão da invalidação de tokens pendentes)', async ({
      page,
    }) => {
      await useOwnClientIp(page);
      const email = uniqueEmail('reemissao');
      await createClinicUser(email);

      await requestReset(page, email);
      await expect(page.getByText(NEUTRAL_MESSAGE)).toBeVisible();
      await requestReset(page, email);
      await expect(page.getByText(NEUTRAL_MESSAGE)).toBeVisible();

      const emails = await queuedEmailsTo(email);
      expect(emails).toHaveLength(2);
      const newest = extractToken(emails[0].body);
      const oldest = extractToken(emails[1].body);
      expect(newest).not.toBe(oldest);

      const db = getEmulatorAdminFirestore();
      const oldDoc = await db
        .collection(RESET_TOKENS_COLLECTION)
        .where('token_hash', '==', hashTokenLikeApp(oldest))
        .get();
      expect(oldDoc.docs[0].data().invalidated_at).toBeTruthy();

      await page.goto(`/reset-password/${oldest}`);
      await expect(
        page.getByText('Este link foi substituído por um mais recente. Solicite uma nova senha.')
      ).toBeVisible();

      await page.goto(`/reset-password/${newest}`);
      await expect(page.getByRole('heading', { name: 'Nova Senha' })).toBeVisible();
    });
  });

  test.describe('Fluxo Alternativo 7a — usuário já autenticado acessa /forgot-password', () => {
    test('sessão ativa redireciona automaticamente para fora de /forgot-password, sem exibir o formulário', async ({
      page,
    }) => {
      await loginAs(
        page,
        { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
        '/clinic/dashboard'
      );

      await page.goto('/forgot-password');

      await expect(page).toHaveURL(/\/clinic\/dashboard/);
      await expect(page.getByRole('heading', { name: 'Recuperar Senha' })).toHaveCount(0);
    });
  });

  test.describe('Fluxos de Exceção', () => {
    test('8a — e-mail sem conta mostra a mesma mensagem e não enfileira nada (RF-05)', async ({
      page,
    }) => {
      await useOwnClientIp(page);
      const email = uniqueEmail('inexistente');

      await requestReset(page, email);

      await expect(page.getByText(NEUTRAL_MESSAGE)).toBeVisible();
      await expect(page.getByText('Usuário não encontrado')).toHaveCount(0);
      expect(await queuedEmailsTo(email)).toHaveLength(0);
    });

    test('8a — usuário inativo mostra a mesma mensagem e não recebe e-mail nem token (DN-07)', async ({
      page,
    }) => {
      await useOwnClientIp(page);
      const email = uniqueEmail('inativo');
      const uid = await createClinicUser(email, false);

      await requestReset(page, email);

      await expect(page.getByText(NEUTRAL_MESSAGE)).toBeVisible();
      expect(await queuedEmailsTo(email)).toHaveLength(0);
      const tokens = await getEmulatorAdminFirestore()
        .collection(RESET_TOKENS_COLLECTION)
        .where('user_id', '==', uid)
        .get();
      expect(tokens.size).toBe(0);
    });

    test('8b — e-mail com formato inválido exibe "Email inválido" e mantém o formulário', async ({
      page,
    }) => {
      await useOwnClientIp(page);
      // "a@b" passa pela validação nativa do <input type="email">, mas não
      // pela da API (exige domínio com ponto).
      await requestReset(page, 'a@b');

      await expect(page.getByText('Email inválido')).toBeVisible();
      await expect(page.locator('#email')).toHaveValue('a@b');
      await expect(page.getByText('Solicitação recebida!')).toHaveCount(0);
    });

    test('8c — a 4ª solicitação para o mesmo e-mail em 15 min recebe a mensagem de limite (429)', async ({
      page,
    }) => {
      const ip = await useOwnClientIp(page);
      // O limite independe de a conta existir (RNF-05).
      const email = uniqueEmail('ratelimit');

      for (let i = 0; i < 3; i++) {
        const response = await page.request.post('/api/auth/forgot-password', {
          data: { email },
          headers: { 'x-forwarded-for': ip },
        });
        expect(response.status()).toBe(200);
      }

      await requestReset(page, email);

      await expect(
        page.getByText('Muitas solicitações. Aguarde alguns minutos e tente novamente.')
      ).toBeVisible();
      await expect(page.getByText('Solicitação recebida!')).toHaveCount(0);
    });

    test('8d — erro de rede exibe "Erro de conexão. Verifique sua internet"', async ({ page }) => {
      await page.route('**/api/auth/forgot-password', (route) => route.abort('failed'));

      await requestReset(page, uniqueEmail('rede'));

      await expect(page.getByText('Erro de conexão. Verifique sua internet')).toBeVisible();
      await expect(page.getByText('Solicitação recebida!')).toHaveCount(0);
    });
  });
});
