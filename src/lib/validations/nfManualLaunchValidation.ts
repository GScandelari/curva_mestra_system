/**
 * Validação pura do corpo de POST /api/nf-imports/manual (UC-11): identidade
 * da nota (CNPJ + série + número, chave opcional) e produtos.
 */

import { validateManualIdentity } from '@/lib/nfIdentity';
import type { NFIdentity } from '@/types/nf';
import type { ManualNfProductInput } from '@/types/nf';

export interface ManualLaunchRequestValid {
  identity: NFIdentity;
  chave_acesso?: string;
  tipo: 'rennova' | 'outra_marca';
  produtos: ManualNfProductInput[];
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function dataValida(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [ano, mes, dia] = v.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
  );
}

function validarProduto(
  raw: unknown,
  indice: number
): { ok: true; produto: ManualNfProductInput } | { ok: false; error: string } {
  const p = (raw ?? {}) as Record<string, unknown>;
  const item = `Produto ${indice + 1}`;
  const codigo = texto(p.codigo);
  const nome = texto(p.nome_produto);
  const lote = texto(p.lote);
  const dtValidade = texto(p.dt_validade);
  if (!codigo || !nome || !lote)
    return { ok: false, error: `${item}: código, nome e lote são obrigatórios` };
  if (typeof p.quantidade !== 'number' || !Number.isFinite(p.quantidade) || p.quantidade <= 0) {
    return { ok: false, error: `${item}: quantidade deve ser maior que zero` };
  }
  if (
    typeof p.valor_unitario !== 'number' ||
    !Number.isFinite(p.valor_unitario) ||
    p.valor_unitario < 0
  ) {
    return { ok: false, error: `${item}: valor unitário inválido` };
  }
  if (!dataValida(dtValidade)) return { ok: false, error: `${item}: data de validade inválida` };
  return {
    ok: true,
    produto: {
      codigo,
      nome_produto: nome,
      lote,
      quantidade: p.quantidade,
      valor_unitario: p.valor_unitario,
      dt_validade: dtValidade,
      ...(texto(p.brand) ? { brand: texto(p.brand) } : {}),
      ...(texto(p.category) ? { category: texto(p.category) } : {}),
    },
  };
}

export function validateManualLaunchRequest(
  body: unknown
): { ok: true; value: ManualLaunchRequestValid } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const identidade = validateManualIdentity({
    numero: texto(b.numero),
    cnpj: texto(b.cnpj),
    serie: texto(b.serie),
    chave: texto(b.chave_acesso) || undefined,
  });
  if (!identidade.ok) return { ok: false, error: identidade.error };

  if (b.tipo !== 'rennova' && b.tipo !== 'outra_marca') {
    return { ok: false, error: 'Tipo da nota inválido' };
  }
  if (!Array.isArray(b.produtos) || b.produtos.length === 0) {
    return { ok: false, error: 'Adicione ao menos um produto' };
  }

  const produtos: ManualNfProductInput[] = [];
  for (let i = 0; i < b.produtos.length; i++) {
    const r = validarProduto(b.produtos[i], i);
    if (!r.ok) return r;
    produtos.push(r.produto);
  }

  return {
    ok: true,
    value: {
      identity: identidade.identity,
      ...(identidade.chave_acesso ? { chave_acesso: identidade.chave_acesso } : {}),
      tipo: b.tipo,
      produtos,
    },
  };
}
