import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Protocolo, ProtocoloItem } from '@/types';

export interface ProdutoHistorico {
  codigo_produto: string;
  nome_produto: string;
}

export async function getHistoricalProducts(tenantId: string): Promise<ProdutoHistorico[]> {
  const snap = await getDocs(collection(db, 'tenants', tenantId, 'inventory'));
  const seen = new Map<string, string>();
  for (const d of snap.docs) {
    const data = d.data();
    if (data.codigo_produto && data.nome_produto && !seen.has(data.codigo_produto)) {
      seen.set(data.codigo_produto, data.nome_produto);
    }
  }
  return Array.from(seen.entries())
    .map(([codigo_produto, nome_produto]) => ({ codigo_produto, nome_produto }))
    .sort((a, b) => a.nome_produto.localeCompare(b.nome_produto));
}

export async function listProtocolos(tenantId: string): Promise<Protocolo[]> {
  const q = query(
    collection(db, 'tenants', tenantId, 'protocolos'),
    where('active', '==', true),
    orderBy('nome')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Protocolo);
}

export interface CreateProtocoloInput {
  nome: string;
  descricao?: string;
  itens: ProtocoloItem[];
}

export async function createProtocolo(
  tenantId: string,
  userId: string,
  input: CreateProtocoloInput
): Promise<string> {
  const now = Timestamp.now();
  const ref = await addDoc(collection(db, 'tenants', tenantId, 'protocolos'), {
    tenant_id: tenantId,
    nome: input.nome,
    ...(input.descricao ? { descricao: input.descricao } : {}),
    itens: input.itens,
    active: true,
    created_at: now,
    updated_at: now,
    created_by: userId,
  });
  return ref.id;
}

export async function updateProtocolo(
  tenantId: string,
  id: string,
  input: Partial<CreateProtocoloInput>
): Promise<void> {
  const updates: Record<string, unknown> = { updated_at: Timestamp.now() };
  if (input.nome !== undefined) updates.nome = input.nome;
  if (input.descricao !== undefined) updates.descricao = input.descricao;
  if (input.itens !== undefined) updates.itens = input.itens;
  await updateDoc(doc(db, 'tenants', tenantId, 'protocolos', id), updates);
}

export async function deleteProtocolo(tenantId: string, id: string): Promise<void> {
  await updateDoc(doc(db, 'tenants', tenantId, 'protocolos', id), {
    active: false,
    updated_at: Timestamp.now(),
  });
}
