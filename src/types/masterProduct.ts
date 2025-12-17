import { Timestamp } from "firebase/firestore";

/**
 * Interface principal para Produto Master (Catálogo Rennova)
 * Produtos disponíveis do fornecedor Rennova
 */
export interface MasterProduct {
  id: string;
  code: string; // Código do produto Rennova (7 dígitos)
  name: string; // Nome do produto
  grupo?: string; // Grupo/categoria do produto (ex: "Preenchedores", "Bioestimuladores")
  active: boolean; // Produto ativo/descontinuado
  created_at: Timestamp;
  updated_at: Timestamp;
}

/**
 * Dados para criar um novo Produto Master
 * Omite campos gerados automaticamente (id, timestamps)
 */
export interface CreateMasterProductData {
  code: string;
  name: string;
  grupo?: string; // Grupo/categoria do produto
  active?: boolean; // Padrão: true
}

/**
 * Dados para atualizar um Produto Master existente
 * Todos os campos são opcionais
 */
export interface UpdateMasterProductData {
  code?: string;
  name?: string;
  grupo?: string;
  active?: boolean;
}

/**
 * Helper para formatar código do produto (7 dígitos)
 */
export function formatProductCode(code: string): string {
  const cleaned = code.replace(/\D/g, "");
  return cleaned.slice(0, 7);
}

/**
 * Helper para validar código do produto (7 dígitos)
 */
export function validateProductCode(code: string): boolean {
  const cleaned = code.replace(/\D/g, "");
  return cleaned.length === 7;
}

/**
 * Helper para normalizar nome do produto (uppercase)
 */
export function normalizeProductName(name: string): string {
  return name.trim().toUpperCase();
}
