import { test, expect } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminAuth, getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_USERS } from './fixtures/seed-data';

/**
 * Cobertura retroativa (Modo B) de:
 * ONLY_FOR_DEVS/PO_BA_Docs/UC-02-aprovar-solicitacao-de-acesso.md (v2.1)
 *
 * Cobre: Fluxo Principal (perfis especialista e consultor, RN-02), Fluxo
 * Alternativo 7a (nenhuma solicitação pendente) e Fluxos de Exceção 8a
 * (token ausente / usuário não é system_admin, RNF-01), 8b (email já existe
 * no Firebase Auth, RN-04), 8c (solicitação já processada) e 8d (erro
 * genérico da API — representado pelo caso determinístico de solicitação
 * inexistente, 404).
 *
 * Assunções assumidas nesta rodada (Modo B — a confirmar pelo revisor humano):
 *
 * 1. Os testes de 8a, 8c e 8d chamam `POST /api/access-requests/{id}/approve`
 *    diretamente via `request` (APIRequestContext), sem passar pela UI. A
 *    tela `/admin/access-requests` já é bloqueada client-side para quem não
 *    é `system_admin` (Admin Layout), e as condições de "solicitação já
 *    processada"/"id inexistente" não são alcançáveis de forma
 *    determinística clicando em botões — replicam exatamente o que a rota
 *    de API faz quando chamada nessas condições, tal como descrito nas
 *    seções 8a/8c/8d do UC.
 * 2. Para obter um ID token real de um usuário do seed (necessário para
 *    montar o header `Authorization: Bearer`, já que o Admin SDK não emite
 *    ID tokens de usuário — apenas custom tokens), os testes acima usam a
 *    REST API do próprio Auth Emulator
 *    (`identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`) via
 *    `FIREBASE_AUTH_EMULATOR_HOST`, nunca contra o Firebase real.
 * 3. 8d é coberto apenas pelo caso "solicitação não encontrada" (404) — os
 *    demais status de erro genérico citados no UC (401/403/500) já são
 *    exercitados por 8a/8b, e simular uma falha 500 exigiria derrubar o
 *    Firestore do emulador no meio do teste, sem mecanismo disponível hoje
 *    nesta suíte (mesma limitação documentada em UC-01 para seu 8c).
 * 4. O teste do Fluxo Alternativo 7a apaga (via Admin SDK) qualquer
 *    `access_requests` com `status: "pendente"` pré-existente no emulador
 *    compartilhado por toda a suíte antes de assertar o estado vazio — não é
 *    uma limitação do UC, é uma questão de isolamento entre arquivos de spec
 *    (ex.: UC-01 cria solicitações pendentes e nunca as aprova/rejeita).
 */

const APPROVE_PATH = (id: string) => `/api/access-requests/${id}/approve`;

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function uniqueEmail(scenario: string): string {
  return `qa-uc02-${scenario}-${uniqueSuffix()}@example.com`;
}

type PendingAccessRequestInput = {
  role: 'especialista' | 'consultor';
  full_name: string;
  email: string;
  phone: string;
  business_name: string;
  council_number: string;
};

/**
 * Cria diretamente no Firestore emulado uma solicitação com `status:
 * "pendente"`, replicando o schema gravado por UC-01 (v2.0) — sem CPF/CNPJ
 * nem endereço, apenas os campos que hoje fazem parte do formulário real.
 */
async function createPendingAccessRequest(input: PendingAccessRequestInput): Promise<string> {
  const db = getEmulatorAdminFirestore();
  const now = Timestamp.now();
  const type = input.role === 'consultor' ? 'autonomo' : 'clinica';
  const ref = await db.collection('access_requests').add({
    role: input.role,
    type,
    full_name: input.full_name,
    email: input.email,
    phone: input.phone,
    council_number: input.council_number,
    business_name: input.business_name,
    status: 'pendente',
    created_at: now,
    updated_at: now,
  });
  return ref.id;
}

/**
 * Obtém um ID token real via REST API do Auth Emulator — o Admin SDK
 * (scripts/lib/emulatorAdmin.ts) não emite ID tokens de usuário, apenas
 * custom tokens. Necessário para os testes de 8a/8c/8d, que chamam a rota de
 * API diretamente (fora do fluxo de login via UI). Nunca roda fora do
 * emulador: falha explicitamente se `FIREBASE_AUTH_EMULATOR_HOST` não
 * estiver definido (só existe quando `firebase emulators:exec` está ativo).
 */
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

