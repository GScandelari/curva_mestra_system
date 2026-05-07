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

export interface ParsedNF {
  numero: string;
  data_emissao?: string;
  fornecedor?: string;
  cnpj_fornecedor?: string;
  produtos: NFProduct[];
}

export type XmlParseErrorCode =
  | 'INVALID_FORMAT'
  | 'MISSING_NF_NUMBER'
  | 'NO_PRODUCTS_FOUND'
  | 'MALFORMED_PRODUCT';

export interface XmlParseError {
  code: XmlParseErrorCode;
  message: string;
  itemIndex?: number;
}

export interface NFImport {
  id: string;
  tenant_id: string;
  numero_nf: string;
  arquivo_nome: string;
  arquivo_url?: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'novo_produto_pendente';
  produtos_importados: number;
  produtos_novos: number;
  error_message?: string;
  parsed_data?: ParsedNF;
  created_at: Date | Timestamp;
  updated_at: Date | Timestamp;
  created_by: string;
}

export interface NFImportCreate {
  tenant_id: string;
  numero_nf: string;
  arquivo_nome: string;
  arquivo_url?: string;
  created_by: string;
}
