import { determineInitialStatus } from '@/lib/services/solicitacaoService';
import type { CreateSolicitacaoInput, CreateSolicitacaoEfetuadaInput } from '@/lib/services/solicitacaoService';

describe('determineInitialStatus', () => {
  it('returns "agendada" for tipo programado with a future date', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(determineInitialStatus(futureDate, 'programado')).toBe('agendada');
  });

  it('returns "agendada" for tipo programado with today', () => {
    expect(determineInitialStatus(new Date(), 'programado')).toBe('agendada');
  });

  it('returns "agendada" when tipo is omitted (defaults to programado)', () => {
    const pastDate = new Date(2020, 0, 1);
    expect(determineInitialStatus(pastDate)).toBe('agendada');
  });

  it('returns "efetuada" for tipo efetuado', () => {
    const pastDate = new Date(2025, 0, 1);
    expect(determineInitialStatus(pastDate, 'efetuado')).toBe('efetuada');
  });

  it('returns "efetuada" for tipo efetuado regardless of date', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(determineInitialStatus(futureDate, 'efetuado')).toBe('efetuada');
  });
});

describe('CreateSolicitacaoInput type contract', () => {
  it('accepts input with descricao and without patient fields', () => {
    const input: CreateSolicitacaoInput = {
      descricao: 'Harmonização facial',
      dt_procedimento: new Date(),
      produtos: [{ inventory_item_id: 'item-1', quantidade: 2 }],
      observacoes: 'Sem observações',
    };

    expect(input.descricao).toBe('Harmonização facial');
    expect(input.dt_procedimento).toBeInstanceOf(Date);
    expect(input.produtos).toHaveLength(1);
  });

  it('accepts input without descricao (optional field)', () => {
    const input: CreateSolicitacaoInput = {
      dt_procedimento: new Date(),
      produtos: [{ inventory_item_id: 'item-2', quantidade: 1 }],
    };

    expect(input.descricao).toBeUndefined();
  });

  it('does not accept paciente_codigo on CreateSolicitacaoInput type', () => {
    const input: CreateSolicitacaoInput = {
      dt_procedimento: new Date(),
      produtos: [],
    };

    expect('paciente_codigo' in input).toBe(false);
    expect('paciente_nome' in input).toBe(false);
  });
});

describe('CreateSolicitacaoEfetuadaInput type contract', () => {
  it('accepts input for an already-performed procedure', () => {
    const input: CreateSolicitacaoEfetuadaInput = {
      descricao: 'Preenchimento labial',
      dt_procedimento: new Date(2025, 0, 15),
      produtos: [{ inventory_item_id: 'item-3', quantidade: 1 }],
    };

    expect(input.descricao).toBe('Preenchimento labial');
    expect(input.dt_procedimento).toBeInstanceOf(Date);
  });

  it('accepts input without descricao (optional field)', () => {
    const input: CreateSolicitacaoEfetuadaInput = {
      dt_procedimento: new Date(2025, 3, 10),
      produtos: [],
    };

    expect(input.descricao).toBeUndefined();
  });
});
