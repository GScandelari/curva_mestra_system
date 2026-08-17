import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PLAYWRIGHT_PORT ?? '3100';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // specs compartilham o mesmo emulador semeado uma única vez
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // open: 'never' também localmente -- sem isso, o reporter HTML abre um
  // servidor local ao final da execução e bloqueia o processo até Ctrl+C,
  // o que trava `npm run test:e2e` (e o `firebase emulators:exec` que o
  // envolve) indefinidamente em vez de finalizar sozinho.
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['html', { open: 'never' }]],
  timeout: 30_000,
  // Next dev compila rotas sob demanda (primeira visita a cada rota é mais
  // lenta) -- o default de 5s do Playwright para `expect()` é curto demais
  // para o primeiro `toHaveURL` pós-redirect de um cold start.
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    // Aponta para /login (não a raiz) de propósito: todo spec desta suíte
    // começa por ali (loginAs, tests/e2e/helpers/auth.ts). O Next dev
    // compila rotas sob demanda -- se o healthcheck do webServer só
    // aguardar `/` responder, a primeira visita real a /login (dentro do
    // próprio teste) ainda paga o custo do primeiro compile e estoura até o
    // timeout de 30s do teste. Aguardar /login aqui garante que ela já foi
    // compilada antes do primeiro teste começar.
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-curva-mestra-e2e',
      // O client SDK do Firebase (getAuth) valida o formato de apiKey mesmo
      // quando vai conectar no emulador logo em seguida (src/lib/firebase.ts)
      // -- sem um valor não-vazio aqui, a própria SSR da página /login lança
      // "auth/invalid-api-key" antes de qualquer teste rodar. Valores fake,
      // nunca usados para autenticar contra o Firebase real (RN-01/RNF-03).
      NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-curva-mestra-e2e.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-curva-mestra-e2e.appspot.com',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
    },
  },
});
