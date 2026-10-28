/**
 * Regras puras da migração de `email_templates/{tipo}` para o layout novo
 * (scripts/migrate-email-templates-layout.ts). Ver
 * ONLY_FOR_DEVS/TO_DO/FEAT-padronizacao-emails-e-links-de-senha.md (STEP 9, DN-03).
 */

import type { EmailTemplateDefinition } from './emailTemplateDefinitions';

export const MIGRATION_ACTOR = 'migration-layout-v1';

/**
 * - `missing`: doc não existe (é criado como no seed);
 * - `migrated`: já tem `layout_version` (no-op);
 * - `seed_default`: nunca editado pelo editor (último autor é o seed);
 * - `customized`: editado no UC-55; migra igual, mas entra no relatório.
 */
export type MigrationStatus = 'missing' | 'migrated' | 'seed_default' | 'customized';

export interface ExistingTemplateDoc {
  subject?: string;
  body?: string;
  variables?: unknown[];
  layout_version?: number;
  updated_by?: string;
}

export function classifyTemplateDoc(doc: ExistingTemplateDoc | undefined): MigrationStatus {
  if (!doc) return 'missing';
  if (doc.layout_version !== undefined) return 'migrated';
  return doc.updated_by === 'seed-script' ? 'seed_default' : 'customized';
}

/** Snapshot do estado atual para `versions` (backup antes de migrar). */
export function buildBackupVersion(doc: ExistingTemplateDoc) {
  return {
    subject: doc.subject ?? '',
    body: doc.body ?? '',
    variables: doc.variables ?? [],
    replaced_by: MIGRATION_ACTOR,
    replaced_by_name: 'Migração para o layout padrão (v1)',
  };
}

/** Campos gravados no doc existente: não toca `body` nem `subject` (DN-03). */
export function buildMigrationUpdate(def: EmailTemplateDefinition) {
  return {
    content: def.content,
    layout_version: 1 as const,
    variables: def.variables,
    label: def.label,
    updated_by: MIGRATION_ACTOR,
    updated_by_name: 'Migração para o layout padrão (v1)',
  };
}
