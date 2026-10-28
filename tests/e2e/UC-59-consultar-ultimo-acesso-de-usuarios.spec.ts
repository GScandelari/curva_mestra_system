import { test, expect, Page, Browser } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import { getEmulatorAdminAuth, getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_TENANTS, TEST_USERS } from './fixtures/seed-data';
import { loginAs } from './helpers/auth';
import { computeLastAccess, formatLastAccessLabel } from '../../src/lib/lastAccess';

/**
 * Cobertura (feature nova) de:
 * ONLY_FOR_DEVS/TASK_COMPLETED/FEAT-ultimo-acesso-usuarios.md — STEP 4 (Validação Manual)
 * e orientações do STEP 5. UC de referência: UC-59 — Consultar último acesso de
 * usuários (ator: system_admin).
 *
 * Cobre: passos 1-2 (coluna "Último acesso" em /admin/users com data/hora do
 * clinic_admin A após login), 3 (usuário que nunca logou → "Nunca acessou"),
 * 4 (busca não refaz a chamada à rota), 5 (/admin/consultants, vínculo por
 * `consultant.user_id`), 6 (rota bloqueada → "—" sem quebrar a tabela) e 7
 * (rota protegida: 401 sem token, 403 com token de clinic_admin).
 * O passo 8 (usuário real em dev-gscandelari.web.app) não é automatizável aqui.
 *
 * Assunções (a confirmar pelo revisor humano):
 * 1. Os usuários "Nunca acessou" são criados no próprio teste (Admin Auth +
 *    `users/{uid}` ou `consultants/{autoId}` com `user_id`), não pelo painel
 *    (UC-39/UC-28) — evita depender de e-mail/fluxos paralelos e da ordem dos
 *    specs (workers: 1). Tudo é removido no afterAll.
 * 2. O "consultor do passo 1" é `TEST_USERS.consultantB`, o único consultor do
 *    seed com aceite dos termos (loga direto em /consultant/dashboard).
 * 3. Além do padrão `dd/mm/aaaa HH:mm`, o valor exibido é conferido contra o
 *    metadata do Auth emulado (Admin SDK) formatado pelas funções puras de
 *    src/lib/lastAccess.ts — mesma fonte que a rota usa.
 */

const LAST_ACCESS_PATH = '/api/admin/users/last-access';
const DATE_TIME_PATTERN = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/;
const SYSTEM_ADMIN = { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD };

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function getIdTokenViaAuthEmulator(email: string, password: string): Promise<string> {
  const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!authEmulatorHost) {
    throw new Error(
      'FIREBASE_AUTH_EMULATOR_HOST não definido — este helper só pode rodar via `firebase emulators:exec` (npm run test:e2e).'
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
  if (!res.ok) {
    throw new Error(`Falha ao logar via Auth Emulator REST para ${email}: ${JSON.stringify(data)}`);
  }
  return data.idToken as string;
}

/** Passo 1: login em outro contexto (janela anônima) e fecha o contexto. */
async function loginInSeparateContext(
  browser: Browser,
  login: (page: Page) => Promise<void>
): Promise<void> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await login(page);
  } finally {
    await context.close();
  }
}

async function loginAsConsultantB(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(TEST_USERS.consultantB.email);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/consultant\/dashboard/);
}

/** Rótulo esperado a partir do metadata do Auth emulado (Admin SDK). */
async function expectedLabelFromAuth(uid: string): Promise<string> {
  const user = await getEmulatorAdminAuth().getUser(uid);
  return formatLastAccessLabel(computeLastAccess(user.metadata));
}

function rowByText(page: Page, text: string) {
  return page.getByRole('row').filter({ hasText: text });
}

async function headerTexts(page: Page): Promise<string[]> {
  // Os <th> do shadcn/ui não expõem role "columnheader" na árvore de acessibilidade.
  return (await page.locator('thead th').allInnerTexts()).map((t) => t.trim());
}

