/**
 * Popula o Firebase Emulator Suite com dados determinísticos para os specs
 * Playwright em tests/e2e/. Só roda contra o emulador — emulatorAdmin.ts
 * recusa executar sem FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST.
 *
 * Uso: já embrulhado no script `npm run test:e2e`. Para rodar isoladamente
 * com o emulador já de pé em outro terminal (`npx firebase emulators:start`):
 * `npm run test:e2e:seed`.
 *
 * Não confundir com scripts/seed-emulator.js (dev tool legado, manual, usado
 * com `dev-tools/.env.dev-tools` para popular o emulador local do dev com
 * dados de exploração livre) — este arquivo é a fixture determinística e
 * versionada usada exclusivamente pela suíte E2E automatizada.
 */
import { Timestamp } from 'firebase-admin/firestore';
import { getEmulatorAdminAuth, getEmulatorAdminFirestore } from './lib/emulatorAdmin';
import {
  TEST_PASSWORD,
  TEST_TENANTS,
  TEST_USERS,
  TEST_LEGAL_DOCUMENTS,
} from '../tests/e2e/fixtures/seed-data';

type SeedUser = (typeof TEST_USERS)[keyof typeof TEST_USERS];

async function createAuthUser(user: SeedUser) {
  const auth = getEmulatorAdminAuth();
  await auth.createUser({
    uid: user.uid,
    email: user.email,
    password: TEST_PASSWORD,
    displayName: user.name,
    emailVerified: true,
  });
  await auth.setCustomUserClaims(user.uid, user.claims);
}

async function seed() {
  const db = getEmulatorAdminFirestore();
  const now = Timestamp.now();

  console.log('[seed-emulator] criando usuários no Auth emulado...');
  for (const user of Object.values(TEST_USERS)) {
    await createAuthUser(user);
  }

  console.log('[seed-emulator] criando tenants...');
  await db.doc(`tenants/${TEST_TENANTS.clinicA.tenant_id}`).set({
    name: TEST_TENANTS.clinicA.name,
    document_type: 'cnpj',
    document_number: '11111111000191',
    email: TEST_USERS.clinicAdminA.email,
    max_users: 5,
    active: true,
    consultant_id: TEST_USERS.consultant.uid,
    consultant_code: TEST_USERS.consultant.code,
    consultant_name: TEST_USERS.consultant.name,
    created_at: now,
    updated_at: now,
  });
  await db.doc(`tenants/${TEST_TENANTS.clinicB.tenant_id}`).set({
    name: TEST_TENANTS.clinicB.name,
    document_type: 'cnpj',
    document_number: '22222222000191',
    email: TEST_USERS.clinicAdminB.email,
    max_users: 5,
    active: true,
    created_at: now,
    updated_at: now,
  });

  console.log('[seed-emulator] criando documentos users/{uid}...');
  const userDocs = [
    { u: TEST_USERS.systemAdmin, role: 'system_admin' },
    { u: TEST_USERS.clinicAdminA, role: 'clinic_admin' },
    { u: TEST_USERS.clinicUserA, role: 'clinic_user' },
    { u: TEST_USERS.clinicAdminB, role: 'clinic_admin' },
  ] as const;
  for (const { u, role } of userDocs) {
    await db.doc(`users/${u.uid}`).set({
      email: u.email,
      full_name: u.name,
      displayName: u.name,
      role,
      active: true,
      tenant_id: u.tenant_id,
      created_at: now,
      updated_at: now,
    });
  }

  console.log('[seed-emulator] criando consultor...');
  await db.doc(`consultants/${TEST_USERS.consultant.uid}`).set({
    user_id: TEST_USERS.consultant.uid,
    code: TEST_USERS.consultant.code,
    name: TEST_USERS.consultant.name,
    email: TEST_USERS.consultant.email,
    phone: '11999990000',
    status: 'active',
    authorized_tenants: [TEST_TENANTS.clinicA.tenant_id],
    created_at: now,
    updated_at: now,
  });
  await db.doc(`users/${TEST_USERS.consultant.uid}`).set({
    email: TEST_USERS.consultant.email,
    full_name: TEST_USERS.consultant.name,
    displayName: TEST_USERS.consultant.name,
    role: 'clinic_consultant',
    active: true,
    tenant_id: null,
    created_at: now,
    updated_at: now,
  });

  console.log('[seed-emulator] criando documentos legais (com e sem aceite)...');
  for (const [key, doc] of Object.entries(TEST_LEGAL_DOCUMENTS)) {
    await db.doc(`legal_documents/${doc.id}`).set({
      title: doc.title,
      slug: doc.slug,
      content: `# ${doc.title}`,
      version: '1.0',
      status: 'ativo',
      required_for_registration: true,
      required_for_existing_users: true,
      order: key === 'withAcceptance' ? 1 : 2,
      created_by: TEST_USERS.systemAdmin.uid,
      created_at: now,
      updated_at: now,
      published_at: now,
    });
  }
  // TermsInterceptor (src/components/auth/TermsInterceptor.tsx) roda para
  // QUALQUER role autenticado, não só clinic_*, e redireciona para
  // /accept-terms sempre que existir pelo menos 1 documento obrigatório sem
  // aceite do usuário logado. systemAdmin e clinicAdminA são os usuários que
  // tests/e2e/_infra-smoke.spec.ts loga via UI para chegar direto no
  // dashboard -- por isso recebem aceite de AMBOS os documentos legais.
  // clinicUserA/clinicAdminB/consultant continuam de propósito SEM nenhuma
  // aceitação: é assim que RF-03 ("um documento com aceite, um sem") fica
  // satisfeito por usuário/documento, sem precisar de um registro negativo
  // explícito -- specs futuros que exercitem o fluxo /accept-terms podem
  // logar com qualquer um desses usuários.
  const usersWithFullAcceptance = [TEST_USERS.systemAdmin, TEST_USERS.clinicAdminA];
  for (const user of usersWithFullAcceptance) {
    for (const legalDoc of Object.values(TEST_LEGAL_DOCUMENTS)) {
      await db.collection('user_document_acceptances').doc(`${user.uid}_${legalDoc.id}`).set({
        user_id: user.uid,
        document_id: legalDoc.id,
        document_version: '1.0',
        accepted_at: now,
      });
    }
  }

  console.log('[seed-emulator] concluído.');
}

seed().catch((error) => {
  console.error('[seed-emulator] falhou:', error);
  process.exit(1);
});
