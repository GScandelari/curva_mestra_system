import type { ConsultantPendencyType, ConsultantTransferRequest } from '@/types';
import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Normaliza o tipo de uma pendência, tratando documentos legados (sem `type`)
 * como 'transfer' — único tipo que existia antes desta feature.
 */
export function normalizeLegacyType(
  type: ConsultantPendencyType | undefined
): ConsultantPendencyType {
  return type ?? 'transfer';
}

export function isInviteRequest(request: Pick<ConsultantTransferRequest, 'type'>): boolean {
  return normalizeLegacyType(request.type) === 'invite';
}

/**
 * Resolve qual consultor deve aprovar/rejeitar a pendência.
 * - 'invite': o próprio consultor convidado (requesting_consultant_id).
 * - 'transfer': o consultor atualmente vinculado (current_consultant_id).
 * Lança erro se type === 'transfer' e current_consultant_id estiver ausente
 * (estado de dado inválido — nunca deveria ocorrer para esse tipo).
 */
export function getApproverConsultantId(
  request: Pick<
    ConsultantTransferRequest,
    'type' | 'requesting_consultant_id' | 'current_consultant_id'
  >
): string {
  if (isInviteRequest(request)) {
    return request.requesting_consultant_id;
  }
  if (!request.current_consultant_id) {
    throw new Error('current_consultant_id ausente para pendência do tipo transfer');
  }
  return request.current_consultant_id;
}

export function getPendencyTypeLabel(type: ConsultantPendencyType | undefined): string {
  return normalizeLegacyType(type) === 'invite' ? 'Convite' : 'Transferência';
}

/** Prazo padrão de validade de uma pendência, em dias (RN-11). */
export const PENDENCY_EXPIRY_DAYS = 15;

/**
 * Calcula a data de expiração a partir de uma data de criação (created_at + 15 dias).
 * Mesma lógica de `TOKEN_EXPIRY_MINUTES` em `passwordResetService.ts`, adaptada para dias.
 */
export function computeExpiresAt(createdAt: Date = new Date()): Date {
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + PENDENCY_EXPIRY_DAYS);
  return expiresAt;
}

/**
 * Normaliza um `expires_at` vindo de três formas possíveis para um `Date`:
 * - instância de `Timestamp` do Admin SDK (uso no servidor, dentro das API routes);
 * - `{ _seconds, _nanoseconds }`, formato em que um Timestamp chega ao client depois
 *   de serializado por `NextResponse.json()` (mesmo padrão de `formatTimestamp` em
 *   `src/lib/utils.ts`, usado pelas telas que consomem `isRequestExpired`);
 * - string/Date, para o caso de teste ou de já ter sido normalizado antes.
 */
function toDateSafe(value: unknown): Date {
  if (value instanceof Date) return value;
  if ((value as Timestamp)?.toDate) return (value as Timestamp).toDate();
  if (value && typeof value === 'object' && '_seconds' in (value as Record<string, unknown>)) {
    const { _seconds } = value as { _seconds: number };
    return new Date(_seconds * 1000);
  }
  return new Date(value as string);
}

/**
 * Verifica se uma pendência já expirou, com base em `expires_at`.
 * Documentos legados/sem `expires_at` NUNCA são considerados expirados (RN-11/RN-12).
 * Mesmo padrão de comparação usado em `validateToken`/`consumeToken`
 * (`new Date() > expiresAt`), aqui centralizado como função pura testável.
 * Funciona tanto no servidor (Timestamp do Admin SDK) quanto no client
 * (Timestamp já serializado em JSON) — ver `toDateSafe`.
 */
export function isRequestExpired(
  request: Pick<ConsultantTransferRequest, 'expires_at'>,
  now: Date = new Date()
): boolean {
  if (!request.expires_at) return false;
  return now > toDateSafe(request.expires_at);
}
