/**
 * Cloud Function: Send Custom Email
 * Envia e-mails personalizados (como boas-vindas para novos admins)
 */

import * as functions from "firebase-functions/v2";
import { sendEmail } from "./services/emailService";

interface CustomEmailRequest {
  to: string;
  subject: string;
  body: string;
}

export const sendCustomEmail = functions.https.onCall(
  {
    region: "southamerica-east1",
    timeoutSeconds: 60,
    memory: "256MiB",
    secrets: ["SMTP_USER", "SMTP_PASS"],
  },
  async (request) => {
    console.log("📧 Iniciando envio de e-mail personalizado...");

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
        "Apenas administradores do sistema podem enviar e-mails personalizados"
      );
    }

    // Validação dos dados
    const data = request.data as CustomEmailRequest;

    if (!data.to || !data.subject || !data.body) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "E-mail, assunto e corpo são obrigatórios"
      );
    }

    // Validar formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.to)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Formato de e-mail inválido"
      );
    }

    try {
      // Enviar e-mail
      await sendEmail({
        to: data.to,
        subject: data.subject,
        html: data.body,
      });

      console.log(`✅ E-mail personalizado enviado para: ${data.to}`);

      return {
        success: true,
        message: "E-mail enviado com sucesso",
        sentTo: data.to,
      };
    } catch (error: any) {
      console.error("❌ Erro ao enviar e-mail personalizado:", error);

      throw new functions.https.HttpsError(
        "internal",
        `Falha ao enviar e-mail: ${error.message}`
      );
    }
  }
);
