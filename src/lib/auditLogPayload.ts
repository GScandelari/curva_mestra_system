/**
 * Audit Log Payload
 * Funções 100% puras (RN-04/RN-05 do UC-53) — sem nenhum import de Firebase
 * (client SDK nem Admin SDK), para serem importáveis tanto por API routes
 * (Admin SDK) quanto por código client-side (auditLogService.ts).
 */

import type { AuditAction, AuditEntityType } from '@/types';

export interface NewAuditLogInput {
  tenant_id: string | null;
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  descricao: string;
  actor_id: string;
  actor_name: string;
  actor_role: 'system_admin' | 'clinic_admin';
  metadata?: Record<string, unknown>;
}

/**
 * Remove apenas chaves `undefined` do objeto — diferente de `removeUndefined`
 * (solicitacaoService.ts), que também remove `null`. Aqui `tenant_id: null`
 * precisa ser preservado (entidades sem escopo de clínica).
 */
function omitUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Monta o objeto plano pronto para `.add()`/`.set()` — SEM `timestamp`, que
 * cada SDK preenche com seu próprio `serverTimestamp()`/`FieldValue.serverTimestamp()`
 * no ponto de escrita.
 */
export function buildAuditLogPayload(input: NewAuditLogInput): Record<string, unknown> {
  return omitUndefined({
    tenant_id: input.tenant_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    action: input.action,
    descricao: input.descricao,
    actor_id: input.actor_id,
    actor_name: input.actor_name,
    actor_role: input.actor_role,
    metadata: input.metadata,
  });
}

export interface AuditActionResult {
  action: AuditAction;
  metadata?: { de: string; para: string };
}

/**
 * Decide a ação de auditoria para uma edição de Usuário a partir do diff
 * entre o estado anterior e o novo. `change_role` tem prioridade quando
 * `role` e `active` mudam simultaneamente.
 */
export function determineUserAuditAction(
  before: { role: string; active: boolean },
  after: { role: string; active: boolean }
): AuditActionResult {
  if (before.role !== after.role) {
    return { action: 'change_role', metadata: { de: before.role, para: after.role } };
  }
  if (before.active && !after.active) {
    return { action: 'deactivate' };
  }
  if (!before.active && after.active) {
    return { action: 'activate' };
  }
  return { action: 'update' };
}

/**
 * Decide a ação de auditoria para uma edição de Consultor a partir do diff
 * de `status`.
 */
export function determineConsultantAuditAction(
  before: { status: string },
  after: { status: string }
): AuditActionResult {
  if (before.status === after.status) {
    return { action: 'update' };
  }
  if (after.status === 'active') {
    return { action: 'reactivate', metadata: { de: before.status, para: after.status } };
  }
  if (after.status === 'suspended' || after.status === 'inactive') {
    return { action: 'suspend', metadata: { de: before.status, para: after.status } };
  }
  return { action: 'update' };
}

export interface FinancialShareState {
  compartilhar_com_consultor: boolean;
  compartilhado_com_consultant_id: string | null;
}

export interface FinancialShareAuditResult {
  action: 'share_with_consultant' | 'unshare_with_consultant';
  metadata: {
    consultant_id: string | null;
    consultant_anterior_id?: string | null;
    motivo?: 'troca_de_consultor';
  };
}

/**
 * Decide se uma gravação da configuração financeira gera entrada de auditoria
 * (D4 da FEAT de precificação: só o compartilhamento com o consultor é
 * auditado). `before: null` = documento ainda não existia (tratado como
 * desligado). `options.trocaDeConsultor` marca a revogação automática da RN-16.
 */
export function determineFinancialShareAuditAction(
  before: FinancialShareState | null,
  after: FinancialShareState,
  options?: { trocaDeConsultor?: boolean }
): FinancialShareAuditResult | null {
  const beforeOn = before?.compartilhar_com_consultor === true;
  const beforeId = beforeOn ? (before?.compartilhado_com_consultant_id ?? null) : null;
  const afterOn = after.compartilhar_com_consultor === true;
  const afterId = afterOn ? after.compartilhado_com_consultant_id : null;

  if (!beforeOn && !afterOn) return null;

  if (!beforeOn && afterOn) {
    return { action: 'share_with_consultant', metadata: { consultant_id: afterId } };
  }

  if (beforeOn && !afterOn) {
    return {
      action: 'unshare_with_consultant',
      metadata: {
        consultant_id: beforeId,
        ...(options?.trocaDeConsultor ? { motivo: 'troca_de_consultor' as const } : {}),
      },
    };
  }

  if (beforeId === afterId) return null;

  return {
    action: 'share_with_consultant',
    metadata: { consultant_id: afterId, consultant_anterior_id: beforeId },
  };
}
