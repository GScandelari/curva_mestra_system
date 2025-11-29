import { Timestamp } from "firebase/firestore";

export type DocumentType = "cnpj" | "cpf";

/**
 * Interface principal para Tenant (Clínica)
 * Representa uma clínica no sistema multi-tenant
 */
export interface Tenant {
  id: string;
  name: string;
  document_type: DocumentType;    // NOVO: tipo de documento
  document_number: string;          // NOVO: CPF ou CNPJ unificado
  cnpj?: string;                    // DEPRECATED: manter compatibilidade
  email: string;
  phone: string;
  address: string;
  city?: string;                    // NOVO: cidade separada
  state?: string;                   // NOVO: estado separado
  cep?: string;                     // NOVO: CEP separado
  plan_id: "semestral" | "anual";
  max_users: number;                // NOVO: 1 para CPF, 5 para CNPJ
  active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/**
 * Dados para criar um novo Tenant
 * Omite campos gerados automaticamente (id, timestamps)
 */
export interface CreateTenantData {
  name: string;
  document_type: DocumentType;  // NOVO
  document_number: string;      // NOVO
  cnpj?: string;                 // DEPRECATED: compatibilidade
  max_users: number;             // NOVO
  email: string;
  phone: string;
  address: string;
  city?: string;                 // NOVO: cidade separada
  state?: string;                // NOVO: estado separado
  cep?: string;                  // NOVO: CEP separado
  plan_id: "semestral" | "anual";
  active?: boolean; // Padrão: true
}

/**
 * Dados para atualizar um Tenant existente
 * Todos os campos são opcionais
 */
export interface UpdateTenantData {
  name?: string;
  document_type?: DocumentType;   // NOVO
  document_number?: string;       // NOVO
  cnpj?: string;                  // DEPRECATED: compatibilidade
  max_users?: number;             // NOVO
  email?: string;
  phone?: string;
  address?: string;
  city?: string;                  // NOVO: cidade separada
  state?: string;                 // NOVO: estado separado
  cep?: string;                   // NOVO: CEP separado
  plan_id?: "semestral" | "anual";
  active?: boolean;
}

/**
 * Planos disponíveis no sistema
 */
export const PLANS = {
  semestral: {
    id: "semestral",
    name: "Plano Semestral",
    description: "6 meses de acesso completo ao sistema",
    price: 59.90,
    period: "mês",
  },
  anual: {
    id: "anual",
    name: "Plano Anual",
    description: "12 meses de acesso completo ao sistema",
    price: 49.90,
    period: "mês",
  },
} as const;

/**
 * Helper para formatar CNPJ
 */
export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, "");
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

/**
 * Helper para validar CNPJ (com dígitos verificadores)
 */
export function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, "");

  // Verifica se tem 14 dígitos
  if (cleaned.length !== 14) {
    return false;
  }

  // Verifica se todos os dígitos são iguais (ex: 11111111111111)
  if (/^(\d)\1{13}$/.test(cleaned)) {
    return false;
  }

  // Validação dos dígitos verificadores
  let tamanho = cleaned.length - 2;
  let numeros = cleaned.substring(0, tamanho);
  const digitos = cleaned.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  // Calcula o primeiro dígito verificador
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) {
      pos = 9;
    }
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) {
    return false;
  }

  // Calcula o segundo dígito verificador
  tamanho = tamanho + 1;
  numeros = cleaned.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) {
      pos = 9;
    }
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) {
    return false;
  }

  return true;
}

/**
 * Helper para formatar telefone
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  } else if (cleaned.length === 10) {
    return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }
  return phone;
}
