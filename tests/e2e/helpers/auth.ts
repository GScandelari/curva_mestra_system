import { Page, expect } from '@playwright/test';

/**
 * Loga via preenchimento real do formulário /login (id="email"/id="password",
 * botão "Entrar" — src/app/(auth)/login/page.tsx), fiel ao roteiro manual já
 * usado nas seções "STEP 4" dos specs de bugfix existentes.
 */
export async function loginAs(
  page: Page,
  credentials: { email: string; password: string },
  expectedRedirect: '/admin/dashboard' | '/clinic/dashboard'
): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(credentials.email);
  await page.locator('#password').fill(credentials.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(new RegExp(expectedRedirect.replace('/', '\\/')));
}
