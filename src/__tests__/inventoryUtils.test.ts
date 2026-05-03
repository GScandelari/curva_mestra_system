import {
  parseInventoryDate,
  computeInventoryStats,
  agruparProdutosPorCodigo,
  getStatusEstoque,
} from '@/lib/inventoryUtils';

describe('parseInventoryDate', () => {
  it('parses dd/mm/yyyy string', () => {
    const result = parseInventoryDate('31/12/2025');
    expect(result).toEqual(new Date(2025, 11, 31));
  });

  it('parses ISO date string', () => {
    const result = parseInventoryDate('2025-06-15');
    expect(result).not.toBeNull();
    expect(result!.getFullYear()).toBe(2025);
  });

  it('calls toDate() on Firestore Timestamp-like object', () => {
    const fakeTimestamp = { toDate: () => new Date(2025, 5, 15) };
    expect(parseInventoryDate(fakeTimestamp)).toEqual(new Date(2025, 5, 15));
  });

  it('returns null for null/undefined', () => {
    expect(parseInventoryDate(null)).toBeNull();
    expect(parseInventoryDate(undefined)).toBeNull();
  });

  it('returns null for unrecognized type', () => {
    expect(parseInventoryDate(12345)).toBeNull();
  });
});

describe('computeInventoryStats', () => {
  const makeDoc = (quantidade_disponivel: number, dt_validade: string) => ({
    data: () => ({ quantidade_disponivel, dt_validade }),
  });

  const cutoff = new Date(2025, 11, 31); // 2025-12-31

  it('counts items with available stock', () => {
    const docs = [makeDoc(10, '01/06/2026'), makeDoc(0, '01/06/2026'), makeDoc(3, '01/01/2025')];
    const stats = computeInventoryStats(docs, cutoff);
    expect(stats.total_items).toBe(2);
  });

  it('counts items expiring on or before cutoff', () => {
    const docs = [makeDoc(5, '31/12/2025'), makeDoc(5, '01/01/2026')];
    const stats = computeInventoryStats(docs, cutoff);
    expect(stats.expiring_soon).toBe(1);
  });

  it('counts items with low stock (<=10 default threshold)', () => {
    const docs = [makeDoc(5, '01/06/2026'), makeDoc(11, '01/06/2026'), makeDoc(10, '01/06/2026')];
    const stats = computeInventoryStats(docs, cutoff);
    expect(stats.low_stock).toBe(2);
  });

  it('returns zeroes for empty docs array', () => {
    expect(computeInventoryStats([], cutoff)).toEqual({
      total_items: 0,
      expiring_soon: 0,
      low_stock: 0,
    });
  });
});

describe('agruparProdutosPorCodigo', () => {
  const baseDate = new Date(2025, 0, 1);
  const laterDate = new Date(2025, 5, 1);

  const item = (codigo: string, nome: string, qtd: number, dt: Date = baseDate) => ({
    codigo_produto: codigo,
    nome_produto: nome,
    quantidade_disponivel: qtd,
    dt_validade: dt,
  });

  it('groups items by codigo_produto', () => {
    const items = [item('001', 'Produto A', 10), item('001', 'Produto A', 5, laterDate)];
    const result = agruparProdutosPorCodigo(items);
    expect(result).toHaveLength(1);
    expect(result[0].lotes).toHaveLength(2);
    expect(result[0].quantidade_total).toBe(15);
  });

  it('orders lotes by dt_validade ascending (FEFO)', () => {
    const items = [item('001', 'A', 3, laterDate), item('001', 'A', 7, baseDate)];
    const result = agruparProdutosPorCodigo(items);
    expect(result[0].lotes[0].dt_validade).toEqual(baseDate);
    expect(result[0].lotes[1].dt_validade).toEqual(laterDate);
  });

  it('sorts groups alphabetically by nome_produto', () => {
    const items = [item('002', 'Zebra', 1), item('001', 'Aardvark', 1)];
    const result = agruparProdutosPorCodigo(items);
    expect(result[0].nome_produto).toBe('Aardvark');
    expect(result[1].nome_produto).toBe('Zebra');
  });

  it('returns empty array for empty input', () => {
    expect(agruparProdutosPorCodigo([])).toEqual([]);
  });
});

describe('getStatusEstoque', () => {
  it('returns Sem estoque when quantidade is 0', () => {
    expect(getStatusEstoque({ quantidade_disponivel: 0 })).toBe('Sem estoque');
  });

  it('returns Sem estoque when quantidade is 0 with custom limite', () => {
    expect(getStatusEstoque({ quantidade_disponivel: 0, limite_estoque_baixo: 5 })).toBe('Sem estoque');
  });

  it('returns Baixo when quantidade <= default threshold (10)', () => {
    expect(getStatusEstoque({ quantidade_disponivel: 10 })).toBe('Baixo');
    expect(getStatusEstoque({ quantidade_disponivel: 1 })).toBe('Baixo');
  });

  it('returns Normal when quantidade > default threshold (10)', () => {
    expect(getStatusEstoque({ quantidade_disponivel: 11 })).toBe('Normal');
  });

  it('returns Baixo when quantidade <= custom limite', () => {
    expect(getStatusEstoque({ quantidade_disponivel: 5, limite_estoque_baixo: 5 })).toBe('Baixo');
  });

  it('returns Normal when quantidade > custom limite', () => {
    expect(getStatusEstoque({ quantidade_disponivel: 6, limite_estoque_baixo: 5 })).toBe('Normal');
  });

  it('returns Baixo when quantidade is within high custom limite', () => {
    expect(getStatusEstoque({ quantidade_disponivel: 20, limite_estoque_baixo: 50 })).toBe('Baixo');
  });

  it('returns Normal when quantidade exceeds high custom limite', () => {
    expect(getStatusEstoque({ quantidade_disponivel: 51, limite_estoque_baixo: 50 })).toBe('Normal');
  });

  it('uses default 10 when limite_estoque_baixo is undefined', () => {
    expect(getStatusEstoque({ quantidade_disponivel: 10, limite_estoque_baixo: undefined })).toBe('Baixo');
    expect(getStatusEstoque({ quantidade_disponivel: 11, limite_estoque_baixo: undefined })).toBe('Normal');
  });
});

import { calcularQuantidadeInventario } from '@/lib/services/inventoryService';

describe('calcularQuantidadeInventario', () => {
  it('retorna valores intactos para produto não fragmentável', () => {
    const result = calcularQuantidadeInventario({
      quantidadeInformada: 5,
      fragmentavel: false,
      valorInformado: 100,
    });
    expect(result).toEqual({ quantidade_inicial: 5, valor_unitario: 100 });
  });

  it('converte embalagens em unidades e divide o valor para produto fragmentável', () => {
    const result = calcularQuantidadeInventario({
      quantidadeInformada: 2,
      fragmentavel: true,
      unidadesPorEmbalagem: 60,
      valorInformado: 50,
    });
    expect(result.quantidade_inicial).toBe(120);
    expect(result.valor_unitario).toBeCloseTo(0.8333, 4);
  });

  it('fallback para não fragmentável quando fragmentavel=true mas sem unidadesPorEmbalagem', () => {
    const result = calcularQuantidadeInventario({
      quantidadeInformada: 3,
      fragmentavel: true,
      unidadesPorEmbalagem: undefined,
      valorInformado: 75,
    });
    expect(result).toEqual({ quantidade_inicial: 3, valor_unitario: 75 });
  });
});
