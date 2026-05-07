/**
 * Inventory Service
 * Gerencia o inventário de produtos de uma clínica (tenant)
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface InventoryItem {
  id: string;
  tenant_id: string;
  produto_id: string;
  codigo_produto: string;
  nome_produto: string;
  lote: string;
  quantidade_inicial: number;
  quantidade_disponivel: number;
  quantidade_reservada?: number;
  dt_validade: Date;
  dt_entrada: Date;
  valor_unitario: number; // sempre por UNIDADE (não por embalagem)
  nf_numero?: string;
  nf_id?: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
  category?: string; // categoria do master product (desnormalizada para filtros)
  // Campos de fragmentação (presentes apenas em produtos fragmentáveis)
  fragmentavel?: boolean;
  unidades_por_embalagem?: number;
  quantidade_embalagens?: number; // auditoria: quantas embalagens foram compradas
  valor_por_embalagem?: number; // auditoria: valor original por embalagem
}

// ============================================================================
// HELPER DE CÁLCULO DE INVENTÁRIO (FRAGMENTAÇÃO)
// ============================================================================

export interface CalcInventarioParams {
  quantidadeInformada: number; // embalagens (se fragmentável) ou unidades
  fragmentavel: boolean;
  unidadesPorEmbalagem?: number;
  valorInformado: number; // por embalagem (se fragmentável) ou por unidade
}

export interface CalcInventarioResult {
  quantidade_inicial: number; // sempre em unidades
  valor_unitario: number; // sempre por unidade
}

/**
 * Calcula quantidade_inicial e valor_unitario para entrada de inventário.
 * Para produtos fragmentáveis, converte embalagens → unidades e distribui o valor.
 * Para não fragmentáveis, retorna os valores informados sem alteração.
 */
export function calcularQuantidadeInventario(params: CalcInventarioParams): CalcInventarioResult {
  const { quantidadeInformada, fragmentavel, unidadesPorEmbalagem, valorInformado } = params;

  if (!fragmentavel || !unidadesPorEmbalagem) {
    return {
      quantidade_inicial: quantidadeInformada,
      valor_unitario: valorInformado,
    };
  }

  return {
    quantidade_inicial: quantidadeInformada * unidadesPorEmbalagem,
    valor_unitario: valorInformado / unidadesPorEmbalagem,
  };
}

export interface InventoryStats {
  totalProdutos: number;
  totalValor: number;
  produtosVencendo30dias: number;
  produtosVencidos: number;
  produtosEstoqueBaixo: number;
  ultimaAtualizacao: Date;
}

export interface ExpiringProduct {
  id: string;
  nome_produto: string;
  lote: string;
  quantidade_disponivel: number;
  dt_validade: Date;
  diasParaVencer: number;
}

export interface RecentActivity {
  id: string;
  tipo: 'entrada' | 'saida' | 'ajuste';
  descricao: string;
  nome_produto: string;
  quantidade: number;
  timestamp: Date;
  usuario?: string;
}

/**
 * Busca estatísticas gerais do inventário
 */
export async function getInventoryStats(tenantId: string): Promise<InventoryStats> {
  try {
    const inventoryRef = collection(db, 'tenants', tenantId, 'inventory');

    // Buscar todos os produtos ativos
    const q = query(inventoryRef, where('active', '==', true));
    const snapshot = await getDocs(q);

    let totalProdutos = 0;
    let totalValor = 0;
    let produtosVencendo30dias = 0;
    let produtosVencidos = 0;
    let produtosEstoqueBaixo = 0;

    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(now.getDate() + 30);

    snapshot.forEach((doc) => {
      const data = doc.data();
      const quantidade = data.quantidade_disponivel || 0;

      if (quantidade > 0) {
        totalProdutos += quantidade;
        totalValor += quantidade * (data.valor_unitario || 0);

        // Verificar vencimento
        const dtValidade =
          data.dt_validade instanceof Timestamp
            ? data.dt_validade.toDate()
            : new Date(data.dt_validade);

        if (dtValidade < now) {
          produtosVencidos++;
        } else if (dtValidade <= in30Days) {
          produtosVencendo30dias++;
        }

        if (quantidade <= 10) {
          produtosEstoqueBaixo++;
        }
      }
    });

    return {
      totalProdutos,
      totalValor,
      produtosVencendo30dias,
      produtosVencidos,
      produtosEstoqueBaixo,
      ultimaAtualizacao: new Date(),
    };
  } catch (error) {
    console.error('Erro ao buscar estatísticas do inventário:', error);
    throw error;
  }
}

