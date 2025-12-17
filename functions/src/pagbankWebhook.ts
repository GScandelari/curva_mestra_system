/**
 * Firebase Function: Webhook PagBank
 * Recebe notificações de atualização de status das assinaturas
 */

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createPagBankClient } from "./lib/pagbankClient";

const PAGBANK_TOKEN = defineSecret("PAGBANK_TOKEN");
const PAGBANK_EMAIL = defineSecret("PAGBANK_EMAIL");

export const pagbankWebhook = onRequest(
  {
    secrets: [PAGBANK_TOKEN, PAGBANK_EMAIL],
    region: "southamerica-east1",
  },
  async (req, res) => {
    // ========================================================================
    // VALIDAR MÉTODO
    // ========================================================================

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { notificationCode, notificationType } = req.body;

    console.log("[PagBank Webhook] Notificação recebida:", {
      notificationCode,
      notificationType,
    });

    if (!notificationCode) {
      console.error("[PagBank Webhook] Código de notificação ausente");
      res.status(400).send("Missing notification code");
      return;
    }

    const db = getFirestore();

    try {
      // ======================================================================
      // 1. INICIALIZAR CLIENTE PAGBANK
      // ======================================================================

      const email = PAGBANK_EMAIL.value();
      const token = PAGBANK_TOKEN.value();
      const client = createPagBankClient(email, token, false); // sandbox

      // ======================================================================
      // 2. CONSULTAR DADOS DA NOTIFICAÇÃO
      // ======================================================================

      let subscriptionData;

      if (notificationType === "preApproval") {
        // Notificação de assinatura
        subscriptionData = await client.getNotification(notificationCode);
      } else {
        console.log("[PagBank Webhook] Tipo de notificação desconhecido:", notificationType);
        res.status(200).send("OK - Ignored");
        return;
      }

      console.log("[PagBank Webhook] Dados da assinatura:", subscriptionData);

      // ======================================================================
      // 3. BUSCAR TENANT PELA SUBSCRIPTION_CODE
      // ======================================================================

      const subscriptionCode = subscriptionData.code || notificationCode;

      const tenantsSnapshot = await db
        .collection("tenants")
        .where("pagbank_subscription_code", "==", subscriptionCode)
        .limit(1)
        .get();

      if (tenantsSnapshot.empty) {
        console.error(
          "[PagBank Webhook] Tenant não encontrado para subscription:",
          subscriptionCode
        );
        // Retornar 200 para evitar re-tentativas
        res.status(200).send("OK - Tenant not found");
        return;
      }

      const tenantDoc = tenantsSnapshot.docs[0];
      const tenantId = tenantDoc.id;

      console.log(`[PagBank Webhook] Processando para tenant: ${tenantId}`);

      // ======================================================================
      // 4. ATUALIZAR STATUS DO TENANT
      // ======================================================================

      const newStatus = subscriptionData.status;

      await db.collection("tenants").doc(tenantId).update({
        payment_status: newStatus,
        pagbank_last_webhook: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

      console.log(`[PagBank Webhook] Status atualizado: ${newStatus}`);

      // ======================================================================
      // 5. ATUALIZAR LICENÇAS BASEADO NO STATUS
      // ======================================================================

      if (newStatus === "ACTIVE") {
        // Reativar licenças suspensas
        const licensesSnapshot = await db
          .collection("licenses")
          .where("tenant_id", "==", tenantId)
          .where("status", "==", "suspensa")
          .get();

        if (!licensesSnapshot.empty) {
          const batch = db.batch();
          licensesSnapshot.docs.forEach((doc) => {
            batch.update(doc.ref, {
              status: "ativa",
              updated_at: FieldValue.serverTimestamp(),
            });
          });
          await batch.commit();

          console.log(`[PagBank Webhook] ${licensesSnapshot.size} licença(s) reativada(s)`);
        }
      } else if (
        newStatus === "CANCELLED" ||
        newStatus === "CANCELLED_BY_RECEIVER" ||
        newStatus === "CANCELLED_BY_SENDER" ||
        newStatus === "EXPIRED" ||
        newStatus === "SUSPENDED"
      ) {
        // Suspender licenças ativas
        const licensesSnapshot = await db
          .collection("licenses")
          .where("tenant_id", "==", tenantId)
          .where("status", "==", "ativa")
          .get();

        if (!licensesSnapshot.empty) {
          const batch = db.batch();
          licensesSnapshot.docs.forEach((doc) => {
            batch.update(doc.ref, {
              status: "suspensa",
              suspension_reason: `PagBank: ${newStatus}`,
              updated_at: FieldValue.serverTimestamp(),
            });
          });
          await batch.commit();

          console.log(`[PagBank Webhook] ${licensesSnapshot.size} licença(s) suspensa(s)`);
        }
      }

      // ======================================================================
      // 6. CRIAR NOTIFICAÇÃO PARA O TENANT
      // ======================================================================

      const notificationMessages: Record<string, { title: string; message: string }> = {
        ACTIVE: {
          title: "Pagamento confirmado",
          message: "Sua assinatura está ativa e você já pode usar o sistema!",
        },
        PENDING: {
          title: "Pagamento pendente",
          message: "Aguardando confirmação do pagamento...",
        },
        CANCELLED: {
          title: "Assinatura cancelada",
          message: "Sua assinatura foi cancelada. Entre em contato com o suporte.",
        },
        EXPIRED: {
          title: "Assinatura expirada",
          message: "Sua assinatura expirou. Renove para continuar usando.",
        },
        SUSPENDED: {
          title: "Assinatura suspensa",
          message: "Sua assinatura foi suspensa. Verifique seu pagamento.",
        },
      };

      const notificationData = notificationMessages[newStatus] || {
        title: "Atualização de pagamento",
        message: `Status da assinatura: ${newStatus}`,
      };

      await db.collection("notifications").add({
        tenant_id: tenantId,
        user_id: null, // Notificação para todos os usuários do tenant
        type: "payment",
        title: notificationData.title,
        message: notificationData.message,
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });

      // ======================================================================
      // 7. SALVAR LOG DO WEBHOOK
      // ======================================================================

      await db.collection("webhook_logs").add({
        type: "pagbank",
        notification_code: notificationCode,
        notification_type: notificationType,
        subscription_code: subscriptionCode,
        subscription_status: newStatus,
        tenant_id: tenantId,
        raw_data: subscriptionData,
        processed: true,
        received_at: FieldValue.serverTimestamp(),
      });

      // ======================================================================
      // 8. RETORNAR SUCESSO
      // ======================================================================

      console.log("[PagBank Webhook] Processamento concluído com sucesso");
      res.status(200).send("OK");
    } catch (error: any) {
      console.error("[PagBank Webhook] Erro ao processar:", error);

      // Salvar erro no log
      await db.collection("webhook_logs").add({
        type: "pagbank",
        notification_code: notificationCode,
        notification_type: notificationType,
        error_message: error.message,
        error_stack: error.stack,
        processed: false,
        received_at: FieldValue.serverTimestamp(),
      });

      // Retornar 200 para evitar re-tentativas infinitas
      res.status(200).send("Error logged");
    }
  }
);