test.describe('UC-02 — Aprovar Solicitação de Acesso', () => {
  test.describe('Fluxo Principal', () => {
    test('System Admin aprova solicitação de especialista: cria tenant (max_users=5), usuário Auth com custom claims, documento users/{uid}, atualiza a solicitação e enfileira o email de boas-vindas (passos 1-18, RN-02, RN-03, RN-05)', async ({
      page,
    }) => {
      const email = uniqueEmail('especialista');
      const businessName = `Clínica QA UC02 ${uniqueSuffix()}`;
      const requestId = await createPendingAccessRequest({
        role: 'especialista',
        full_name: 'Beatriz Andrade',
        email,
        phone: '11988771122',
        business_name: businessName,
        council_number: 'CRM-SP 887744',
      });

      // Passo 1.
      await loginAs(
        page,
        { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
        '/admin/dashboard'
      );
      await page.goto('/admin/access-requests');

      // Passos 2-3: cards de contagem e a linha da solicitação criada, com o
      // rótulo "Conselho" (especialista) e o tipo legado "Clínica".
      await expect(page.getByText('Total Pendentes')).toBeVisible();
      const row = page.getByRole('row').filter({ hasText: email });
      await expect(row).toBeVisible();
      await expect(row.getByText('Clínica', { exact: true })).toBeVisible();
      await expect(row.getByText(/Conselho:\s*CRM-SP 887744/)).toBeVisible();

      // Passos 4-5: clique em "Aprovar" dispara POST .../approve com Bearer token.
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes(APPROVE_PATH(requestId)) && res.request().method() === 'POST'
      );
      await row.getByRole('button', { name: 'Aprovar' }).click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      const responseBody = await response.json();
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.email).toBe(email);
      expect(responseBody.data.business_name).toBe(businessName);
      const { tenant_id, user_id } = responseBody.data as { tenant_id: string; user_id: string };

      // Passo 16: toast de sucesso.
      await expect(
        page.getByText('Solicitação aprovada!').and(page.locator(':not([role="status"])'))
      ).toBeVisible();
      await expect(
        page
          .getByText(`Tenant e usuário criados com sucesso. Email: ${email}`)
          .and(page.locator(':not([role="status"])'))
      ).toBeVisible();

      // Passo 17: a solicitação aprovada não aparece mais na listagem.
      await expect(page.getByRole('row').filter({ hasText: email })).toHaveCount(0);

      // Pós-condições (Firestore) — tenant criado com os fallbacks fixos
      // documentados na seção 14 do UC (document_type/document_number) e sem
      // o campo `address`.
      const db = getEmulatorAdminFirestore();
      const tenantSnap = await db.collection('tenants').doc(tenant_id).get();
      expect(tenantSnap.exists).toBe(true);
      const tenantDoc = tenantSnap.data()!;
      expect(tenantDoc.name).toBe(businessName);
      expect(tenantDoc.max_users).toBe(5); // RN-02: especialista → 5 usuários
      expect(tenantDoc.active).toBe(true);
      expect(tenantDoc.document_type).toBe('cnpj');
      expect(tenantDoc.document_number).toBe('');
      expect(tenantDoc.address).toBeUndefined();

      // Pós-condições (Firestore) — documento `users/{uid}`.
      const userSnap = await db.collection('users').doc(user_id).get();
      expect(userSnap.exists).toBe(true);
      const userDoc = userSnap.data()!;
      expect(userDoc.tenant_id).toBe(tenant_id);
      expect(userDoc.email).toBe(email);
      expect(userDoc.full_name).toBe('Beatriz Andrade');
      expect(userDoc.role).toBe('clinic_admin');
      expect(userDoc.active).toBe(true);

      // Pós-condições (Firebase Auth / Custom Claims) — RN-03: senha
      // temporária aleatória, nunca a informada na solicitação original;
      // emailVerified false; claims exatamente como descrito na seção 4.1.
      const authUser = await getEmulatorAdminAuth().getUser(user_id);
      expect(authUser.email).toBe(email);
      expect(authUser.emailVerified).toBe(false);
      expect(authUser.customClaims?.tenant_id).toBe(tenant_id);
      expect(authUser.customClaims?.role).toBe('clinic_admin');
      expect(authUser.customClaims?.active).toBe(true);

      // Pós-condição (Firestore) — solicitação atualizada para "aprovada",
      // com approved_by/approved_by_name vindos do token verificado (RNF-01).
      const requestSnap = await db.collection('access_requests').doc(requestId).get();
      const requestDoc = requestSnap.data()!;
      expect(requestDoc.status).toBe('aprovada');
      expect(requestDoc.tenant_id).toBe(tenant_id);
      expect(requestDoc.user_id).toBe(user_id);
      expect(requestDoc.approved_by).toBe(TEST_USERS.systemAdmin.uid);
      expect(requestDoc.approved_by_name).toBe(TEST_USERS.systemAdmin.name);
      expect(requestDoc.approved_at).toBeTruthy();

      // RN-05: email de boas-vindas (com link de redefinição de senha)
      // enfileirado em `email_queue`, assíncrono, do tipo "welcome_approval".
      const emailQueueSnap = await db
        .collection('email_queue')
        .where('to', '==', email)
        .where('type', '==', 'welcome_approval')
        .limit(1)
        .get();
      expect(emailQueueSnap.empty).toBe(false);
      const emailDoc = emailQueueSnap.docs[0].data();
      expect(emailDoc.status).toBe('pending');
      expect(emailDoc.metadata.tenant_id).toBe(tenant_id);
      expect(emailDoc.metadata.user_id).toBe(user_id);
    });

    test('System Admin aprova solicitação de consultor: cria tenant com max_users=1 (RN-02)', async ({
      page,
    }) => {
      const email = uniqueEmail('consultor');
      const businessName = `Região QA UC02 ${uniqueSuffix()}`;
      const requestId = await createPendingAccessRequest({
        role: 'consultor',
        full_name: 'Otávio Freitas',
        email,
        phone: '11977662233',
        business_name: businessName,
        council_number: 'RNV-CR-9981',
      });

      await loginAs(
        page,
        { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
        '/admin/dashboard'
      );
      await page.goto('/admin/access-requests');

      // Passo 3: rótulo "ID Rennova" (consultor) e tipo legado "Autônomo".
      const row = page.getByRole('row').filter({ hasText: email });
      await expect(row.getByText('Autônomo', { exact: true })).toBeVisible();
      await expect(row.getByText(/ID Rennova:\s*RNV-CR-9981/)).toBeVisible();

      const responsePromise = page.waitForResponse(
        (res) => res.url().includes(APPROVE_PATH(requestId)) && res.request().method() === 'POST'
      );
      await row.getByRole('button', { name: 'Aprovar' }).click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      const { tenant_id } = (await response.json()).data as { tenant_id: string };

      await expect(
        page.getByText('Solicitação aprovada!').and(page.locator(':not([role="status"])'))
      ).toBeVisible();

      const db = getEmulatorAdminFirestore();
      const tenantSnap = await db.collection('tenants').doc(tenant_id).get();
      expect(tenantSnap.data()?.max_users).toBe(1); // RN-02: consultor → 1 usuário
    });
  });

  test.describe('Fluxo Alternativo 7a — nenhuma solicitação pendente', () => {
    test('estado vazio é exibido quando não há solicitações pendentes', async ({ page }) => {
      // Assunção 4 (cabeçalho do arquivo): limpa solicitações pendentes
      // remanescentes de outros specs (ex.: UC-01) para garantir o estado
      // vazio de forma determinística neste teste específico.
      const db = getEmulatorAdminFirestore();
      const staleSnap = await db
        .collection('access_requests')
        .where('status', '==', 'pendente')
        .get();
      if (!staleSnap.empty) {
        const batch = db.batch();
        staleSnap.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }

      await loginAs(
        page,
        { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
        '/admin/dashboard'
      );
      await page.goto('/admin/access-requests');

      // Passo 1: estado vazio.
      await expect(page.getByText('Nenhuma solicitação pendente')).toBeVisible();
      await expect(page.getByText('Todas as solicitações foram processadas')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Aprovar' })).toHaveCount(0);
    });
  });

  test.describe('Fluxo de Exceção 8a — token ausente ou usuário não é system_admin', () => {
    test('sem header Authorization: API retorna 401 e a solicitação permanece pendente', async ({
      request,
    }) => {
      const email = uniqueEmail('sem-token');
      const businessName = `Clínica QA UC02 ${uniqueSuffix()}`;
      const requestId = await createPendingAccessRequest({
        role: 'especialista',
        full_name: 'Sem Token Teste',
        email,
        phone: '11911112222',
        business_name: businessName,
        council_number: 'CRM-SP 100001',
      });

      const response = await request.post(APPROVE_PATH(requestId));
      expect(response.status()).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Não autorizado');

      // Garantias mínimas de falha (seção 4.2): nenhuma criação, solicitação
      // permanece "pendente".
      const db = getEmulatorAdminFirestore();
      const requestSnap = await db.collection('access_requests').doc(requestId).get();
      expect(requestSnap.data()?.status).toBe('pendente');
      const tenantSnap = await db.collection('tenants').where('name', '==', businessName).get();
      expect(tenantSnap.empty).toBe(true);
    });

    test('token válido mas usuário não é system_admin: API retorna 403 e a solicitação permanece pendente', async ({
      request,
    }) => {
      const email = uniqueEmail('nao-admin');
      const businessName = `Clínica QA UC02 ${uniqueSuffix()}`;
      const requestId = await createPendingAccessRequest({
        role: 'especialista',
        full_name: 'Não Admin Teste',
        email,
        phone: '11911113333',
        business_name: businessName,
        council_number: 'CRM-SP 100002',
      });

      const nonAdminToken = await getIdTokenViaAuthEmulator(
        TEST_USERS.clinicAdminA.email,
        TEST_PASSWORD
      );

      const response = await request.post(APPROVE_PATH(requestId), {
        headers: { Authorization: `Bearer ${nonAdminToken}` },
      });
      expect(response.status()).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Apenas administradores do sistema podem aprovar solicitações');

      const db = getEmulatorAdminFirestore();
      const requestSnap = await db.collection('access_requests').doc(requestId).get();
      expect(requestSnap.data()?.status).toBe('pendente');
      const tenantSnap = await db.collection('tenants').where('name', '==', businessName).get();
      expect(tenantSnap.empty).toBe(true);
    });
  });

  test.describe('Fluxo de Exceção 8b — email já existe no Firebase Auth', () => {
    test('aprovar solicitação com email já cadastrado reverte o tenant criado e mantém a solicitação pendente (RN-04)', async ({
      page,
    }) => {
      const businessName = `Clínica QA UC02 ${uniqueSuffix()}`;
      // Reaproveita um email já existente no Auth emulado (seed) para forçar
      // `auth/email-already-exists`.
      const requestId = await createPendingAccessRequest({
        role: 'especialista',
        full_name: 'Email Duplicado Teste',
        email: TEST_USERS.clinicAdminB.email,
        phone: '11911114444',
        business_name: businessName,
        council_number: 'CRM-SP 100003',
      });

      await loginAs(
        page,
        { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
        '/admin/dashboard'
      );
      await page.goto('/admin/access-requests');

      const row = page.getByRole('row').filter({ hasText: TEST_USERS.clinicAdminB.email });
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes(APPROVE_PATH(requestId)) && res.request().method() === 'POST'
      );
      await row.getByRole('button', { name: 'Aprovar' }).click();
      const response = await responsePromise;

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Este email já está em uso');

      // Toast destructive de erro.
      await expect(
        page.getByText('Este email já está em uso').and(page.locator(':not([role="status"])'))
      ).toBeVisible();

      // Garantias mínimas de falha: tenant revertido (não fica órfão), a
      // solicitação permanece "pendente" e continua visível na listagem.
      const db = getEmulatorAdminFirestore();
      const requestSnap = await db.collection('access_requests').doc(requestId).get();
      expect(requestSnap.data()?.status).toBe('pendente');
      const tenantSnap = await db.collection('tenants').where('name', '==', businessName).get();
      expect(tenantSnap.empty).toBe(true);
      await expect(row).toBeVisible();
    });
  });

  test.describe('Fluxo de Exceção 8c — solicitação já processada', () => {
    test('aprovar uma solicitação que não está mais pendente retorna 400', async ({ request }) => {
      const email = uniqueEmail('ja-processada');
      const requestId = await createPendingAccessRequest({
        role: 'especialista',
        full_name: 'Já Processada Teste',
        email,
        phone: '11911115555',
        business_name: `Clínica QA UC02 ${uniqueSuffix()}`,
        council_number: 'CRM-SP 100004',
      });

      // Simula uma aprovação concorrente já concluída por outra requisição,
      // sem passar pela rota de API (que é justamente o que está sendo testado).
      const db = getEmulatorAdminFirestore();
      await db.collection('access_requests').doc(requestId).update({ status: 'aprovada' });

      const adminToken = await getIdTokenViaAuthEmulator(
        TEST_USERS.systemAdmin.email,
        TEST_PASSWORD
      );
      const response = await request.post(APPROVE_PATH(requestId), {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Solicitação já foi processada');
    });
  });

  test.describe('Fluxo de Exceção 8d — erro genérico da API (representado por solicitação inexistente, 404)', () => {
    test('aprovar um id de solicitação inexistente retorna 404', async ({ request }) => {
      const adminToken = await getIdTokenViaAuthEmulator(
        TEST_USERS.systemAdmin.email,
        TEST_PASSWORD
      );
      const response = await request.post(APPROVE_PATH('id-inexistente-qa-uc02'), {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(response.status()).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Solicitação não encontrada');
    });
  });
});
