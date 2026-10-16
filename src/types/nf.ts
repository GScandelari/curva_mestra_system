import { Timestamp } from 'firebase/firestore';

export interface NFProduct {
  codigo: string;
  nome_produto: string;
  lote: string;
  quantidade: number;
  dt_validade: string; // formato DD/MM/YYYY
  dt_fabricacao?: string; // formato DD/MM/YYYY (opcional)
  valor_unitario: number;
  sem_rastro?: boolean; // true quando <rastro> ausente no XML
}

export type TipoNota = 'bonificacao' | 'venda' | 'outro';

export interface ParsedNF {
  numero: string; // normalizado (sem zeros à esquerda)
  serie: string; // normalizada
  chave_acesso: string; // 44 posições, sem 'NFe', DV validado
  data_emissao?: string;
  fornecedor?: string;
  cnpj_fornecedor: string; // 14 posições, DV validado
  natureza_operacao?: string; // texto bruto de <ide><natOp>
  forma_pagamento?: string; // rótulo derivado de <pag><detPag>
  tipo_nota: TipoNota; // classificação derivada de natureza_operacao
  produtos: NFProduct[];
}

export type XmlParseErrorCode =
  | 'INVALID_FORMAT'
  | 'MISSING_NF_NUMBER'
  | 'NO_PRODUCTS_FOUND'
  | 'MALFORMED_PRODUCT'
  | 'MISSING_ACCESS_KEY'
  | 'INVALID_ACCESS_KEY' // formato, DV ou divergência com as tags
  | 'INVALID_ISSUER'; // emitente sem CNPJ, CNPJ inválido ou série inválida

export interface XmlParseError {
  code: XmlParseErrorCode;
  message: string;
  itemIndex?: number;
}

export type NFOrigem = 'xml' | 'manual';

/** Identidade de uma NF: CNPJ do emitente (14 posições) + série + número, normalizados. */
export interface NFIdentity {
  cnpj: string;
  serie: string;
  numero: string;
}

export interface NFProdutoPendente {
  codigo: string;
  nome_produto: string;
  lote: string;
  /** Código fora do padrão do catálogo (só XML): nunca é incorporado; sai da fila por recusa. */
  fora_do_padrao?: boolean;
}

/** Item recusado pelo system_admin (não cadastrado no catálogo). */
export interface NFProdutoRecusado {
  codigo: string;
  nome_produto: string;
  lote: string;
  motivo: string;
  recusado_em: Date | Timestamp;
}

/** Produto do lançamento manual, como chega ao servidor (código e lote já normalizados). */
export interface ManualNfProductInput {
  codigo: string;
  nome_produto: string;
  lote: string;
  quantidade: number; // como informado (embalagens, se Rennova fragmentável ou pendente)
  valor_unitario: number; // como informado (por embalagem, se fragmentável ou pendente)
  dt_validade: string; // 'YYYY-MM-DD'
  brand?: string;
  category?: string;
}

/** Resposta de GET /api/nf-imports/identidade (só fatos; a mensagem é montada no client). */
export type NfIdentityLookupResponse =
  | { existe: false }
  | {
      existe: true;
      importId: string;
      idLabel: string;
      origem: NFOrigem;
      hasPending: boolean;
      hasRejected: boolean;
    };

export interface NFImport {
  id: string;
  tenant_id: string;
  numero_nf: string;
  origem: NFOrigem;
  arquivo_nome: string;
  arquivo_url?: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'novo_produto_pendente';
  produtos_importados: number;
  produtos_novos: number;
  produtos_pendentes?: NFProdutoPendente[];
  produtos_recusados?: NFProdutoRecusado[];
  error_message?: string;
  natureza_operacao?: string;
  forma_pagamento?: string;
  tipo_nota?: TipoNota;
  parsed_data?: ParsedNF;
  created_at: Date | Timestamp;
  updated_at: Date | Timestamp;
  created_by: string;
}
