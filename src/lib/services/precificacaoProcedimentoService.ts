/**
 * Precificação do Procedimento Service
 * Snapshot do preço sugerido gravado ao confirmar cada procedimento
 * (tenants/{tenantId}/precificacao_procedimentos/{solicitacaoId}). Só
 * clinic_admin lê e grava — a solicitação, legível por clinic_user e pelo
 * consultor, não guarda nenhum destes valores.
 */

import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizarParametrosMarkup, type SnapshotPrecificacao } from '@/lib/precificacao';
import type { PrecificacaoProcedimento } from '@/types';

const ref = (tenantId: string, solicitacaoId: string) =>
  doc(db, 'tenants', tenantId, 'precificacao_procedimentos', solicitacaoId);

export async function getPrecificacaoProcedimento(
  tenantId: string,
  solicitacaoId: string
): Promise<PrecificacaoProcedimento | null> {
  const snap = await getDoc(ref(tenantId, solicitacaoId));
  if (!snap.exists()) return null;
  const data = snap.data() as PrecificacaoProcedimento;
  return { ...data, markup: normalizarParametrosMarkup(data.markup) };
}

/** Todos os snapshots do tenant, por id da solicitação (tabela de procedimentos). */
export async function listPrecificacoesProcedimentos(
  tenantId: string
): Promise<Map<string, PrecificacaoProcedimento>> {
  const snap = await getDocs(collection(db, 'tenants', tenantId, 'precificacao_procedimentos'));
  const porSolicitacao = new Map<string, PrecificacaoProcedimento>();
  for (const d of snap.docs) {
    const data = d.data() as PrecificacaoProcedimento;
    porSolicitacao.set(d.id, { ...data, markup: normalizarParametrosMarkup(data.markup) });
  }
  return porSolicitacao;
}

/**
 * Sobrescreve o snapshot (edição refaz o registro). Não captura erro: quem
 * chama decide o best-effort — a solicitação nunca deixa de ser gravada por
 * causa da precificação.
 */
export async function salvarPrecificacaoProcedimento(
  tenantId: string,
  userId: string,
  snapshot: SnapshotPrecificacao
): Promise<void> {
  await setDoc(ref(tenantId, snapshot.solicitacao_id), {
    ...snapshot,
    gravado_em: Timestamp.now(),
    gravado_por: userId,
  });
}
