import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { validateTemplateVariables } from '@/lib/emailTemplateRendering';
import { renderStoredEmailTemplate, SYSTEM_TEMPLATE_VARIABLES } from '@/lib/emailLayout';
import { getAppBaseUrl } from '@/lib/appBaseUrl';
import type { EmailTemplateDoc, EmailTemplateVersion } from '@/types';

/**
 * Serviço Admin SDK do editor de templates de e-mail (UC-55). Única via de
 * escrita em `email_templates/{tipo}` — a regra do Firestore bloqueia
 * qualquer client SDK (Opção A, firestore.rules). Usado pelas API routes
 * `/api/email-templates/**` e, para leitura, por `getRenderedEmailTemplate`
 * (chamadores server-side de `email_queue`, Branch C).
 */

function templatesCollection() {
  return adminDb.collection('email_templates');
}

export async function getEmailTemplate(tipo: string): Promise<EmailTemplateDoc | null> {
  const snap = await templatesCollection().doc(tipo).get();
  if (!snap.exists) {
    return null;
  }
  return snap.data() as EmailTemplateDoc;
}

export async function getRenderedEmailTemplate(
  tipo: string,
  variables: Record<string, string>
): Promise<{ subject: string; body: string }> {
  const template = await getEmailTemplate(tipo);
  if (!template) {
    throw new Error(`Template de e-mail "${tipo}" não encontrado`);
  }
  const { subject, html } = renderStoredEmailTemplate({
    tipo,
    template,
    variables,
    getBaseUrl: getAppBaseUrl,
  });
  return { subject, body: html };
}

/** Conteúdo editável: `content` (formato novo) ou `body` (formato antigo). */
export interface EmailTemplateEdit {
  subject: string;
  body?: string;
  content?: string;
}

/** Snapshot do conteúdo atual para o histórico, sem campos `undefined`. */
function versionSnapshot(current: EmailTemplateDoc | EmailTemplateVersion) {
  return {
    subject: current.subject,
    ...(current.body !== undefined && { body: current.body }),
    ...(current.content !== undefined && { content: current.content }),
    ...(current.layout_version !== undefined && { layout_version: current.layout_version }),
  };
}

/**
 * Renderiza `tipo` com `variables` e grava o resultado em `email_queue` —
 * os 8 pontos de chamada migrados nas Branches C/D do UC-55 só diferem no
 * destinatário, nas variáveis e em campos opcionais de `metadata`.
 */
export async function enqueueTemplatedEmail(
  tipo: string,
  to: string,
  variables: Record<string, string>,
  extraFields?: Record<string, unknown>
): Promise<void> {
  const { subject, body } = await getRenderedEmailTemplate(tipo, variables);
  await adminDb.collection('email_queue').add({
    to,
    subject,
    body,
    status: 'pending',
    type: tipo,
    created_at: FieldValue.serverTimestamp(),
    ...extraFields,
  });
}

export async function saveEmailTemplateVersion(
  tipo: string,
  edit: EmailTemplateEdit,
  actor: { uid: string; name: string }
): Promise<void> {
  const templateRef = templatesCollection().doc(tipo);

  await adminDb.runTransaction(async (transaction) => {
    const snap = await transaction.get(templateRef);
    if (!snap.exists) {
      throw new Error(`Template de e-mail "${tipo}" não encontrado`);
    }

    const current = snap.data() as EmailTemplateDoc;
    // Doc no formato novo só aceita `content`; o antigo, só `body`.
    const usesLayout = current.layout_version !== undefined;
    const text = usesLayout ? edit.content : edit.body;
    if (!text) {
      throw new Error(
        usesLayout ? 'Conteúdo do e-mail é obrigatório' : 'Corpo do e-mail é obrigatório'
      );
    }

    const allowedKeys = [...current.variables.map((v) => v.key), ...SYSTEM_TEMPLATE_VARIABLES];
    const requiredKeys = current.variables.filter((v) => v.required).map((v) => v.key);

    const validation = validateTemplateVariables(edit.subject, text, allowedKeys, requiredKeys);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const versionRef = templateRef.collection('versions').doc();
    transaction.set(versionRef, {
      id: versionRef.id,
      ...versionSnapshot(current),
      variables: current.variables,
      replaced_at: FieldValue.serverTimestamp(),
      replaced_by: actor.uid,
      replaced_by_name: actor.name,
    });

    transaction.update(templateRef, {
      subject: edit.subject,
      [usesLayout ? 'content' : 'body']: text,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: actor.uid,
      updated_by_name: actor.name,
    });
  });
}

export async function listEmailTemplateVersions(tipo: string): Promise<EmailTemplateVersion[]> {
  const snap = await templatesCollection()
    .doc(tipo)
    .collection('versions')
    .orderBy('replaced_at', 'desc')
    .get();
  return snap.docs.map((d) => d.data() as EmailTemplateVersion);
}

export async function revertEmailTemplateVersion(
  tipo: string,
  versionId: string,
  actor: { uid: string; name: string }
): Promise<void> {
  const templateRef = templatesCollection().doc(tipo);
  const versionRef = templateRef.collection('versions').doc(versionId);

  await adminDb.runTransaction(async (transaction) => {
    const [templateSnap, versionSnap] = await Promise.all([
      transaction.get(templateRef),
      transaction.get(versionRef),
    ]);

    if (!templateSnap.exists) {
      throw new Error(`Template de e-mail "${tipo}" não encontrado`);
    }
    if (!versionSnap.exists) {
      throw new Error(`Versão "${versionId}" não encontrada para o template "${tipo}"`);
    }

    const current = templateSnap.data() as EmailTemplateDoc;
    const version = versionSnap.data() as EmailTemplateVersion;

    const newVersionRef = templateRef.collection('versions').doc();
    transaction.set(newVersionRef, {
      id: newVersionRef.id,
      ...versionSnapshot(current),
      variables: current.variables,
      replaced_at: FieldValue.serverTimestamp(),
      replaced_by: actor.uid,
      replaced_by_name: actor.name,
    });

    // Restaura o formato da versão: com `content`, volta ao layout novo; sem
    // ele (versão anterior à migração), volta ao `body` legado.
    const restored =
      version.content !== undefined
        ? { content: version.content, layout_version: version.layout_version ?? 1 }
        : { content: FieldValue.delete(), layout_version: FieldValue.delete() };
    transaction.update(templateRef, {
      subject: version.subject,
      ...(version.body !== undefined && { body: version.body }),
      ...restored,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: actor.uid,
      updated_by_name: actor.name,
    });
  });
}
