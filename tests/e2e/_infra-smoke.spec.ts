import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';
import { getEmulatorAdminAuth } from '../../scripts/lib/emulatorAdmin';
import { TEST_PASSWORD, TEST_USERS } from './fixtures/seed-data';

/**
 * Spec de infraestrutura (prefixo `_`, não vinculado a nenhum UC) — prova viva
 * de que Firebase Emulator Suite + scripts/seed-emulator.ts + Playwright +
 * webServer (next dev apontando para os emuladores) funcionam juntos de ponta
 * a ponta. Ver FEAT-qa-agent-playwright-emulator-setup.md, Seção 6.8/8.
 */
test.describe('Infraestrutura de QA — smoke test', () => {
  test('system_admin semeado loga e chega em /admin/dashboard', async ({ page }) => {
    await loginAs(
      page,
      { email: TEST_USERS.systemAdmin.email, password: TEST_PASSWORD },
      '/admin/dashboard'
    );
  });

  test('clinic_admin semeado loga e chega em /clinic/dashboard', async ({ page }) => {
    await loginAs(
      page,
      { email: TEST_USERS.clinicAdminA.email, password: TEST_PASSWORD },
      '/clinic/dashboard'
    );
  });

  test('custom claims do usuário semeado batem com o esperado (Admin SDK contra o emulador)', async () => {
    const auth = getEmulatorAdminAuth();
    const user = await auth.getUser(TEST_USERS.clinicAdminA.uid);
    expect(user.customClaims?.role).toBe('clinic_admin');
    expect(user.customClaims?.tenant_id).toBe(TEST_USERS.clinicAdminA.tenant_id);
    expect(user.customClaims?.active).toBe(true);
  });
});
