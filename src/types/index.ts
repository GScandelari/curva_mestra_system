/**
 * Types do Sistema Curva Mestra
 * Multi-Tenant SaaS para Clínicas de Harmonização
 */

import { Timestamp } from "firebase/firestore";

// ============================================================================
// USER & AUTH
// ============================================================================

export type UserRole = "clinic_admin" | "clinic_user" | "system_admin";

export interface CustomClaims {
  tenant_id: string;
  role: UserRole;
  is_system_admin: boolean;
  active: boolean;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  tenant_id: string;
  role: UserRole;
  active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ============================================================================
// TENANT
// ============================================================================

export type DocumentType = "cnpj" | "cpf";

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
  produto_codigo: string;
  produto_nome: string;
  lote: string;
  quantidade_inicial: number;
  quantidade_disponivel: number;
  quantidade_reservada: number; // Quantidade reservada para procedimentos agendados
  dt_validade: string; // formato: DD/MM/YYYY
  valor_unitario: number;
  nf_id: string;
  nf_numero: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ============================================================================
// SOLICITAÇÕES
// ============================================================================

export type SolicitacaoStatus =
  | "criada"
  | "agendada"
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
  | "aprovada" // Aprovada, aguardando ativação por código
  | "ativa" // Conta ativada com sucesso
  | "rejeitada" // Recusada por admin
  | "expirada"; // Código de ativação expirou

export interface AccessRequest {
  id: string;
  document_type: DocumentType; // NOVO: tipo de documento (CPF ou CNPJ)
  document_number: string; // NOVO: CPF ou CNPJ unificado
  cnpj?: string; // DEPRECATED: manter compatibilidade
  tenant_id?: string; // Preenchido se o documento já existe
  tenant_name?: string; // Nome da clínica/pessoa (se encontrada)
  full_name: string; // Nome completo do solicitante
  email: string; // Email do solicitante
  password_hash?: string; // Hash da senha (temporário até ativação)
  status: AccessRequestStatus;
  activation_code?: string; // Código de 8 dígitos
  activation_code_expires_at?: Timestamp; // Expiração do código (24h)
  has_available_slots?: boolean; // Se tem vagas disponíveis
  approved_by?: string; // UID do admin que aprovou
  approved_by_name?: string; // Nome do admin que aprovou
  approved_at?: Timestamp;
  rejected_by?: string;
  rejected_by_name?: string;
  rejected_at?: Timestamp;
  rejection_reason?: string;
  activated_at?: Timestamp;
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
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
