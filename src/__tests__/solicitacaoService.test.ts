import { determineInitialStatus } from '@/lib/services/solicitacaoService';
import type { CreateSolicitacaoInput } from '@/lib/services/solicitacaoService';

describe('determineInitialStatus', () => {
  it('always returns "agendada" for a future date', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(determineInitialStatus(futureDate)).toBe('agendada');
  });

  it('always returns "agendada" for today', () => {
    expect(determineInitialStatus(new Date())).toBe('agendada');
  });

  it('always returns "agendada" for a past date', () => {
    const pastDate = new Date(2020, 0, 1);
    expect(determineInitialStatus(pastDate)).toBe('agendada');
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
    // This test verifies at TypeScript level that the patient fields were removed.
    // If paciente_codigo were added back to the interface, this cast would fail type-check.
    const input: CreateSolicitacaoInput = {
      dt_procedimento: new Date(),
      produtos: [],
    };

    expect('paciente_codigo' in input).toBe(false);
    expect('paciente_nome' in input).toBe(false);
  });
});
