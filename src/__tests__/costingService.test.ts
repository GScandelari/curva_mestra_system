import {
  calculateTicketMedioCusto,
  groupConsumptionByProduct,
  buildLotHistory,
  calculateMixPercentages,
  type ConsumptionRecord,
  type ProductCostMetadata,
  type LotHistoryEvent,
} from '@/lib/services/costingService';

const record = (overrides: Partial<ConsumptionRecord>): ConsumptionRecord => ({
  codigo_produto: '001',
  nome_produto: 'Produto A',
  inventory_item_id: 'inv-1',
  lote: 'LOTE-1',
  quantidade: 1,
  valor_unitario: 10,
  solicitacao_id: 'sol-1',
  dt_procedimento: new Date(2026, 8, 1),
  ...overrides,
});

describe('calculateTicketMedioCusto', () => {
  it('divides total cost by number of procedures', () => {
    expect(calculateTicketMedioCusto(100, 4)).toBe(25);
  });

  it('returns 0 when there are no procedures', () => {
    expect(calculateTicketMedioCusto(100, 0)).toBe(0);
  });
});

describe('groupConsumptionByProduct', () => {
  it('sums cost directly when a single lot was consumed (RN-01)', () => {
    const records = [
      record({ quantidade: 5, valor_unitario: 10, solicitacao_id: 'sol-1' }),
      record({ quantidade: 3, valor_unitario: 10, solicitacao_id: 'sol-2' }),
    ];
    const [summary] = groupConsumptionByProduct(records, new Map());
    expect(summary.custo_total).toBe(80);
    expect(summary.custo_unitario_medio).toBe(10);
    expect(summary.quantidade_consumida).toBe(8);
  });

  it('reproduces the exact numeric example from UC-51 for multiple lots (RN-02)', () => {
    const records = [
      record({
        inventory_item_id: 'lote-A',
        lote: 'A',
        quantidade: 10,
        valor_unitario: 5,
        solicitacao_id: 'sol-1',
      }),
      record({
        inventory_item_id: 'lote-B',
        lote: 'B',
        quantidade: 2,
        valor_unitario: 8,
        solicitacao_id: 'sol-2',
      }),
    ];
    const [summary] = groupConsumptionByProduct(records, new Map());
    expect(summary.custo_total).toBe(66);
    expect(summary.custo_unitario_medio).toBe(5.5);
  });

  it('counts distinct lots and distinct procedures correctly', () => {
    const records = [
      record({ inventory_item_id: 'lote-A', solicitacao_id: 'sol-1', quantidade: 1 }),
      record({ inventory_item_id: 'lote-A', solicitacao_id: 'sol-1', quantidade: 1 }),
      record({ inventory_item_id: 'lote-B', solicitacao_id: 'sol-2', quantidade: 1 }),
    ];
    const [summary] = groupConsumptionByProduct(records, new Map());
    expect(summary.lotes_distintos).toBe(2);
    expect(summary.numero_procedimentos).toBe(2);
  });

  it('falls back to "Sem Categoria" when no metadata exists for the product', () => {
    const records = [record({})];
    const [summary] = groupConsumptionByProduct(records, new Map());
    expect(summary.categoria).toBe('Sem Categoria');
    expect(summary.lotes_detalhe).toHaveLength(1);
  });

  it('uses the category and dt_entrada from metadata when present', () => {
    const metadata: ProductCostMetadata = {
      categoria: 'Preenchedores',
      dtEntradaByInventoryItemId: new Map([['inv-1', new Date(2026, 0, 1)]]),
    };
    const [summary] = groupConsumptionByProduct([record({})], new Map([['001', metadata]]));
    expect(summary.categoria).toBe('Preenchedores');
    expect(summary.lotes_detalhe[0].dt_entrada).toEqual(new Date(2026, 0, 1));
  });

  it('groups multiple products independently', () => {
    const records = [
      record({ codigo_produto: '001', nome_produto: 'Produto A', quantidade: 2 }),
      record({ codigo_produto: '002', nome_produto: 'Produto B', quantidade: 3 }),
    ];
    const summaries = groupConsumptionByProduct(records, new Map());
    expect(summaries).toHaveLength(2);
  });
});

describe('buildLotHistory', () => {
  const event = (overrides: Partial<LotHistoryEvent>): LotHistoryEvent => ({
    solicitacao_id: 'sol-1',
    identificador_procedimento: 'SOL-ABCDEF12',
    dt_procedimento: new Date(2026, 8, 1),
    quantidade_consumida: 1,
    ...overrides,
  });

  it('computes decreasing balance correctly across events', () => {
    const events = [
      event({ dt_procedimento: new Date(2026, 8, 1), quantidade_consumida: 3 }),
      event({ dt_procedimento: new Date(2026, 8, 5), quantidade_consumida: 2 }),
    ];
    const result = buildLotHistory(events, 10);
    expect(result[0].saldo_apos_evento).toBe(7);
    expect(result[1].saldo_apos_evento).toBe(5);
  });

  it('reorders out-of-order events chronologically before calculating', () => {
    const events = [
      event({ dt_procedimento: new Date(2026, 8, 10), quantidade_consumida: 2 }),
      event({ dt_procedimento: new Date(2026, 8, 1), quantidade_consumida: 4 }),
    ];
    const result = buildLotHistory(events, 10);
    expect(result[0].dt_procedimento).toEqual(new Date(2026, 8, 1));
    expect(result[0].saldo_apos_evento).toBe(6);
    expect(result[1].saldo_apos_evento).toBe(4);
  });

  it('does not throw when the resulting balance goes negative', () => {
    const events = [event({ quantidade_consumida: 15 })];
    const result = buildLotHistory(events, 10);
    expect(result[0].saldo_apos_evento).toBe(-5);
  });
});

describe('calculateMixPercentages', () => {
  it('percentages sum to approximately 100', () => {
    const summaries = [
      { codigo_produto: '001', nome_produto: 'A', custo_total: 30 },
      { codigo_produto: '002', nome_produto: 'B', custo_total: 70 },
    ];
    const result = calculateMixPercentages(summaries);
    const total = result.reduce((sum, r) => sum + r.percentual, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it('returns all zeroes when total cost is zero', () => {
    const summaries = [
      { codigo_produto: '001', nome_produto: 'A', custo_total: 0 },
      { codigo_produto: '002', nome_produto: 'B', custo_total: 0 },
    ];
    const result = calculateMixPercentages(summaries);
    expect(result.every((r) => r.percentual === 0)).toBe(true);
  });

  it('sorts by percentual descending', () => {
    const summaries = [
      { codigo_produto: '001', nome_produto: 'A', custo_total: 10 },
      { codigo_produto: '002', nome_produto: 'B', custo_total: 90 },
    ];
    const result = calculateMixPercentages(summaries);
    expect(result[0].codigo).toBe('002');
    expect(result[1].codigo).toBe('001');
  });
});
