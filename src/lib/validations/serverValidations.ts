/**
 * Validações Server-Side
 * Utilitários para validação de dados no backend
 */

/**
 * Valida CPF
 * Verifica dígitos verificadores e formato
 */
export function validateCPF(cpf: string): { valid: boolean; error?: string } {
  // Remove formatação
  const cleanCPF = cpf.replace(/\D/g, "");

  // Verifica se tem 11 dígitos
  if (cleanCPF.length !== 11) {
    return { valid: false, error: "CPF deve ter 11 dígitos" };
  }

  // Verifica se todos os dígitos são iguais (inválido)
  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    return { valid: false, error: "CPF inválido: todos os dígitos são iguais" };
  }

  // Validação dos dígitos verificadores
  let sum = 0;
  let remainder;

  // Primeiro dígito verificador
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) {
    return { valid: false, error: "CPF inválido: dígito verificador incorreto" };
  }

  // Segundo dígito verificador
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) {
    return { valid: false, error: "CPF inválido: dígito verificador incorreto" };
  }

  return { valid: true };
}

/**
 * Valida CNPJ
 * Verifica dígitos verificadores e formato
 */
export function validateCNPJ(cnpj: string): { valid: boolean; error?: string } {
  // Remove formatação
  const cleanCNPJ = cnpj.replace(/\D/g, "");

  // Verifica se tem 14 dígitos
  if (cleanCNPJ.length !== 14) {
    return { valid: false, error: "CNPJ deve ter 14 dígitos" };
  }

  // Verifica se todos os dígitos são iguais (inválido)
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) {
    return { valid: false, error: "CNPJ inválido: todos os dígitos são iguais" };
  }

  // Validação dos dígitos verificadores
  let length = cleanCNPJ.length - 2;
  let numbers = cleanCNPJ.substring(0, length);
  const digits = cleanCNPJ.substring(length);
  let sum = 0;
  let pos = length - 7;

  // Primeiro dígito verificador
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) {
    return { valid: false, error: "CNPJ inválido: dígito verificador incorreto" };
  }

  // Segundo dígito verificador
  length = length + 1;
  numbers = cleanCNPJ.substring(0, length);
  sum = 0;
  pos = length - 7;
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) {
    return { valid: false, error: "CNPJ inválido: dígito verificador incorreto" };
  }

  return { valid: true };
}

/**
 * Valida documento (CPF ou CNPJ)
 */
export function validateDocument(
  document: string,
  type: "cpf" | "cnpj"
): { valid: boolean; error?: string } {
  if (type === "cpf") {
    return validateCPF(document);
  } else {
    return validateCNPJ(document);
  }
}

/**
 * Valida email
 * RFC 5322 Official Standard regex simplificado
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: "E-mail é obrigatório" };
  }

  // Regex simplificado mas robusto
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) {
    return { valid: false, error: "Formato de e-mail inválido" };
  }

  // Verifica tamanho máximo (RFC 5321)
  if (email.length > 254) {
    return { valid: false, error: "E-mail muito longo (máximo 254 caracteres)" };
  }

  // Verifica domínio mínimo
  const parts = email.split("@");
  if (parts.length !== 2) {
    return { valid: false, error: "E-mail deve conter exatamente um @" };
  }

  const [local, domain] = parts;

  if (local.length === 0 || local.length > 64) {
    return { valid: false, error: "Parte local do e-mail inválida" };
  }

  if (domain.length === 0 || !domain.includes(".")) {
    return { valid: false, error: "Domínio do e-mail inválido" };
  }

  return { valid: true };
}

/**
 * Valida telefone brasileiro
 * Formatos aceitos: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 */
export function validatePhone(phone: string): { valid: boolean; error?: string } {
  if (!phone || phone.trim().length === 0) {
    return { valid: false, error: "Telefone é obrigatório" };
  }

  // Remove formatação
  const cleanPhone = phone.replace(/\D/g, "");

  // Verifica tamanho (10 ou 11 dígitos)
  if (cleanPhone.length !== 10 && cleanPhone.length !== 11) {
    return {
      valid: false,
      error: "Telefone deve ter 10 ou 11 dígitos (com DDD)",
    };
  }

  // Verifica se DDD é válido (11-99)
  const ddd = parseInt(cleanPhone.substring(0, 2));
  if (ddd < 11 || ddd > 99) {
    return { valid: false, error: "DDD inválido" };
  }

  // Verifica se não é todos os dígitos iguais
  if (/^(\d)\1+$/.test(cleanPhone)) {
    return { valid: false, error: "Telefone inválido: todos os dígitos são iguais" };
  }

  return { valid: true };
}

/**
 * Valida CEP brasileiro
 * Formato: XXXXX-XXX ou XXXXXXXX
 */
