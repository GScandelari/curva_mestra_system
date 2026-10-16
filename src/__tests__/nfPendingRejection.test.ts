import {
  applyRejectionToImport,
  buildPendingRejectedMessage,
  validateRejectReason,
} from '@/lib/nfPendingRejection';

describe('validateRejectReason', () => {
  it('trims and accepts 5 to 500 characters', () => {
    expect(validateRejectReason('  Código inexistente  ')).toEqual({
      ok: true,
      motivo: 'Código inexistente',
    });
    expect(validateRejectReason('x'.repeat(500))).toMatchObject({ ok: true });
  });

  it.each([undefined, null, 42, '', '   ', 'abcd', 'x'.repeat(501)])('rejects %p', (raw) => {
    expect(validateRejectReason(raw)).toEqual({
      ok: false,
      error: 'Informe o motivo da recusa (5 a 500 caracteres).',
    });
  });
});

describe('applyRejectionToImport', () => {
  const quando = new Date(Date.UTC(2026, 9, 15, 12));
  const pendente = { codigo: 'A12', nome_produto: 'PRODUTO X', lote: 'L1' };

  it('moves one occurrence to produtos_recusados and keeps pending while others remain', () => {
    const r = applyRejectionToImport(
      {
        produtos_pendentes: [
          { ...pendente, fora_do_padrao: true },
          { ...pendente, fora_do_padrao: true },
          { codigo: '9999999', nome_produto: 'Y', lote: 'L2' },
        ],
      },
      pendente,
      'Código inexistente',
      quando
    );
    expect(r.produtos_pendentes).toEqual([
      { ...pendente, fora_do_padrao: true },
      { codigo: '9999999', nome_produto: 'Y', lote: 'L2' },
    ]);
    expect(r.produtos_recusados).toEqual([
      { ...pendente, motivo: 'Código inexistente', recusado_em: quando },
    ]);
    expect(r.status).toBe('novo_produto_pendente');
  });

  it('turns the record into success when the last pending is rejected', () => {
    const r = applyRejectionToImport(
      {
        produtos_pendentes: [pendente],
        produtos_recusados: [
          { codigo: 'B', nome_produto: 'B', lote: 'L', motivo: 'm', recusado_em: quando },
        ],
      },
      pendente,
      'Descontinuado',
      quando
    );
    expect(r.produtos_pendentes).toEqual([]);
    expect(r.produtos_recusados).toHaveLength(2);
    expect(r.status).toBe('success');
  });
});

describe('buildPendingRejectedMessage', () => {
  it('names the product, the readable ID and the reason', () => {
    expect(buildPendingRejectedMessage('PRODUTO X', '1000', 'Código inexistente')).toBe(
      'O produto PRODUTO X da NF (ID 1000) não foi cadastrado no catálogo. Motivo: Código inexistente'
    );
  });
});
