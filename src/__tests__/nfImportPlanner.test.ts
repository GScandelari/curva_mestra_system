import {
  MAX_TRANSACTION_WRITES,
  NF_IMPORT_FIRST_ID,
  checkManualWriteBudget,
  checkWriteBudget,
  evaluateIdentityConflict,
  nextImportId,
  planXmlLines,
  type MasterLite,
} from '@/lib/nfImportPlanner';
import type { NFProduct } from '@/types/nf';

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
