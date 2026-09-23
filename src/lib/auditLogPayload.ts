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
