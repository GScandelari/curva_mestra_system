/**
 * Trigger: Envia e-mail de boas-vindas quando um novo usuário é criado
 * Trigger: firestore document created em users/{userId}
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { sendWelcomeEmail } from './services/emailService';
import { defineSecret } from 'firebase-functions/params';

// Secrets do Firebase para credenciais SMTP
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

export const onUserCreated = onDocumentCreated(
  {
    document: 'users/{userId}',
    region: 'southamerica-east1',
    secrets: [SMTP_USER, SMTP_PASS], // Adicionar secrets necessários
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log('No data associated with the event');
      return;
    }

    const userData = snapshot.data();
    const { email, full_name, role } = userData;

    if (!email || !full_name) {
      console.log('Usuário sem e-mail ou nome, pulando envio');
      return;
    }

    try {
      console.log(`📧 Enviando e-mail de boas-vindas para ${email}...`);

      await sendWelcomeEmail(email, full_name, role);

      console.log(`✅ E-mail enviado com sucesso para ${email}`);
    } catch (error) {
      console.error(`❌ Erro ao enviar e-mail para ${email}:`, error);
      // Não vamos lançar erro para não quebrar o fluxo de criação do usuário
    }
  }
);
