import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PLAYWRIGHT_PORT ?? '3100';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

// src/lib/firebase-admin.ts (Admin SDK de PRODUÇÃO, usado pelas API routes
// reais como /api/access-requests) exige FIREBASE_ADMIN_CREDENTIALS (ou o
// arquivo local de credenciais) para sequer chamar initializeApp() -- sem
// isso, getAdminApp() lança "Firebase Admin SDK não configurado" e toda API
// route que o usa quebra em runtime, mesmo com o emulador de pé. Como
// FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST já chegam herdados de
// `firebase emulators:exec` (ver scripts/lib/emulatorAdmin.ts), o Admin SDK
// ignora silenciosamente as credenciais reais e conversa só com o emulador
// assim que o app inicializa -- então essa chave RSA é só uma chave
// descartável gerada localmente (openssl), nunca usada para autenticar
// contra nada real, apenas para satisfazer o formato exigido por cert().
const FAKE_ADMIN_CREDENTIALS = JSON.stringify({
  type: 'service_account',
  project_id: 'demo-curva-mestra-e2e',
  private_key_id: 'fake-key-id-e2e',
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDUtfMr9mMeyhL2
8ednsA6avTk22YU133oDj5VyplJ6Riq8zicpRXj7ubHjPGVlxDnhVHiP2nYbtzC/
l2hrxy9hF8lYbiSczAUfe+ZQT2x6hJPxz87UgI1+N5DumW8M3tZIWvbNMclsuO+1
u50ERMv+0brbxsikT2kvJba0Rh4dSzp2bBl9p+T9rttiP4jFT5M6MSrCnwy1WEH/
S2ZnlOrv5/F9W9BkNeTEIXOv0vrzjH6bGeto34aHK16liN+4wfDm0yFkLl4lUVPW
kjhK0tK7ZTU+67vm2ieRAdE/tWbUa618/yH5SQBS5n6WgWegabKT+cfu2LHn5cxM
kTbzwt7xAgMBAAECggEAAuvXYcG7ckHA5jkDxJ0hHwRp9WQiEkLJSvFTn0FQzcLK
O8R41E/SypUHoz27po/9+7RJVJZuoh2Cf9SzpF+vrNc8cDVRCOgI/cbALr2sf6ra
Jxgp+JA/mtDNPrQHCtr1Mx8WsR8I+GNUA9lGaoRxKPgWtB9KhAeRw8oL9I70kAWB
G6iCbgghICO/La6BSGoropBBhl1HGmW2Jon4l9yYKT3WyVqXttOtKXe1Udyzi+51
+yH6SLOd8V7a7fGt+U8v+tDq/Pf+BBJbhXTYnm71BAt54SG2w2WpuxDtbXHtsH/s
kVvjqEdXWvVyS12udAVzPHx6IIFYDEwFgFcCz1XXUQKBgQDrjN5yx5TW8rLgQRSz
/t6+nLeqZSNaAIaU5y925UULN+1f1XcZani3CRBM/yAPHJSDTNG01K3elPsCX+PN
eMaJDS/7WdJ+s2xbvDCRTGhwc0npfUZPXRr50N2hJ53JxdF8D1SkMaPYewl2PVav
yZmNqnNyp3tzYE0xwkLEQKQm2QKBgQDnLXhLRRjFETxBt3bP5+N72Xo3PzvEjA5m
+31M8uDP79ctlOZGIxyfMOZntG7iKOkS9TX2XFxANEpqApo3Gc77I/kv4q/InZN0
Mf+PVcyDE2PcaiTDnN39FzsoRBPSH5fTzJ7W3z0oqwXRm0K/NH0aZGiJFAh7zFZC
3KUgszDZ2QKBgQCAEDuU7duHLbaA5AFMhyI1QeE9W/VnZmfFJxgQLUBnhAWjl9xD
zjZJVT0uj3qvnJtF84sEJKlPHXKG7Pleae6O7sOKhWBDEGu2SE+jf4Y8tQGXV0vV
tEoJTjxg9Lf9znZBW9hp2K868FHJnjm2IwZAFk7kJBijNtVhWzuPlZFpqQKBgQCC
HdaiTv7VFJFcz72A4ZzpfYvLgrzKMKZ+kjiBUgb1IqJzVmaRvXuDoktcvXLXun0N
HZVE19FYldX4ewR/1Pfp5OKBcE7OVNrEwMt9yqX0dLp1Ogz9SNKtfCDg1ght8ThM
jtQsTrQmqrP4uTHFWu67Jx6rYOoxe95lfbk3gYQSaQKBgQCGhn9O5cc8eLK6yVaG
26128sDO6e6Jiu19PBmRaLjnQvAYlvwXKGy0aKKjtyZRhAzUTvfC7RI8a5CIzXcz
D+HkWoOucjwQ/zTiGRWM5xB9TA1SoILPMWtyxnEh0TeEN9rhvdEjSIUSGztpPeBX
jXoZL5H6XK3UIwqIueJXawnxhA==
-----END PRIVATE KEY-----
`,
  client_email: 'fake-e2e@demo-curva-mestra-e2e.iam.gserviceaccount.com',
  client_id: '000000000000000000000',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
});

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
      FIREBASE_ADMIN_CREDENTIALS: FAKE_ADMIN_CREDENTIALS,
    },
  },
});
