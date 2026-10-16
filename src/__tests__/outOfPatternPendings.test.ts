import { groupOutOfPatternPendings, isOutOfPatternPending } from '@/lib/outOfPatternPendings';
import type { PendingMasterProduct } from '@/types/pendingMasterProduct';

type Row = PendingMasterProduct & { tenant_nome: string };

const row = (id: string, codigo: string, tenant: string, nome: string, dia: number): Row => ({
  id,
  tenant_id: tenant,
  tenant_nome: `Clínica ${tenant}`,
  nf_import_id: '1000',
  id_sequencial: 1000,
  numero_nf: '26229',
  serie: '4',
  cnpj_emitente: '12345678000195',
  linha: 0,
  codigo,
  nome_produto: nome,
  lote: 'L',
  quantidade: 1,
  valor_unitario: 1,
  dt_validade: new Date(Date.UTC(2027, 0, 1)),
  status: 'aberta',
  created_at: new Date(Date.UTC(2026, 9, dia)),
});

describe('isOutOfPatternPending', () => {
  it('uses the stored flag or, for older pendings, the code format', () => {
    expect(isOutOfPatternPending({ codigo: '3076528', fora_do_padrao: true })).toBe(true);
    expect(isOutOfPatternPending({ codigo: 'A12' })).toBe(true);
    expect(isOutOfPatternPending({ codigo: '1234' })).toBe(true);
    expect(isOutOfPatternPending({ codigo: '9999999' })).toBe(false);
    expect(isOutOfPatternPending({ codigo: '12345678', fora_do_padrao: false })).toBe(false);
  });
});

describe('groupOutOfPatternPendings', () => {
  it('groups by code with distinct descriptions and clinics, newest first', () => {
    const grupos = groupOutOfPatternPendings([
      row('1', 'A12', 'a', 'PRODUTO X', 10),
      row('2', '123456789', 'a', 'PRODUTO Y', 12),
      row('3', 'A12', 'b', 'PRODUTO X', 14),
      row('4', 'A12', 'b', 'PRODUTO X 2', 11),
    ]);
    expect(grupos.map((g) => g.codigo)).toEqual(['A12', '123456789']);
    expect(grupos[0]).toMatchObject({
      descricoes: ['PRODUTO X', 'PRODUTO X 2'],
      clinicas: ['Clínica b', 'Clínica a'],
    });
    expect(grupos[0].ocorrencias.map((o) => o.id)).toEqual(['3', '4', '1']);
  });

  it('returns no groups for an empty list', () => {
    expect(groupOutOfPatternPendings([])).toEqual([]);
  });
});
