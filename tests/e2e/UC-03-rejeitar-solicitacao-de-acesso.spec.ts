import { test, expect, Page } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminFirestore } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_TENANTS, TEST_USERS } from './fixtures/seed-data';

/**
 * Cobertura retroativa (Modo B) de:
 * ONLY_FOR_DEVS/PO_BA_Docs/UC-03-rejeitar-solicitacao-de-acesso.md (v1.3.1)
 *
 * Cobre:
 * - Fluxo Principal (passos 1-12), pelo System Admin em /admin/access-requests
 *   (com regressão do bugfix UC-03-Q1 / commit `1254abb` no placeholder do
 *   campo "Motivo da rejeição").
 * - Fluxo Principal pelo Clinic Admin (ator secundário, seção 2.2) em
 *   /clinic/access-requests, exercitando RN-04 (visibilidade de solicitações
 *   pendentes escopada por tenant_id) e RNF-03 (isolamento multi-tenant).
 * - Fluxo Alternativo 7a — motivo em branco, RN-01 (rejection_reason vira
 *   "Não especificado").
 * - Fluxo Alternativo 7b — Admin cancela o dialog, sem efeito.
 * - Fluxo de Exceção 8a — solicitação já processada por uma ação concorrente
 *   entre a abertura do dialog e a confirmação.
 *
 * Suposições assumidas nesta cobertura retroativa (Modo B, sem "STEP 4"
 * pronto para servir de fonte — ver Seção 3, passo 3 do agente qa-agent):
 * - `access_requests` não é uma entidade semeada por
 *   tests/e2e/fixtures/seed-data.ts / scripts/seed-emulator.ts. Cada teste
 *   cria sua própria solicitação pendente diretamente via Admin SDK
 *   (getEmulatorAdminFirestore()), replicando o mesmo schema gravado hoje
 *   pelo fluxo real de criação (UC-01, `POST /api/access-requests`) — a
 *   pré-condição deste UC (seção 3) é apenas "existe uma solicitação com
 *   status pendente", agnóstica a como ela foi criada (RN-03).
 * - RNF-04 (rota de API server-side `POST /api/access-requests/[id]/reject`)
 *   não é exercitada aqui: o próprio UC documenta que nenhum client a chama
 *   hoje (RN-02) — a UI coberta por este spec sempre passa por
 *   `rejectAccessRequest()` (`updateDoc` direto no client).
 */

