import { Timestamp } from 'firebase/firestore';

export interface PendingMasterProduct {
  id: string;
  tenant_id: string;
  numero_nf: string;
  nf_id: string;
  codigo: string;
  nome_produto: string;
  created_at: Date | Timestamp;
}

export interface PendingMasterProductCreate {
  tenant_id: string;
  numero_nf: string;
  nf_id: string;
  codigo: string;
  nome_produto: string;
}
