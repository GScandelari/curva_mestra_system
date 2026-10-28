/**
 * Firestore de destino dos scripts de manutenção: o emulador quando
 * FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST estão setados (ex.:
 * via `firebase emulators:exec`); senão, o projeto real da credencial
 * informada, restrito aos projetos conhecidos.
 */

const KNOWN_REAL_PROJECT_IDS = ['curva-mestra-dev', 'curva-mestra'];

export async function resolveFirestore(credPath: string | undefined, scriptName: string) {
  if (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const { getEmulatorAdminFirestore } = await import('./emulatorAdmin');
    console.log(`[${scriptName}] rodando contra o Firebase Emulator`);
    return getEmulatorAdminFirestore();
  }

  if (!credPath) {
    console.error(
      `Uso: npx tsx scripts/${scriptName}.ts [<caminho-para-service-account.json>] [opções]\n` +
        'Sem FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST setados, é obrigatório informar a credencial.'
    );
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const serviceAccount = require(credPath);
  if (!KNOWN_REAL_PROJECT_IDS.includes(serviceAccount.project_id)) {
    console.error(
      `❌ ABORTADO: a credencial aponta para "${serviceAccount.project_id}", esperado um de ` +
        `${KNOWN_REAL_PROJECT_IDS.join(', ')}. Isso evita escrever no projeto errado.`
    );
    process.exit(1);
  }

  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  console.log(`[${scriptName}] rodando contra o projeto real "${serviceAccount.project_id}"`);
  return getFirestore(app);
}