/**
 * Busca produtos próximos ao vencimento
 */
export async function getExpiringProducts(
  tenantId: string,
  daysThreshold: number = 30,
  limitResults: number = 10
): Promise<ExpiringProduct[]> {
  try {
    const inventoryRef = collection(db, 'tenants', tenantId, 'inventory');

    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() + daysThreshold);

    const q = query(
      inventoryRef,
      where('active', '==', true),
      where('quantidade_disponivel', '>', 0),
      orderBy('dt_validade', 'asc'),
      limit(limitResults)
    );

    const snapshot = await getDocs(q);
    const products: ExpiringProduct[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const dtValidade =
        data.dt_validade instanceof Timestamp
          ? data.dt_validade.toDate()
          : new Date(data.dt_validade);

      // Só incluir se estiver dentro do threshold
      if (dtValidade <= thresholdDate) {
        const diasParaVencer = Math.ceil(
          (dtValidade.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        products.push({
          id: doc.id,
          nome_produto: data.nome_produto,
          lote: data.lote,
          quantidade_disponivel: data.quantidade_disponivel,
          dt_validade: dtValidade,
          diasParaVencer,
        });
      }
    });

    return products;
  } catch (error) {
    console.error('Erro ao buscar produtos vencendo:', error);
    throw error;
  }
}

/**
 * Busca atividades recentes do inventário
 */
export async function getRecentActivity(
  tenantId: string,
  limitResults: number = 10
): Promise<RecentActivity[]> {
  try {
    const activityRef = collection(db, 'tenants', tenantId, 'inventory_activity');

    const q = query(activityRef, orderBy('timestamp', 'desc'), limit(limitResults));

    const snapshot = await getDocs(q);
    const activities: RecentActivity[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      activities.push({
        id: doc.id,
        tipo: data.tipo,
        descricao: data.descricao,
        nome_produto: data.nome_produto,
        quantidade: data.quantidade,
        timestamp:
          data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
        usuario: data.usuario,
      });
    });

    return activities;
  } catch (error) {
    console.error('Erro ao buscar atividades recentes:', error);
    // Retornar array vazio se a coleção não existir ainda
    return [];
  }
}

/**
 * Busca lista completa do inventário
 */
export async function listInventory(
  tenantId: string,
  activeOnly: boolean = true
): Promise<InventoryItem[]> {
  try {
    const inventoryRef = collection(db, 'tenants', tenantId, 'inventory');

    let q = query(inventoryRef, orderBy('nome_produto', 'asc'));

    if (activeOnly) {
      q = query(inventoryRef, where('active', '==', true), orderBy('nome_produto', 'asc'));
    }

    const snapshot = await getDocs(q);
    const items: InventoryItem[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      items.push({
        id: doc.id,
        tenant_id: data.tenant_id,
        produto_id: data.produto_id,
        codigo_produto: data.codigo_produto,
        nome_produto: data.nome_produto,
        lote: data.lote,
        quantidade_inicial: data.quantidade_inicial,
        quantidade_disponivel: data.quantidade_disponivel,
        quantidade_reservada: data.quantidade_reservada,
        dt_validade:
          data.dt_validade instanceof Timestamp
            ? data.dt_validade.toDate()
            : new Date(data.dt_validade),
        dt_entrada:
          data.dt_entrada instanceof Timestamp
            ? data.dt_entrada.toDate()
            : new Date(data.dt_entrada),
        valor_unitario: data.valor_unitario,
        nf_numero: data.nf_numero,
        nf_id: data.nf_id,
        active: data.active,
        created_at:
          data.created_at instanceof Timestamp
            ? data.created_at.toDate()
            : new Date(data.created_at),
        updated_at:
          data.updated_at instanceof Timestamp
            ? data.updated_at.toDate()
            : new Date(data.updated_at),
      });
    });

    return items;
  } catch (error) {
    console.error('Erro ao listar inventário:', error);
    throw error;
  }
}

