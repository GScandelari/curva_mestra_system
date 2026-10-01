/**
 * Trigger: Notifica admin quando uma nova clínica é criada
 * Trigger: firestore document created em tenants/{tenantId}
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { sendEmail, getPlanName } from './services/emailService';
import { getRenderedEmailTemplate } from './services/emailTemplateService';
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

    // Mesmo achado/correção de checkAlertsScheduled.ts e processEmailQueue.ts:
    // declarar `secrets` NÃO garante admin.initializeApp() de forma confiável
    // (efeito colateral não documentado, visto falhar mesmo quando presente)
    // -- chamada explícita aqui, no mesmo arquivo que acaba lendo o Firestore
    // (via getRenderedEmailTemplate), não só dentro do helper compartilhado.
    if (!admin.apps.length) {
      admin.initializeApp();
    }

    try {
      console.log(`📧 Notificando admin sobre nova clínica: ${name}...`);

      const { subject, html } = await getRenderedEmailTemplate('new_tenant_notification', {
        tenantName: name,
        tenantEmail: email,
        planName: getPlanName(plan_id),
      });
      await sendEmail({ to: 'scandelari.guilherme@curvamestra.com.br', subject, html });

      console.log(`✅ Notificação enviada com sucesso`);
    } catch (error) {
      console.error(`❌ Erro ao enviar notificação:`, error);
      // Não vamos lançar erro para não quebrar o fluxo de criação da clínica
    }
  }
);
