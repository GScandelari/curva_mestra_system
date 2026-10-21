/**
 * Regras puras da tela de Configurações do Sistema (`system_settings/global`,
 * UC-35). Sem imports de `firebase/*` para poderem ser testadas com Jest.
 *
 * Contexto (UX-046): a tela não pode salvar sobre valores que não leu do
 * servidor, nem sobrescrever uma alteração feita em outra sessão.
 * Ver ONLY_FOR_DEVS/TO_DO/BUGFIX-admin-settings-sobrescrita-falha-leitura.md.
 */

export interface SystemSettingsForm {
  session_timeout_minutes: number;
  maintenance_mode: boolean;
  maintenance_message: string; // sempre string no formulário ('' se ausente)
  registration_enabled: boolean;
}

export const DEFAULT_SYSTEM_SETTINGS_FORM: SystemSettingsForm = {
  session_timeout_minutes: 15,
  maintenance_mode: false,
  maintenance_message: '',
  registration_enabled: true,
};

/** Forma mínima de um Timestamp do Firestore, para manter as funções puras. */
export interface TimestampLike {
  seconds: number;
  nanoseconds: number;
}

/** Base de revisão: o que foi lido do servidor e contra o que o salvamento compara. */
export interface SettingsBaseline {
  exists: boolean;
  updatedAt: TimestampLike | null;
}

export type SettingsLoadStatus = 'loading' | 'loaded' | 'missing' | 'error' | 'stale';

/**
 * Converte o documento lido no valor que o sistema efetivamente aplica,
 * espelhando o fallback de cada consumidor:
 * - timeout: useSessionTimeout (número finito > 0, senão 15);
 * - maintenance_mode: ProtectedRoute (só bloqueia se === true);
 * - registration_enabled: /api/access-requests (só fecha se === false).
 */
export function normalizeSystemSettingsForm(
  data: Record<string, unknown> | undefined
): SystemSettingsForm {
  if (!data) return { ...DEFAULT_SYSTEM_SETTINGS_FORM };

  const timeout = data.session_timeout_minutes;
  return {
    session_timeout_minutes:
      typeof timeout === 'number' && Number.isFinite(timeout) && timeout > 0
        ? timeout
        : DEFAULT_SYSTEM_SETTINGS_FORM.session_timeout_minutes,
    maintenance_mode: data.maintenance_mode === true,
    maintenance_message:
      typeof data.maintenance_message === 'string' ? data.maintenance_message : '',
    registration_enabled: data.registration_enabled !== false,
  };
}

export function validateSystemSettingsForm(
  form: SystemSettingsForm
): { ok: true } | { ok: false; message: string } {
  const timeout = form.session_timeout_minutes;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 1440) {
    return { ok: false, message: 'O timeout deve estar entre 1 e 1440 minutos (24 horas)' };
  }
  return { ok: true };
}

/** true quando o documento mudou (criado, apagado ou regravado) desde a leitura. */
export function hasConcurrentChange(loaded: SettingsBaseline, current: SettingsBaseline): boolean {
  if (loaded.exists !== current.exists) return true;

  const a = loaded.updatedAt;
  const b = current.updatedAt;
  if (a === null && b === null) return false;
  if (a === null || b === null) return true;
  return a.seconds !== b.seconds || a.nanoseconds !== b.nanoseconds;
}

/**
 * Só os campos editáveis + autor. `id` não é mais gravado e `updated_at`
 * (serverTimestamp) é acrescentado pela página.
 */
export function buildSystemSettingsPayload(
  form: SystemSettingsForm,
  uid: string
): SystemSettingsForm & { updated_by: string } {
  return {
    session_timeout_minutes: form.session_timeout_minutes,
    maintenance_mode: form.maintenance_mode,
    maintenance_message: form.maintenance_message,
    registration_enabled: form.registration_enabled,
    updated_by: uid,
  };
}

/** Só se salva sobre uma base lida do servidor (documento existente ou inexistente confirmado). */
export function canSaveSystemSettings(status: SettingsLoadStatus, saving: boolean): boolean {
  return (status === 'loaded' || status === 'missing') && !saving;
}
