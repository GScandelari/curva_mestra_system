/**
 * Cloud Function: Send Template Test Email (UC-55, RF-04)
 * Envia um e-mail de teste do conteúdo em EDIÇÃO (ainda não salvo) — por
 * isso recebe subject/html já renderizados do client, em vez de ler
 * `email_templates/{tipo}` (esse conteúdo pode nem existir lá ainda).
 */

import * as functions from 'firebase-functions/v2';
import { sendEmail } from './services/emailService';

interface TemplateTestEmailRequest {
  to: string;
  subject: string;
  html: string;
}

export const sendTemplateTestEmail = functions.https.onCall(
  {
    region: 'southamerica-east1',
    timeoutSeconds: 60,
    memory: '256MiB',
    secrets: ['SMTP_USER', 'SMTP_PASS'],
  },
  async (request) => {
    console.log('📧 Iniciando envio de e-mail de teste de template...');

    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    const isSystemAdmin = request.auth.token.is_system_admin === true;
    if (!isSystemAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Apenas administradores do sistema podem enviar e-mails de teste'
      );
    }

    const data = request.data as TemplateTestEmailRequest;

    if (!data.to || !data.subject || !data.html) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Destinatário, assunto e corpo são obrigatórios'
      );
    }

    const emailRegex = /^[^@\s]+@[^@\s]+$/;
    if (!emailRegex.test(data.to)) {
      throw new functions.https.HttpsError('invalid-argument', 'Formato de e-mail inválido');
    }

    try {
      await sendEmail({
        to: data.to,
        subject: `[TESTE] ${data.subject}`,
        html: data.html,
      });

      console.log(`✅ E-mail de teste de template enviado para: ${data.to}`);

      return {
        success: true,
        message: 'E-mail de teste enviado com sucesso',
        sentTo: data.to,
      };
    } catch (error: unknown) {
      console.error('❌ Erro ao enviar e-mail de teste de template:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new functions.https.HttpsError('internal', `Falha ao enviar e-mail: ${message}`);
    }
  }
);
