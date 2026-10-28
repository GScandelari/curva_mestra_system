/**
 * Migra `email_templates/{tipo}` para o layout padrão (`content` +
 * `layout_version: 1`) sem perder customizações (DN-03):
 *   - o estado atual de cada tipo (subject, body, variables) vai para
 *     `versions`, como qualquer edição do UC-55;
 *   - `body` e `subject` não são alterados (o assunto customizado continua);
 *   - tipos editados no UC-55 aparecem no relatório final, para o admin
 *     reaplicar as frases no miolo novo se quiser;
 *   - doc já migrado é ignorado (rodar de novo é no-op); doc inexistente é
 *     criado como no seed.
 *
 * Padrão: --dry-run (só imprime a classificação). Use --apply para gravar.
 *
 * Uso (PowerShell):
 *   npx tsx scripts/migrate-email-templates-layout.ts C:\caminho\service-account.json --dry-run
 *   npx tsx scripts/migrate-email-templates-layout.ts C:\caminho\service-account.json --apply
 *
 * Ver ONLY_FOR_DEVS/TO_DO/FEAT-padronizacao-emails-e-links-de-senha.md (STEP 9).
 */

import { EMAIL_TEMPLATE_DEFINITIONS } from './lib/emailTemplateDefinitions';
import {
  buildBackupVersion,
  buildMigrationUpdate,
  classifyTemplateDoc,
  MIGRATION_ACTOR,
  type ExistingTemplateDoc,
  type MigrationStatus,
} from './lib/emailTemplateMigration';
import { resolveFirestore } from './lib/firestoreTarget';

const STATUS_LABEL: Record<MigrationStatus, string> = {
  missing: 'inexistente (será criado)',
  migrated: 'já migrado (ignorado)',
  seed_default: 'padrão do seed',
  customized: 'CUSTOMIZADO (revisar depois)',
};

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const credPath = args.find((a) => !a.startsWith('--'));

  const db = await resolveFirestore(credPath, 'migrate-email-templates-layout');
  const { FieldValue } = await import('firebase-admin/firestore');

  console.log(apply ? '\nModo --apply: gravando.\n' : '\nModo --dry-run: nada será gravado.\n');

  const customized: string[] = [];
  const counts: Record<MigrationStatus, number> = {
    missing: 0,
    migrated: 0,
    seed_default: 0,
    customized: 0,
  };

  for (const def of EMAIL_TEMPLATE_DEFINITIONS) {
    const ref = db.collection('email_templates').doc(def.tipo);

    const status = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists ? (snap.data() as ExistingTemplateDoc) : undefined;
      const result = classifyTemplateDoc(current);
      if (!apply || result === 'migrated') return result;

      if (!current) {
        tx.set(ref, {
          tipo: def.tipo,
          category: def.category,
          related_uc: def.related_uc,
          subject: def.subject,
          ...buildMigrationUpdate(def),
          updated_at: FieldValue.serverTimestamp(),
        });
        return result;
      }

      const versionRef = ref.collection('versions').doc();
      tx.set(versionRef, {
        id: versionRef.id,
        ...buildBackupVersion(current),
        replaced_at: FieldValue.serverTimestamp(),
      });
      tx.update(ref, {
        ...buildMigrationUpdate(def),
        updated_at: FieldValue.serverTimestamp(),
      });
      return result;
    });

    counts[status]++;
    if (status === 'customized') customized.push(def.tipo);
    console.log(`  ${def.tipo.padEnd(45)} ${STATUS_LABEL[status]}`);
  }

  console.log(
    `\nResumo: ${counts.seed_default} padrão, ${counts.customized} customizado(s), ` +
      `${counts.missing} inexistente(s), ${counts.migrated} já migrado(s) de ` +
      `${EMAIL_TEMPLATE_DEFINITIONS.length} templates.`
  );
  if (customized.length > 0) {
    console.log(
      `\nTemplates customizados: o conteúdo anterior está no histórico (versions, ` +
        `replaced_by "${MIGRATION_ACTOR}"). Revise no editor e reaplique as frases no miolo novo, se quiser:\n` +
        customized.map((t) => `  - ${t}`).join('\n')
    );
  }
  if (!apply) console.log('\nNada foi gravado. Rode com --apply para migrar.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[migrate-email-templates-layout] erro:', error);
    process.exit(1);
  });
