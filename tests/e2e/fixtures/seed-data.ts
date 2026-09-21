/**
 * Fixture determinística de dados de teste para a suíte Playwright E2E.
 *
 * Fonte única de verdade reaproveitada por:
 * - scripts/seed-emulator.ts (grava estes dados no Firebase Emulator Suite)
 * - tests/e2e/**\/*.spec.ts (specs referenciam estes usuários/tenants por nome)
 *
 * Campos alinhados a src/types/index.ts (User, Tenant, Consultant, LegalDocument,
 * UserDocumentAcceptance, CustomClaims) e conferidos linha a linha contra as rotas
 * reais de criação (src/app/api/users/create/route.ts, src/app/api/tenants/create/route.ts,
 * src/app/api/consultants/route.ts) — ex.: o documento em `users/{uid}` grava tanto
 * `full_name` quanto `displayName` (padrão real do projeto, não só o que o tipo declara),
 * e consultores usam `tenant_id: null` (não string vazia), replicando exatamente o que
 * o backend real grava hoje.
 *
 * NUNCA usar estes dados fora do Firebase Emulator Suite (demo-curva-mestra-e2e) — ver
 * scripts/lib/emulatorAdmin.ts para a guarda que impede isso.
 */

export const TEST_PASSWORD = 'Test@12345!';

export const TEST_TENANTS = {
  clinicA: { tenant_id: 'test-clinic-a', name: 'Clínica Teste A' },
  clinicB: { tenant_id: 'test-clinic-b', name: 'Clínica Teste B' },
} as const;

export const TEST_USERS = {
  systemAdmin: {
    uid: 'qa-system-admin',
    email: 'qa.system-admin@curvamestra.test',
    name: 'QA System Admin',
    tenant_id: null,
    claims: { tenant_id: null, role: 'system_admin', is_system_admin: true, active: true },
  },
  clinicAdminA: {
    uid: 'qa-clinic-admin-a',
    email: 'qa.clinic-admin-a@curvamestra.test',
    name: 'QA Clinic Admin A',
    tenant_id: TEST_TENANTS.clinicA.tenant_id,
    claims: {
      tenant_id: TEST_TENANTS.clinicA.tenant_id,
      role: 'clinic_admin',
      is_system_admin: false,
      active: true,
    },
  },
  clinicUserA: {
    uid: 'qa-clinic-user-a',
    email: 'qa.clinic-user-a@curvamestra.test',
    name: 'QA Clinic User A',
    tenant_id: TEST_TENANTS.clinicA.tenant_id,
    claims: {
      tenant_id: TEST_TENANTS.clinicA.tenant_id,
      role: 'clinic_user',
      is_system_admin: false,
      active: true,
    },
  },
  clinicAdminB: {
    uid: 'qa-clinic-admin-b',
    email: 'qa.clinic-admin-b@curvamestra.test',
    name: 'QA Clinic Admin B',
    tenant_id: TEST_TENANTS.clinicB.tenant_id,
    claims: {
      tenant_id: TEST_TENANTS.clinicB.tenant_id,
      role: 'clinic_admin',
      is_system_admin: false,
      active: true,
    },
  },
  consultant: {
    uid: 'qa-consultant',
    email: 'qa.consultant@curvamestra.test',
    name: 'QA Consultant',
    code: 'QA0001',
    tenant_id: null,
    claims: {
      tenant_id: null,
      role: 'clinic_consultant',
      is_system_admin: false,
      is_consultant: true,
      consultant_id: 'qa-consultant',
      authorized_tenants: [TEST_TENANTS.clinicA.tenant_id],
      active: true,
    },
  },
} as const;

export const TEST_LEGAL_DOCUMENTS = {
  withAcceptance: {
    id: 'qa-legal-doc-accepted',
    title: 'Termo de Uso — QA (com aceite)',
    slug: 'termo-qa-com-aceite',
  },
  withoutAcceptance: {
    id: 'qa-legal-doc-pending',
    title: 'Termo de Uso — QA (sem aceite)',
    slug: 'termo-qa-sem-aceite',
  },
} as const;
