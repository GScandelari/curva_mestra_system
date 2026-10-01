/**
 * Firebase Function - Trigger para nova solicitação de acesso
 * Envia e-mail para o system_admin quando uma nova solicitação é criada
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineString } from 'firebase-functions/params';
import { sendEmail } from './services/emailService';
import { getRenderedEmailTemplate } from './services/emailTemplateService';

// E-mail do system_admin (configurável via: firebase functions:config:set ou defineString)
const SYSTEM_ADMIN_EMAIL = defineString('SYSTEM_ADMIN_EMAIL', {
  default: 'scandelari.guilherme@curvamestra.com.br',
  description: 'E-mail do system_admin para receber notificações de novas solicitações de acesso',
});

/**
 * Formata o documento (CPF ou CNPJ) para exibição
 */
function formatDocument(document: string, type: string): string {
  const clean = document.replace(/\D/g, '');

  if (type === 'cpf' && clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  if (type === 'cnpj' && clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  return document;
}

/**
 * Trigger: Quando uma nova solicitação de acesso é criada
 */
export const onAccessRequestCreated = onDocumentCreated(
  {
    document: 'access_requests/{requestId}',
    region: 'southamerica-east1',
    secrets: ['SMTP_USER', 'SMTP_PASS'],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log('Sem dados no evento');
      return;
    }

    const data = snapshot.data();
    const requestId = event.params.requestId;

    console.log(`📝 Nova solicitação de acesso criada: ${requestId}`);

    // Extrair dados da solicitação
    const documentNumber = data.document_number || '';
    const documentType = data.document_type || 'cnpj';
    const fullName = data.full_name || 'Não informado';
    const email = data.email || 'Não informado';
    const businessName = data.business_name || fullName;

    // Formatar documento para o título do e-mail
    const formattedDocument = formatDocument(documentNumber, documentType);

    try {
      const { subject, html } = await getRenderedEmailTemplate('access_request_created', {
        documentNumber: formattedDocument,
        documentType,
        fullName,
        email,
        businessName,
      });

      await sendEmail({
        to: SYSTEM_ADMIN_EMAIL.value(),
        subject,
        html,
      });

      console.log(`✅ E-mail de notificação enviado para ${SYSTEM_ADMIN_EMAIL.value()}`);
    } catch (error) {
      console.error('❌ Erro ao enviar e-mail de notificação:', error);
      // Não lançamos o erro para não impedir a criação da solicitação
    }
  }
);
