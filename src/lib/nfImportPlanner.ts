/**
 * Planejador puro da confirmação de NF-e (BUGFIX-identidade-e-duplicidade-nfe).
 * Decide, sem tocar no banco, o que a transação da rota de confirmação grava:
 * o próximo ID legível, se a identidade cria/complementa/bloqueia (RN-02) e
 * quais linhas do XML entram no estoque ou viram pendência de catálogo.
 */

import { calcularQuantidadeInventario } from '@/lib/inventoryQuantity';
import { formatImportId } from '@/lib/nfIdentity';
import type { NFOrigem, NFProduct } from '@/types/nf';

export const NF_IMPORT_FIRST_ID = 1000;
export const MAX_TRANSACTION_WRITES = 500;

/** Próximo ID sequencial da clínica: começa em 1000. */
export function nextImportId(ultimoId: number | undefined | null): number {
  if (typeof ultimoId !== 'number' || !Number.isFinite(ultimoId)) return NF_IMPORT_FIRST_ID;
  return Math.max(Math.floor(ultimoId) + 1, NF_IMPORT_FIRST_ID);
}

export type IdentityConflictDecision =
  | { action: 'create' }
  | { action: 'complement'; nfImportId: string }
  | { action: 'blocked'; status: 409; nfImportId: string; reason: string };

const MENSAGEM_PENDENTES =
  ' Os produtos pendentes desta NF serão adicionados automaticamente quando cadastrados no catálogo.';

/**
 * RN-02: (1) identidade nova → cria; (2) registro manual → manual complementa o
 * mesmo ID, XML bloqueado; (3) registro XML → tudo bloqueado.
 */
export function evaluateIdentityConflict(
  attempt: NFOrigem,
  existing: { nf_import_id: string; origem: NFOrigem; hasPending?: boolean } | null
): IdentityConflictDecision {
  if (!existing) return { action: 'create' };
  const id = formatImportId(existing.nf_import_id);

  if (existing.origem === 'manual') {
    if (attempt === 'manual') return { action: 'complement', nfImportId: existing.nf_import_id };
    return {
      action: 'blocked',
      status: 409,
      nfImportId: existing.nf_import_id,
      reason: `Esta NF já foi cadastrada manualmente (${id}) e não pode ser importada via XML.`,
    };
  }

  if (attempt === 'manual') {
    return {
      action: 'blocked',
      status: 409,
      nfImportId: existing.nf_import_id,
      reason: `Esta NF já foi importada via XML (${id}) e não aceita lançamento manual.`,
    };
  }
  return {
    action: 'blocked',
    status: 409,
    nfImportId: existing.nf_import_id,
    reason: `Esta NF já foi cadastrada (${id}).${existing.hasPending ? MENSAGEM_PENDENTES : ''}`,
  };
}

export interface MasterLite {
  id: string;
  code: string;
  active: boolean;
  category?: string;
  fragmentavel?: boolean;
  unidades_por_embalagem?: number;
}

export interface PlannedInventoryLine {
  linha: number;
  produto: NFProduct;
  master: MasterLite;
  quantidade: number;
  valor_unitario: number;
}

/** Produto ausente ou inativo no catálogo → pendência; os demais entram no estoque. */
export function planXmlLines(
  produtos: NFProduct[],
  mastersByCode: Map<string, MasterLite>
): { inventory: PlannedInventoryLine[]; pending: Array<{ linha: number; produto: NFProduct }> } {
  const inventory: PlannedInventoryLine[] = [];
  const pending: Array<{ linha: number; produto: NFProduct }> = [];

  produtos.forEach((produto, linha) => {
    const master = mastersByCode.get(produto.codigo);
    if (!master || !master.active) {
      pending.push({ linha, produto });
      return;
    }
    const calculo = calcularQuantidadeInventario({
      quantidadeInformada: produto.quantidade,
      fragmentavel: master.fragmentavel === true,
      unidadesPorEmbalagem: master.unidades_por_embalagem,
      valorInformado: produto.valor_unitario,
    });
    inventory.push({
      linha,
      produto,
      master,
      quantidade: calculo.quantidade_inicial,
      valor_unitario: calculo.valor_unitario,
    });
  });

  return { inventory, pending };
}

/**
 * Uma transação do Firestore aceita até 500 escritas: `fixedWrites` cobre
 * identidade, contador e registro; `lineWrites`, uma escrita por linha.
 */
export function checkWriteBudget(
  fixedWrites: number,
  lineWrites: number
): { ok: true } | { ok: false; status: 422; error: string } {
  if (fixedWrites + lineWrites <= MAX_TRANSACTION_WRITES) return { ok: true };
  return {
    ok: false,
    status: 422,
    error: `Esta NF-e tem ${lineWrites} itens; o limite por importação é ${MAX_TRANSACTION_WRITES - fixedWrites}.`,
  };
}

/** Mesma checagem para o lançamento manual, sugerindo dividir em complementos. */
export function checkManualWriteBudget(
  fixedWrites: number,
  lineWrites: number
): { ok: true } | { ok: false; status: 422; error: string } {
  const result = checkWriteBudget(fixedWrites, lineWrites);
  if (result.ok) return result;
  return {
    ...result,
    error: `${result.error} Divida o lançamento: os complementos mantêm o mesmo ID.`,
  };
}
