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

export interface Tenant {
  id: string;
  name: string;
  cnpj: string;
  email: string;
  phone?: string;
  address?: string;
  plan_id: string;
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

export interface Solicitacao {
  id: string;
  tenant_id: string;
  paciente_nome: string;
  paciente_id?: string;
  procedimento: string;
  data_agendamento?: Timestamp;
  produtos_solicitados: ProdutoSolicitado[];
  status: SolicitacaoStatus;
  observacoes?: string;
  created_by: string;
  updated_by?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProdutoSolicitado {
  produto_codigo: string;
  produto_nome: string;
  quantidade: number;
  lote?: string;
  inventory_item_id?: string;
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
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
