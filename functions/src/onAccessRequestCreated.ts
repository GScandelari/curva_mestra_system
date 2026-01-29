/**
 * Firebase Function - Trigger para nova solicitação de acesso
 * Envia e-mail para o system_admin quando uma nova solicitação é criada
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { sendEmail } from "./services/emailService";

// E-mail do system_admin
const SYSTEM_ADMIN_EMAIL = "scandelari.guilherme@curvamestra.com.br";

/**
 * Formata o documento (CPF ou CNPJ) para exibição
 */
function formatDocument(document: string, type: string): string {
  const clean = document.replace(/\D/g, "");

  if (type === "cpf" && clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  if (type === "cnpj" && clean.length === 14) {
    return clean.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5"
    );
  }

  return document;
}

/**
 * Trigger: Quando uma nova solicitação de acesso é criada
 */
export const onAccessRequestCreated = onDocumentCreated(
  {
    document: "access_requests/{requestId}",
    region: "southamerica-east1",
    secrets: ["SMTP_USER", "SMTP_PASS"],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("Sem dados no evento");
      return;
    }

    const data = snapshot.data();
    const requestId = event.params.requestId;

    console.log(`📝 Nova solicitação de acesso criada: ${requestId}`);

    // Extrair dados da solicitação
    const documentNumber = data.document_number || "";
    const documentType = data.document_type || "cnpj";
    const fullName = data.full_name || "Não informado";
    const email = data.email || "Não informado";
    const businessName = data.business_name || fullName;

    // Formatar documento para o título do e-mail
    const formattedDocument = formatDocument(documentNumber, documentType);

    // Criar HTML do e-mail
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: #ffffff;
              padding: 30px;
              border: 1px solid #e5e7eb;
              border-top: none;
              border-radius: 0 0 10px 10px;
            }
            .info-box {
              background: #f9fafb;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #3b82f6;
              margin: 20px 0;
            }
            .info-row {
              display: flex;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              font-weight: 600;
              color: #6b7280;
              width: 140px;
              flex-shrink: 0;
            }
            .info-value {
              color: #111827;
            }
            .badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
            }
            .badge-cpf {
              background: #dbeafe;
              color: #1d4ed8;
            }
            .badge-cnpj {
              background: #dcfce7;
              color: #15803d;
            }
            .badge-pending {
              background: #fef3c7;
              color: #b45309;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: #3b82f6;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📋 Nova Solicitação de Acesso</h1>
          </div>
          <div class="content">
            <p>Uma nova solicitação de acesso foi recebida no <strong>Curva Mestra</strong>.</p>

            <div class="info-box">
              <div class="info-row">
                <span class="info-label">Tipo:</span>
                <span class="info-value">
                  <span class="badge ${documentType === "cpf" ? "badge-cpf" : "badge-cnpj"}">
                    ${documentType === "cpf" ? "Autônomo (CPF)" : "Clínica (CNPJ)"}
                  </span>
                </span>
              </div>
              <div class="info-row">
                <span class="info-label">${documentType === "cpf" ? "CPF" : "CNPJ"}:</span>
                <span class="info-value"><strong>${formattedDocument}</strong></span>
              </div>
              <div class="info-row">
                <span class="info-label">Nome:</span>
                <span class="info-value">${fullName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">E-mail:</span>
                <span class="info-value">${email}</span>
              </div>
              ${businessName !== fullName ? `
              <div class="info-row">
                <span class="info-label">Empresa:</span>
                <span class="info-value">${businessName}</span>
              </div>
              ` : ""}
              <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">
                  <span class="badge badge-pending">Pendente</span>
                </span>
              </div>
              <div class="info-row">
                <span class="info-label">Data:</span>
                <span class="info-value">${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
              </div>
            </div>

            <p>Acesse o painel administrativo para revisar e aprovar/rejeitar esta solicitação.</p>

            <div style="text-align: center;">
              <a href="https://curva-mestra.web.app/admin/access-requests" class="button">
                Ver Solicitações
              </a>
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Curva Mestra - Gestão Inteligente de Estoque</p>
            <p>Este é um e-mail automático do sistema.</p>
          </div>
        </body>
      </html>
    `;

    try {
      await sendEmail({
        to: SYSTEM_ADMIN_EMAIL,
        subject: `Solicitação de Acesso - ${formattedDocument}`,
        html,
      });

      console.log(`✅ E-mail de notificação enviado para ${SYSTEM_ADMIN_EMAIL}`);
    } catch (error) {
      console.error("❌ Erro ao enviar e-mail de notificação:", error);
      // Não lançamos o erro para não impedir a criação da solicitação
    }
  }
);