function uniqueSuffix(scenario: string): string {
  return `${scenario}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

type PendingAccessRequestOverrides = {
  full_name?: string;
  email?: string;
  role?: 'especialista' | 'consultor';
  type?: 'clinica' | 'autonomo';
  council_number?: string;
  business_name?: string;
  tenant_id?: string;
};

/**
 * Cria diretamente no Firestore do emulador uma access_request com
 * status "pendente" — pré-condição deste UC (seção 3). Réplica fiel do
 * schema gravado hoje por `POST /api/access-requests` (ver UC-01).
 */
async function createPendingAccessRequest(
  scenario: string,
  overrides: PendingAccessRequestOverrides = {}
): Promise<{ id: string; full_name: string; email: string }> {
  const db = getEmulatorAdminFirestore();
  const suffix = uniqueSuffix(scenario);
  const full_name = overrides.full_name ?? `QA UC03 Solicitante ${suffix}`;
  const email = overrides.email ?? `qa-uc03-${suffix}@example.com`;

  const data: Record<string, unknown> = {
    role: overrides.role ?? 'especialista',
    type: overrides.type ?? 'clinica',
    full_name,
    email,
    phone: '11987654321',
    council_number: overrides.council_number ?? 'CRM-SP 100000',
    business_name: overrides.business_name ?? 'Clínica QA UC-03',
    status: 'pendente',
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  };
  if (overrides.tenant_id) {
    data.tenant_id = overrides.tenant_id;
  }

  const docRef = await db.collection('access_requests').add(data);
  return { id: docRef.id, full_name, email };
}

/** Passos 3-4 do Fluxo Principal: clica em "Rejeitar" na linha e aguarda o dialog abrir. */
async function openRejectDialogForRow(page: Page, fullName: string): Promise<void> {
  const row = page.getByRole('row', { name: new RegExp(fullName) });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Rejeitar' }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Rejeitar Solicitação' })
  ).toBeVisible();
}

test.describe('UC-03 — Rejeitar Solicitação de Acesso', () => {
  test.describe('Fluxo Principal — System Admin em /admin/access-requests', () => {
    test('rejeita solicitação pendente com motivo preenchido e atualiza o Firestore (passos 1-12)', async ({
      page,
    }) => {
      const request = await createPendingAccessRequest('admin-principal');

      // Passo 1.
      await loginAs(
        page,
        { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
        '/admin/dashboard'
      );
      await page.goto('/admin/access-requests');

      // Passo 2: solicitação pendente listada.
      const row = page.getByRole('row', { name: new RegExp(request.full_name) });
      await expect(row).toBeVisible();
      await expect(row.getByText(request.email)).toBeVisible();

      // Passos 3-4: dialog abre com o placeholder corrigido (bugfix
      // UC-03-Q1, commit `1254abb` — sem mais menção a CPF/CNPJ).
      await openRejectDialogForRow(page, request.full_name);
      await expect(page.locator('#reason')).toHaveAttribute(
        'placeholder',
        'Ex: Perfil não compatível, dados incorretos, vaga indisponível, etc.'
      );

      // Passo 5.
      const motivo = 'Perfil não compatível com a vaga disponível.';
      await page.locator('#reason').fill(motivo);

      // Passo 6.
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar Rejeição' }).click();

      // Passo 10: toast de sucesso.
      await expect(
        page.getByText('Solicitação rejeitada').and(page.locator(':not([role="status"])'))
      ).toBeVisible();
      await expect(page.getByText('O solicitante será notificado')).toBeVisible();

      // Passo 11: dialog fecha e a lista de pendentes é recarregada sem a
      // solicitação rejeitada.
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(page.getByRole('row', { name: new RegExp(request.full_name) })).toHaveCount(0);

      // Pós-condição de sucesso (seção 4.1): documento atualizado no Firestore.
      const db = getEmulatorAdminFirestore();
      const doc = (await db.collection('access_requests').doc(request.id).get()).data();
      expect(doc?.status).toBe('rejeitada');
      expect(doc?.rejected_by).toBe(TEST_USERS.systemAdmin.uid);
      expect(doc?.rejected_by_name).toBe(TEST_USERS.systemAdmin.name);
      expect(doc?.rejection_reason).toBe(motivo);
      expect(doc?.rejected_at).toBeDefined();
      expect(doc?.updated_at).toBeDefined();
    });
  });

  test.describe('Fluxo Principal — Clinic Admin em /clinic/access-requests (ator secundário, RN-04)', () => {
    test('rejeita apenas solicitações do próprio tenant; solicitação de outra clínica não aparece na lista', async ({
      page,
    }) => {
      const ownRequest = await createPendingAccessRequest('clinic-admin-tenant-a', {
        tenant_id: TEST_TENANTS.clinicA.tenant_id,
      });
      const otherTenantRequest = await createPendingAccessRequest('clinic-admin-tenant-b', {
        tenant_id: TEST_TENANTS.clinicB.tenant_id,
      });

      await loginAs(
        page,
        { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
        '/clinic/dashboard'
      );
      await page.goto('/clinic/access-requests');

      // Passo 2 (RN-04/RNF-03): apenas a solicitação do próprio tenant é
      // visível; a de outra clínica não aparece na lista.
      await expect(page.getByRole('row', { name: new RegExp(ownRequest.full_name) })).toBeVisible();
      await expect(
        page.getByRole('row', { name: new RegExp(otherTenantRequest.full_name) })
      ).toHaveCount(0);

      // Passos 3-4: mesmo dialog/função (RN-02), placeholder da tela do
      // Clinic Admin (sem "vaga indisponível", diferente do placeholder
      // corrigido da tela do System Admin).
      await openRejectDialogForRow(page, ownRequest.full_name);
      await expect(page.locator('#reason')).toHaveAttribute(
        'placeholder',
        'Ex: Perfil não compatível, dados incorretos, etc.'
      );

      await page.locator('#reason').fill('Vaga já preenchida por outro candidato.');
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar Rejeição' }).click();

      await expect(
        page.getByText('Solicitação rejeitada').and(page.locator(':not([role="status"])'))
      ).toBeVisible();
      await expect(page.getByRole('row', { name: new RegExp(ownRequest.full_name) })).toHaveCount(
        0
      );

      const db = getEmulatorAdminFirestore();
      const ownDoc = (await db.collection('access_requests').doc(ownRequest.id).get()).data();
      expect(ownDoc?.status).toBe('rejeitada');
      expect(ownDoc?.rejected_by).toBe(TEST_USERS.clinicAdminA.uid);
      expect(ownDoc?.rejected_by_name).toBe(TEST_USERS.clinicAdminA.name);

      // A solicitação da outra clínica permanece intocada — nunca foi
      // exposta na UI do Clinic Admin A para ser rejeitada.
      const otherDoc = (
        await db.collection('access_requests').doc(otherTenantRequest.id).get()
      ).data();
      expect(otherDoc?.status).toBe('pendente');
    });
  });

  test.describe('Fluxo Alternativo 7a — Admin não preenche motivo', () => {
    test('rejection_reason é salvo como "Não especificado" quando o campo fica em branco (RN-01)', async ({
      page,
    }) => {
      const request = await createPendingAccessRequest('motivo-vazio');

      await loginAs(
        page,
        { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
        '/admin/dashboard'
      );
      await page.goto('/admin/access-requests');

      // Passo 1: campo "Motivo da rejeição" deixado em branco.
      await openRejectDialogForRow(page, request.full_name);
      await expect(page.locator('#reason')).toHaveValue('');

      // Passo 3: segue o fluxo normal a partir do passo 6 do Fluxo Principal.
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar Rejeição' }).click();
      await expect(
        page.getByText('Solicitação rejeitada').and(page.locator(':not([role="status"])'))
      ).toBeVisible();

      const db = getEmulatorAdminFirestore();
      const doc = (await db.collection('access_requests').doc(request.id).get()).data();
      expect(doc?.status).toBe('rejeitada');
      // Passo 2 do fluxo 7a.
      expect(doc?.rejection_reason).toBe('Não especificado');
    });
  });

  test.describe('Fluxo Alternativo 7b — Admin cancela o dialog', () => {
    test('cancelar fecha o dialog sem alterar a solicitação', async ({ page }) => {
      const request = await createPendingAccessRequest('cancelar-dialog');

      await loginAs(
        page,
        { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
        '/admin/dashboard'
      );
      await page.goto('/admin/access-requests');

      await openRejectDialogForRow(page, request.full_name);
      // Preenche o motivo antes de cancelar, para provar que o texto
      // digitado também é descartado junto com o cancelamento.
      await page.locator('#reason').fill('Motivo que será descartado.');

      // Passo 1.
      await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();

      // Passo 2: dialog fecha sem alterar a solicitação.
      await expect(page.getByRole('dialog')).toBeHidden();
      // Passo 3: caso de uso encerrado sem efeito — a lista não é
      // recarregada (loadRequests() só roda no sucesso da rejeição/aprovação
      // ou no clique manual em "Atualizar"), então a linha continua visível.
      await expect(page.getByRole('row', { name: new RegExp(request.full_name) })).toBeVisible();

      // Pós-condição de falha (seção 4.2): documento permanece inalterado.
      const db = getEmulatorAdminFirestore();
      const doc = (await db.collection('access_requests').doc(request.id).get()).data();
      expect(doc?.status).toBe('pendente');
      expect(doc?.rejection_reason).toBeUndefined();
      expect(doc?.rejected_at).toBeUndefined();
    });
  });

  test.describe('Fluxo de Exceção 8a — solicitação já processada', () => {
    test('toast de erro é exibido e a solicitação mantém o status atual quando já foi processada por outra ação', async ({
      page,
    }) => {
      const request = await createPendingAccessRequest('ja-processada');

      await loginAs(
        page,
        { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
        '/admin/dashboard'
      );
      await page.goto('/admin/access-requests');

      await openRejectDialogForRow(page, request.full_name);
      await page.locator('#reason').fill('Tentando rejeitar depois de já processada.');

      // Simula uma ação concorrente: a mesma solicitação é aprovada por
      // outro admin entre a abertura do dialog e a confirmação — via Admin
      // SDK, sem passar pela UI (RNF-02: sem realtime listener nesta tela).
      const db = getEmulatorAdminFirestore();
      await db.collection('access_requests').doc(request.id).update({
        status: 'aprovada',
        updated_at: Timestamp.now(),
      });

      // Passo 1 (a partir do passo 8 do Fluxo Principal): confirma a
      // rejeição sobre uma solicitação que não está mais "pendente".
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar Rejeição' }).click();

      // Passos 2-3: toast destructive com a mensagem exata do service.
      await expect(page.getByText('Erro').and(page.locator(':not([role="status"])'))).toBeVisible();
      await expect(
        page.getByText('Solicitação já foi processada').and(page.locator(':not([role="status"])'))
      ).toBeVisible();

      // Dialog permanece aberto — só fecha no branch de sucesso.
      await expect(page.getByRole('dialog')).toBeVisible();

      // Passo 4 / pós-condição de falha: a solicitação mantém o status
      // atual (aprovada), sem qualquer campo de rejeição gravado.
      const doc = (await db.collection('access_requests').doc(request.id).get()).data();
      expect(doc?.status).toBe('aprovada');
      expect(doc?.rejected_by).toBeUndefined();
      expect(doc?.rejection_reason).toBeUndefined();
    });
  });
});
