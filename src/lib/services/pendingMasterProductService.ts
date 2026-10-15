/**
 * Pending Master Product Service
 * Leitura das linhas de NF-e que ficaram pendentes por código fora do
 * catálogo master — visível ao system_admin. A gravação e a resolução
 * acontecem só no servidor (importação e Cloud Functions).
 */

import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PendingMasterProduct } from '@/types/pendingMasterProduct';

const COLLECTION = 'pending_master_products';

const toDate = (v: unknown) => (v instanceof Timestamp ? v.toDate() : (v as Date));

/**
 * Lista as pendências abertas (cross-tenant) — uso exclusivo do system_admin.
 * Usa o índice (status, created_at).
 */
export async function listPendingMasterProducts(): Promise<PendingMasterProduct[]> {
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'aberta'),
    orderBy('created_at', 'desc')
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      ...(data as Omit<PendingMasterProduct, 'id'>),
      id: docSnap.id,
      dt_validade: toDate(data.dt_validade),
      created_at: toDate(data.created_at),
    };
  });
}
