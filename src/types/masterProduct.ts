import { Timestamp } from 'firebase/firestore';

// ============================================================================
// CATEGORIAS
// ============================================================================

export const MASTER_PRODUCT_CATEGORIES = [
  'Preenchedores',
  'Bioestimuladores',
  'Fios de PDO',
  'Toxina',
  'Cannulas',
  'Care Home',
  'Care Professional',
] as const;

export type MasterProductCategory = (typeof MASTER_PRODUCT_CATEGORIES)[number];

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Interface principal para Produto Master (Catálogo Rennova)
 * Produtos disponíveis do fornecedor Rennova
 */
export interface MasterProduct {
  id: string;
  code: string; // Código do produto Rennova (5 a 8 dígitos, sem zeros à esquerda)
  name: string; // Nome base do produto (SEM quantidade/unidade para fragmentáveis)
  category?: MasterProductCategory; // Categoria (alinhado com Firestore — era "grupo")
  active: boolean; // Produto ativo/descontinuado
  fragmentavel: boolean; // Produto vendido em embalagem composta? (undefined = false)
  unidades_por_embalagem?: number; // Obrigatório quando fragmentavel=true
  created_at: Timestamp;
  updated_at: Timestamp;
}

/**
 * Dados para criar um novo Produto Master
 */
export interface CreateMasterProductData {
  code: string;
  name: string;
  category?: MasterProductCategory;
  active?: boolean; // Padrão: true
  fragmentavel?: boolean; // Padrão: false
  unidades_por_embalagem?: number;
}

/**
 * Dados para atualizar um Produto Master existente
 */
export interface UpdateMasterProductData {
  code?: string;
  name?: string;
  category?: MasterProductCategory | null; // null limpa o campo explicitamente
  active?: boolean;
  fragmentavel?: boolean;
  unidades_por_embalagem?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Retorna o nome completo do produto para exibição.
 * Para fragmentáveis: "{name} {unidades_por_embalagem} UND"
 * Para não fragmentáveis: "{name}"
 */
export function getNomeCompletoMasterProduct(product: MasterProduct): string {
  if (!product.fragmentavel || !product.unidades_por_embalagem) {
    return product.name;
  }
  return `${product.name} ${product.unidades_por_embalagem} UND`;
}

/**
 * Formato do código do catálogo master: só dígitos, sem zeros à esquerda, de 5
 * a 8 dígitos. ESPELHADO na rule de master_products (isCatalogCode em
 * firestore.rules) — mudar nos dois lugares.
 */
export const CATALOG_CODE_PATTERN = /^[1-9]\d{4,7}$/;

/** Código já normalizado (sem zeros à esquerda) está no padrão do catálogo? */
export function isCatalogProductCode(codigoNormalizado: string): boolean {
  return CATALOG_CODE_PATTERN.test(codigoNormalizado);
}

/**
 * Helper para formatar a digitação do código do produto (só dígitos, até 8)
 */
export function formatProductCode(code: string): string {
  const cleaned = code.replace(/\D/g, '');
  return cleaned.slice(0, 8);
}

/**
 * Helper para validar código do produto digitado: só dígitos; sem os zeros à
 * esquerda (removidos na gravação, mesma forma do cProd da NF-e) precisa ter
 * de 5 a 8 dígitos.
 */
export function validateProductCode(code: string): boolean {
  const cleaned = code.trim();
  if (!/^\d+$/.test(cleaned)) return false;
  return isCatalogProductCode(cleaned.replace(/^0+/, ''));
}

/**
 * Helper para normalizar nome do produto (uppercase)
 */
export function normalizeProductName(name: string): string {
  return name.trim().toUpperCase();
}