/**
 * Cria no Auth emulado um usuário que nunca fez login.
 *
 * Divergência do Auth Emulator: `createUser` (com ou sem senha) já preenche
 * `metadata.lastSignInTime` com o horário de criação, ao contrário do Firebase
 * real, em que ele fica vazio até o primeiro login. `importUsers` sem
 * `lastSignInTime` reproduz o estado real de "nunca acessou".
 */
async function createNeverSignedInAuthUser(
  email: string,
  displayName: string
): Promise<{ uid: string }> {
  const uid = `qa-uc59-${uniqueSuffix()}`;
  const result = await getEmulatorAdminAuth().importUsers([
    {
      uid,
      email,
      displayName,
      emailVerified: true,
      metadata: { creationTime: new Date().toUTCString() } as UserMetadataRequest,
    },
  ]);
  expect(result.failureCount).toBe(0);
  return { uid };
}

type UserMetadataRequest = { creationTime?: string; lastSignInTime?: string };

// Dados criados pelo próprio spec (removidos no afterAll).
const neverUser = {
  uid: '',
  email: `qa-uc59-nunca-${uniqueSuffix()}@example.com`,
  name: `QA UC59 Nunca Acessou ${uniqueSuffix()}`,
};
const neverConsultant = {
  uid: '',
  docId: '',
  email: `qa-uc59-consultor-${uniqueSuffix()}@example.com`,
  name: `QA UC59 Consultor Novo ${uniqueSuffix()}`,
  // 6 dígitos, distinto dos códigos do seed (482913 e 731548).
  code: String(100000 + Math.floor(Math.random() * 300000)),
};

