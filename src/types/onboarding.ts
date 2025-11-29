import { Timestamp } from "firebase/firestore";

/**
 * Status do onboarding da clínica
 */
export type OnboardingStatus =
  | "pending_setup"      // Aguardando configuração inicial
  | "pending_plan"       // Aguardando seleção de plano
  | "pending_payment"    // Aguardando confirmação de pagamento
  | "completed";         // Onboarding completo

/**
 * Dados de onboarding do tenant
 */
export interface TenantOnboarding {
  tenant_id: string;
  status: OnboardingStatus;
  setup_completed: boolean;
  plan_selected: boolean;
  payment_confirmed: boolean;
  selected_plan_id?: "semestral" | "anual";
  payment_method?: "credit_card" | "pix" | "boleto";
  payment_data?: PaymentData;
  created_at: Timestamp;
  updated_at: Timestamp;
  completed_at?: Timestamp;
}

/**
 * Dados de pagamento (PagSeguro)
 */
export interface PaymentData {
  provider: "pagseguro" | "mock"; // mock para MVP
  subscription_id?: string;        // ID da assinatura recorrente
  transaction_id?: string;         // ID da transação
  payment_status: PaymentStatus;
  amount: number;
  payment_date?: Timestamp;
  next_billing_date?: Timestamp;
  card_last_digits?: string;
  card_brand?: string;
}

/**
 * Status do pagamento
 */
export type PaymentStatus =
  | "pending"           // Aguardando pagamento
  | "processing"        // Processando pagamento
  | "approved"          // Pagamento aprovado
  | "rejected"          // Pagamento rejeitado
  | "cancelled"         // Pagamento cancelado
  | "refunded";         // Pagamento reembolsado

/**
 * Dados para configuração inicial da clínica
 */
export interface ClinicSetupData {
  name: string;
  document_type: "cnpj" | "cpf";
  document_number: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  cep: string;
}

/**
 * Dados para seleção de plano
 */
export interface PlanSelectionData {
  plan_id: "semestral" | "anual";
  payment_method: "credit_card" | "pix" | "boleto";
}

/**
 * Resposta da criação de pagamento
 */
export interface PaymentCreationResponse {
  success: boolean;
  payment_id?: string;
  payment_url?: string;  // URL para redirecionamento (PagSeguro)
  qr_code?: string;      // QR Code para PIX
  error?: string;
}

/**
 * Webhook de confirmação de pagamento (PagSeguro)
 */
export interface PaymentWebhookData {
  notificationCode: string;
  notificationType: string;
  // Dados adicionais do PagSeguro serão mapeados aqui
}
