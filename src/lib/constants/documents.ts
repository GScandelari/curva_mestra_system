/**
 * Constantes relacionadas a documentos (CPF/CNPJ)
 */

import type { DocumentType } from "@/types";

export const DOCUMENT_TYPES = {
  CPF: "cpf" as const,
  CNPJ: "cnpj" as const,
};

export const MAX_USERS_BY_TYPE: Record<DocumentType, number> = {
  cpf: 1,
  cnpj: 5,
};

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  cpf: "CPF (Pessoa Física)",
  cnpj: "CNPJ (Pessoa Jurídica)",
};

export const DOCUMENT_LABELS_SHORT: Record<DocumentType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
};

export const DOCUMENT_MASKS: Record<DocumentType, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
};

export const DOCUMENT_PLACEHOLDERS: Record<DocumentType, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
};

export const DOCUMENT_LENGTHS: Record<DocumentType, number> = {
  cpf: 11,  // sem formatação
  cnpj: 14, // sem formatação
};

export const DOCUMENT_FORMATTED_LENGTHS: Record<DocumentType, number> = {
  cpf: 14,  // com formatação: 000.000.000-00
  cnpj: 18, // com formatação: 00.000.000/0000-00
};

export const ACCOUNT_TYPE_DESCRIPTIONS: Record<DocumentType, string> = {
  cpf: "Conta individual - apenas 1 usuário (você)",
  cnpj: "Clínica / Empresa - até 5 usuários",
};

export const ACCOUNT_TYPE_TITLES: Record<DocumentType, string> = {
  cpf: "Profissional Autônomo",
  cnpj: "Clínica / Empresa",
};
