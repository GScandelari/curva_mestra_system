import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteField,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isDuplicateValue } from '@/lib/duplicateValidation';
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
  const q = query(collection(db, 'tenants', tenantId, 'protocolos'), where('active', '==', true));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Protocolo)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export interface CreateProtocoloInput {
  nome: string;
  descricao?: string;
  itens: ProtocoloItem[];
  duracao_minutos?: number; // RN-15: inteiro 1..1440
}

export interface UpdateProtocoloInput extends Partial<
  Omit<CreateProtocoloInput, 'duracao_minutos'>
> {
  duracao_minutos?: number | null; // null remove a duração
}

// Nenhum protocolo do mesmo tenant pode compartilhar o mesmo nome
// (UC-20-RN-06) -- antes, createProtocolo/updateProtocolo gravavam sem
// nenhuma checagem de unicidade.
export const DUPLICATE_PROTOCOLO_NAME_ERROR = 'Já existe um protocolo com este nome';

async function assertProtocoloNameIsUnique(
  tenantId: string,
  nome: string,
  excludeId?: string
): Promise<void> {
  const existing = await listProtocolos(tenantId);
  if (
    isDuplicateValue(
      existing,
      nome,
      (p) => p.nome,
      excludeId,
      (p) => p.id
    )
  ) {
    throw new Error(DUPLICATE_PROTOCOLO_NAME_ERROR);
  }
}

export async function createProtocolo(
  tenantId: string,
  userId: string,
  input: CreateProtocoloInput
): Promise<string> {
  await assertProtocoloNameIsUnique(tenantId, input.nome);

  const now = Timestamp.now();
  const ref = await addDoc(collection(db, 'tenants', tenantId, 'protocolos'), {
    tenant_id: tenantId,
    nome: input.nome,
    ...(input.descricao ? { descricao: input.descricao } : {}),
    itens: input.itens,
    ...(input.duracao_minutos ? { duracao_minutos: input.duracao_minutos } : {}),
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
  input: UpdateProtocoloInput
): Promise<void> {
  if (input.nome !== undefined) {
    await assertProtocoloNameIsUnique(tenantId, input.nome, id);
  }

  const updates: Record<string, unknown> = { updated_at: Timestamp.now() };
  if (input.nome !== undefined) updates.nome = input.nome;
  if (input.descricao !== undefined) updates.descricao = input.descricao;
  if (input.itens !== undefined) updates.itens = input.itens;
  if (input.duracao_minutos === null) updates.duracao_minutos = deleteField();
  else if (input.duracao_minutos !== undefined) updates.duracao_minutos = input.duracao_minutos;
  await updateDoc(doc(db, 'tenants', tenantId, 'protocolos', id), updates);
}

export async function deleteProtocolo(tenantId: string, id: string): Promise<void> {
  await updateDoc(doc(db, 'tenants', tenantId, 'protocolos', id), {
    active: false,
    updated_at: Timestamp.now(),
  });
}
