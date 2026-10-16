/**
 * Pendências de NF-e com código fora do padrão do catálogo (5 a 8 dígitos):
 * identificação e agrupamento por código para a seção "Códigos fora do
 * padrão" de /admin/pending-products. Puro, sem Firestore.
 */

import { isCatalogProductCode } from '@/types/masterProduct';
import type { PendingMasterProduct } from '@/types/pendingMasterProduct';

/**
 * Pela flag gravada na importação ou pelo formato — pendências anteriores à
 * flag também caem na seção certa.
 */
export function isOutOfPatternPending(p: { codigo: string; fora_do_padrao?: boolean }): boolean {
  return p.fora_do_padrao === true || !isCatalogProductCode(p.codigo);
}

export interface OutOfPatternGroup<T> {
  codigo: string;
  descricoes: string[]; // nomes distintos vindos das NF-e
  clinicas: string[]; // nomes distintos das clínicas
  ocorrencias: T[]; // mais recente primeiro
}

function quando(v: unknown): number {
  if (v instanceof Date) return v.getTime();
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

/** Agrupa por código; grupos ordenados pela ocorrência mais recente. */
export function groupOutOfPatternPendings<T extends PendingMasterProduct & { tenant_nome: string }>(
  rows: T[]
): Array<OutOfPatternGroup<T>> {
  const porCodigo = new Map<string, T[]>();
  for (const row of rows) {
    const lista = porCodigo.get(row.codigo) ?? [];
    lista.push(row);
    porCodigo.set(row.codigo, lista);
  }

  const grupos = Array.from(porCodigo.entries()).map(([codigo, lista]) => {
    const ocorrencias = [...lista].sort((a, b) => quando(b.created_at) - quando(a.created_at));
    return {
      codigo,
      descricoes: Array.from(new Set(ocorrencias.map((o) => o.nome_produto))),
      clinicas: Array.from(new Set(ocorrencias.map((o) => o.tenant_nome))),
      ocorrencias,
    };
  });

  return grupos.sort(
    (a, b) => quando(b.ocorrencias[0].created_at) - quando(a.ocorrencias[0].created_at)
  );
}
