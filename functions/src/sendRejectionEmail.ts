/**
 * Cloud Function: Send Rejection Email
 * Envia e-mail informando que solicitação foi rejeitada
 * Chamado pela API route de rejeição de solicitação de acesso
 */

import * as functions from 'firebase-functions/v2';
import { sendRejectionEmail } from './services/emailService';
import { defineSecret } from 'firebase-functions/params';

// Secrets do Firebase para credenciais SMTP
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

interface RejectionEmailRequest {
  email: string;
  displayName: string;
  businessName: string;
  rejectionReason?: string;
}

export const sendAccessRejectionEmail = functions.https.onCall(
  {
    region: 'southamerica-east1',
    timeoutSeconds: 60,
    memory: '256MiB',
    secrets: [SMTP_USER, SMTP_PASS],
  },
  async (request) => {
    console.log('📧 Iniciando envio de e-mail de rejeição...');

    // Validação de autenticação
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    // Validação de permissões (apenas system_admin pode enviar)
    const isSystemAdmin = request.auth.token.is_system_admin === true;
    if (!isSystemAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Apenas administradores do sistema podem rejeitar solicitações'
      );
    }

    // Validação dos dados
    const data = request.data as RejectionEmailRequest;

    if (!data.email || !data.displayName || !data.businessName) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'E-mail, nome e nome da empresa são obrigatórios'
      );
    }

    // Validar formato de e-mail
    const emailRegex = /^[^@\s]+@[^@\s]+$/;
    if (!emailRegex.test(data.email)) {
      throw new functions.https.HttpsError('invalid-argument', 'Formato de e-mail inválido');
    }

    try {
      // Enviar e-mail de rejeição
      await sendRejectionEmail(
        data.email,
        data.displayName,
        data.businessName,
        data.rejectionReason
      );

      console.log(`✅ E-mail de rejeição enviado para: ${data.email}`);

      return {
        success: true,
        message: 'E-mail de rejeição enviado com sucesso',
        sentTo: data.email,
      };
    } catch (error: any) {
      console.error('❌ Erro ao enviar e-mail de rejeição:', error);

      throw new functions.https.HttpsError('internal', `Falha ao enviar e-mail: ${error.message}`);
    }
  }
);
