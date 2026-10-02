/**
 * Trigger: Envia e-mail de boas-vindas quando um novo usuário é criado
 * Trigger: firestore document created em users/{userId}
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { sendEmail, getRoleName } from './services/emailService';
import { getRenderedEmailTemplate } from './services/emailTemplateService';
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
    const { email, full_name, role, skip_welcome_email } = userData;

    if (!email || !full_name) {
      console.log('Usuário sem e-mail ou nome, pulando envio');
      return;
    }

    if (skip_welcome_email === true) {
      console.log(
        `Usuário ${email} já recebeu um e-mail de boas-vindas específico, pulando o genérico`
      );
      return;
    }

    // Mesmo achado/correção de checkAlertsScheduled.ts e processEmailQueue.ts
    // -- e confirmado em produção que `admin.apps.length` não é suficiente
    // aqui (ficava > 0 sem o app "[DEFAULT]" existir, pulando a inicialização
    // real) -- ver emailTemplateService.ts para o detalhe completo.
    try {
      admin.app();
    } catch {
      admin.initializeApp();
    }

    try {
      console.log(`📧 Enviando e-mail de boas-vindas para ${email}...`);

      const { subject, html } = await getRenderedEmailTemplate('generic_user_welcome', {
        displayName: full_name,
        role: getRoleName(role),
      });
      await sendEmail({ to: email, subject, html });

      console.log(`✅ E-mail enviado com sucesso para ${email}`);
    } catch (error) {
      console.error(`❌ Erro ao enviar e-mail para ${email}:`, error);
      // Não vamos lançar erro para não quebrar o fluxo de criação do usuário
    }
  }
);
