import { Timestamp } from 'firebase/firestore';

/**
 * Linha de NF-e importada via XML cujo código não estava ativo no catálogo
 * master. Gravada pelo servidor na confirmação da importação; a Cloud
 * Function onMasterProductWritten a lança no inventário quando o produto
 * fica ativo (status 'resolvida').
 */
export interface PendingMasterProduct {
  id: string; // `${tenant_id}_${nf_import_id}_${linha}`
  tenant_id: string;
  nf_import_id: string; // "1000"
  id_sequencial: number; // 1000
  numero_nf: string;
  serie: string;
  cnpj_emitente: string;
  linha: number; // índice em parsedNF.produtos
  codigo: string;
  nome_produto: string;
  lote: string;
  quantidade: number; // como na NF (embalagens)
  valor_unitario: number; // como na NF (por embalagem)
  dt_validade: Date | Timestamp;
  dt_fabricacao?: Date | Timestamp;
  sem_rastro?: boolean;
  status: 'aberta' | 'resolvida';
  inventory_id?: string;
  created_at: Date | Timestamp;
  resolved_at?: Date | Timestamp;
}
