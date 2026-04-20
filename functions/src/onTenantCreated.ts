/**
 * Trigger: Notifica admin quando uma nova clínica é criada
 * Trigger: firestore document created em tenants/{tenantId}
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { sendNewTenantNotification } from './services/emailService';
import { defineSecret } from 'firebase-functions/params';

// Secrets do Firebase para credenciais SMTP
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

export const onTenantCreated = onDocumentCreated(
  {
    document: 'tenants/{tenantId}',
    region: 'southamerica-east1',
    secrets: [SMTP_USER, SMTP_PASS], // Adicionar secrets necessários
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log('No data associated with the event');
      return;
    }

    const tenantData = snapshot.data();
    const { name, email, plan_id } = tenantData;

    try {
      console.log(`📧 Notificando admin sobre nova clínica: ${name}...`);

      await sendNewTenantNotification(name, email, plan_id);

      console.log(`✅ Notificação enviada com sucesso`);
    } catch (error) {
      console.error(`❌ Erro ao enviar notificação:`, error);
      // Não vamos lançar erro para não quebrar o fluxo de criação da clínica
    }
  }
);
