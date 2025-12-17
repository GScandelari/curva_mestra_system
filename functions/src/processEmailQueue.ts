/**
 * Cloud Function: Process Email Queue
 * Trigger que processa e-mails na fila automaticamente
 */

import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { sendEmail } from "./services/emailService";

const db = admin.firestore();

export const processEmailQueue = functions.firestore.onDocumentCreated(
  {
    document: "email_queue/{emailId}",
    region: "southamerica-east1",
    timeoutSeconds: 60,
    memory: "256MiB",
    secrets: ["SMTP_USER", "SMTP_PASS"],
  },
  async (event) => {
    const emailData = event.data?.data();
    const emailId = event.params.emailId;

    if (!emailData) {
      console.error("❌ Dados de e-mail não encontrados");
      return;
    }

    console.log(`📧 Processando e-mail da fila: ${emailId}`);
    console.log(`   Para: ${emailData.to}`);
    console.log(`   Assunto: ${emailData.subject}`);

    try {
      // Verificar se o e-mail já foi processado
      if (emailData.status !== "pending") {
        console.log(`⏭️ E-mail já processado (status: ${emailData.status})`);
        return;
      }

      // Enviar e-mail
      await sendEmail({
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.body,
      });

      // Atualizar status para "sent"
      await db.collection("email_queue").doc(emailId).update({
        status: "sent",
        sent_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ E-mail enviado com sucesso: ${emailId}`);
    } catch (error: any) {
      console.error(`❌ Erro ao enviar e-mail ${emailId}:`, error);

      // Atualizar status para "failed"
      await db.collection("email_queue").doc(emailId).update({
        status: "failed",
        error_message: error.message,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Não lançar erro para não causar retry infinito
    }
  }
);
