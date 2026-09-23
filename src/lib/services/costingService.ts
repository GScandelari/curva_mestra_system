/**
 * Costing Service
 * Motor de custeio por procedimento/produto (UC-51)
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ConsumptionRecord {
  codigo_produto: string;
  nome_produto: string;
  inventory_item_id: string;
  lote: string;
  quantidade: number;
  valor_unitario: number;
  solicitacao_id: string;
  dt_procedimento: Date;
}

export interface LoteDetalhe {
  inventory_item_id: string;
  lote: string;
  quantidade: number;
  valor_unitario: number;
  dt_entrada: Date | null;
}

export interface ProductCostSummary {
  codigo_produto: string;
  nome_produto: string;
  categoria: string;
  quantidade_consumida: number;
  custo_total: number;
  custo_unitario_medio: number;
  lotes_distintos: number;
  numero_procedimentos: number;
  ticket_medio_custo: number;
  lotes_detalhe: LoteDetalhe[];
}

export interface ProductCostMetadata {
  categoria: string;
  dtEntradaByInventoryItemId: Map<string, Date | null>;
}

export interface LotHistoryEvent {
  solicitacao_id: string;
  identificador_procedimento: string;
  dt_procedimento: Date;
  quantidade_consumida: number;
}

export interface LotHistoryEntry extends LotHistoryEvent {
  saldo_apos_evento: number;
}

// ============================================================================
// FUNÇÕES PURAS (RN-01 a RN-03)
// ============================================================================

export function calculateTicketMedioCusto(custoTotal: number, numeroProcedimentos: number): number {
  if (numeroProcedimentos === 0) return 0;
  return custoTotal / numeroProcedimentos;
}

function buildLotesDetalhe(
  records: ConsumptionRecord[],
  metadata: ProductCostMetadata | undefined
): LoteDetalhe[] {
  const porLote = new Map<string, { lote: string; quantidade: number; custoTotal: number }>();

  for (const record of records) {
    const existing = porLote.get(record.inventory_item_id);
    if (existing) {
      existing.quantidade += record.quantidade;
      existing.custoTotal += record.quantidade * record.valor_unitario;
    } else {
      porLote.set(record.inventory_item_id, {
        lote: record.lote,
        quantidade: record.quantidade,
        custoTotal: record.quantidade * record.valor_unitario,
      });
    }
  }

  const detalhes: LoteDetalhe[] = Array.from(porLote.entries()).map(
    ([inventoryItemId, { lote, quantidade, custoTotal }]) => ({
      inventory_item_id: inventoryItemId,
      lote,
      quantidade,
      valor_unitario: quantidade > 0 ? custoTotal / quantidade : 0,
      dt_entrada: metadata?.dtEntradaByInventoryItemId.get(inventoryItemId) ?? null,
    })
  );

  return detalhes.sort((a, b) => {
    if (a.dt_entrada === null && b.dt_entrada === null) return 0;
    if (a.dt_entrada === null) return 1;
    if (b.dt_entrada === null) return -1;
    return a.dt_entrada.getTime() - b.dt_entrada.getTime();
  });
}

export function groupConsumptionByProduct(
  records: ConsumptionRecord[],
  metadataByCodigo: Map<string, ProductCostMetadata>
): ProductCostSummary[] {
  const porProduto = new Map<string, ConsumptionRecord[]>();

  for (const record of records) {
    const grupo = porProduto.get(record.codigo_produto) ?? [];
    grupo.push(record);
    porProduto.set(record.codigo_produto, grupo);
  }

  const summaries: ProductCostSummary[] = [];

  porProduto.forEach((grupoRecords, codigoProduto) => {
    const metadata = metadataByCodigo.get(codigoProduto);
    const quantidadeConsumida = grupoRecords.reduce((sum, r) => sum + r.quantidade, 0);
    const custoTotal = grupoRecords.reduce((sum, r) => sum + r.quantidade * r.valor_unitario, 0);
    const lotesDistintos = new Set(grupoRecords.map((r) => r.inventory_item_id)).size;
    const numeroProcedimentos = new Set(grupoRecords.map((r) => r.solicitacao_id)).size;

    summaries.push({
      codigo_produto: codigoProduto,
      nome_produto: grupoRecords[0].nome_produto,
      categoria: metadata?.categoria ?? 'Sem Categoria',
      quantidade_consumida: quantidadeConsumida,
      custo_total: custoTotal,
      custo_unitario_medio: quantidadeConsumida > 0 ? custoTotal / quantidadeConsumida : 0,
      lotes_distintos: lotesDistintos,
      numero_procedimentos: numeroProcedimentos,
      ticket_medio_custo: calculateTicketMedioCusto(custoTotal, numeroProcedimentos),
      lotes_detalhe: buildLotesDetalhe(grupoRecords, metadata),
    });
  });

  return summaries;
}

export function buildLotHistory(
  events: LotHistoryEvent[],
  quantidadeInicial: number
): LotHistoryEntry[] {
  const ordenados = [...events].sort(
    (a, b) => a.dt_procedimento.getTime() - b.dt_procedimento.getTime()
  );

  let saldo = quantidadeInicial;
  return ordenados.map((event) => {
    saldo -= event.quantidade_consumida;
    return { ...event, saldo_apos_evento: saldo };
  });
}

export function calculateMixPercentages(
  summaries: { codigo_produto: string; nome_produto: string; custo_total: number }[]
): { codigo: string; nome: string; custo_total: number; percentual: number }[] {
  const totalGeral = summaries.reduce((sum, s) => sum + s.custo_total, 0);

  const resultado = summaries.map((s) => ({
    codigo: s.codigo_produto,
    nome: s.nome_produto,
    custo_total: s.custo_total,
    percentual: totalGeral > 0 ? (s.custo_total / totalGeral) * 100 : 0,
  }));

  return resultado.sort((a, b) => b.percentual - a.percentual);
}
