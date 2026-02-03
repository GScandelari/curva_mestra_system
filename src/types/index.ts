/**
 * Types do Sistema Curva Mestra
 * Multi-Tenant SaaS para Clínicas de Harmonização
 */

import { Timestamp } from "firebase/firestore";

// ============================================================================
// USER & AUTH
// ============================================================================

export type UserRole = "clinic_admin" | "clinic_user" | "system_admin" | "clinic_consultant";

export interface CustomClaims {
  tenant_id: string | null;           // null para consultores
  role: UserRole;
  is_system_admin: boolean;
  is_consultant?: boolean;            // true para clinic_consultant
  consultant_id?: string;             // ID do consultor
  authorized_tenants?: string[];      // Tenants com acesso (para consultores)
  active: boolean;
  requirePasswordChange?: boolean;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  tenant_id: string;
  role: UserRole;
  active: boolean;
  requirePasswordChange?: boolean; // Flag para forçar troca de senha no próximo login
  passwordResetAt?: Timestamp;     // Data da última redefinição de senha pelo admin
  passwordChangedAt?: Timestamp;   // Data da última troca de senha pelo próprio usuário
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ============================================================================
// TENANT
// ============================================================================

export type DocumentType = "cnpj" | "cpf";

export type SuspensionReason =
  | "payment_failure"      // Falta de pagamento
  | "contract_breach"      // Quebra de contrato
  | "terms_violation"      // Violação dos termos de uso
  | "fraud_detected"       // Fraude detectada
  | "other";               // Outro motivo

export interface SuspensionInfo {
  suspended: boolean;
  reason: SuspensionReason;
  details: string;                  // Detalhes adicionais do motivo
  suspended_at: Timestamp;
  suspended_by: string;             // UID do system_admin que suspendeu
  contact_email: string;            // Email para contato (suporte)
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface Tenant {
  id: string;
  name: string;
  document_type: DocumentType;    // NOVO: tipo de documento
  document_number: string;          // NOVO: CPF ou CNPJ unificado
  cnpj?: string;                    // DEPRECATED: manter compatibilidade
  email: string;
  phone?: string;
  address?: string | Address;
  plan_id: string;
  max_users: number;                // NOVO: 1 para CPF, 5 para CNPJ
  active: boolean;
  suspension?: SuspensionInfo;      // NOVO: Informações de suspensão
  consultant_id?: string;           // ID do consultor atual
  consultant_code?: string;         // Código 6 dígitos (desnormalizado)
  consultant_name?: string;         // Nome do consultor (desnormalizado)
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ============================================================================
// PRODUTO RENNOVA
// ============================================================================

export interface ProdutoRennova {
  codigo: string;
  nome_produto: string;
  lote: string;
  quantidade: number;
  dt_validade: string; // formato: DD/MM/YYYY
  valor_unitario: number;
}

export interface ProdutoMaster {
  id: string;
  codigo: string;
  nome: string;
  categoria?: string;
  unidade_medida?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ============================================================================
// NF-e IMPORT
// ============================================================================

export type NFImportStatus =
  | "pending"
  | "processing"
  | "success"
  | "error"
  | "novo_produto_pendente";

export interface NFImport {
  id: string;
  tenant_id: string;
  numero_nf: string;
  pdf_url: string;
  status: NFImportStatus;
  error_message?: string;
  produtos: ProdutoRennova[];
  created_by: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ============================================================================
// INVENTORY
// ============================================================================

export interface InventoryItem {
  id: string;
  tenant_id: string;
  codigo_produto: string;
  nome_produto: string;
  lote: string;
  quantidade_inicial: number;
  quantidade_disponivel: number;
  quantidade_reservada: number; // Quantidade reservada para procedimentos agendados
  dt_validade: string; // formato: DD/MM/YYYY ou YYYY-MM-DD
  valor_unitario: number;
  nf_id?: string;
  nf_numero: string;
  nf_import_id?: string;
  master_product_id?: string;
  produto_id?: string;
  active?: boolean;
  is_rennova?: boolean;
  dt_entrada?: Timestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ============================================================================
// SOLICITAÇÕES
// ============================================================================

export type SolicitacaoStatus =
  | "criada"
  | "agendada"
  | "concluida"
  | "aprovada"
  | "reprovada"
  | "cancelada";

export interface StatusHistoryEntry {
  status: SolicitacaoStatus;
  changed_by: string; // UID do usuário
  changed_by_name: string; // Nome do usuário
  changed_at: Timestamp;
  observacao?: string; // Motivo da mudança (ex: "Procedimento realizado", "Paciente cancelou")
}

export interface Solicitacao {
  id: string;
  tenant_id: string;
  paciente_codigo: string; // Código único do paciente (obrigatório)
  paciente_nome: string;
  dt_procedimento: Timestamp; // Data do procedimento (obrigatório)
  produtos_solicitados: ProdutoSolicitado[];
  status: SolicitacaoStatus;
  status_history?: StatusHistoryEntry[]; // Histórico de mudanças de status
  observacoes?: string;
  created_by: string; // UID do usuário que criou
  created_by_name?: string; // Nome do usuário que criou
  updated_by?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProdutoSolicitado {
  inventory_item_id: string; // ID do item no inventário (obrigatório para consumo)
  produto_codigo: string;
  produto_nome: string;
  lote: string;
  quantidade: number; // Quantidade consumida
  quantidade_disponivel_antes: number; // Para auditoria
  valor_unitario: number; // Valor no momento do consumo
}

// ============================================================================
// LICENÇAS
// ============================================================================

export type LicenseStatus = "ativa" | "pendente" | "expirada" | "suspensa";

export interface License {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: LicenseStatus;
  max_users: number;
  features: string[];
  start_date: Timestamp;
  end_date: Timestamp;
  auto_renew: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ============================================================================
// DASHBOARD & ANALYTICS
// ============================================================================

export interface DashboardStats {
  total_produtos: number;
  produtos_proximos_vencimento: number;
  produtos_estoque_baixo: number;
  solicitacoes_pendentes: number;
  valor_total_estoque: number;
}

export interface AlertaVencimento {
  produto_codigo: string;
  produto_nome: string;
  lote: string;
  dt_validade: string;
  dias_restantes: number;
  quantidade_disponivel: number;
}

// ============================================================================
// SOLICITAÇÕES DE ACESSO
// ============================================================================

export type AccessRequestStatus =
  | "pendente" // Aguardando aprovação
  | "aprovada" // Aprovada e clínica criada
  | "rejeitada"; // Recusada por admin

export type AccessRequestType = "clinica" | "autonomo";

export interface AccessRequest {
  id: string;
  type: AccessRequestType; // Clínica ou Autônomo

  // Dados do solicitante
  full_name: string; // Nome completo
  email: string;
  phone: string;
  password: string; // Senha para criar a conta

  // Dados da empresa/pessoa
  business_name: string; // Nome da clínica ou nome profissional
  document_type: DocumentType; // cpf ou cnpj
  document_number: string; // CPF ou CNPJ sem formatação

  // Endereço
  address?: string;
  city?: string;
  state?: string;
  cep?: string;

  // Status e aprovação
  status: AccessRequestStatus;
  approved_by?: string; // UID do admin que aprovou
  approved_by_name?: string;
  approved_at?: Timestamp;
  rejected_by?: string;
  rejected_by_name?: string;
  rejected_at?: Timestamp;
  rejection_reason?: string;

  // Tenant criado
  tenant_id?: string; // ID do tenant criado após aprovação
  user_id?: string; // ID do usuário criado após aprovação

  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface TenantLimits {
  tenant_id: string;
  max_users: number; // Limite do plano
  current_users: number; // Usuários ativos
  available_slots: number; // Vagas disponíveis
}

// ============================================================================
// DOCUMENTOS LEGAIS
// ============================================================================

export type DocumentStatus = "ativo" | "inativo" | "rascunho";

export interface LegalDocument {
  id: string;
  title: string; // Ex: "Termos de Uso", "Política de Privacidade"
  slug: string; // Ex: "termos-de-uso", "politica-privacidade"
  content: string; // Conteúdo em Markdown
  version: string; // Ex: "1.0", "2.1"
  status: DocumentStatus;
  required_for_registration: boolean; // Se obrigatório no cadastro
  required_for_existing_users: boolean; // Se usuários existentes devem aceitar
  order: number; // Ordem de exibição
  created_by: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  published_at?: Timestamp;
}

export interface UserDocumentAcceptance {
  id: string;
  user_id: string;
  document_id: string;
  document_version: string;
  accepted_at: Timestamp;
  ip_address?: string;
  user_agent?: string;
}

// ============================================================================
// CONFIGURAÇÕES DO SISTEMA
// ============================================================================

export interface SystemSettings {
  id: string; // sempre "global"
  session_timeout_minutes: number; // Tempo de sessão em minutos (padrão: 15)
  maintenance_mode: boolean; // Modo de manutenção
  maintenance_message?: string;
  registration_enabled: boolean; // Permitir novos registros
  updated_by: string;
  updated_at: Timestamp;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============================================================================
// PASSWORD RESET TOKENS
// ============================================================================

export interface PasswordResetToken {
  id: string;                    // Document ID
  token_hash: string;            // SHA-256 hash do token (nunca armazena raw)
  user_id: string;               // Firebase Auth UID
  user_email: string;            // Email do usuário
  tenant_id?: string;            // Multi-tenant
  expires_at: Timestamp;         // 30 minutos
  created_at: Timestamp;
  created_by: string;            // UID do admin que iniciou
  used_at?: Timestamp;           // Marcado quando usado (one-time)
  invalidated_at?: Timestamp;    // Se invalidado manualmente
}

// ============================================================================
// CONSULTORES
// ============================================================================

export type ConsultantStatus = "active" | "inactive" | "suspended";

export interface Consultant {
  id: string;
  user_id: string;                    // Firebase Auth UID
  code: string;                       // 6 dígitos únicos (ex: "847291")
  name: string;
  email: string;
  phone: string;
  cpf: string;                        // Documento do consultor
  status: ConsultantStatus;
  authorized_tenants: string[];       // Lista de tenant_ids autorizados
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by?: string;                // UID do admin que criou
}

export type ConsultantClaimStatus = "pending" | "approved" | "rejected";

export interface ConsultantClaim {
  id: string;
  consultant_id: string;              // ID do consultor solicitante
  consultant_name: string;            // Nome (desnormalizado)
  consultant_code: string;            // Código (desnormalizado)
  tenant_id: string;                  // ID da clínica solicitada
  tenant_name: string;                // Nome da clínica (desnormalizado)
  tenant_document: string;            // CNPJ/CPF da clínica (desnormalizado)
  status: ConsultantClaimStatus;
  approved_by?: string;               // UID do admin que aprovou
  approved_by_name?: string;
  approved_at?: Timestamp;
  rejected_by?: string;
  rejected_by_name?: string;
  rejected_at?: Timestamp;
  rejection_reason?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}
