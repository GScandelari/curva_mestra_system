/**
 * Alert Rules — lógica pura de decisão de alertas (vencimento/estoque baixo)
 * Zero import de Firestore (client ou Admin SDK) — compartilhada entre
 * src/lib/services/alertTriggers.ts (client SDK, fluxo manual UC-42) e
 * functions/src/alertChecks.ts (Admin SDK, Scheduled Function). Como o
 * deploy de functions/ empacota só functions/src (firebase.json/tsconfig),
 * este arquivo é espelhado manualmente em functions/src/alertRules.ts —
 * qualquer mudança aqui precisa ser replicada lá também.
 */

/** Converte "DD/MM/YYYY" em Date à meia-noite (hora local), ou null se inválido. */
export function parseBrDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const [day, month, year] = value.split('/');
  if (!day || !month || !year) return null;
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Meia-noite de hoje (hora local) — base de comparação para as regras abaixo. */
export function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** Data limite do alerta de vencimento: hoje + warningDays. */
export function computeExpiryLimitDate(today: Date, warningDays: number): Date {
  const limit = new Date(today);
  limit.setDate(limit.getDate() + warningDays);
  return limit;
}

/** Dias inteiros entre hoje e a data de vencimento (arredondado para cima). */
export function daysUntil(expiryDate: Date, today: Date): number {
  return Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** Threshold de dias de antecedência para o alerta de vencimento (RN, padrão 30). */
export function resolveExpiryWarningDays(warningDaysSetting: number | undefined | null): number {
  return warningDaysSetting || 30;
}

/** Um item está "vencendo" quando a validade cai dentro da janela [hoje, hoje+warningDays]. */
export function isWithinExpiryWindow(expiryDate: Date, today: Date, limitDate: Date): boolean {
  return expiryDate >= today && expiryDate <= limitDate;
}

/** Um item está "vencido" quando a validade já passou de hoje. */
export function isExpired(expiryDate: Date, today: Date): boolean {
  return expiryDate < today;
}

/**
 * Threshold de estoque baixo para um produto: limite específico do produto,
 * senão o threshold global do tenant, senão o padrão 10 (mesma cascata de
 * fallback de checkLowStock).
 */
export function resolveLowStockThreshold(
  perProductLimit: number | undefined | null,
  globalThreshold: number | undefined | null
): number {
  return perProductLimit ?? globalThreshold ?? 10;
}

/** Estoque baixo: quantidade total > 0 (não é ruptura) e <= o limite mínimo. */
export function isLowStock(totalQuantity: number, minQuantity: number): boolean {
  return totalQuantity > 0 && totalQuantity <= minQuantity;
}
