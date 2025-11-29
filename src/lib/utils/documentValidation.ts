/**
 * Utilitários para validação e formatação de CPF e CNPJ
 */

import type { DocumentType } from "@/types";

/**
 * Valida CPF
 */
export function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");

  if (cleaned.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleaned)) return false;

  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(9))) return false;

  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(10))) return false;

  return true;
}

/**
 * Valida CNPJ
 */
export function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, "");

  if (cleaned.length !== 14) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleaned)) return false;

  // Validação do primeiro dígito verificador
  let size = cleaned.length - 2;
  let numbers = cleaned.substring(0, size);
  const digits = cleaned.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  // Validação do segundo dígito verificador
  size = size + 1;
  numbers = cleaned.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

/**
 * Valida documento (CPF ou CNPJ) automaticamente
 */
export function validateDocument(doc: string): boolean {
  const cleaned = doc.replace(/\D/g, "");

  if (cleaned.length === 11) {
    return validateCPF(doc);
  } else if (cleaned.length === 14) {
    return validateCNPJ(doc);
  }

  return false;
}

/**
 * Formata CPF (000.000.000-00)
 */
export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/**
 * Formata CNPJ (00.000.000/0000-00)
 */
export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

/**
 * Formata documento baseado no tipo
 */
export function formatDocument(doc: string, type: DocumentType): string {
  if (type === "cpf") {
    return formatCPF(doc);
  } else {
    return formatCNPJ(doc);
  }
}

/**
 * Formata documento automaticamente (detecta tipo)
 */
export function formatDocumentAuto(doc: string): string {
  const cleaned = doc.replace(/\D/g, "");

  if (cleaned.length === 11) {
    return formatCPF(cleaned);
  } else if (cleaned.length === 14) {
    return formatCNPJ(cleaned);
  }

  return doc;
}

/**
 * Detecta tipo de documento baseado no tamanho
 */
export function getDocumentType(doc: string): DocumentType | null {
  const cleaned = doc.replace(/\D/g, "");

  if (cleaned.length === 11) return "cpf";
  if (cleaned.length === 14) return "cnpj";

  return null;
}

/**
 * Remove formatação do documento
 */
export function cleanDocument(doc: string): string {
  return doc.replace(/\D/g, "");
}

/**
 * Retorna o limite de usuários baseado no tipo de documento
 */
export function getMaxUsersForDocumentType(type: DocumentType): number {
  return type === "cpf" ? 1 : 5;
}

/**
 * Máscara para input de CPF
 */
export function maskCPF(value: string): string {
  let cleaned = value.replace(/\D/g, "");
  cleaned = cleaned.substring(0, 11); // Máximo 11 dígitos

  if (cleaned.length <= 3) {
    return cleaned;
  } else if (cleaned.length <= 6) {
    return cleaned.replace(/^(\d{3})(\d{0,3})/, "$1.$2");
  } else if (cleaned.length <= 9) {
    return cleaned.replace(/^(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3");
  } else {
    return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4");
  }
}

/**
 * Máscara para input de CNPJ
 */
export function maskCNPJ(value: string): string {
  let cleaned = value.replace(/\D/g, "");
  cleaned = cleaned.substring(0, 14); // Máximo 14 dígitos

  if (cleaned.length <= 2) {
    return cleaned;
  } else if (cleaned.length <= 5) {
    return cleaned.replace(/^(\d{2})(\d{0,3})/, "$1.$2");
  } else if (cleaned.length <= 8) {
    return cleaned.replace(/^(\d{2})(\d{3})(\d{0,3})/, "$1.$2.$3");
  } else if (cleaned.length <= 12) {
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, "$1.$2.$3/$4");
  } else {
    return cleaned.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/,
      "$1.$2.$3/$4-$5"
    );
  }
}

/**
 * Aplica máscara baseado no tipo
 */
export function maskDocument(value: string, type: DocumentType): string {
  if (type === "cpf") {
    return maskCPF(value);
  } else {
    return maskCNPJ(value);
  }
}