/**
 * Busca item específico do inventário
 */
export async function getInventoryItem(
  tenantId: string,
  itemId: string
): Promise<InventoryItem | null> {
  try {
    const itemRef = doc(db, 'tenants', tenantId, 'inventory', itemId);
    const snapshot = await getDoc(itemRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return {
      id: snapshot.id,
      tenant_id: data.tenant_id,
      produto_id: data.produto_id,
      codigo_produto: data.codigo_produto,
      nome_produto: data.nome_produto,
      lote: data.lote,
      quantidade_inicial: data.quantidade_inicial,
      quantidade_disponivel: data.quantidade_disponivel,
      quantidade_reservada: data.quantidade_reservada,
      dt_validade:
        data.dt_validade instanceof Timestamp
          ? data.dt_validade.toDate()
          : new Date(data.dt_validade),
      dt_entrada:
        data.dt_entrada instanceof Timestamp ? data.dt_entrada.toDate() : new Date(data.dt_entrada),
      valor_unitario: data.valor_unitario,
      nf_numero: data.nf_numero,
      nf_id: data.nf_id,
      active: data.active,
      created_at:
        data.created_at instanceof Timestamp ? data.created_at.toDate() : new Date(data.created_at),
      updated_at:
        data.updated_at instanceof Timestamp ? data.updated_at.toDate() : new Date(data.updated_at),
      category: data.category as string | undefined,
      fragmentavel: data.fragmentavel as boolean | undefined,
      unidades_por_embalagem: data.unidades_por_embalagem as number | undefined,
      quantidade_embalagens: data.quantidade_embalagens as number | undefined,
      valor_por_embalagem: data.valor_por_embalagem as number | undefined,
    };
  } catch (error) {
    console.error('Erro ao buscar item do inventário:', error);
    throw error;
  }
}

/**
 * Retorna um Map<codigo_produto, limite_estoque_baixo> para o tenant.
 * Lê de tenants/{tenantId}/stock_limits/{codigo_produto}.
 */
export async function getStockLimitsMap(tenantId: string): Promise<Map<string, number>> {
  const limitsRef = collection(db, 'tenants', tenantId, 'stock_limits');
  const snapshot = await getDocs(limitsRef);
  const map = new Map<string, number>();
  snapshot.forEach((d) => {
    map.set(d.id, d.data().limite_estoque_baixo as number);
  });
  return map;
}

/**
 * Persiste o limite de estoque baixo de um produto (por codigo_produto).
 */
export async function updateStockLimit(
  tenantId: string,
  codigoProduto: string,
  limiteEstoqueBaixo: number
): Promise<void> {
  const limitRef = doc(db, 'tenants', tenantId, 'stock_limits', codigoProduto);
  await setDoc(limitRef, { limite_estoque_baixo: limiteEstoqueBaixo }, { merge: true });
}

// ============================================================================
// DESATIVAÇÃO (SOFT DELETE)
// ============================================================================

/**
 * Desativa um item sem reservas ativas (active = false).
 */
export async function deactivateInventoryItem(tenantId: string, itemId: string): Promise<void> {
  const itemRef = doc(db, 'tenants', tenantId, 'inventory', itemId);
  await updateDoc(itemRef, {
    active: false,
    updated_at: serverTimestamp(),
  });
}

// ============================================================================
// DESATIVAÇÃO FORÇADA (COM REDISTRIBUIÇÃO DE RESERVAS)
// ============================================================================

export interface ImpactedProcedimento {
  id: string;
  descricao?: string;
  dt_procedimento: Date;
  quantidade_reservada: number;
}

export interface ForceDeactivateResult {
  procedimentosAlterados: number;
  procedimentosCancelados: number;
}

/**
 * Retorna os procedimentos agendados que têm este item reservado.
 */
export async function checkInventoryItemReservations(
  tenantId: string,
  itemId: string
): Promise<ImpactedProcedimento[]> {
  const q = query(
    collection(db, 'tenants', tenantId, 'solicitacoes'),
    where('status', '==', 'agendada')
  );
  const snap = await getDocs(q);

  const impacted: ImpactedProcedimento[] = [];
  snap.docs.forEach((d) => {
    const data = d.data();
    const produtos = (data.produtos_solicitados ?? []) as Array<{
      inventory_item_id: string;
      quantidade: number;
    }>;
    const entry = produtos.find((p) => p.inventory_item_id === itemId);
    if (entry) {
      impacted.push({
        id: d.id,
        descricao: data.descricao as string | undefined,
        dt_procedimento:
          data.dt_procedimento instanceof Timestamp
            ? data.dt_procedimento.toDate()
            : new Date(data.dt_procedimento as string),
        quantidade_reservada: entry.quantidade,
      });
    }
  });

  return impacted;
}

/**
 * Desativa um item com reservas ativas redistribuindo-as para outros lotes do mesmo produto (FEFO).
 *
 * Para cada procedimento agendado que usa o item:
 * - Lotes alternativos disponíveis: substitui via FEFO. Se insuficientes, avisa
 *   "Produtos alterados - revisar antes de concluir".
 * - Sem lotes alternativos: remove o produto e avisa
 *   "{nome} (lote {X}) removido - revisar antes de concluir".
 * - Procedimento fica sem produtos: cancela com "Produtos indisponíveis".
 * Avisos são cumulativos no campo observacoes do procedimento.
 */
export async function forceDeactivateInventoryItem(
  tenantId: string,
  itemId: string
): Promise<ForceDeactivateResult> {
  const now = new Date();

  // ── 1. Gather data ──────────────────────────────────────────────────────────
  const itemRef = doc(db, 'tenants', tenantId, 'inventory', itemId);
  const itemSnap = await getDoc(itemRef);
  if (!itemSnap.exists()) throw new Error('Item não encontrado');

  const itemRaw = itemSnap.data();
  const codigoProduto = itemRaw.codigo_produto as string;
  const nomeProduto = itemRaw.nome_produto as string;
  const loteDeactivated = itemRaw.lote as string;
  const itemCurrentDisponivel = (itemRaw.quantidade_disponivel as number) || 0;
  const itemCurrentReservada = (itemRaw.quantidade_reservada as number) || 0;

  // Agendada solicitacoes
  const solSnap = await getDocs(
    query(collection(db, 'tenants', tenantId, 'solicitacoes'), where('status', '==', 'agendada'))
  );

  interface ProdutoRaw {
    inventory_item_id: string;
    produto_codigo: string;
    produto_nome: string;
    lote: string;
    quantidade: number;
    quantidade_disponivel_antes: number;
    valor_unitario: number;
  }

  interface SolRaw {
    id: string;
    descricao?: string;
    observacoes?: string;
    status_history?: unknown[];
    produtos_solicitados: ProdutoRaw[];
  }

  const impactedSols: SolRaw[] = [];
  solSnap.docs.forEach((d) => {
    const data = d.data() as Omit<SolRaw, 'id'>;
    if (data.produtos_solicitados?.some((p) => p.inventory_item_id === itemId)) {
      impactedSols.push({ id: d.id, ...data });
    }
  });

  // Alternative lots: same product, active, not expired, FEFO order
  const altSnap = await getDocs(
    query(
      collection(db, 'tenants', tenantId, 'inventory'),
      where('codigo_produto', '==', codigoProduto),
      where('active', '==', true),
      orderBy('dt_validade', 'asc')
    )
  );

  interface AltLot {
    id: string;
    lote: string;
    nome_produto: string;
    codigo_produto: string;
    quantidade_disponivel: number;
    quantidade_reservada: number;
    valor_unitario: number;
    dt_validade: Date;
  }

  const altLots: AltLot[] = altSnap.docs
    .filter((d) => d.id !== itemId)
    .map((d) => {
      const data = d.data();
      const dtVal =
        data.dt_validade instanceof Timestamp
          ? data.dt_validade.toDate()
          : new Date(data.dt_validade as string);
      return {
        id: d.id,
        lote: data.lote as string,
        nome_produto: data.nome_produto as string,
        codigo_produto: data.codigo_produto as string,
        quantidade_disponivel: (data.quantidade_disponivel as number) || 0,
        quantidade_reservada: (data.quantidade_reservada as number) || 0,
        valor_unitario: (data.valor_unitario as number) || 0,
        dt_validade: dtVal,
      };
    })
    .filter((l) => l.dt_validade > now);

  // ── 2. Pre-compute allocations ───────────────────────────────────────────────
  // runningAvailable tracks disponivel across procedures (mutable during allocation)
  const runningAvailable = new Map<string, number>(
    altLots.map((l) => [l.id, l.quantidade_disponivel])
  );

  interface ProcessedSol {
    sol: SolRaw;
    oldQty: number;
    newAllocations: Array<{ lotId: string; quantidade: number }>;
    newProdutos: ProdutoRaw[];
    warnings: string[];
    cancel: boolean;
  }

  const processed: ProcessedSol[] = [];

  for (const sol of impactedSols) {
    const entry = sol.produtos_solicitados.find((p) => p.inventory_item_id === itemId)!;
    const quantidadeNecessaria = entry.quantidade;

    const newAllocations: Array<{ lotId: string; quantidade: number }> = [];
    let quantidadeAlocada = 0;

    for (const altLot of altLots) {
      if (quantidadeAlocada >= quantidadeNecessaria) break;
      const disponivel = runningAvailable.get(altLot.id) ?? 0;
      if (disponivel <= 0) continue;
      const toTake = Math.min(disponivel, quantidadeNecessaria - quantidadeAlocada);
      newAllocations.push({ lotId: altLot.id, quantidade: toTake });
      runningAvailable.set(altLot.id, disponivel - toTake);
      quantidadeAlocada += toTake;
    }

    // Build merged produtos list (merges quantity if alt lot already in procedure)
    const otherProdutos = sol.produtos_solicitados.filter((p) => p.inventory_item_id !== itemId);
    const mergedMap = new Map<string, ProdutoRaw>(
      otherProdutos.map((p) => [p.inventory_item_id, { ...p }])
    );

    for (const alloc of newAllocations) {
      const altLot = altLots.find((l) => l.id === alloc.lotId)!;
      if (mergedMap.has(alloc.lotId)) {
        const existing = mergedMap.get(alloc.lotId)!;
        mergedMap.set(alloc.lotId, {
          ...existing,
          quantidade: existing.quantidade + alloc.quantidade,
        });
      } else {
        mergedMap.set(alloc.lotId, {
          inventory_item_id: alloc.lotId,
          produto_codigo: altLot.codigo_produto,
          produto_nome: altLot.nome_produto,
          lote: altLot.lote,
          quantidade: alloc.quantidade,
          quantidade_disponivel_antes: altLot.quantidade_disponivel,
          valor_unitario: altLot.valor_unitario,
        });
      }
    }

    const newProdutos = Array.from(mergedMap.values());

    const warnings: string[] = [];
    if (newAllocations.length === 0) {
      warnings.push(
        `${nomeProduto} (lote ${loteDeactivated}) removido - revisar antes de concluir`
      );
    } else if (quantidadeAlocada < quantidadeNecessaria) {
      warnings.push('Produtos alterados - revisar antes de concluir');
    }
    const cancel = newProdutos.length === 0;
    if (cancel) warnings.push('Produtos indisponíveis');

    processed.push({
      sol,
      oldQty: quantidadeNecessaria,
      newAllocations,
      newProdutos,
      warnings,
      cancel,
    });
  }

  // ── 3. Write batch ───────────────────────────────────────────────────────────
  const batch = writeBatch(db);
  const nowTs = Timestamp.now();

  // Deactivate old item and release its reservations
  const totalRelease = processed.reduce((sum, p) => sum + p.oldQty, 0);
  batch.update(itemRef, {
    active: false,
    quantidade_reservada: Math.max(0, itemCurrentReservada - totalRelease),
    quantidade_disponivel: Math.max(0, itemCurrentDisponivel + totalRelease),
    updated_at: nowTs,
  });

  // Update alternative lots that received new reservations
  for (const altLot of altLots) {
    const remaining = runningAvailable.get(altLot.id) ?? altLot.quantidade_disponivel;
    const allocated = altLot.quantidade_disponivel - remaining;
    if (allocated > 0) {
      batch.update(doc(db, 'tenants', tenantId, 'inventory', altLot.id), {
        quantidade_reservada: altLot.quantidade_reservada + allocated,
        quantidade_disponivel: remaining,
        updated_at: nowTs,
      });
    }
  }

  // Update solicitacoes
  let procedimentosAlterados = 0;
  let procedimentosCancelados = 0;

  for (const p of processed) {
    const solRef = doc(db, 'tenants', tenantId, 'solicitacoes', p.sol.id);
    const existingObs = p.sol.observacoes ?? '';
    const newObs =
      p.warnings.length > 0
        ? existingObs
          ? `${existingObs}\n${p.warnings.join('\n')}`
          : p.warnings.join('\n')
        : existingObs;

    if (p.cancel) {
      const statusHistory = [
        ...(p.sol.status_history ?? []),
        {
          status: 'cancelada',
          changed_by: 'system',
          changed_by_name: 'Sistema',
          changed_at: nowTs,
          observacao: 'Cancelado automaticamente: todos os produtos foram removidos do estoque',
        },
      ];
      batch.update(solRef, {
        status: 'cancelada',
        status_history: statusHistory,
        ...(newObs ? { observacoes: newObs } : {}),
        updated_at: nowTs,
      });
      procedimentosCancelados++;
    } else {
      batch.update(solRef, {
        produtos_solicitados: p.newProdutos,
        ...(newObs ? { observacoes: newObs } : {}),
        updated_at: nowTs,
      });
      procedimentosAlterados++;
    }
  }

  await batch.commit();

  return { procedimentosAlterados, procedimentosCancelados };
}

// ============================================================================
// INSERÇÃO EM LOTE (IMPORTAÇÃO XML NF-e)
// ============================================================================

export interface AddInventoryItemsParams {
  tenantId: string;
  nfNumero: string;
  nfId: string;
  items: Array<{
    produto_id: string;
    codigo_produto: string;
    nome_produto: string;
    lote: string;
    quantidade: number;
    dt_validade: Date;
    valor_unitario: number;
    category?: string;
    fragmentavel?: boolean;
    unidades_por_embalagem?: number;
    quantidade_embalagens?: number;
    valor_por_embalagem?: number;
  }>;
}

/**
 * Grava um lote de itens no inventário do tenant usando writeBatch para atomicidade.
 */
export async function addInventoryItems(params: AddInventoryItemsParams): Promise<void> {
  const { tenantId, nfNumero, nfId, items } = params;

  if (items.length === 0) return;

  const inventoryRef = collection(db, 'tenants', tenantId, 'inventory');
  const batch = writeBatch(db);

  for (const item of items) {
    const newDocRef = doc(inventoryRef);
    batch.set(newDocRef, {
      tenant_id: tenantId,
      produto_id: item.produto_id,
      codigo_produto: item.codigo_produto,
      nome_produto: item.nome_produto,
      lote: item.lote,
      quantidade_inicial: item.quantidade,
      quantidade_disponivel: item.quantidade,
      quantidade_reservada: 0,
      dt_validade: Timestamp.fromDate(item.dt_validade),
      dt_entrada: serverTimestamp(),
      valor_unitario: item.valor_unitario,
      nf_numero: nfNumero,
      nf_id: nfId,
      active: true,
      category: item.category ?? null,
      fragmentavel: item.fragmentavel ?? false,
      unidades_por_embalagem: item.unidades_por_embalagem ?? null,
      quantidade_embalagens: item.quantidade_embalagens ?? null,
      valor_por_embalagem: item.valor_por_embalagem ?? null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
  }

  await batch.commit();
}
