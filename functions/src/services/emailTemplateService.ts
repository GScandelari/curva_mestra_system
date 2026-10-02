/**
 * Serviço Admin SDK (Cloud Functions) de leitura/renderização de templates
 * de e-mail (UC-55). Fonte única: `email_templates/{tipo}` no Firestore —
 * sem fallback hardcoded (RN-06 do UC-55): se o documento não existir, o
 * envio falha explicitamente em vez de mandar um e-mail incorreto.
 */

import * as admin from 'firebase-admin';
import { renderTemplate } from '../emailTemplateRendering';

export async function getRenderedEmailTemplate(
  tipo: string,
  variables: Record<string, string>
): Promise<{ subject: string; html: string }> {
  // onSchedule/onDocumentCreated/callables não garantem admin.initializeApp()
  // ter sido chamado (ver checkAlertsScheduled.ts) -- chamada aqui dentro
  // (lazy), não no topo do módulo, para não rodar no momento do import.
  // IMPORTANTE: checar `admin.apps.length` não basta -- confirmado em
  // produção (via `firebase functions:log`) que onTenantCreated/
  // onAccessRequestCreated têm `admin.apps.length > 0` mesmo sem o app
  // "[DEFAULT]" existir (algum app com outro nome já registrado por secrets/
  // params), fazendo esse guard pular a inicialização e admin.firestore()
  // seguir lançando "The default Firebase app does not exist". Checar
  // especificamente o app "[DEFAULT]" via admin.app() (lança se não existir).
  try {
    admin.app();
  } catch {
    admin.initializeApp();
  }

  const snap = await admin.firestore().collection('email_templates').doc(tipo).get();
  if (!snap.exists) {
    throw new Error(`Template de e-mail "${tipo}" não encontrado em email_templates`);
  }

  const data = snap.data() as { subject: string; body: string };
  return {
    subject: renderTemplate(data.subject, variables),
    html: renderTemplate(data.body, variables),
  };
}
