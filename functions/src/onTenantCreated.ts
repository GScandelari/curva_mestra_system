/**
 * Trigger: Notifica admin quando uma nova clínica é criada
 * Trigger: firestore document created em tenants/{tenantId}
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { sendEmail } from './services/emailService';
import { getRenderedEmailTemplate } from './services/emailTemplateService';
import { defineSecret } from 'firebase-functions/params';

// Secrets do Firebase para credenciais SMTP
const SMTP_USER = defineSecret('SMTP_USER');
const SMTP_PASS = defineSecret('SMTP_PASS');

// O sistema não tem mais o conceito de "plano" (nenhum fluxo de criação de
// clínica grava plan_id há tempos -- o antigo getPlanName(plan_id) sempre
// recebia undefined). A classificação hoje é por tipo de documento, já
// presente em toda clínica (document_type, cpf ou cnpj).
const TIPO_CADASTRO_LABEL: Record<string, string> = {
  cpf: 'Pessoa Física',
  cnpj: 'Pessoa Jurídica',
};

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
    const { name, email, document_type } = tenantData;

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
      console.log(`📧 Notificando admin sobre nova clínica: ${name}...`);

      const { subject, html } = await getRenderedEmailTemplate('new_tenant_notification', {
        tenantName: name,
        tenantEmail: email,
        tipoCadastro: TIPO_CADASTRO_LABEL[document_type] || document_type,
      });
      await sendEmail({ to: 'scandelari.guilherme@curvamestra.com.br', subject, html });

      console.log(`✅ Notificação enviada com sucesso`);
    } catch (error) {
      console.error(`❌ Erro ao enviar notificação:`, error);
      // Não vamos lançar erro para não quebrar o fluxo de criação da clínica
    }
  }
);
