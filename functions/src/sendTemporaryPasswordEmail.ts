/**
 * Cloud Function: Send Temporary Password Email
 * Envia e-mail com senha temporária para usuário aprovado
 * Chamado pela API route de aprovação de solicitação de acesso
 */

import * as functions from "firebase-functions/v2";
import {sendTemporaryPasswordEmail} from "./services/emailService";
import {defineSecret} from "firebase-functions/params";

// Secrets do Firebase para credenciais SMTP
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");

interface TemporaryPasswordEmailRequest {
  email: string;
  displayName: string;
  temporaryPassword: string;
  businessName: string;
}

export const sendTempPasswordEmail = functions.https.onCall(
  {
    region: "southamerica-east1",
    timeoutSeconds: 60,
    memory: "256MiB",
    secrets: [SMTP_USER, SMTP_PASS],
  },
  async (request) => {
    console.log("📧 Iniciando envio de e-mail com senha temporária...");

    // Validação de autenticação
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Usuário não autenticado"
      );
    }

    // Validação de permissões (apenas system_admin pode enviar)
    const isSystemAdmin = request.auth.token.is_system_admin === true;
    if (!isSystemAdmin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Apenas administradores do sistema podem enviar senhas temporárias"
      );
    }

    // Validação dos dados
    const data = request.data as TemporaryPasswordEmailRequest;

    if (!data.email || !data.displayName || !data.temporaryPassword || !data.businessName) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Todos os campos são obrigatórios"
      );
    }

    // Validar formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Formato de e-mail inválido"
      );
    }

    try {
      // Enviar e-mail com senha temporária
      await sendTemporaryPasswordEmail(
        data.email,
        data.displayName,
        data.temporaryPassword,
        data.businessName
      );

      console.log(`✅ E-mail com senha temporária enviado para: ${data.email}`);

      return {
        success: true,
        message: "E-mail com senha temporária enviado com sucesso",
        sentTo: data.email,
      };
    } catch (error: any) {
      console.error("❌ Erro ao enviar e-mail:", error);

      throw new functions.https.HttpsError(
        "internal",
        `Falha ao enviar e-mail: ${error.message}`
      );
    }
  }
);
