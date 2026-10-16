import {
  MAX_TRANSACTION_WRITES,
  NF_IMPORT_FIRST_ID,
  buildComplementNotice,
  buildPendingAdminAlertMessage,
  checkManualWriteBudget,
  checkWriteBudget,
  evaluateIdentityConflict,
  hasResolvablePending,
  listOutOfPatternCodes,
  nextImportId,
  planManualLines,
  planXmlLines,
  type MasterLite,
} from '@/lib/nfImportPlanner';
import type { ManualNfProductInput, NFProduct } from '@/types/nf';

describe('nextImportId', () => {
  it('starts at 1000 and increments', () => {
    expect(NF_IMPORT_FIRST_ID).toBe(1000);
    expect(nextImportId(undefined)).toBe(1000);
    expect(nextImportId(null)).toBe(1000);
    expect(nextImportId(1000)).toBe(1001);
    expect(nextImportId(5)).toBe(1000);
  });
});

describe('evaluateIdentityConflict', () => {
  it('creates when the identity is new', () => {
    expect(evaluateIdentityConflict('xml', null)).toEqual({ action: 'create' });
    expect(evaluateIdentityConflict('manual', null)).toEqual({ action: 'create' });
  });

  it('complements a manual record with a new manual entry (same ID)', () => {
    expect(evaluateIdentityConflict('manual', { nf_import_id: '1000', origem: 'manual' })).toEqual({
      action: 'complement',
      nfImportId: '1000',
    });
  });

  it('blocks XML over a manual record', () => {
    expect(evaluateIdentityConflict('xml', { nf_import_id: '1000', origem: 'manual' })).toEqual({
      action: 'blocked',
      status: 409,
      nfImportId: '1000',
      reason: 'Esta NF já foi cadastrada manualmente (ID 1000) e não pode ser importada via XML.',
    });
  });

  it('blocks a second XML of the same NF as duplicate', () => {
    expect(evaluateIdentityConflict('xml', { nf_import_id: '1000', origem: 'xml' })).toEqual({
      action: 'blocked',
      status: 409,
      nfImportId: '1000',
      reason: 'Esta NF já foi cadastrada (ID 1000).',
    });
  });

  it('mentions automatic completion when the XML record has pending products', () => {
    const decision = evaluateIdentityConflict('xml', {
      nf_import_id: '1001',
      origem: 'xml',
      hasPending: true,
    });
    expect(decision).toMatchObject({ action: 'blocked', status: 409 });
    expect(decision.action === 'blocked' && decision.reason).toBe(
      'Esta NF já foi cadastrada (ID 1001). Os produtos pendentes desta NF serão adicionados automaticamente quando cadastrados no catálogo.'
    );
  });

  it('blocks a manual entry over an XML record', () => {
    expect(evaluateIdentityConflict('manual', { nf_import_id: '1000', origem: 'xml' })).toEqual({
      action: 'blocked',
      status: 409,
      nfImportId: '1000',
      reason: 'Esta NF já foi importada via XML (ID 1000) e não aceita lançamento manual.',
    });
  });
});

describe('planXmlLines', () => {
  const produto = (codigo: string, lote: string, quantidade = 2, valor = 100): NFProduct => ({
    codigo,
    nome_produto: `PRODUTO ${codigo}`,
    lote,
    quantidade,
    dt_validade: '31/12/2027',
    valor_unitario: valor,
  });
  const master = (code: string, extra: Partial<MasterLite> = {}): MasterLite => ({
    id: `m-${code}`,
    code,
    active: true,
    ...extra,
  });

  it('sends every line to the inventory when all products are in the catalog', () => {
    const plano = planXmlLines(
      [produto('3076528', 'L1'), produto('1111111', 'L2')],
      new Map([
        ['3076528', master('3076528')],
        ['1111111', master('1111111')],
      ])
    );
    expect(plano.inventory.map((l) => l.linha)).toEqual([0, 1]);
    expect(plano.pending).toEqual([]);
    expect(plano.inventory[0]).toMatchObject({ quantidade: 2, valor_unitario: 100 });
  });

  it('turns missing and inactive products into pending lines', () => {
    const plano = planXmlLines(
      [produto('3076528', 'L1'), produto('9999999', 'L9'), produto('2222222', 'L3')],
      new Map([
        ['3076528', master('3076528')],
        ['2222222', master('2222222', { active: false })],
      ])
    );
    expect(plano.inventory.map((l) => l.linha)).toEqual([0]);
    expect(plano.pending.map((l) => l.linha)).toEqual([1, 2]);
  });

  it('converts packages into units for fragmentable products', () => {
    const plano = planXmlLines(
      [produto('3076528', 'L1', 2, 100)],
      new Map([['3076528', master('3076528', { fragmentavel: true, unidades_por_embalagem: 10 })]])
    );
    expect(plano.inventory[0]).toMatchObject({ quantidade: 20, valor_unitario: 10 });
  });

  it('keeps two lots of the same product as two lines', () => {
    const plano = planXmlLines(
      [produto('3076528', 'L1'), produto('3076528', 'L2')],
      new Map([['3076528', master('3076528')]])
    );
    expect(plano.inventory.map((l) => l.produto.lote)).toEqual(['L1', 'L2']);
  });
});

