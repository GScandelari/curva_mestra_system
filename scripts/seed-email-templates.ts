/**
 * Popula `email_templates/{tipo}` (UC-55) com os 13 templates no layout
 * padrão (`content` + `layout_version: 1`). O conteúdo fica em
 * scripts/lib/emailTemplateDefinitions.ts, compartilhado com a migração
 * (scripts/migrate-email-templates-layout.ts).
 *
 * O e-mail de corpo livre de `tenants/create` continua fora deste seed
 * (RN-14 do UC-55).
 *
 * Idempotente: só cria um `tipo` se o documento ainda não existir. Passe
 * `--force` para sobrescrever os que já existem (sobrescreve o documento
 * inteiro, inclusive o `body` legado). Para levar um ambiente já seedado ao
 * layout novo preservando customizações, use a migração.
 *
 * Uso:
 *   # Contra o Firebase Emulator (requer FIRESTORE_EMULATOR_HOST/
 *   # FIREBASE_AUTH_EMULATOR_HOST setados, ex.: via `firebase emulators:exec`):
 *   npx tsx scripts/seed-email-templates.ts
 *
 *   # Contra um projeto real (gscandelari_setup ou produção):
 *   npx tsx scripts/seed-email-templates.ts <caminho-para-service-account.json>
 *
 *   # Sobrescrevendo templates já existentes, em qualquer um dos dois modos:
 *   npx tsx scripts/seed-email-templates.ts [<service-account.json>] --force
 */

import { EMAIL_TEMPLATE_DEFINITIONS as TEMPLATES } from './lib/emailTemplateDefinitions';

const KNOWN_REAL_PROJECT_IDS = ['curva-mestra-dev', 'curva-mestra'];

async function resolveFirestore(credPath: string | undefined) {
  if (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const { getEmulatorAdminFirestore } = await import('./lib/emulatorAdmin');
    console.log('[seed-email-templates] rodando contra o Firebase Emulator');
    return getEmulatorAdminFirestore();
  }

  if (!credPath) {
    console.error(
      'Uso: npx tsx scripts/seed-email-templates.ts [<caminho-para-service-account.json>] [--force]\n' +
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
  console.log(
    `[seed-email-templates] rodando contra o projeto real "${serviceAccount.project_id}"`
  );
  return getFirestore(app);
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const credPath = args.find((a) => a !== '--force');

  const db = await resolveFirestore(credPath);
  const { FieldValue } = await import('firebase-admin/firestore');

  let created = 0;
  let skipped = 0;
  let overwritten = 0;

  for (const template of TEMPLATES) {
    const ref = db.collection('email_templates').doc(template.tipo);
    const snap = await ref.get();

    if (snap.exists && !force) {
      console.log(`[seed-email-templates] "${template.tipo}" já existe — mantido (sem --force)`);
      skipped++;
      continue;
    }

    await ref.set({
      tipo: template.tipo,
      label: template.label,
      category: template.category,
      related_uc: template.related_uc,
      subject: template.subject,
      content: template.content,
      layout_version: 1,
      variables: template.variables,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: 'seed-script',
      updated_by_name: 'Seed automático (UC-55)',
    });

    if (snap.exists) {
      console.log(`[seed-email-templates] "${template.tipo}" sobrescrito (--force)`);
      overwritten++;
    } else {
      console.log(`[seed-email-templates] "${template.tipo}" criado`);
      created++;
    }
  }

  console.log(
    `[seed-email-templates] concluído — ${created} criado(s), ${overwritten} sobrescrito(s), ${skipped} mantido(s) de ${TEMPLATES.length} templates.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[seed-email-templates] erro:', error);
    process.exit(1);
  });
