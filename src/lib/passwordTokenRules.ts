/**
 * Regras puras dos links de senha (redefinição e primeiro acesso) e do
 * rate limit do "Esqueci minha senha". Sem Firebase, testáveis com Jest.
 * Ver ONLY_FOR_DEVS/TO_DO/FEAT-padronizacao-emails-e-links-de-senha.md (§6.2).
 */

/** `password_reset`: 30 min, consumido no envio da senha. `first_access`: 72 h, uso único no clique. */
export type PasswordTokenPurpose = 'password_reset' | 'first_access';

export const TOKEN_TTL_MINUTES: Record<PasswordTokenPurpose, number> = {
  password_reset: 30,
  first_access: 72 * 60,
};

/** Tempo para salvar a senha depois do clique em "Definir minha senha" (DN-02). */
export const FIRST_ACCESS_SESSION_MINUTES = 30;

export function computeTokenExpiry(purpose: PasswordTokenPurpose, now: Date): Date {
  return new Date(now.getTime() + TOKEN_TTL_MINUTES[purpose] * 60_000);
}

export function computeSessionExpiry(openedAt: Date): Date {
  return new Date(openedAt.getTime() + FIRST_ACCESS_SESSION_MINUTES * 60_000);
}

export type TokenState =
  | 'valid'
  | 'used'
  | 'invalidated'
  | 'expired'
  /** first_access já aberto (nova abertura ou validação). */
  | 'opened'
  /** first_access aberto, sessão conferida e dentro da janela. */
  | 'session_valid'
  /** Sessão ausente, diferente ou vencida. */
  | 'session_invalid'
  /** Abertura pedida para um token que não é de primeiro acesso. */
  | 'not_first_access';

export interface TokenSnapshot {
  purpose?: PasswordTokenPurpose;
  expires_at: Date;
  used_at?: Date | null;
  invalidated_at?: Date | null;
  opened_at?: Date | null;
  session_hash?: string | null;
  session_expires_at?: Date | null;
}

export type TokenMode = 'inspect' | 'open' | 'consume';

/** Token sem `purpose` (emitido antes desta feature) é tratado como redefinição (RN-02). */
export function tokenPurpose(t: Pick<TokenSnapshot, 'purpose'>): PasswordTokenPurpose {
  return t.purpose ?? 'password_reset';
}

/**
 * Estado do token para cada operação:
 * - `inspect` (GET/validar): nunca altera nada;
 * - `open` (clique em "Definir minha senha"): só para first_access não aberto;
 * - `consume` (envio da nova senha): first_access exige sessão válida.
 */
export function evaluatePasswordToken(
  t: TokenSnapshot,
  now: Date,
  mode: TokenMode,
  providedSessionHash?: string
): TokenState {
  if (t.used_at) return 'used';
  if (t.invalidated_at) return 'invalidated';

  const purpose = tokenPurpose(t);

  if (purpose === 'password_reset') {
    if (mode === 'open') return 'not_first_access';
    return now > t.expires_at ? 'expired' : 'valid';
  }

  // first_access
  if (!t.opened_at) {
    if (now > t.expires_at) return 'expired';
    // Consumir sem ter aberto (sem sessão) não é permitido.
    return mode === 'consume' ? 'session_invalid' : 'valid';
  }

  // Já aberto: a validade passa a ser a da sessão, não as 72 h.
  if (mode !== 'consume') return 'opened';
  if (
    !providedSessionHash ||
    !t.session_hash ||
    providedSessionHash !== t.session_hash ||
    !t.session_expires_at ||
    now > t.session_expires_at
  ) {
    return 'session_invalid';
  }
  return 'session_valid';
}

const STATE_MESSAGES: Record<TokenState, string> = {
  valid: '',
  session_valid: '',
  used: 'Este link já foi utilizado. Solicite uma nova senha.',
  invalidated: 'Este link foi substituído por um mais recente. Solicite uma nova senha.',
  expired: 'Este link expirou. Solicite uma nova senha.',
  opened: 'Este link de primeiro acesso já foi utilizado. Solicite uma nova senha.',
  session_invalid: 'Sua sessão para definir a senha expirou. Solicite uma nova senha.',
  not_first_access: 'Este link não é de primeiro acesso.',
};

export function tokenStateMessage(state: TokenState): string {
  return STATE_MESSAGES[state];
}

export interface RateLimitState {
  count: number;
  window_started_at: Date;
}

/** Janela fixa: até `max` tentativas a cada `windowMinutes`, contadas a partir da primeira. */
export function evaluateRateLimit(
  state: RateLimitState | null,
  now: Date,
  limit: { max: number; windowMinutes: number }
): { allowed: boolean; next: RateLimitState } {
  const windowMs = limit.windowMinutes * 60_000;
  if (!state || now.getTime() - state.window_started_at.getTime() >= windowMs) {
    return { allowed: true, next: { count: 1, window_started_at: now } };
  }
  if (state.count >= limit.max) {
    return { allowed: false, next: state };
  }
  return {
    allowed: true,
    next: { count: state.count + 1, window_started_at: state.window_started_at },
  };
}
