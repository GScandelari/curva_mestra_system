import { test, expect, Page } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import { getEmulatorAdminAuth, getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_USERS } from './fixtures/seed-data';

/**
 * Cobertura (feature nova) de:
 * ONLY_FOR_DEVS/PO_BA_Docs/UC-56-consultor-aprova-solicitacao-vinculada-ao-codigo.md (v1.3)
 *
 * Cobre: Fluxo Principal (via UI do portal do consultor, incluindo a
 * visibilidade universal de RN-04 com a ação desabilitada para solicitação
 * exclusiva de outro consultor), Fluxos Alternativos 7a (sem consultor
 * vinculado, RN-05) e 7b (janela de 48h expirada, RN-03), Fluxos de Exceção
 * 8a (exclusividade de outro consultor, RN-02), 8b (sem token / não consultor
 * / consultor inativo, RN-07), 8c (já processada) e 8d (e-mail já existe no
 * Auth, reversão do tenant), a anotação `eligible_now` da rota de listagem, e
 * RN-06 (System Admin aprova mesmo dentro da janela de outro consultor).
 *
 * Assunções (a confirmar pelo revisor humano):
 * 1. A janela de 48h é simulada gravando `created_at` no passado direto no
 *    Firestore emulado (mesmo padrão de createPendingAccessRequest do spec de
 *    UC-02) — não há espera de tempo real.
 * 2. `TEST_USERS.consultant` faz o papel do "outro consultor" vinculado, e
 *    `TEST_USERS.consultantB` (com aceite de termos no seed) é o consultor que
 *    age. Os cenários de API usam ID token real obtido via REST do Auth
 *    Emulator, como em UC-02.
 * 3. O teste de consultor inativo (RN-07) altera temporariamente as claims de
 *    consultantB e restaura no `finally`.
 */

const APPROVE_CONSULTANT_PATH = (id: string) => `/api/access-requests/${id}/approve-consultant`;
const APPROVE_ADMIN_PATH = (id: string) => `/api/access-requests/${id}/approve`;
const LIST_PATH = '/api/consultants/me/pending-access-requests';
const HOUR_MS = 60 * 60 * 1000;

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function uniqueEmail(scenario: string): string {
  return `qa-uc56-${scenario}-${uniqueSuffix()}@example.com`;
}

