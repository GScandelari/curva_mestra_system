import {
  isWindowDataSufficient,
  filterEventsWithinWindow,
  calculateDailyConsumptionRate,
  selectConsumptionWindow,
  calculateEstimatedDepletionDate,
  calculateProductProjection,
  countProjectionsWithinHorizon,
  MIN_DISTINCT_CONSUMPTION_DATES,
  type ConsumptionEvent,
  type ProductProjection,
  type ProductProjectionInput,
} from '@/lib/services/projectionService';

const today = new Date(2026, 8, 22); // 22/09/2026

const event = (quantidade: number, dt_procedimento: Date): ConsumptionEvent => ({
  quantidade,
  dt_procedimento,
});

describe('isWindowDataSufficient', () => {
  it('returns true when there are enough distinct dates', () => {
    const events = [event(1, new Date(2026, 8, 1)), event(1, new Date(2026, 8, 5))];
    expect(events.length).toBeGreaterThanOrEqual(MIN_DISTINCT_CONSUMPTION_DATES);
    expect(isWindowDataSufficient(events)).toBe(true);
  });

  it('returns false when events share the same date', () => {
    const events = [event(1, new Date(2026, 8, 1)), event(2, new Date(2026, 8, 1))];
    expect(isWindowDataSufficient(events)).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(isWindowDataSufficient([])).toBe(false);
  });
});

describe('filterEventsWithinWindow', () => {
  it('includes an event inside the window', () => {
    const events = [event(1, new Date(2026, 8, 10))];
    const result = filterEventsWithinWindow(events, today, 30);
    expect(result).toHaveLength(1);
  });

  it('excludes an event outside the window', () => {
    const events = [event(1, new Date(2026, 5, 1))]; // ~113 dias atrás
    const result = filterEventsWithinWindow(events, today, 30);
    expect(result).toHaveLength(0);
  });

  it('includes an event exactly at the window boundary', () => {
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - 30);
    const result = filterEventsWithinWindow([event(1, windowStart)], today, 30);
    expect(result).toHaveLength(1);
  });
});

describe('calculateDailyConsumptionRate', () => {
  it('divides the total consumed by the window size', () => {
    const events = [event(30, new Date(2026, 8, 1)), event(60, new Date(2026, 8, 5))];
    expect(calculateDailyConsumptionRate(events, 30)).toBeCloseTo(3, 5);
  });

  it('returns 0 for an empty array', () => {
    expect(calculateDailyConsumptionRate([], 30)).toBe(0);
  });
});

describe('selectConsumptionWindow', () => {
  it('falls back to 60 days when 30 is insufficient but 60 is sufficient', () => {
    const events = [
      event(10, new Date(2026, 6, 25)), // ~59 dias atrás: fora de 30, dentro de 60/90
      event(10, new Date(2026, 7, 10)), // ~43 dias atrás: fora de 30, dentro de 60/90
    ];
    const result = selectConsumptionWindow(events, today);
    expect(result).not.toBeNull();
    expect(result!.windowDays).toBe(60);
  });

  it('falls back to 90 days when 30 and 60 are insufficient but 90 is sufficient', () => {
    const events = [
      event(9, new Date(2026, 5, 25)), // ~89 dias atrás: fora de 30/60, dentro de 90
      event(9, new Date(2026, 6, 10)), // ~74 dias atrás: fora de 30/60, dentro de 90
    ];
    const result = selectConsumptionWindow(events, today);
    expect(result).not.toBeNull();
    expect(result!.windowDays).toBe(90);
    expect(result!.taxaConsumoDiaria).toBeCloseTo(18 / 90, 5);
  });

  it('returns null when no window has sufficient data', () => {
    const events = [event(10, new Date(2026, 7, 1))]; // única data distinta
    const result = selectConsumptionWindow(events, today);
    expect(result).toBeNull();
  });

  it('prefers the first sufficient window (30) over a wider one with a different rate', () => {
    const events = [
      event(3, new Date(2026, 8, 1)), // dentro de 30, 60 e 90
      event(3, new Date(2026, 8, 10)), // dentro de 30, 60 e 90
    ];
    const result = selectConsumptionWindow(events, today);
    expect(result).not.toBeNull();
    expect(result!.windowDays).toBe(30);
    expect(result!.taxaConsumoDiaria).toBeCloseTo(6 / 30, 5);
  });
});

