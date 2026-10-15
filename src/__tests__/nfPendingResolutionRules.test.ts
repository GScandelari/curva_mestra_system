import * as web from '@/lib/nfPendingResolutionRules';
import * as mirror from '../../functions/src/nfPendingResolutionRules';

const {
  buildPendingResolvedMessage,
  chunkPendingLines,
  MAX_PENDING_PER_TRANSACTION,
  normalizeCodigo,
  planPendingResolution,
  removeResolvedPendentes,
  shouldResolvePendingForProduct,
} = web;

const linha = (id: string, extra: Partial<web.PendingLineInput> = {}): web.PendingLineInput => ({
  id,
  codigo: '9999999',
  nome_produto: 'PRODUTO NOVO',
  lote: 'L1',
  quantidade: 2,
  valor_unitario: 100,
  ...extra,
});

describe('shouldResolvePendingForProduct', () => {
  it.each([
    ['created active', null, { code: '0123456', active: true }, '123456'],
    ['created inactive', null, { code: '123456', active: false }, null],
    ['deleted', { code: '123456', active: true }, null, null],
    ['reactivated', { code: '123456', active: false }, { code: '123456', active: true }, '123456'],
    ['deactivated', { code: '123456', active: true }, { code: '123456', active: false }, null],
    ['code changed', { code: '123456', active: true }, { code: '654321', active: true }, '654321'],
    ['name only', { code: '123456', active: true }, { code: '123456', active: true }, null],
    [
      'zeros only differ',
      { code: '0123456', active: true },
      { code: '123456', active: true },
      null,
    ],
    ['no code', null, { active: true }, null],
  ])('%s', (_, before, after, esperado) => {
    expect(shouldResolvePendingForProduct(before, after)).toBe(esperado);
  });
});

describe('planPendingResolution', () => {
  it('converts packages to units for a fragmentable product', () => {
    expect(
      planPendingResolution([linha('a')], { fragmentavel: true, unidades_por_embalagem: 10 })
    ).toEqual([
      {
        pendingId: 'a',
        quantidade: 20,
        valor_unitario: 10,
        quantidade_embalagens: 2,
        valor_por_embalagem: 100,
      },
    ]);
  });

  it.each([[{ fragmentavel: false, unidades_por_embalagem: 10 }], [{ fragmentavel: true }], [{}]])(
    'keeps the NF values when not fragmentable (%p)',
    (master) => {
      expect(planPendingResolution([linha('a')], master)).toEqual([
        { pendingId: 'a', quantidade: 2, valor_unitario: 100 },
      ]);
    }
  );
});

describe('chunkPendingLines', () => {
  it('splits at 248 by default and respects 2 writes per line + 2', () => {
    const linhas = Array.from({ length: 500 }, (_, i) => i);
    const blocos = chunkPendingLines(linhas);
    expect(blocos.map((b) => b.length)).toEqual([248, 248, 4]);
    expect(MAX_PENDING_PER_TRANSACTION * 2 + 2).toBeLessThanOrEqual(500);
    expect(chunkPendingLines([], 10)).toEqual([]);
  });
});

describe('removeResolvedPendentes', () => {
  it('removes one occurrence per resolved line', () => {
    const pendentes = [
      { codigo: '1', nome_produto: 'A', lote: 'L1' },
      { codigo: '1', nome_produto: 'A', lote: 'L1' },
      { codigo: '2', nome_produto: 'B', lote: 'L2' },
    ];
    expect(removeResolvedPendentes(pendentes, [{ codigo: '1', lote: 'L1' }])).toEqual([
      { codigo: '1', nome_produto: 'A', lote: 'L1' },
      { codigo: '2', nome_produto: 'B', lote: 'L2' },
    ]);
    expect(removeResolvedPendentes(pendentes, [{ codigo: '9', lote: 'X' }])).toHaveLength(3);
  });
});

describe('buildPendingResolvedMessage', () => {
  it('uses singular for one product and dedupes repeated names', () => {
    expect(buildPendingResolvedMessage('1000', ['X', 'X'])).toBe(
      'A NF (ID 1000) foi atualizada: o produto X foi adicionado ao inventário automaticamente.'
    );
    expect(buildPendingResolvedMessage('1000', ['X', 'Y', 'Z'])).toBe(
      'A NF (ID 1000) foi atualizada: os produtos X, Y, Z foram adicionados ao inventário automaticamente.'
    );
  });
});

describe('normalizeCodigo', () => {
  it.each([
    ['0012345', '12345'],
    [' 123 ', '123'],
    ['000', '0'],
    [123, '123'],
    [null, ''],
  ])('%p → %p', (raw, esperado) => {
    expect(normalizeCodigo(raw)).toBe(esperado);
  });
});

// O espelho em functions/src precisa se comportar exatamente igual
describe('paridade com functions/src/nfPendingResolutionRules', () => {
  it('exports the same API', () => {
    expect(Object.keys(mirror).sort()).toEqual(Object.keys(web).sort());
    expect(mirror.MAX_PENDING_PER_TRANSACTION).toBe(web.MAX_PENDING_PER_TRANSACTION);
  });

  it('gives the same results', () => {
    const transicoes: Array<[Record<string, unknown> | null, Record<string, unknown> | null]> = [
      [null, { code: '0123456', active: true }],
      [
        { code: '1', active: false },
        { code: '1', active: true },
      ],
      [
        { code: '1', active: true },
        { code: '2', active: true },
      ],
      [
        { code: '1', active: true },
        { code: '1', active: true },
      ],
      [{ code: '1', active: true }, null],
    ];
    for (const [antes, depois] of transicoes) {
      expect(mirror.shouldResolvePendingForProduct(antes, depois)).toBe(
        web.shouldResolvePendingForProduct(antes, depois)
      );
    }
    for (const master of [{ fragmentavel: true, unidades_por_embalagem: 4 }, {}]) {
      const linhas = [linha('a'), linha('b', { quantidade: 3, valor_unitario: 7 })];
      expect(mirror.planPendingResolution(linhas, master)).toEqual(
        web.planPendingResolution(linhas, master)
      );
    }
    expect(mirror.chunkPendingLines([1, 2, 3], 2)).toEqual(web.chunkPendingLines([1, 2, 3], 2));
    expect(mirror.buildPendingResolvedMessage('1001', ['A', 'B'])).toBe(
      web.buildPendingResolvedMessage('1001', ['A', 'B'])
    );
    const pendentes = [{ codigo: '1', lote: 'L' }];
    expect(mirror.removeResolvedPendentes(pendentes, pendentes)).toEqual(
      web.removeResolvedPendentes(pendentes, pendentes)
    );
    expect(mirror.normalizeCodigo('007')).toBe(web.normalizeCodigo('007'));
  });
});
