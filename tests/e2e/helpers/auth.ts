import { Page, expect } from '@playwright/test';

/**
 * Loga via preenchimento real do formulário /login (id="email"/id="password",
 * botão "Entrar" — src/app/(auth)/login/page.tsx), fiel ao roteiro manual já
 * usado nas seções "STEP 4" dos specs de bugfix existentes.
 *
 * '/change-password' foi adicionado ao destino esperado (UC-06) porque
 * também é um redirecionamento legítimo pós-login — acionado quando
 * `claims.requirePasswordChange === true` (src/app/(auth)/login/page.tsx,
 * handleSubmit) — e não apenas os destinos finais por role.
 */
export async function loginAs(
  page: Page,
  credentials: { email: string; password: string },
  expectedRedirect: '/admin/dashboard' | '/clinic/dashboard' | '/change-password'
): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(new RegExp(expectedRedirect.replace('/', '\\/')));
}