describe('calculateEstimatedDepletionDate', () => {
  it('returns a future date rounded up when the rate is positive', () => {
    const result = calculateEstimatedDepletionDate(10, 3, today); // ceil(10/3) = 4 dias
    expect(result).not.toBeNull();
    expect(result!.toDateString()).toBe(new Date(2026, 8, 26).toDateString());
  });

  it('returns null when the rate is zero', () => {
    expect(calculateEstimatedDepletionDate(10, 0, today)).toBeNull();
  });

  it('returns null when the rate is negative', () => {
    expect(calculateEstimatedDepletionDate(10, -5, today)).toBeNull();
  });
});

describe('calculateProductProjection', () => {
  const baseInput: Omit<ProductProjectionInput, 'eventosConsumo'> = {
    codigo_produto: '3029055',
    nome_produto: 'TORNEIRA DESCARTAVEL 3VIAS LL',
    quantidade_disponivel_total: 20,
  };

  it('returns a complete projection when there is sufficient data', () => {
    const input: ProductProjectionInput = {
      ...baseInput,
      eventosConsumo: [event(2, new Date(2026, 8, 1)), event(2, new Date(2026, 8, 10))],
    };
    const result = calculateProductProjection(input, today);
    expect(result.dados_insuficientes).toBe(false);
    expect(result.taxa_consumo_diaria).not.toBeNull();
    expect(result.data_estimada_esgotamento).not.toBeNull();
    expect(result.janela_usada_dias).not.toBeNull();
  });

  it('marks as dados_insuficientes with null fields when no window qualifies', () => {
    const input: ProductProjectionInput = {
      ...baseInput,
      eventosConsumo: [event(2, new Date(2026, 8, 1))],
    };
    const result = calculateProductProjection(input, today);
    expect(result.dados_insuficientes).toBe(true);
    expect(result.taxa_consumo_diaria).toBeNull();
    expect(result.data_estimada_esgotamento).toBeNull();
    expect(result.janela_usada_dias).toBeNull();
  });
});

describe('countProjectionsWithinHorizon', () => {
  const makeProjection = (data_estimada_esgotamento: Date | null): ProductProjection => ({
    codigo_produto: '001',
    nome_produto: 'Produto',
    quantidade_disponivel_total: 10,
    taxa_consumo_diaria: data_estimada_esgotamento ? 1 : null,
    data_estimada_esgotamento,
    janela_usada_dias: data_estimada_esgotamento ? 30 : null,
    dados_insuficientes: data_estimada_esgotamento === null,
  });

  it('counts a projection within the horizon', () => {
    const projections = [makeProjection(new Date(2026, 9, 10))]; // 18 dias à frente
    expect(countProjectionsWithinHorizon(projections, today, 30)).toBe(1);
  });

  it('does not count a projection outside the horizon', () => {
    const projections = [makeProjection(new Date(2026, 11, 1))]; // ~70 dias à frente
    expect(countProjectionsWithinHorizon(projections, today, 30)).toBe(0);
  });

  it('never counts a null data_estimada_esgotamento', () => {
    const projections = [makeProjection(null)];
    expect(countProjectionsWithinHorizon(projections, today, 30)).toBe(0);
  });

  it('respects a custom horizon', () => {
    const projections = [makeProjection(new Date(2026, 9, 15))]; // 23 dias à frente
    expect(countProjectionsWithinHorizon(projections, today, 10)).toBe(0);
    expect(countProjectionsWithinHorizon(projections, today, 30)).toBe(1);
  });
});
