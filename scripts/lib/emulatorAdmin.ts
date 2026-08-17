/**
 * Inicialização do Firebase Admin SDK exclusiva para scripts/testes contra o
 * Firebase Emulator Suite. NUNCA importar em código de produção (src/) — ver
 * src/lib/firebase-admin.ts para a inicialização real, que exige credenciais
 * (FIREBASE_ADMIN_CREDENTIALS ou arquivo local) e nunca deve ser usada aqui.
 *
 * Funciona porque, quando FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST
 * estão setados (definidos automaticamente por `firebase emulators:exec`), o
 * Admin SDK não valida credenciais reais — basta inicializar com um projectId.
 */
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

export const EMULATOR_PROJECT_ID =
  process.env.GCLOUD_PROJECT ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
  'demo-curva-mestra-e2e';

/**
 * Função pura — testada isoladamente em scripts/lib/__tests__/emulatorAdmin.test.ts.
 * Nunca deve retornar true se qualquer uma das duas env vars do emulador faltar.
 */
export function isEmulatorConfigured(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.FIRESTORE_EMULATOR_HOST) && Boolean(env.FIREBASE_AUTH_EMULATOR_HOST);
}

function assertRunningAgainstEmulator(): void {
  if (!isEmulatorConfigured(process.env)) {
    throw new Error(
      'emulatorAdmin.ts só pode rodar com FIRESTORE_EMULATOR_HOST e FIREBASE_AUTH_EMULATOR_HOST ' +
        'definidos (via `firebase emulators:exec`). Abortando para evitar tocar Firebase real.'
    );
  }
}

let app: App | undefined;

export function getEmulatorAdminApp(): App {
  assertRunningAgainstEmulator();
  if (app) return app;
  const apps = getApps();
  app = apps.length > 0 ? apps[0] : initializeApp({ projectId: EMULATOR_PROJECT_ID });
  return app;
}

export function getEmulatorAdminAuth(): Auth {
  return getAuth(getEmulatorAdminApp());
}

export function getEmulatorAdminFirestore(): Firestore {
  return getFirestore(getEmulatorAdminApp());
}