/** Cria uma solicitação pendente no emulador, com vínculo e idade controlados. */
async function createPendingAccessRequest(options: {
  email: string;
  fullName?: string;
  businessName?: string;
  consultant?: { uid: string; code: string } | null;
  ageHours?: number;
}): Promise<string> {
  const db = getEmulatorAdminFirestore();
  const createdAt = Timestamp.fromMillis(Date.now() - (options.ageHours ?? 0) * HOUR_MS);
  const ref = await db.collection('access_requests').add({
    role: 'especialista',
    type: 'clinica',
    full_name: options.fullName ?? 'Especialista QA UC56',
    email: options.email,
    phone: '11966665555',
    council_number: 'CRM-SP 560056',
    business_name: options.businessName ?? `Clínica QA UC56 ${uniqueSuffix()}`,
    volume: '30–80',
    consultant_code: options.consultant?.code ?? null,
    consultant_id: options.consultant?.uid ?? null,
    status: 'pendente',
    created_at: createdAt,
    updated_at: createdAt,
  });
  return ref.id;
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

async function consultantBToken(): Promise<string> {
  return getIdTokenViaAuthEmulator(TEST_USERS.consultantB.email, TEST_PASSWORD);
}

async function loginAsConsultantB(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(TEST_USERS.consultantB.email);
  await page.locator('#password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/consultant\/dashboard/);
}

async function expectStillPendingWithoutTenant(requestId: string, businessName: string) {
  const db = getEmulatorAdminFirestore();
  const requestSnap = await db.collection('access_requests').doc(requestId).get();
  expect(requestSnap.data()?.status).toBe('pendente');
  const tenantSnap = await db.collection('tenants').where('name', '==', businessName).get();
  expect(tenantSnap.empty).toBe(true);
}

test.describe('UC-56 — Consultor Aprova Solicitação de Acesso Vinculada ao Seu Código', () => {
  test.describe('Fluxo Principal (via portal do consultor)', () => {
    test('consultor vê todas as pendentes (RN-04), aprova a vinculada a ele e a exclusiva de outro fica bloqueada (passos 1-11)', async ({
      page,
    }) => {
      const ownEmail = uniqueEmail('propria');
      const ownBusiness = `Clínica Própria UC56 ${uniqueSuffix()}`;
      const ownId = await createPendingAccessRequest({
        email: ownEmail,
        fullName: 'Lívia Campos',
        businessName: ownBusiness,
        consultant: { uid: TEST_USERS.consultantB.uid, code: TEST_USERS.consultantB.code },
        ageHours: 1,
      });
      const otherEmail = uniqueEmail('exclusiva-outro');
      await createPendingAccessRequest({
        email: otherEmail,
        consultant: { uid: TEST_USERS.consultant.uid, code: TEST_USERS.consultant.code },
        ageHours: 1,
      });

      // Passo 1: item de menu do portal leva à tela.
      await loginAsConsultantB(page);
      await page.getByRole('link', { name: 'Solicitações de Acesso' }).click();
      await expect(page).toHaveURL(/\/consultant\/access-requests/);
      await expect(page.getByRole('heading', { name: 'Solicitações de Acesso' })).toBeVisible();

      // Passo 2 / RN-04: as duas aparecem; a de outro consultor dentro da janela
      // fica com "Aprovar" desabilitado e indica de quem é a exclusividade.
      const ownCard = page.getByTestId('consultant-access-request').filter({ hasText: ownEmail });
      const otherCard = page
        .getByTestId('consultant-access-request')
        .filter({ hasText: otherEmail });
      await expect(ownCard).toBeVisible();
      await expect(otherCard).toBeVisible();
      await expect(ownCard.getByText('Vinculada a você')).toBeVisible();
      await expect(otherCard.getByText(`Exclusiva de ${TEST_USERS.consultant.name}`)).toBeVisible();
      await expect(otherCard.getByRole('button', { name: 'Aprovar' })).toBeDisabled();

      // Passos 3-9: aprova a própria (com confirmação).
      await ownCard.getByRole('button', { name: 'Aprovar' }).click();
      const responsePromise = page.waitForResponse(
        (res) =>
          res.url().includes(APPROVE_CONSULTANT_PATH(ownId)) && res.request().method() === 'POST'
      );
      await page.getByRole('alertdialog').getByRole('button', { name: 'Aprovar' }).click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.email).toBe(ownEmail);
      expect(body.data.business_name).toBe(ownBusiness);
      const { tenant_id, user_id } = body.data as { tenant_id: string; user_id: string };

      // Passo 10: sucesso e a solicitação some da lista.
      await expect(
        page.getByText('Solicitação aprovada!').and(page.locator(':not([role="status"])'))
      ).toBeVisible();
      await expect(
        page.getByTestId('consultant-access-request').filter({ hasText: ownEmail })
      ).toHaveCount(0);

      // Pós-condições (4.1): mesma cadeia de UC-02, com autoria do consultor (RN-08).
      const db = getEmulatorAdminFirestore();
      const tenantDoc = (await db.collection('tenants').doc(tenant_id).get()).data()!;
      expect(tenantDoc.name).toBe(ownBusiness);
      expect(tenantDoc.max_users).toBe(5);
      const userDoc = (await db.collection('users').doc(user_id).get()).data()!;
      expect(userDoc.tenant_id).toBe(tenant_id);
      expect(userDoc.role).toBe('clinic_admin');
      const authUser = await getEmulatorAdminAuth().getUser(user_id);
      expect(authUser.customClaims?.tenant_id).toBe(tenant_id);
      expect(authUser.customClaims?.role).toBe('clinic_admin');
      expect(authUser.customClaims?.active).toBe(true);

      const requestDoc = (await db.collection('access_requests').doc(ownId).get()).data()!;
      expect(requestDoc.status).toBe('aprovada');
      expect(requestDoc.approved_by).toBe(TEST_USERS.consultantB.uid);
      expect(requestDoc.approved_by_name).toBe(TEST_USERS.consultantB.name);

      const emailSnap = await db
        .collection('email_queue')
        .where('to', '==', ownEmail)
        .where('type', '==', 'welcome_approval')
        .limit(1)
        .get();
      expect(emailSnap.empty).toBe(false);
      expect(emailSnap.docs[0].data().body).toContain('mode=resetPassword');
    });
  });

  test.describe('Rota de listagem — anotação eligible_now (RN-01 a RN-05)', () => {
    test('anota corretamente própria, sem vínculo, exclusiva de outro e expirada', async ({
      request,
    }) => {
      const ownId = await createPendingAccessRequest({
        email: uniqueEmail('lista-propria'),
        consultant: { uid: TEST_USERS.consultantB.uid, code: TEST_USERS.consultantB.code },
      });
      const noneId = await createPendingAccessRequest({ email: uniqueEmail('lista-sem') });
      const otherId = await createPendingAccessRequest({
        email: uniqueEmail('lista-outro'),
        consultant: { uid: TEST_USERS.consultant.uid, code: TEST_USERS.consultant.code },
        ageHours: 47,
      });
      const expiredId = await createPendingAccessRequest({
        email: uniqueEmail('lista-expirada'),
        consultant: { uid: TEST_USERS.consultant.uid, code: TEST_USERS.consultant.code },
        ageHours: 49,
      });

      const response = await request.get(LIST_PATH, {
        headers: { Authorization: `Bearer ${await consultantBToken()}` },
      });
      expect(response.status()).toBe(200);
      const items = (await response.json()).data as Array<{
        id: string;
        eligible_now: boolean;
        linked_to_me: boolean;
        consultant_name: string | null;
      }>;
      const byId = new Map(items.map((i) => [i.id, i]));

      expect(byId.get(ownId)).toMatchObject({ eligible_now: true, linked_to_me: true });
      expect(byId.get(noneId)).toMatchObject({ eligible_now: true, linked_to_me: false });
      expect(byId.get(otherId)).toMatchObject({
        eligible_now: false,
        linked_to_me: false,
        consultant_name: TEST_USERS.consultant.name,
      });
      expect(byId.get(expiredId)).toMatchObject({ eligible_now: true, linked_to_me: false });
    });

    test('usuário que não é consultor recebe 403', async ({ request }) => {
      const token = await getIdTokenViaAuthEmulator(TEST_USERS.clinicAdminA.email, TEST_PASSWORD);
      const response = await request.get(LIST_PATH, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status()).toBe(403);
    });
  });

  test.describe('Fluxos Alternativos', () => {
    test('7a — solicitação sem consultor vinculado pode ser aprovada por qualquer consultor desde o início (RN-05)', async ({
      request,
    }) => {
      const requestId = await createPendingAccessRequest({ email: uniqueEmail('sem-vinculo') });
      const response = await request.post(APPROVE_CONSULTANT_PATH(requestId), {
        headers: { Authorization: `Bearer ${await consultantBToken()}` },
      });
      expect(response.status()).toBe(200);

      const db = getEmulatorAdminFirestore();
      const doc = (await db.collection('access_requests').doc(requestId).get()).data()!;
      expect(doc.status).toBe('aprovada');
      expect(doc.approved_by).toBe(TEST_USERS.consultantB.uid);
    });

    test('7b — vinculada a outro consultor há 48h ou mais: qualquer consultor pode aprovar (RN-03)', async ({
      request,
    }) => {
      const requestId = await createPendingAccessRequest({
        email: uniqueEmail('janela-expirada'),
        consultant: { uid: TEST_USERS.consultant.uid, code: TEST_USERS.consultant.code },
        ageHours: 49,
      });
      const response = await request.post(APPROVE_CONSULTANT_PATH(requestId), {
        headers: { Authorization: `Bearer ${await consultantBToken()}` },
      });
      expect(response.status()).toBe(200);

      const db = getEmulatorAdminFirestore();
      const doc = (await db.collection('access_requests').doc(requestId).get()).data()!;
      expect(doc.status).toBe('aprovada');
      expect(doc.approved_by_name).toBe(TEST_USERS.consultantB.name);
    });
  });

  test.describe('Fluxos de Exceção', () => {
    test('8a — vinculada a outro consultor dentro da janela de 48h: 403 e nada é criado (RN-02)', async ({
      request,
    }) => {
      const businessName = `Clínica Exclusiva UC56 ${uniqueSuffix()}`;
      const requestId = await createPendingAccessRequest({
        email: uniqueEmail('exclusiva'),
        businessName,
        consultant: { uid: TEST_USERS.consultant.uid, code: TEST_USERS.consultant.code },
        ageHours: 47,
      });
      const response = await request.post(APPROVE_CONSULTANT_PATH(requestId), {
        headers: { Authorization: `Bearer ${await consultantBToken()}` },
      });
      expect(response.status()).toBe(403);
      expect((await response.json()).error).toBe(
        'Esta solicitação está em período de exclusividade de outro consultor'
      );
      await expectStillPendingWithoutTenant(requestId, businessName);
    });

    test('8b — sem token: 401', async ({ request }) => {
      const businessName = `Clínica Sem Token UC56 ${uniqueSuffix()}`;
      const requestId = await createPendingAccessRequest({
        email: uniqueEmail('sem-token'),
        businessName,
      });
      const response = await request.post(APPROVE_CONSULTANT_PATH(requestId));
      expect(response.status()).toBe(401);
      await expectStillPendingWithoutTenant(requestId, businessName);
    });

    test('8b — token de usuário que não é consultor: 403', async ({ request }) => {
      const businessName = `Clínica Não Consultor UC56 ${uniqueSuffix()}`;
      const requestId = await createPendingAccessRequest({
        email: uniqueEmail('nao-consultor'),
        businessName,
      });
      const token = await getIdTokenViaAuthEmulator(TEST_USERS.clinicAdminA.email, TEST_PASSWORD);
      const response = await request.post(APPROVE_CONSULTANT_PATH(requestId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status()).toBe(403);
      expect((await response.json()).error).toBe(
        'Apenas consultores ativos podem aprovar solicitações'
      );
      await expectStillPendingWithoutTenant(requestId, businessName);
    });

    test('8b — consultor inativo (claim active=false) não aprova nem a própria solicitação (RN-07)', async ({
      request,
    }) => {
      const businessName = `Clínica Consultor Inativo UC56 ${uniqueSuffix()}`;
      const requestId = await createPendingAccessRequest({
        email: uniqueEmail('consultor-inativo'),
        businessName,
        consultant: { uid: TEST_USERS.consultantB.uid, code: TEST_USERS.consultantB.code },
      });

      const authAdmin = getEmulatorAdminAuth();
      await authAdmin.setCustomUserClaims(TEST_USERS.consultantB.uid, {
        ...TEST_USERS.consultantB.claims,
        active: false,
      });
      try {
        const token = await consultantBToken();
        const response = await request.post(APPROVE_CONSULTANT_PATH(requestId), {
          headers: { Authorization: `Bearer ${token}` },
        });
        expect(response.status()).toBe(403);
      } finally {
        await authAdmin.setCustomUserClaims(
          TEST_USERS.consultantB.uid,
          TEST_USERS.consultantB.claims
        );
      }
      await expectStillPendingWithoutTenant(requestId, businessName);
    });

    test('8c — solicitação já processada: 400', async ({ request }) => {
      const requestId = await createPendingAccessRequest({ email: uniqueEmail('processada') });
      const db = getEmulatorAdminFirestore();
      await db.collection('access_requests').doc(requestId).update({ status: 'rejeitada' });

      const response = await request.post(APPROVE_CONSULTANT_PATH(requestId), {
        headers: { Authorization: `Bearer ${await consultantBToken()}` },
      });
      expect(response.status()).toBe(400);
      expect((await response.json()).error).toBe('Solicitação já foi processada');
    });

    test('8d — e-mail já existe no Auth: 400, tenant revertido e solicitação continua pendente', async ({
      request,
    }) => {
      const businessName = `Clínica Email Duplicado UC56 ${uniqueSuffix()}`;
      const requestId = await createPendingAccessRequest({
        email: TEST_USERS.clinicAdminB.email,
        businessName,
        consultant: { uid: TEST_USERS.consultantB.uid, code: TEST_USERS.consultantB.code },
      });
      const response = await request.post(APPROVE_CONSULTANT_PATH(requestId), {
        headers: { Authorization: `Bearer ${await consultantBToken()}` },
      });
      expect(response.status()).toBe(400);
      expect((await response.json()).error).toBe('Este email já está em uso');
      await expectStillPendingWithoutTenant(requestId, businessName);

      // Limpa para não deixar pendente um e-mail de usuário semeado.
      await getEmulatorAdminFirestore().collection('access_requests').doc(requestId).delete();
    });
  });

  test.describe('RN-06 — System Admin não fica sujeito à janela de exclusividade', () => {
    test('System Admin aprova solicitação ainda exclusiva de um consultor', async ({ request }) => {
      const requestId = await createPendingAccessRequest({
        email: uniqueEmail('admin-na-janela'),
        consultant: { uid: TEST_USERS.consultant.uid, code: TEST_USERS.consultant.code },
        ageHours: 1,
      });
      const token = await getIdTokenViaAuthEmulator(TEST_USERS.systemAdmin.email, TEST_PASSWORD);
      const response = await request.post(APPROVE_ADMIN_PATH(requestId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.status()).toBe(200);

      const db = getEmulatorAdminFirestore();
      const doc = (await db.collection('access_requests').doc(requestId).get()).data()!;
      expect(doc.status).toBe('aprovada');
      expect(doc.approved_by).toBe(TEST_USERS.systemAdmin.uid);
    });
  });
});
