import { EMAIL_TEMPLATE_DEFINITIONS } from '../../scripts/lib/emailTemplateDefinitions';
import {
  buildBackupVersion,
  buildMigrationUpdate,
  classifyTemplateDoc,
} from '../../scripts/lib/emailTemplateMigration';
import { SYSTEM_TEMPLATE_VARIABLES } from '@/lib/emailLayout';
import { validateTemplateVariables } from '@/lib/emailTemplateRendering';

const LINK_VARIABLE: Record<string, string> = {
  generic_user_welcome: 'firstAccessLink',
  consultant_welcome: 'firstAccessLink',
  welcome_approval: 'passwordResetLink',
  password_reset: 'resetLink',
};

describe('definições dos templates (seed/migração)', () => {
  it('cobre os 13 tipos, sem repetição', () => {
    const tipos = EMAIL_TEMPLATE_DEFINITIONS.map((d) => d.tipo);
    expect(tipos).toHaveLength(13);
    expect(new Set(tipos).size).toBe(13);
  });

  it.each(EMAIL_TEMPLATE_DEFINITIONS.map((d) => [d.tipo, d]))(
    '%s: miolo sem documento completo, sem título e com variáveis válidas',
    (_tipo, def) => {
      expect(def.content).not.toMatch(/<html|<body|<head|<style|<h1/i);
      expect(def.content).not.toMatch(/curva-mestra\.web\.app|curvamestra\.com\.br/);

      const allowed = [...def.variables.map((v) => v.key), ...SYSTEM_TEMPLATE_VARIABLES];
      const required = def.variables.filter((v) => v.required).map((v) => v.key);
      expect(validateTemplateVariables(def.subject, def.content, allowed, required)).toEqual({
        valid: true,
      });
    }
  );

  it.each(Object.entries(LINK_VARIABLE))('%s usa o link de senha {{%s}}', (tipo, key) => {
    const def = EMAIL_TEMPLATE_DEFINITIONS.find((d) => d.tipo === tipo)!;
    expect(def.content).toContain(`href="{{${key}}}"`);
  });

  it('assuntos sem emoji', () => {
    for (const def of EMAIL_TEMPLATE_DEFINITIONS) {
      expect(def.subject).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe('migração para o layout', () => {
  it('classifica docs', () => {
    expect(classifyTemplateDoc(undefined)).toBe('missing');
    expect(classifyTemplateDoc({ layout_version: 1 })).toBe('migrated');
    expect(classifyTemplateDoc({ updated_by: 'seed-script' })).toBe('seed_default');
    expect(classifyTemplateDoc({ updated_by: 'admin-uid' })).toBe('customized');
  });

  it('não altera body nem subject do doc existente', () => {
    const update = buildMigrationUpdate(EMAIL_TEMPLATE_DEFINITIONS[0]);
    expect(update).not.toHaveProperty('body');
    expect(update).not.toHaveProperty('subject');
    expect(update.layout_version).toBe(1);
  });

  it('backup guarda o estado atual', () => {
    expect(buildBackupVersion({ subject: 's', body: 'b', variables: [] })).toMatchObject({
      subject: 's',
      body: 'b',
      variables: [],
      replaced_by: 'migration-layout-v1',
    });
  });
});
