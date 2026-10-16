import { Timestamp } from 'firebase/firestore';
import type { NFOrigem } from '@/types/nf';

/**
 * Linha de NF-e cujo código não estava ativo no catálogo master — vinda da
 * importação via XML ou de um lançamento manual Rennova. Gravada pelo servidor
 * na confirmação; a Cloud Function onMasterProductWritten a lança no
 * inventário quando o produto fica ativo (status 'resolvida'), e o
 * system_admin pode recusá-la (status 'recusada').
 */
export interface PendingMasterProduct {
  id: string; // XML: `${tenant_id}_${nf_import_id}_${linha}` · manual: `${tenant_id}_${nf_import_id}_m${n}_${linha}`
  tenant_id: string;
  nf_import_id: string; // "1000"
  id_sequencial: number; // 1000
  numero_nf: string;
  serie: string;
  cnpj_emitente: string;
  origem?: NFOrigem; // ausente = 'xml' (pendências anteriores)
  lancamento?: number; // manual: número do lançamento (1 = criação, 2+ = complementos)
  linha: number; // índice do item na NF (XML) ou no lançamento (manual)
  codigo: string;
  nome_produto: string;
  lote: string;
  quantidade: number; // como na NF (embalagens)
  valor_unitario: number; // como na NF (por embalagem)
  dt_validade: Date | Timestamp;
  dt_fabricacao?: Date | Timestamp;
  sem_rastro?: boolean;
  /** Código fora do padrão do catálogo (só XML): nunca é incorporado; sai da fila por recusa. */
  fora_do_padrao?: boolean;
  status: 'aberta' | 'resolvida' | 'recusada';
  inventory_id?: string;
  created_at: Date | Timestamp;
  resolved_at?: Date | Timestamp;
  motivo_recusa?: string;
  recusado_por?: string;
  recusado_por_nome?: string;
  recusado_em?: Date | Timestamp;
}
