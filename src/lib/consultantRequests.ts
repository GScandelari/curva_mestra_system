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
 * Verifica se uma pendência já expirou, com base em `expires_at`.
 * Documentos legados/sem `expires_at` NUNCA são considerados expirados (RN-11/RN-12).
 * Mesmo padrão de comparação usado em `validateToken`/`consumeToken`
 * (`new Date() > expiresAt`), aqui centralizado como função pura testável.
 */
export function isRequestExpired(
  request: Pick<ConsultantTransferRequest, 'expires_at'>,
  now: Date = new Date()
): boolean {
  if (!request.expires_at) return false;
  const expiresAtDate = (request.expires_at as Timestamp).toDate
    ? (request.expires_at as Timestamp).toDate()
    : new Date(request.expires_at as unknown as string);
  return now > expiresAtDate;
}
