/**
 * Planejador puro da confirmação de NF-e (BUGFIX-identidade-e-duplicidade-nfe).
 * Decide, sem tocar no banco, o que a transação da rota de confirmação grava:
 * o próximo ID legível, se a identidade cria/complementa/bloqueia (RN-02) e
 * quais linhas do XML ou do lançamento manual entram no estoque ou viram
 * pendência de catálogo (FEAT-pendencias-nfe-fora-padrao-manual-recusa-checagem:
 * código fora do padrão, pendência manual e complemento após recusa).
 */

import { calcularQuantidadeInventario } from '@/lib/inventoryQuantity';
import { formatImportId, formatNFLabel } from '@/lib/nfIdentity';
import { isCatalogProductCode } from '@/types/masterProduct';
import type { ManualNfProductInput, NFIdentity, NFOrigem, NFProduct } from '@/types/nf';

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
 * Matriz de duplicidade: (1) identidade nova → cria; (2) registro manual →
 * manual complementa o mesmo ID, XML bloqueado; (3) registro XML → bloqueado,
 * exceto manual quando o registro tem item recusado (complementa o mesmo ID,
 * para relançar o item recusado). Usada pela transação e pela checagem
 * antecipada (mesmos textos).
 */
export function evaluateIdentityConflict(
  attempt: NFOrigem,
  existing: {
    nf_import_id: string;
    origem: NFOrigem;
    hasPending?: boolean;
    hasRejected?: boolean;
  } | null
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
    if (existing.hasRejected) return { action: 'complement', nfImportId: existing.nf_import_id };
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

/** Mensagem do aviso de complemento (checagem antecipada do lançamento manual). */
export function buildComplementNotice(importId: string, origem: NFOrigem): string {
  const id = formatImportId(importId);
  if (origem === 'xml') {
    return `Esta NF foi importada via XML (${id}) e tem produto(s) recusado(s). Os produtos que você adicionar serão incluídos nesse mesmo ID.`;
  }
  return `Esta NF já tem lançamento (${id}). Os produtos que você adicionar serão incluídos nesse mesmo ID.`;
}

export interface PlannedInventoryLine {
  linha: number;
  produto: NFProduct;
  master: MasterLite;
  quantidade: number;
  valor_unitario: number;
}

export interface PlannedPendingLine {
  linha: number;
  produto: NFProduct;
  fora_do_padrao: boolean;
}

/** Códigos (distintos, na ordem da NF) fora do padrão do catálogo. */
export function listOutOfPatternCodes(produtos: Array<{ codigo: string }>): string[] {
  const vistos = new Set<string>();
  for (const { codigo } of produtos) {
    if (!isCatalogProductCode(codigo)) vistos.add(codigo);
  }
  return Array.from(vistos);
}

/** Há pendência que a incorporação automática ainda pode resolver? (ignora fora do padrão) */
export function hasResolvablePending(
  pendentes: Array<{ fora_do_padrao?: boolean }> | undefined
): boolean {
  return (pendentes ?? []).some((p) => p.fora_do_padrao !== true);
}

/**
 * Linha com código fora do padrão → pendência marcada (sem consultar o
 * catálogo); produto ausente ou inativo → pendência comum; os demais entram
 * no estoque.
 */
export function planXmlLines(
  produtos: NFProduct[],
  mastersByCode: Map<string, MasterLite>
): { inventory: PlannedInventoryLine[]; pending: PlannedPendingLine[] } {
  const inventory: PlannedInventoryLine[] = [];
  const pending: PlannedPendingLine[] = [];

  produtos.forEach((produto, linha) => {
    if (!isCatalogProductCode(produto.codigo)) {
      pending.push({ linha, produto, fora_do_padrao: true });
      return;
    }
    const master = mastersByCode.get(produto.codigo);
    if (!master || !master.active) {
      pending.push({ linha, produto, fora_do_padrao: false });
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

export interface PlannedManualInventoryLine {
  linha: number;
  produto: ManualNfProductInput;
  master?: MasterLite;
  quantidade: number;
  valor_unitario: number;
}

/**
 * Lançamento manual: "Outras marcas" entra sempre no estoque (valores como
 * informados). Rennova: produto ativo no catálogo → estoque (fragmentação do
 * catálogo); código fora do padrão → 400 (o client deveria ter bloqueado);
 * sem produto ativo (ausente ou inativo) → pendência, com quantidade e valor
 * como informados (a incorporação converte pela regra do catálogo).
 */
export function planManualLines(
  tipo: 'rennova' | 'outra_marca',
  produtos: ManualNfProductInput[],
  mastersByCode: Map<string, MasterLite>
):
  | {
      ok: true;
      inventory: PlannedManualInventoryLine[];
      pending: Array<{ linha: number; produto: ManualNfProductInput }>;
    }
  | { ok: false; status: 400 | 422; error: string } {
  const inventory: PlannedManualInventoryLine[] = [];
  const pending: Array<{ linha: number; produto: ManualNfProductInput }> = [];

  for (let linha = 0; linha < produtos.length; linha++) {
    const produto = produtos[linha];
    if (tipo === 'outra_marca') {
      inventory.push({
        linha,
        produto,
        quantidade: produto.quantidade,
        valor_unitario: produto.valor_unitario,
      });
      continue;
    }
    if (!isCatalogProductCode(produto.codigo)) {
      return {
        ok: false,
        status: 400,
        error: `Produto ${linha + 1}: código inválido (use de 5 a 8 dígitos numéricos).`,
      };
    }
    const master = mastersByCode.get(produto.codigo);
    if (!master?.active) {
      pending.push({ linha, produto });
      continue;
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
  }

  return { ok: true, inventory, pending };
}

const MAX_CODIGOS_NA_MENSAGEM = 10;

function listaCodigos(codigos: string[]): string {
  if (codigos.length <= MAX_CODIGOS_NA_MENSAGEM) return codigos.join(', ');
  const resto = codigos.length - MAX_CODIGOS_NA_MENSAGEM;
  return `${codigos.slice(0, MAX_CODIGOS_NA_MENSAGEM).join(', ')} e mais ${resto}`;
}

/** Texto do alerta do system_admin para uma importação/lançamento com pendência. */
export function buildPendingAdminAlertMessage(p: {
  tenantName: string;
  origem: NFOrigem;
  importId: string;
  identity: NFIdentity;
  codigosPendentes: string[];
  codigosForaPadrao: string[];
}): string {
  const acao = p.origem === 'xml' ? 'importou via XML' : 'lançou manualmente';
  const partes: string[] = [];
  if (p.codigosPendentes.length > 0) {
    partes.push(
      `${p.codigosPendentes.length} produto(s) fora do catálogo (${listaCodigos(p.codigosPendentes)})`
    );
  }
  if (p.codigosForaPadrao.length > 0) {
    partes.push(
      `${p.codigosForaPadrao.length} código(s) fora do padrão (${listaCodigos(p.codigosForaPadrao)})`
    );
  }
  return `${p.tenantName} ${acao} a ${formatNFLabel(p.identity)} (${formatImportId(p.importId)}): ${partes.join(' e ')}.`;
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