describe('checkWriteBudget', () => {
  it('allows up to 500 writes per transaction', () => {
    expect(MAX_TRANSACTION_WRITES).toBe(500);
    expect(checkWriteBudget(3, 497)).toEqual({ ok: true });
    expect(checkWriteBudget(1, 499)).toEqual({ ok: true });
  });

  it('rejects more than 500 writes with 422', () => {
    expect(checkWriteBudget(3, 498)).toEqual({
      ok: false,
      status: 422,
      error: 'Esta NF-e tem 498 itens; o limite por importação é 497.',
    });
    expect(checkWriteBudget(1, 500)).toMatchObject({ ok: false, status: 422 });
  });

  it('suggests splitting a manual entry into complements', () => {
    const result = checkManualWriteBudget(1, 500);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('os complementos mantêm o mesmo ID');
  });
});

// --- FEAT-pendencias-nfe-fora-padrao-manual-recusa-checagem -----------------

describe('evaluateIdentityConflict — complemento após recusa (D7-A)', () => {
  it('lets a manual entry complement an XML record that has rejected items', () => {
    expect(
      evaluateIdentityConflict('manual', { nf_import_id: '1000', origem: 'xml', hasRejected: true })
    ).toEqual({ action: 'complement', nfImportId: '1000' });
  });

  it('keeps blocking XML over XML and XML over manual even with rejected items', () => {
    expect(
      evaluateIdentityConflict('xml', { nf_import_id: '1000', origem: 'xml', hasRejected: true })
    ).toMatchObject({ action: 'blocked', reason: 'Esta NF já foi cadastrada (ID 1000).' });
    expect(
      evaluateIdentityConflict('xml', { nf_import_id: '1001', origem: 'manual', hasRejected: true })
    ).toMatchObject({
      action: 'blocked',
      reason: 'Esta NF já foi cadastrada manualmente (ID 1001) e não pode ser importada via XML.',
    });
  });

  it('keeps blocking manual over XML without rejected items', () => {
    expect(
      evaluateIdentityConflict('manual', {
        nf_import_id: '1000',
        origem: 'xml',
        hasRejected: false,
      })
    ).toMatchObject({
      action: 'blocked',
      reason: 'Esta NF já foi importada via XML (ID 1000) e não aceita lançamento manual.',
    });
  });
});

describe('buildComplementNotice', () => {
  it('describes manual and XML-with-rejection complements', () => {
    expect(buildComplementNotice('1005', 'manual')).toBe(
      'Esta NF já tem lançamento (ID 1005). Os produtos que você adicionar serão incluídos nesse mesmo ID.'
    );
    expect(buildComplementNotice('1000', 'xml')).toBe(
      'Esta NF foi importada via XML (ID 1000) e tem produto(s) recusado(s). Os produtos que você adicionar serão incluídos nesse mesmo ID.'
    );
  });
});

describe('listOutOfPatternCodes / hasResolvablePending', () => {
  it('lists distinct out-of-pattern codes in NF order', () => {
    expect(
      listOutOfPatternCodes([
        { codigo: '3076528' },
        { codigo: 'A12' },
        { codigo: '1234' },
        { codigo: '123456789' },
        { codigo: 'A12' },
        { codigo: '12345' },
        { codigo: '12345678' },
      ])
    ).toEqual(['A12', '1234', '123456789']);
  });

  it('counts only pendings the automatic resolution can still incorporate', () => {
    expect(hasResolvablePending(undefined)).toBe(false);
    expect(hasResolvablePending([{ fora_do_padrao: true }])).toBe(false);
    expect(hasResolvablePending([{ fora_do_padrao: true }, {}])).toBe(true);
  });
});

