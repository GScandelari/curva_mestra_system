/**
 * Projection Service
 * Cálculo de projeção de reposição de estoque (UC-52)
 */

// ============================================================================
// TYPES
// ============================================================================

export const HISTORY_WINDOWS_DAYS = [90, 60, 30] as const;
export type HistoryWindowDays = (typeof HISTORY_WINDOWS_DAYS)[number];

// Critério de suficiência de dados (RN-03), confirmado pelo usuário em 22/09/2026.
export const MIN_DISTINCT_CONSUMPTION_DATES = 2;

export interface ConsumptionEvent {
  quantidade: number;
  dt_procedimento: Date;
}

export interface ProductProjectionInput {
  codigo_produto: string;
  nome_produto: string;
  quantidade_disponivel_total: number;
  eventosConsumo: ConsumptionEvent[];
}

export interface ProductProjection {
  codigo_produto: string;
  nome_produto: string;
  quantidade_disponivel_total: number;
  taxa_consumo_diaria: number | null;
  data_estimada_esgotamento: Date | null;
  janela_usada_dias: HistoryWindowDays | null;
  dados_insuficientes: boolean;
}

export interface WindowSelectionResult {
  windowDays: HistoryWindowDays;
  taxaConsumoDiaria: number;
}

// ============================================================================
// FUNÇÕES PURAS DE CÁLCULO (RN-01 a RN-06)
// ============================================================================

function dateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function isWindowDataSufficient(events: ConsumptionEvent[]): boolean {
  const distinctDates = new Set(events.map((event) => dateKey(event.dt_procedimento)));
  return distinctDates.size >= MIN_DISTINCT_CONSUMPTION_DATES;
}

export function filterEventsWithinWindow(
  events: ConsumptionEvent[],
  today: Date,
  windowDays: number
): ConsumptionEvent[] {
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - windowDays);

  return events.filter(
    (event) => event.dt_procedimento >= windowStart && event.dt_procedimento <= today
  );
}

export function calculateDailyConsumptionRate(
  events: ConsumptionEvent[],
  windowDays: number
): number {
  if (events.length === 0 || windowDays <= 0) return 0;
  const total = events.reduce((sum, event) => sum + event.quantidade, 0);
  return total / windowDays;
}

export function selectConsumptionWindow(
  allEvents: ConsumptionEvent[],
  today: Date
): WindowSelectionResult | null {
  for (const windowDays of HISTORY_WINDOWS_DAYS) {
    const eventsInWindow = filterEventsWithinWindow(allEvents, today, windowDays);
    if (isWindowDataSufficient(eventsInWindow)) {
      return {
        windowDays,
        taxaConsumoDiaria: calculateDailyConsumptionRate(eventsInWindow, windowDays),
      };
    }
  }
  return null;
}

export function calculateEstimatedDepletionDate(
  quantidadeDisponivelTotal: number,
  taxaConsumoDiaria: number,
  today: Date
): Date | null {
  if (taxaConsumoDiaria <= 0) return null;

  const diasParaEsgotar = Math.ceil(quantidadeDisponivelTotal / taxaConsumoDiaria);
  const dataEstimada = new Date(today);
  dataEstimada.setDate(dataEstimada.getDate() + diasParaEsgotar);
  return dataEstimada;
}

export function calculateProductProjection(
  input: ProductProjectionInput,
  today: Date
): ProductProjection {
  const base = {
    codigo_produto: input.codigo_produto,
    nome_produto: input.nome_produto,
    quantidade_disponivel_total: input.quantidade_disponivel_total,
  };

  const windowSelection = selectConsumptionWindow(input.eventosConsumo, today);

  if (!windowSelection) {
    return {
      ...base,
      taxa_consumo_diaria: null,
      data_estimada_esgotamento: null,
      janela_usada_dias: null,
      dados_insuficientes: true,
    };
  }

  const dataEstimada = calculateEstimatedDepletionDate(
    input.quantidade_disponivel_total,
    windowSelection.taxaConsumoDiaria,
    today
  );

  return {
    ...base,
    taxa_consumo_diaria: windowSelection.taxaConsumoDiaria,
    data_estimada_esgotamento: dataEstimada,
    janela_usada_dias: windowSelection.windowDays,
    dados_insuficientes: dataEstimada === null,
  };
}

export function countProjectionsWithinHorizon(
  projections: ProductProjection[],
  today: Date,
  horizonDays: number = 30
): number {
  const horizonDate = new Date(today);
  horizonDate.setDate(horizonDate.getDate() + horizonDays);

  return projections.filter(
    (projection) =>
      projection.data_estimada_esgotamento !== null &&
      projection.data_estimada_esgotamento <= horizonDate
  ).length;
}
