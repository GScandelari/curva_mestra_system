import { Timestamp } from 'firebase/firestore';
import type { NFOrigem } from '@/types/nf';

/**
 * Alerta do sino do system_admin (coleção de raiz `admin_notifications`).
 * Criado só pelo servidor (Admin SDK) na mesma transação da importação ou do
 * lançamento que gerou pendência; o system_admin só marca como lido.
 */
export type AdminNotificationType = 'nf_pendencias';

export interface AdminNotification {
  id: string; // nf_pendencias_{tenantId}_{importId} (XML) · nf_pendencias_{tenantId}_{importId}_m{n} (manual)
  type: AdminNotificationType;
  title: string;
  message: string;
  read: boolean;
  link: string; // '/admin/pending-products' ou '/admin/pending-products#fora-do-padrao'
  created_at: Timestamp | Date;
  read_at?: Timestamp | Date;
  metadata: {
    tenant_id: string;
    tenant_name: string;
    origem: NFOrigem;
    nf_import_id: string;
    lancamento?: number;
    numero_nf: string;
    serie: string;
    cnpj_emitente: string;
    codigos_pendentes: string[]; // fora do catálogo (incorporáveis)
    codigos_fora_padrao: string[]; // fora do padrão do catálogo (só XML)
  };
}
