/**
 * PagBank API Types
 * Tipos para integração com API de Pagamentos Recorrentes do PagBank
 */

// ============================================================================
// PLANOS (PLANS)
// ============================================================================

export interface PagBankPlanRequest {
  reference: string; // Ex: "PLAN_SEMESTRAL_clinic123"
  preApproval: {
    name: string; // Nome do plano
    charge: "AUTO"; // Cobrança automática
    period: "MONTHLY" | "SEMIANNUAL" | "ANNUAL" | "YEARLY";
    amountPerPayment: string; // Valor total do período (ex: "359.40")
  };
}

export interface PagBankPlanResponse {
  code: string; // Código do plano no PagBank
  date: string;
}

// ============================================================================
// ASSINANTES (SUBSCRIBERS/CUSTOMERS)
// ============================================================================

export interface PagBankSubscriberRequest {
  reference: string; // tenant_id
  email: string;
  name: string;
  phone: {
    areaCode: string;
    number: string;
  };
  document: {
    type: "CPF" | "CNPJ";
    value: string; // Sem formatação
  };
  address: {
    street: string;
    number: string;
    complement?: string;
    district: string;
    city: string;
    state: string; // Sigla (SP, RJ, etc)
    country: "BRA";
    postalCode: string; // CEP sem formatação
  };
}

export interface PagBankSubscriberResponse {
  code: string; // Código do assinante no PagBank
  date: string;
}

// ============================================================================
// ASSINATURAS (SUBSCRIPTIONS)
// ============================================================================

export interface PagBankSubscriptionRequest {
  plan: string; // Código do plano (da resposta de createPlan)
  reference: string; // Referência interna (tenant_id)
  sender: {
    name: string;
    email: string;
    phone: {
      areaCode: string;
      number: string;
    };
    address: {
      street: string;
      number: string;
      complement?: string;
      district: string;
      city: string;
      state: string;
      country: "BRA";
      postalCode: string;
    };
    documents: Array<{
      type: "CPF" | "CNPJ";
      value: string;
    }>;
  };
  paymentMethod: {
    type: "CREDITCARD";
    creditCard: {
      token: string; // Token do cartão gerado no frontend
      holder: {
        name: string;
        birthDate: string; // DD/MM/YYYY
        documents: Array<{
          type: "CPF";
          value: string;
        }>;
        billingAddress: {
          street: string;
          number: string;
          complement?: string;
          district: string;
          city: string;
          state: string;
          country: "BRA";
          postalCode: string;
        };
        phone: {
          areaCode: string;
          number: string;
        };
      };
    };
  };
}

export interface PagBankSubscriptionResponse {
  code: string; // Código da assinatura
  date: string;
  status: PagBankSubscriptionStatus;
  plan: string;
  reference: string;
}

export type PagBankSubscriptionStatus =
  | "INITIATED"
  | "PENDING"
  | "ACTIVE"
  | "PAYMENT_METHOD_CHANGE"
  | "SUSPENDED"
  | "CANCELLED"
  | "CANCELLED_BY_RECEIVER"
  | "CANCELLED_BY_SENDER"
  | "EXPIRED";

// ============================================================================
// WEBHOOK NOTIFICATIONS
// ============================================================================

export interface PagBankWebhookNotification {
  notificationCode: string;
  notificationType: string; // "preApproval"
}

export interface PagBankSubscriptionDetailsResponse {
  code: string;
  name: string;
  status: PagBankSubscriptionStatus;
  reference: string;
  plan: string;
  charge: string;
  date: string;
  lastEventDate: string;
  tracker?: string;
}

// ============================================================================
// SESSION (para tokenização de cartão no frontend)
// ============================================================================

export interface PagBankSessionResponse {
  session: {
    id: string;
  };
}

// ============================================================================
// ERROR RESPONSE
// ============================================================================

export interface PagBankErrorResponse {
  errors: Array<{
    code: string;
    message: string;
  }>;
}
