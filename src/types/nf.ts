import { Timestamp } from "firebase/firestore";

export interface NFProduct {
  codigo: string;
  nome_produto: string;
  lote: string;
  quantidade: number;
  dt_validade: string; // formato DD/MM/YYYY
  valor_unitario: number;
}

export interface ParsedNF {
  numero: string;
  data_emissao?: string;
  fornecedor?: string;
  produtos: NFProduct[];
}

export interface NFImport {
  id: string;
  tenant_id: string;
  numero_nf: string;
  arquivo_nome: string;
  arquivo_url?: string;
  status: "pending" | "processing" | "success" | "error" | "novo_produto_pendente";
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
