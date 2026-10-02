import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { renderTemplate, validateTemplateVariables } from '@/lib/emailTemplateRendering';
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
  return {
    subject: renderTemplate(template.subject, variables),
    body: renderTemplate(template.body, variables),
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
  content: { subject: string; body: string },
  actor: { uid: string; name: string }
): Promise<void> {
  const templateRef = templatesCollection().doc(tipo);

  await adminDb.runTransaction(async (transaction) => {
    const snap = await transaction.get(templateRef);
    if (!snap.exists) {
      throw new Error(`Template de e-mail "${tipo}" não encontrado`);
    }

    const current = snap.data() as EmailTemplateDoc;
    const allowedKeys = current.variables.map((v) => v.key);
    const requiredKeys = current.variables.filter((v) => v.required).map((v) => v.key);

    const validation = validateTemplateVariables(
      content.subject,
      content.body,
      allowedKeys,
      requiredKeys
    );
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const versionRef = templateRef.collection('versions').doc();
    transaction.set(versionRef, {
      id: versionRef.id,
      subject: current.subject,
      body: current.body,
      variables: current.variables,
      replaced_at: FieldValue.serverTimestamp(),
      replaced_by: actor.uid,
      replaced_by_name: actor.name,
    });

    transaction.update(templateRef, {
      subject: content.subject,
      body: content.body,
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
      subject: current.subject,
      body: current.body,
      variables: current.variables,
      replaced_at: FieldValue.serverTimestamp(),
      replaced_by: actor.uid,
      replaced_by_name: actor.name,
    });

    transaction.update(templateRef, {
      subject: version.subject,
      body: version.body,
      updated_at: FieldValue.serverTimestamp(),
      updated_by: actor.uid,
      updated_by_name: actor.name,
    });
  });
}
