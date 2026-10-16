/**
 * Regras puras da incorporação automática de produtos pendentes de NF-e
 * (BUGFIX-identidade-e-duplicidade-nfe): quando um produto do catálogo master
 * fica ativo, as linhas pendentes desse código entram no inventário das
 * clínicas. Zero import de Firestore.
 *
 * ESPELHO MANUAL em functions/src/nfPendingResolutionRules.ts — o deploy de
 * functions/ empacota só functions/src, então as Cloud Functions não podem
 * importar daqui. Qualquer mudança neste arquivo precisa ser replicada lá
 * (o teste de paridade em src/__tests__/nfPendingResolutionRules.test.ts
 * compara os dois).
 */

/** Mesma normalização de nfIdentity.normalizeLeadingZeros: '0012345' → '12345'; '000' → '0'. */
export function normalizeCodigo(raw: unknown): string {
  const texto = typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : '';
  if (texto === '') return '';
  const semZeros = texto.replace(/^0+/, '');
  return semZeros === '' ? '0' : semZeros;
}

/**
 * Decide se a escrita em master_products deve disparar a incorporação.
 * Devolve o código normalizado a resolver, ou null.
 */
export function shouldResolvePendingForProduct(
  before: { code?: unknown; active?: unknown } | null,
  after: { code?: unknown; active?: unknown } | null
): string | null {
  if (!after || after.active !== true) return null;
  const codigo = normalizeCodigo(after.code);
  if (!codigo) return null;
  if (!before || before.active !== true) return codigo;
  if (normalizeCodigo(before.code) !== codigo) return codigo;
  return null;
}

export interface PendingLineInput {
  id: string;
  codigo: string;
  nome_produto: string;
  lote: string;
  quantidade: number; // como na NF (embalagens, se fragmentável)
  valor_unitario: number; // como na NF (por embalagem, se fragmentável)
}

export interface PendingResolutionLine {
  pendingId: string;
  quantidade: number; // unidades
  valor_unitario: number; // por unidade
  quantidade_embalagens?: number;
  valor_por_embalagem?: number;
}

/** Mesmo cálculo de calcularQuantidadeInventario (src/lib/inventoryQuantity.ts). */
export function planPendingResolution(
  pendings: PendingLineInput[],
  master: { fragmentavel?: boolean; unidades_por_embalagem?: number }
): PendingResolutionLine[] {
  const unidades = master.unidades_por_embalagem;
  const fragmenta = master.fragmentavel === true && !!unidades;
  return pendings.map((p) =>
    fragmenta
      ? {
          pendingId: p.id,
          quantidade: p.quantidade * (unidades as number),
          valor_unitario: p.valor_unitario / (unidades as number),
          quantidade_embalagens: p.quantidade,
          valor_por_embalagem: p.valor_unitario,
        }
      : { pendingId: p.id, quantidade: p.quantidade, valor_unitario: p.valor_unitario }
  );
}

/** 2 escritas por linha (inventário + pendência) + registro + notificação ≤ 500. */
export const MAX_PENDING_PER_TRANSACTION = 248;

export function chunkPendingLines<T>(
  lines: T[],
  size: number = MAX_PENDING_PER_TRANSACTION
): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < lines.length; i += size) blocos.push(lines.slice(i, i + size));
  return blocos;
}

/**
 * Remove de produtos_pendentes do registro uma ocorrência de cada linha
 * resolvida (par código + lote); linhas repetidas na NF saem uma a uma.
 */
export function removeResolvedPendentes<T extends { codigo: string; lote: string }>(
  pendentes: T[],
  resolvidos: Array<{ codigo: string; lote: string }>
): T[] {
  const restantes = [...pendentes];
  for (const r of resolvidos) {
    const i = restantes.findIndex((p) => p.codigo === r.codigo && p.lote === r.lote);
    if (i >= 0) restantes.splice(i, 1);
  }
  return restantes;
}

export function buildPendingResolvedMessage(importId: string, productNames: string[]): string {
  const nomes = Array.from(new Set(productNames));
  if (nomes.length === 1) {
    return `A NF (ID ${importId}) foi atualizada: o produto ${nomes[0]} foi adicionado ao inventário automaticamente.`;
  }
  return `A NF (ID ${importId}) foi atualizada: os produtos ${nomes.join(', ')} foram adicionados ao inventário automaticamente.`;
}
