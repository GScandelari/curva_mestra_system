/**
 * Pending Master Product Service
 * Gerencia produtos identificados em imports de NF-e que ainda não existem
 * no catálogo master — visível ao system_admin para cadastro posterior.
 */

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  PendingMasterProduct,
  PendingMasterProductCreate,
} from '@/types/pendingMasterProduct';

const COLLECTION = 'pending_master_products';

/**
 * Registra produtos pendentes de cadastro, evitando duplicar uma pendência
 * já existente para o mesmo (tenant_id, nf_id, codigo).
 */
export async function registerPendingMasterProducts(
  items: PendingMasterProductCreate[]
): Promise<void> {
  for (const item of items) {
    const pendingRef = collection(db, COLLECTION);
    const q = query(
      pendingRef,
      where('tenant_id', '==', item.tenant_id),
      where('nf_id', '==', item.nf_id),
      where('codigo', '==', item.codigo)
    );
    const existing = await getDocs(q);

    if (!existing.empty) {
      continue;
    }

    await addDoc(pendingRef, {
      ...item,
      created_at: Timestamp.now(),
    });
  }
}

/**
 * Lista todos os produtos pendentes (cross-tenant) — uso exclusivo do system_admin.
 */
export async function listPendingMasterProducts(): Promise<PendingMasterProduct[]> {
  const pendingRef = collection(db, COLLECTION);
  const q = query(pendingRef, orderBy('created_at', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      tenant_id: data.tenant_id,
      numero_nf: data.numero_nf,
      nf_id: data.nf_id,
      codigo: data.codigo,
      nome_produto: data.nome_produto,
      created_at: data.created_at instanceof Timestamp ? data.created_at.toDate() : data.created_at,
    };
  });
}

/**
 * Remove uma pendência da fila (ex: após o system_admin cadastrar o produto
 * e confirmar que não é mais necessário rastreá-la).
 */
export async function resolvePendingMasterProduct(pendingId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, pendingId));
}
