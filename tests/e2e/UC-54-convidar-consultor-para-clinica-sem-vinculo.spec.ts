import { test, expect } from '@playwright/test';
import { FieldValue } from 'firebase-admin/firestore';
import { getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import {
  TEST_LEGAL_DOCUMENTS,
  TEST_PASSWORD,
  TEST_TENANTS,
  TEST_USERS,
} from './fixtures/seed-data';
import { loginAs } from './helpers/auth';
import {
  INACTIVE_CONSULTANT_MESSAGE,
  INACTIVE_CONSULTANT_TITLE,
} from '../../src/lib/validations/serverValidations';

/**
 * Cobertura parcial de:
 * ONLY_FOR_DEVS/PO_BA_Docs/UC-54-convidar-consultor-para-clinica-sem-vinculo.md
 *
 * Cobre só o tratamento de consultor INATIVO (decisão do PO, 08/10/2026): ao
 * buscar ou convidar um consultor inativo, o clinic_admin recebe a mensagem de
 * que ele está temporariamente inativo e que outro consultor pode auxiliar —
 * em vez do antigo "Consultor não encontrado". O restante do UC-54 ainda não
 * tem caderno (cobertura retroativa pendente).
 *
 * `clinicB` do seed não tem consultor vinculado, por isso o clinicAdminB é o
 * ator. O consultor inativo é criado e removido pelo próprio spec.
 */

const INACTIVE_ID = 'qa-uc54-inactive-consultant';
const INACTIVE_CODE = '905417';

async function getIdTokenViaAuthEmulator(email: string, password: string): Promise<string> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host) {
    throw new Error('FIREBASE_AUTH_EMULATOR_HOST não definido — rode via `npm run test:e2e`.');
  }
  const res = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Falha ao logar ${email}: ${JSON.stringify(data)}`);
  return data.idToken as string;
}

function clinicAdminBToken(): Promise<string> {
  return getIdTokenViaAuthEmulator(TEST_USERS.clinicAdminB.email, TEST_PASSWORD);
}

test.describe('UC-54 — Convidar consultor: consultor inativo', () => {
  // clinicAdminB fica sem aceite de termos no seed de propósito (UC-09 usa isso).
  // Aceite criado só para este spec e removido no fim, para o TermsInterceptor
  // não cobrir a tela de convite quando o spec roda isolado.
  const createdAcceptances: string[] = [];

  test.beforeAll(async () => {
    const db = getEmulatorAdminFirestore();
    for (const legalDoc of Object.values(TEST_LEGAL_DOCUMENTS)) {
      const id = `${TEST_USERS.clinicAdminB.uid}_${legalDoc.id}`;
      const ref = db.collection('user_document_acceptances').doc(id);
      if (!(await ref.get()).exists) {
        await ref.set({
          user_id: TEST_USERS.clinicAdminB.uid,
          document_id: legalDoc.id,
          document_version: '1.0',
          accepted_at: FieldValue.serverTimestamp(),
        });
        createdAcceptances.push(id);
      }
    }

    await db.collection('consultants').doc(INACTIVE_ID).set({
      code: INACTIVE_CODE,
      name: 'Consultor Inativo QA UC54',
      email: 'qa.uc54-inactive@curvamestra.test',
      phone: '11955554444',
      status: 'inactive',
      authorized_tenants: [],
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
  });

  test.afterAll(async () => {
    const db = getEmulatorAdminFirestore();
    await db.collection('consultants').doc(INACTIVE_ID).delete();
    for (const id of createdAcceptances) {
      await db.collection('user_document_acceptances').doc(id).delete();
    }
  });

  test('busca por código de consultor inativo retorna 409 com a mensagem de inativo', async ({
    request,
  }) => {
    const response = await request.get(`/api/consultants/by-code/${INACTIVE_CODE}`, {
      headers: { Authorization: `Bearer ${await clinicAdminBToken()}` },
    });
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.code).toBe('consultant_inactive');
    expect(body.error).toBe(INACTIVE_CONSULTANT_MESSAGE);
  });

  test('busca continua distinguindo consultor ativo (200) e código inexistente (404)', async ({
    request,
  }) => {
    const headers = { Authorization: `Bearer ${await clinicAdminBToken()}` };

    const active = await request.get(`/api/consultants/by-code/${TEST_USERS.consultantB.code}`, {
      headers,
    });
    expect(active.status()).toBe(200);
    expect((await active.json()).data.id).toBe(TEST_USERS.consultantB.uid);

    const missing = await request.get('/api/consultants/by-code/111111', { headers });
    expect(missing.status()).toBe(404);
  });

  test('convite para consultor inativo é recusado com a mesma mensagem e nada é criado', async ({
    request,
  }) => {
    const response = await request.post(
      `/api/tenants/${TEST_TENANTS.clinicB.tenant_id}/consultant/invite`,
      {
        headers: { Authorization: `Bearer ${await clinicAdminBToken()}` },
        data: { consultant_id: INACTIVE_ID },
      }
    );
    expect(response.status()).toBe(409);
    expect((await response.json()).error).toBe(INACTIVE_CONSULTANT_MESSAGE);

    const invites = await getEmulatorAdminFirestore()
      .collection('consultant_transfer_requests')
      .where('tenant_id', '==', TEST_TENANTS.clinicB.tenant_id)
      .where('requesting_consultant_id', '==', INACTIVE_ID)
      .get();
    expect(invites.empty).toBe(true);
  });

  test('clinic_admin vê o aviso de consultor temporariamente inativo na tela de convite', async ({
    page,
  }) => {
    await loginAs(
      page,
      { email: TEST_USERS.clinicAdminB.email, password: TEST_PASSWORD },
      '/clinic/dashboard'
    );
    await page.goto('/clinic/consultant/invite');

    const codeInput = page.locator('#code');
    await codeInput.fill(INACTIVE_CODE);
    await codeInput.locator('xpath=following-sibling::button').click();

    await expect(page.getByText(INACTIVE_CONSULTANT_TITLE, { exact: true })).toBeVisible();
    await expect(page.getByText(INACTIVE_CONSULTANT_MESSAGE, { exact: true })).toBeVisible();
    await expect(page.getByText('Consultor não encontrado')).toHaveCount(0);
  });
});