test.describe('UC-59 — Consultar Último Acesso de Usuários', () => {
  test.beforeAll(async () => {
    const auth = getEmulatorAdminAuth();
    const db = getEmulatorAdminFirestore();
    const now = Timestamp.now();

    // Usuário de clínica que nunca logou (passo 3).
    const created = await createNeverSignedInAuthUser(neverUser.email, neverUser.name);
    neverUser.uid = created.uid;
    await auth.setCustomUserClaims(created.uid, {
      tenant_id: TEST_TENANTS.clinicA.tenant_id,
      role: 'clinic_user',
      is_system_admin: false,
      active: true,
    });
    await db.doc(`users/${created.uid}`).set({
      email: neverUser.email,
      full_name: neverUser.name,
      displayName: neverUser.name,
      role: 'clinic_user',
      active: true,
      tenant_id: TEST_TENANTS.clinicA.tenant_id,
      created_at: now,
      updated_at: now,
    });

    // Consultor que nunca logou (passo 5): doc com id automático, DIFERENTE do
    // UID — a tela deve vincular pelo campo user_id, como em produção.
    const consultantUser = await createNeverSignedInAuthUser(
      neverConsultant.email,
      neverConsultant.name
    );
    neverConsultant.uid = consultantUser.uid;
    const ref = db.collection('consultants').doc();
    neverConsultant.docId = ref.id;
    await auth.setCustomUserClaims(consultantUser.uid, {
      tenant_id: null,
      role: 'clinic_consultant',
      is_system_admin: false,
      is_consultant: true,
      consultant_id: ref.id,
      authorized_tenants: [],
      active: true,
    });
    await ref.set({
      user_id: consultantUser.uid,
      code: neverConsultant.code,
      name: neverConsultant.name,
      email: neverConsultant.email,
      phone: '11977770059',
      status: 'active',
      authorized_tenants: [],
      created_at: now,
      updated_at: now,
    });
    expect(ref.id).not.toBe(consultantUser.uid);
  });

  test.afterAll(async () => {
    const auth = getEmulatorAdminAuth();
    const db = getEmulatorAdminFirestore();
    if (neverUser.uid) {
      await db.doc(`users/${neverUser.uid}`).delete();
      await auth.deleteUser(neverUser.uid).catch(() => undefined);
    }
    if (neverConsultant.docId) {
      await db.doc(`consultants/${neverConsultant.docId}`).delete();
    }
    if (neverConsultant.uid) {
      await auth.deleteUser(neverConsultant.uid).catch(() => undefined);
    }
  });

  test.describe('Listagem de usuários (/admin/users)', () => {
    test('após login do clinic_admin A em outro contexto, a coluna "Último acesso" (entre "Cadastro" e "Ações") mostra dd/mm/aaaa HH:mm coerente com o metadata do Auth (STEP 4, passos 1-2)', async ({
      page,
      browser,
    }) => {
      // Passo 1 — login do clinic_admin A em janela separada.
      await loginInSeparateContext(browser, (p) =>
        loginAs(
          p,
          { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
          '/clinic/dashboard'
        )
      );

      // Admin SDK: o login real preencheu o metadata do Auth emulado.
      const authUser = await getEmulatorAdminAuth().getUser(TEST_USERS.clinicAdminA.uid);
      expect(computeLastAccess(authUser.metadata)).not.toBeNull();

      // Passo 2 — system_admin abre /admin/users.
      await loginAs(page, SYSTEM_ADMIN, '/admin/dashboard');
      await page.goto('/admin/users');

      const headers = page.locator('thead th');
      await expect(headers.filter({ hasText: 'Último acesso' })).toBeVisible();
      const texts = await headerTexts(page);
      const idx = texts.indexOf('Último acesso');
      expect(texts[idx - 1]).toBe('Cadastro');
      expect(texts[idx + 1]).toBe('Ações');

      const cell = rowByText(page, TEST_USERS.clinicAdminA.email).getByTestId('last-access');
      await expect(cell).toHaveText(DATE_TIME_PATTERN);
      expect(await cell.innerText()).not.toContain(',');
      expect((await cell.innerText()).trim()).toBe(
        await expectedLabelFromAuth(TEST_USERS.clinicAdminA.uid)
      );
    });

    test('usuário criado e que nunca fez login mostra "Nunca acessou"; a busca não refaz a chamada à rota (STEP 4, passos 3-4)', async ({
      page,
    }) => {
      // Admin SDK: o usuário criado no teste não tem nenhum acesso registrado.
      const authUser = await getEmulatorAdminAuth().getUser(neverUser.uid);
      expect(computeLastAccess(authUser.metadata)).toBeNull();

      const lastAccessCalls: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes(LAST_ACCESS_PATH) && req.method() === 'POST') {
          lastAccessCalls.push(req.url());
        }
      });

      await loginAs(page, SYSTEM_ADMIN, '/admin/dashboard');
      await page.goto('/admin/users');

      const cell = rowByText(page, neverUser.email).getByTestId('last-access');
      await expect(cell).toHaveText('Nunca acessou');
      // O rótulo só sai de "—" depois que a rota respondeu.
      const callsBeforeSearch = lastAccessCalls.length;
      expect(callsBeforeSearch).toBeGreaterThan(0);

      // Passo 4 — digitar na busca mantém os valores sem nova chamada.
      await page.getByPlaceholder('Buscar por nome, email ou clínica...').fill(neverUser.email);
      await expect(page.getByRole('row').filter({ hasText: '@' })).toHaveCount(1);
      await expect(cell).toHaveText('Nunca acessou');
      // Margem para uma eventual chamada indevida disparada pela busca.
      await page.waitForTimeout(1500);
      expect(lastAccessCalls.length).toBe(callsBeforeSearch);
    });

    test('com a rota de último acesso bloqueada, a tabela carrega normalmente e a coluna fica em "—" (STEP 4, passo 6 / RF-05)', async ({
      page,
    }) => {
      await loginAs(page, SYSTEM_ADMIN, '/admin/dashboard');
      await page.route(`**${LAST_ACCESS_PATH}`, (route) => route.abort());
      const blocked = page.waitForEvent('requestfailed', (req) =>
        req.url().includes(LAST_ACCESS_PATH)
      );
      await page.goto('/admin/users');

      const row = rowByText(page, TEST_USERS.clinicAdminA.email);
      await expect(row).toBeVisible();
      await blocked;
      await expect(row.getByTestId('last-access')).toHaveText('—');
      await expect(rowByText(page, neverUser.email).getByTestId('last-access')).toHaveText('—');
    });
  });

  test.describe('Listagem de consultores (/admin/consultants)', () => {
    test('coluna "Último acesso" depois de "Criado em": consultor do seed após login mostra data/hora e consultor recém-criado (doc id ≠ uid) mostra "Nunca acessou" (STEP 4, passo 5)', async ({
      page,
      browser,
    }) => {
      // Passo 1 — login do consultor em janela separada.
      await loginInSeparateContext(browser, loginAsConsultantB);

      const consultantAuth = await getEmulatorAdminAuth().getUser(TEST_USERS.consultantB.uid);
      expect(computeLastAccess(consultantAuth.metadata)).not.toBeNull();
      const neverAuth = await getEmulatorAdminAuth().getUser(neverConsultant.uid);
      expect(computeLastAccess(neverAuth.metadata)).toBeNull();

      await loginAs(page, SYSTEM_ADMIN, '/admin/dashboard');
      await page.goto('/admin/consultants');

      await expect(page.locator('thead th').filter({ hasText: 'Último acesso' })).toBeVisible();
      const texts = await headerTexts(page);
      const idx = texts.indexOf('Último acesso');
      expect(texts[idx - 1]).toBe('Criado em');

      const seededCell = rowByText(page, TEST_USERS.consultantB.email).getByTestId('last-access');
      await expect(seededCell).toHaveText(DATE_TIME_PATTERN);
      expect((await seededCell.innerText()).trim()).toBe(
        await expectedLabelFromAuth(TEST_USERS.consultantB.uid)
      );

      await expect(rowByText(page, neverConsultant.email).getByTestId('last-access')).toHaveText(
        'Nunca acessou'
      );
    });
  });

  test.describe('Proteção da rota POST /api/admin/users/last-access (STEP 4, passo 7)', () => {
    test('sem token responde 401', async ({ request }) => {
      const response = await request.post(LAST_ACCESS_PATH, {
        data: { uids: [TEST_USERS.clinicAdminA.uid] },
      });
      expect(response.status()).toBe(401);
      expect(response.headers()['cache-control']).toContain('no-store');
    });

    test('com token de clinic_admin responde 403 e não devolve dados', async ({ request }) => {
      const token = await getIdTokenViaAuthEmulator(TEST_USERS.clinicAdminA.email, TEST_PASSWORD);

      // Admin SDK: o token é de fato de um clinic_admin sem is_system_admin.
      const authUser = await getEmulatorAdminAuth().getUser(TEST_USERS.clinicAdminA.uid);
      expect(authUser.customClaims?.role).toBe('clinic_admin');
      expect(authUser.customClaims?.is_system_admin).toBe(false);

      const response = await request.post(LAST_ACCESS_PATH, {
        headers: { Authorization: `Bearer ${token}` },
        data: { uids: [TEST_USERS.clinicAdminA.uid] },
      });
      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Acesso negado');
      expect(body.data).toBeUndefined();
    });

    test('com token de system_admin responde 200 com ISO para quem acessou e null para quem nunca acessou', async ({
      request,
    }) => {
      const token = await getIdTokenViaAuthEmulator(TEST_USERS.systemAdmin.email, TEST_PASSWORD);
      const response = await request.post(LAST_ACCESS_PATH, {
        headers: { Authorization: `Bearer ${token}` },
        data: { uids: [TEST_USERS.systemAdmin.uid, neverUser.uid, 'uid-inexistente-uc59'] },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data[TEST_USERS.systemAdmin.uid]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(body.data[neverUser.uid]).toBeNull();
      expect(body.data).not.toHaveProperty('uid-inexistente-uc59');
    });
  });
});