describe('planXmlLines — código fora do padrão', () => {
  const linha = (codigo: string): NFProduct => ({
    codigo,
    nome_produto: `P ${codigo}`,
    lote: 'L',
    quantidade: 1,
    dt_validade: '31/12/2027',
    valor_unitario: 1,
  });

  it('flags out-of-pattern lines as pending without looking at the catalog', () => {
    const plano = planXmlLines(
      [linha('3076528'), linha('A12'), linha('1234'), linha('9999999')],
      new Map([
        ['3076528', { id: 'm1', code: '3076528', active: true }],
        // mesmo que exista um master com o código (só por script), não entra
        ['1234', { id: 'm2', code: '1234', active: true }],
      ])
    );
    expect(plano.inventory.map((l) => l.linha)).toEqual([0]);
    expect(plano.pending.map((l) => [l.linha, l.fora_do_padrao])).toEqual([
      [1, true],
      [2, true],
      [3, false],
    ]);
  });
});

describe('planManualLines', () => {
  const item = (
    codigo: string,
    extra: Partial<ManualNfProductInput> = {}
  ): ManualNfProductInput => ({
    codigo,
    nome_produto: `P ${codigo}`,
    lote: 'L1',
    quantidade: 2,
    valor_unitario: 100,
    dt_validade: '2027-12-31',
    ...extra,
  });
  const masters = new Map<string, MasterLite>([
    ['3076528', { id: 'm1', code: '3076528', active: true }],
    [
      '3000001',
      { id: 'm2', code: '3000001', active: true, fragmentavel: true, unidades_por_embalagem: 10 },
    ],
    ['5550001', { id: 'm3', code: '5550001', active: false }],
  ]);

  it('sends every "outra marca" item to the inventory as informed', () => {
    const plano = planManualLines('outra_marca', [item('ABC1'), item('42')], new Map());
    expect(plano).toMatchObject({ ok: true, pending: [] });
    if (plano.ok) {
      expect(plano.inventory.map((l) => [l.linha, l.quantidade, l.valor_unitario])).toEqual([
        [0, 2, 100],
        [1, 2, 100],
      ]);
    }
  });

  it('Rennova: active → inventory (fragmentation); missing or inactive → pending as informed', () => {
    const plano = planManualLines(
      'rennova',
      [item('3076528'), item('3000001'), item('88888888'), item('5550001')],
      masters
    );
    expect(plano.ok).toBe(true);
    if (!plano.ok) return;
    expect(
      plano.inventory.map((l) => [l.linha, l.quantidade, l.valor_unitario, l.master?.id])
    ).toEqual([
      [0, 2, 100, 'm1'],
      [1, 20, 10, 'm2'],
    ]);
    expect(plano.pending.map((l) => [l.linha, l.produto.codigo, l.produto.quantidade])).toEqual([
      [2, '88888888', 2],
      [3, '5550001', 2],
    ]);
  });

  it('Rennova: rejects an out-of-pattern code with 400', () => {
    expect(planManualLines('rennova', [item('3076528'), item('1234')], masters)).toEqual({
      ok: false,
      status: 400,
      error: 'Produto 2: código inválido (use de 5 a 8 dígitos numéricos).',
    });
  });
});

describe('buildPendingAdminAlertMessage', () => {
  const identity = { cnpj: '12345678000195', serie: '4', numero: '26229' };

  it('separates catalog-missing and out-of-pattern codes (XML)', () => {
    expect(
      buildPendingAdminAlertMessage({
        tenantName: 'Clínica A',
        origem: 'xml',
        importId: '1003',
        identity,
        codigosPendentes: ['9999999'],
        codigosForaPadrao: ['A12', '123456789', '1234'],
      })
    ).toBe(
      'Clínica A importou via XML a NF 26229 · série 4 · CNPJ 12.345.678/0001-95 (ID 1003): 1 produto(s) fora do catálogo (9999999) e 3 código(s) fora do padrão (A12, 123456789, 1234).'
    );
  });

  it('omits the empty part (manual) and caps long lists at 10 codes', () => {
    expect(
      buildPendingAdminAlertMessage({
        tenantName: 'Clínica A',
        origem: 'manual',
        importId: '1005',
        identity,
        codigosPendentes: ['88888888', '7777777'],
        codigosForaPadrao: [],
      })
    ).toBe(
      'Clínica A lançou manualmente a NF 26229 · série 4 · CNPJ 12.345.678/0001-95 (ID 1005): 2 produto(s) fora do catálogo (88888888, 7777777).'
    );
    const muitos = Array.from({ length: 12 }, (_, i) => String(10000000 + i));
    expect(
      buildPendingAdminAlertMessage({
        tenantName: 'C',
        origem: 'xml',
        importId: '1',
        identity,
        codigosPendentes: muitos,
        codigosForaPadrao: [],
      })
    ).toContain('10000009 e mais 2)');
  });
});
