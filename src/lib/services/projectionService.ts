/**
 * Projection Service
 * Cálculo de projeção de reposição de estoque (UC-52)
 */

import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ============================================================================
// TYPES
// ============================================================================

// Ordem de avaliação da cascata: mais estreita (recente) primeiro. Janelas medidas
// a partir de "hoje" são aninhadas (30 ⊆ 60 ⊆ 90), então avaliar da mais larga para
// a mais estreita tornaria o fallback para 60/30 matematicamente inalcançável —
// suficiência em uma janela menor sempre implica suficiência na janela maior que a
// contém. Avaliando da mais estreita, o sistema usa a taxa mais recente disponível e
// só amplia a janela quando os dados recentes forem insuficientes.
export const HISTORY_WINDOWS_DAYS = [30, 60, 90] as const;
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

// ============================================================================
// ORQUESTRADOR — LEITURA FIRESTORE
// ============================================================================

/**
 * Lê inventory + solicitacoes concluídas do tenant e calcula a projeção
 * de esgotamento por codigo_produto (RN-01 a RN-06). 100% client-side, sem
 * persistência do resultado (RN-07).
 */
export async function getReplenishmentProjections(tenantId: string): Promise<ProductProjection[]> {
  try {
    const today = new Date();
    const maxWindowDays = Math.max(...HISTORY_WINDOWS_DAYS);
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - maxWindowDays);

    const inventoryRef = collection(db, 'tenants', tenantId, 'inventory');
    const inventoryQuery = query(inventoryRef, where('active', '==', true));

    const solicitacoesRef = collection(db, 'tenants', tenantId, 'solicitacoes');
    const solicitacoesQuery = query(
      solicitacoesRef,
      where('status', '==', 'concluida'),
      where('dt_procedimento', '>=', Timestamp.fromDate(windowStart))
    );

    const [inventorySnapshot, solicitacoesSnapshot] = await Promise.all([
      getDocs(inventoryQuery),
      getDocs(solicitacoesQuery),
    ]);

    const inventoryByCodigo = new Map<
      string,
      { codigo_produto: string; nome_produto: string; quantidade_disponivel_total: number }
    >();

    inventorySnapshot.forEach((doc) => {
      const data = doc.data();
      const codigo = data.codigo_produto;
      const quantidade = data.quantidade_disponivel || 0;

      const existing = inventoryByCodigo.get(codigo);
      if (existing) {
        existing.quantidade_disponivel_total += quantidade;
      } else {
        inventoryByCodigo.set(codigo, {
          codigo_produto: codigo,
          nome_produto: data.nome_produto,
          quantidade_disponivel_total: quantidade,
        });
      }
    });

    const eventsByCodigo = new Map<string, ConsumptionEvent[]>();

    solicitacoesSnapshot.forEach((doc) => {
      const solicitacao = doc.data();
      const dtProcedimento: Timestamp | undefined = solicitacao.dt_procedimento;
      if (!dtProcedimento) return;
      const dtProcedimentoDate = dtProcedimento.toDate();

      const produtos = solicitacao.produtos_solicitados || [];
      produtos.forEach((produto: any) => {
        // Campo real gravado em ProdutoSolicitado é produto_codigo, não
        // codigo_produto (que só existe em InventoryItem) -- ver
        // src/types/index.ts. O mesmo engano pré-existe em
        // reportService.ts (generateConsumptionReport).
        const codigo = produto.produto_codigo;
        const eventos = eventsByCodigo.get(codigo) ?? [];
        eventos.push({
          quantidade: produto.quantidade || 0,
          dt_procedimento: dtProcedimentoDate,
        });
        eventsByCodigo.set(codigo, eventos);
      });
    });

    const projections: ProductProjection[] = Array.from(inventoryByCodigo.values()).map((item) => {
      const input: ProductProjectionInput = {
        codigo_produto: item.codigo_produto,
        nome_produto: item.nome_produto,
        quantidade_disponivel_total: item.quantidade_disponivel_total,
        eventosConsumo: eventsByCodigo.get(item.codigo_produto) ?? [],
      };
      return calculateProductProjection(input, today);
    });

    projections.sort((a, b) => {
      if (a.data_estimada_esgotamento === null && b.data_estimada_esgotamento === null) return 0;
      if (a.data_estimada_esgotamento === null) return 1;
      if (b.data_estimada_esgotamento === null) return -1;
      return a.data_estimada_esgotamento.getTime() - b.data_estimada_esgotamento.getTime();
    });

    return projections;
  } catch (error) {
    console.error('Erro ao calcular projeção de reposição:', error);
    throw new Error('Falha ao calcular projeção de reposição de estoque');
  }
}