export function validateCEP(cep: string): { valid: boolean; error?: string } {
  if (!cep || cep.trim().length === 0) {
    return { valid: false, error: "CEP é obrigatório" };
  }

  // Remove formatação
  const cleanCEP = cep.replace(/\D/g, "");

  // Verifica se tem 8 dígitos
  if (cleanCEP.length !== 8) {
    return { valid: false, error: "CEP deve ter 8 dígitos" };
  }

  // Verifica se não é todos zeros
  if (cleanCEP === "00000000") {
    return { valid: false, error: "CEP inválido" };
  }

  return { valid: true };
}

/**
 * Valida senha
 * Regras:
 * - Mínimo 6 caracteres
 * - Máximo 100 caracteres
 * - Pelo menos 1 letra
 * - Pelo menos 1 número (recomendado)
 */
export function validatePassword(
  password: string,
  options: {
    minLength?: number;
    requireNumber?: boolean;
    requireSpecialChar?: boolean;
  } = {}
): { valid: boolean; error?: string; strength?: "weak" | "medium" | "strong" } {
  const {
    minLength = 6,
    requireNumber = false,
    requireSpecialChar = false,
  } = options;

  if (!password || password.length === 0) {
    return { valid: false, error: "Senha é obrigatória" };
  }

  if (password.length < minLength) {
    return {
      valid: false,
      error: `Senha deve ter pelo menos ${minLength} caracteres`,
    };
  }

  if (password.length > 100) {
    return {
      valid: false,
      error: "Senha muito longa (máximo 100 caracteres)",
    };
  }

  // Verifica se tem pelo menos uma letra
  if (!/[a-zA-Z]/.test(password)) {
    return {
      valid: false,
      error: "Senha deve conter pelo menos uma letra",
    };
  }

  // Verifica número se obrigatório
  if (requireNumber && !/\d/.test(password)) {
    return {
      valid: false,
      error: "Senha deve conter pelo menos um número",
    };
  }

  // Verifica caractere especial se obrigatório
  if (requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return {
      valid: false,
      error: "Senha deve conter pelo menos um caractere especial",
    };
  }

  // Calcula força da senha
  let strength: "weak" | "medium" | "strong" = "weak";

  if (password.length >= 8) {
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);

    const criteriaMet = [hasNumber, hasSpecial, hasUpper, hasLower].filter(
      Boolean
    ).length;

    if (criteriaMet >= 3 && password.length >= 12) {
      strength = "strong";
    } else if (criteriaMet >= 2) {
      strength = "medium";
    }
  }

  return { valid: true, strength };
}

/**
 * Sanitiza string removendo caracteres perigosos
 * Previne XSS e SQL injection
 */
export function sanitizeString(input: string): string {
  if (!input) return "";

  return input
    .trim()
    .replace(/[<>]/g, "") // Remove < e >
    .replace(/javascript:/gi, "") // Remove javascript:
    .replace(/on\w+=/gi, "") // Remove event handlers (onclick=, onload=, etc)
    .substring(0, 1000); // Limita tamanho
}

/**
 * Valida nome completo
 * Deve ter pelo menos nome e sobrenome
 */
export function validateFullName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Nome completo é obrigatório" };
  }

  const sanitized = sanitizeString(name);
  const parts = sanitized.trim().split(/\s+/);

  if (parts.length < 2) {
    return {
      valid: false,
      error: "Informe nome e sobrenome",
    };
  }

  if (sanitized.length < 3) {
    return {
      valid: false,
      error: "Nome muito curto",
    };
  }

  if (sanitized.length > 100) {
    return {
      valid: false,
      error: "Nome muito longo (máximo 100 caracteres)",
    };
  }

  // Verifica se tem apenas letras, espaços, acentos e hífen
  if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(sanitized)) {
    return {
      valid: false,
      error: "Nome deve conter apenas letras",
    };
  }

  return { valid: true };
}

/**
 * Valida data de nascimento
 * Deve ser uma data válida e pessoa deve ter entre 18 e 120 anos
 */
export function validateBirthDate(
  dateString: string
): { valid: boolean; error?: string } {
  if (!dateString || dateString.trim().length === 0) {
    return { valid: false, error: "Data de nascimento é obrigatória" };
  }

  // Formato DD/MM/AAAA
  const parts = dateString.split("/");
  if (parts.length !== 3) {
    return { valid: false, error: "Formato de data inválido (use DD/MM/AAAA)" };
  }

  const [day, month, year] = parts.map(Number);

  // Validações básicas
  if (day < 1 || day > 31) {
    return { valid: false, error: "Dia inválido" };
  }

  if (month < 1 || month > 12) {
    return { valid: false, error: "Mês inválido" };
  }

  if (year < 1900 || year > new Date().getFullYear()) {
    return { valid: false, error: "Ano inválido" };
  }

  // Cria data e valida
  const date = new Date(year, month - 1, day);
  if (
    date.getDate() !== day ||
    date.getMonth() !== month - 1 ||
    date.getFullYear() !== year
  ) {
    return { valid: false, error: "Data inválida" };
  }

  // Calcula idade
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }

  if (age < 18) {
    return { valid: false, error: "Deve ter pelo menos 18 anos" };
  }

  if (age > 120) {
    return { valid: false, error: "Idade inválida" };
  }

  return { valid: true };
}
