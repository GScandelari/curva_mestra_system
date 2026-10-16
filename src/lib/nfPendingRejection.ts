/**
 * Recusa de pendência de catálogo pelo system_admin — regras puras
 * (FEAT-pendencias-nfe-fora-padrao-manual-recusa-checagem). A transação fica
 * em src/lib/services/pendingRejectionServer.ts.
 */

import { removeResolvedPendentes } from '@/lib/nfPendingResolutionRules';
import type { NFProdutoPendente, NFProdutoRecusado } from '@/types/nf';

export const REJECT_REASON_MIN = 5;
export const REJECT_REASON_MAX = 500;

export function validateRejectReason(
  raw: unknown
): { ok: true; motivo: string } | { ok: false; error: string } {
  const motivo = typeof raw === 'string' ? raw.trim() : '';
  if (motivo.length < REJECT_REASON_MIN || motivo.length > REJECT_REASON_MAX) {
    return {
      ok: false,
      error: `Informe o motivo da recusa (${REJECT_REASON_MIN} a ${REJECT_REASON_MAX} caracteres).`,
    };
  }
  return { ok: true, motivo };
}

/**
 * Efeito da recusa no registro da NF: remove UMA ocorrência (código + lote) de
 * produtos_pendentes, acrescenta o item a produtos_recusados e recalcula o
 * status (pendente só enquanto restar pendência aberta).
 */
export function applyRejectionToImport(
  nf: { produtos_pendentes?: NFProdutoPendente[]; produtos_recusados?: NFProdutoRecusado[] },
  pendente: { codigo: string; nome_produto: string; lote: string },
  motivo: string,
  recusadoEm: Date
): {
  produtos_pendentes: NFProdutoPendente[];
  produtos_recusados: NFProdutoRecusado[];
  status: 'success' | 'novo_produto_pendente';
} {
  const produtos_pendentes = removeResolvedPendentes(nf.produtos_pendentes ?? [], [pendente]);
  const produtos_recusados: NFProdutoRecusado[] = [
    ...(nf.produtos_recusados ?? []),
    {
      codigo: pendente.codigo,
      nome_produto: pendente.nome_produto,
      lote: pendente.lote,
      motivo,
      recusado_em: recusadoEm,
    },
  ];
  return {
    produtos_pendentes,
    produtos_recusados,
    status: produtos_pendentes.length > 0 ? 'novo_produto_pendente' : 'success',
  };
}

export function buildPendingRejectedMessage(
  nomeProduto: string,
  importId: string,
  motivo: string
): string {
  return `O produto ${nomeProduto} da NF (ID ${importId}) não foi cadastrado no catálogo. Motivo: ${motivo}`;
}
