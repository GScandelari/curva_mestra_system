/**
 * Firebase Function: Criar Assinatura PagBank
 * Gerencia a criação de planos e assinaturas no PagBank
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createPagBankClient } from "./lib/pagbankClient";
import type { PagBankSubscriptionRequest } from "./types/pagbank";

const PAGBANK_TOKEN = defineSecret("PAGBANK_TOKEN");
const PAGBANK_EMAIL = defineSecret("PAGBANK_EMAIL");

interface CreateSubscriptionData {
  tenant_id: string;
  plan_id: "semestral" | "anual";
  card_token: string; // Token do cartão gerado no frontend
  holder_name: string;
  holder_birth_date: string; // DD/MM/YYYY
  holder_cpf: string;
  holder_phone: string;
}

export const createPagBankSubscription = onCall(
  {
    secrets: [PAGBANK_TOKEN, PAGBANK_EMAIL],
    region: "southamerica-east1",
  },
  async (request) => {
    const { auth, data } = request;

    // ========================================================================
    // VALIDAÇÕES
    // ========================================================================

    if (!auth) {
      throw new HttpsError("unauthenticated", "Usuário não autenticado");
    }

    const {
      tenant_id,
      plan_id,
      card_token,
      holder_name,
      holder_birth_date,
      holder_cpf,
      holder_phone,
    } = data as CreateSubscriptionData;

    if (!tenant_id || !plan_id || !card_token || !holder_name || !holder_cpf) {
      throw new HttpsError("invalid-argument", "Dados incompletos");
    }

    const db = getFirestore();

    try {
      // ======================================================================
      // 1. BUSCAR DADOS DO TENANT
      // ======================================================================

      const tenantDoc = await db.collection("tenants").doc(tenant_id).get();
      if (!tenantDoc.exists) {
        throw new HttpsError("not-found", "Clínica não encontrada");
      }

      const tenant = tenantDoc.data()!;

      console.log(`[PagBank] Criando assinatura para tenant: ${tenant_id}`);

      // ======================================================================
      // 2. INICIALIZAR CLIENTE PAGBANK
      // ======================================================================

      const email = PAGBANK_EMAIL.value();
      const token = PAGBANK_TOKEN.value();
      const client = createPagBankClient(email, token, false); // sandbox

      // ======================================================================
      // 3. CRIAR OU OBTER PLANO NO PAGBANK
      // ======================================================================

      let planCode = tenant.pagbank_plan_id;

      if (!planCode) {
        console.log(`[PagBank] Criando plano: ${plan_id}`);

        // Definir valores do plano
        const planValues = {
          semestral: {
            name: "Plano Semestral Curva Mestra",
            period: "SEMIANNUAL" as const,
            amount: "359.40", // R$ 59,90 x 6 meses
          },
          anual: {
            name: "Plano Anual Curva Mestra",
            period: "YEARLY" as const,
            amount: "598.80", // R$ 49,90 x 12 meses
          },
        };

        const planConfig = planValues[plan_id];

        const planResponse = await client.createPlan({
          reference: `PLAN_${plan_id.toUpperCase()}_${tenant_id}`,
          preApproval: {
            name: planConfig.name,
            charge: "AUTO",
            period: planConfig.period,
            amountPerPayment: planConfig.amount,
          },
        });

        planCode = planResponse.code;

        // Salvar plan_id no tenant
        await db.collection("tenants").doc(tenant_id).update({
          pagbank_plan_id: planCode,
          updated_at: FieldValue.serverTimestamp(),
        });

        console.log(`[PagBank] Plano criado: ${planCode}`);
      } else {
        console.log(`[PagBank] Usando plano existente: ${planCode}`);
      }

      // ======================================================================
      // 4. PREPARAR DADOS DO ASSINANTE (SENDER)
      // ======================================================================

      // Extrair área code e número do telefone
      const cleanPhone = holder_phone.replace(/\D/g, "");
      const areaCode = cleanPhone.substring(0, 2);
      const phoneNumber = cleanPhone.substring(2);

      const cleanCpf = holder_cpf.replace(/\D/g, "");
      const cleanDocument = tenant.document_number.replace(/\D/g, "");

      // Preparar endereço
      const addressParts = tenant.address?.split(",") || ["Rua Exemplo", "100"];
      const street = addressParts[0]?.trim() || "Rua Exemplo";
      const number = addressParts[1]?.trim() || "100";

      const senderData = {
        name: holder_name,
        email: tenant.email,
        phone: {
          areaCode: areaCode,
          number: phoneNumber,
        },
        address: {
          street: street,
          number: number,
          complement: "",
          district: "Centro",
          city: tenant.city || "São Paulo",
          state: tenant.state || "SP",
          country: "BRA" as const,
          postalCode: tenant.cep?.replace(/\D/g, "") || "01310100",
        },
        documents: [
          {
            type: (tenant.document_type === "cnpj" ? "CNPJ" : "CPF") as "CPF" | "CNPJ",
            value: cleanDocument,
          },
        ],
      };

      // ======================================================================
      // 5. CRIAR ASSINATURA
      // ======================================================================

      console.log("[PagBank] Criando assinatura...");

      const subscriptionRequest: PagBankSubscriptionRequest = {
        plan: planCode,
        reference: tenant_id,
        sender: senderData,
        paymentMethod: {
          type: "CREDITCARD",
          creditCard: {
            token: card_token,
            holder: {
              name: holder_name,
              birthDate: holder_birth_date,
              documents: [
                {
                  type: "CPF",
                  value: cleanCpf,
                },
              ],
              billingAddress: {
                street: street,
                number: number,
                complement: "",
                district: "Centro",
                city: tenant.city || "São Paulo",
                state: tenant.state || "SP",
                country: "BRA",
                postalCode: tenant.cep?.replace(/\D/g, "") || "01310100",
              },
              phone: {
                areaCode: areaCode,
                number: phoneNumber,
              },
            },
          },
        },
      };

      const subscriptionResponse = await client.createSubscription(
        subscriptionRequest
      );

      console.log(`[PagBank] Assinatura criada: ${subscriptionResponse.code}`);

      // ======================================================================
      // 6. SALVAR DADOS NO FIRESTORE
      // ======================================================================

      await db.collection("tenants").doc(tenant_id).update({
        pagbank_subscription_code: subscriptionResponse.code,
        pagbank_plan_id: planCode,
        payment_status: subscriptionResponse.status,
        payment_date: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

      // ======================================================================
      // 7. CRIAR LICENÇA SE PAGAMENTO ATIVO
      // ======================================================================

      if (subscriptionResponse.status === "ACTIVE") {
        console.log("[PagBank] Criando licença...");

        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + (plan_id === "anual" ? 12 : 6));

        await db.collection("licenses").add({
          tenant_id: tenant_id,
          plan_id: plan_id,
          max_users: 5,
          features: [
            "Gestão completa de estoque",
            "Até 5 usuários",
            "Controle de lotes e validades",
            "Rastreamento por paciente",
            "Relatórios e alertas",
          ],
          start_date: startDate,
          end_date: endDate,
          status: "ativa",
          auto_renew: true,
          pagbank_subscription_code: subscriptionResponse.code,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        });

        console.log("[PagBank] Licença criada com sucesso");
      }

      // ======================================================================
      // 8. RETORNAR SUCESSO
      // ======================================================================

      return {
        success: true,
        subscription_code: subscriptionResponse.code,
        status: subscriptionResponse.status,
        plan_code: planCode,
      };
    } catch (error: any) {
      console.error("[PagBank] Erro ao criar assinatura:", error);

      // Salvar erro no Firestore para debug
      await db.collection("payment_errors").add({
        tenant_id: tenant_id,
        error_message: error.message || "Erro desconhecido",
        error_stack: error.stack,
        timestamp: FieldValue.serverTimestamp(),
      });

      throw new HttpsError(
        "internal",
        error.message || "Erro ao processar pagamento. Tente novamente."
      );
    }
  }
);
