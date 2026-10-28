import {
  computeSessionExpiry,
  computeTokenExpiry,
  evaluatePasswordToken,
  evaluateRateLimit,
  tokenPurpose,
  type TokenSnapshot,
} from '@/lib/passwordTokenRules';

const NOW = new Date('2026-10-28T12:00:00Z');
const min = (n: number) => new Date(NOW.getTime() + n * 60_000);

function token(overrides: Partial<TokenSnapshot> = {}): TokenSnapshot {
  return { purpose: 'password_reset', expires_at: min(30), ...overrides };
}

describe('computeTokenExpiry', () => {
  it('redefinição vale 30 minutos', () => {
    expect(computeTokenExpiry('password_reset', NOW)).toEqual(min(30));
  });

  it('primeiro acesso vale 72 horas', () => {
    expect(computeTokenExpiry('first_access', NOW)).toEqual(min(72 * 60));
  });

  it('sessão de primeiro acesso vale 30 minutos após a abertura', () => {
    expect(computeSessionExpiry(NOW)).toEqual(min(30));
  });
});

describe('tokenPurpose', () => {
  it('token antigo sem purpose é redefinição', () => {
    expect(tokenPurpose({})).toBe('password_reset');
  });
});

describe('evaluatePasswordToken — password_reset', () => {
  it('válido para inspecionar e consumir dentro do prazo', () => {
    expect(evaluatePasswordToken(token(), NOW, 'inspect')).toBe('valid');
    expect(evaluatePasswordToken(token(), NOW, 'consume')).toBe('valid');
  });

  it('expirado após 30 minutos', () => {
    expect(evaluatePasswordToken(token({ expires_at: min(-1) }), NOW, 'consume')).toBe('expired');
  });

  it('usado e invalidado têm prioridade sobre validade', () => {
    expect(evaluatePasswordToken(token({ used_at: min(-5) }), NOW, 'inspect')).toBe('used');
    expect(evaluatePasswordToken(token({ invalidated_at: min(-5) }), NOW, 'inspect')).toBe(
      'invalidated'
    );
  });

  it('não pode ser aberto como primeiro acesso', () => {
    expect(evaluatePasswordToken(token(), NOW, 'open')).toBe('not_first_access');
  });

  it('token legado (sem purpose) segue a regra de redefinição', () => {
    const legacy = token({ purpose: undefined });
    expect(evaluatePasswordToken(legacy, NOW, 'consume')).toBe('valid');
    expect(evaluatePasswordToken(legacy, NOW, 'open')).toBe('not_first_access');
  });
});

describe('evaluatePasswordToken — first_access', () => {
  const fresh = () => token({ purpose: 'first_access', expires_at: min(72 * 60) });
  const opened = (sessionMinutesLeft = 20) =>
    token({
      purpose: 'first_access',
      expires_at: min(72 * 60),
      opened_at: min(-10),
      session_hash: 'abc',
      session_expires_at: min(sessionMinutesLeft),
    });

  it('não aberto: válido para inspecionar e abrir', () => {
    expect(evaluatePasswordToken(fresh(), NOW, 'inspect')).toBe('valid');
    expect(evaluatePasswordToken(fresh(), NOW, 'open')).toBe('valid');
  });

  it('não aberto: consumir sem sessão é recusado', () => {
    expect(evaluatePasswordToken(fresh(), NOW, 'consume', 'abc')).toBe('session_invalid');
  });

  it('não aberto e vencido: expirado', () => {
    const t = token({ purpose: 'first_access', expires_at: min(-1) });
    expect(evaluatePasswordToken(t, NOW, 'open')).toBe('expired');
  });

  it('aberto: nova abertura ou inspeção mostram "já utilizado"', () => {
    expect(evaluatePasswordToken(opened(), NOW, 'open')).toBe('opened');
    expect(evaluatePasswordToken(opened(), NOW, 'inspect')).toBe('opened');
  });

  it('aberto: consome com a sessão correta dentro da janela', () => {
    expect(evaluatePasswordToken(opened(), NOW, 'consume', 'abc')).toBe('session_valid');
  });

  it('aberto: sessão ausente, diferente ou vencida é recusada', () => {
    expect(evaluatePasswordToken(opened(), NOW, 'consume')).toBe('session_invalid');
    expect(evaluatePasswordToken(opened(), NOW, 'consume', 'xyz')).toBe('session_invalid');
    expect(evaluatePasswordToken(opened(-1), NOW, 'consume', 'abc')).toBe('session_invalid');
  });

  it('aberto: a sessão vale mesmo se as 72 h vencerem durante ela', () => {
    const t = { ...opened(), expires_at: min(-1) };
    expect(evaluatePasswordToken(t, NOW, 'consume', 'abc')).toBe('session_valid');
  });

  it('usado depois de definir a senha', () => {
    const t = { ...opened(), used_at: min(-1) };
    expect(evaluatePasswordToken(t, NOW, 'consume', 'abc')).toBe('used');
  });
});

describe('evaluateRateLimit', () => {
  const limit = { max: 3, windowMinutes: 15 };

  it('primeira tentativa abre a janela', () => {
    expect(evaluateRateLimit(null, NOW, limit)).toEqual({
      allowed: true,
      next: { count: 1, window_started_at: NOW },
    });
  });

  it('conta dentro da janela e bloqueia ao atingir o máximo', () => {
    const start = min(-5);
    expect(evaluateRateLimit({ count: 2, window_started_at: start }, NOW, limit)).toEqual({
      allowed: true,
      next: { count: 3, window_started_at: start },
    });
    expect(evaluateRateLimit({ count: 3, window_started_at: start }, NOW, limit).allowed).toBe(
      false
    );
  });

  it('janela vencida reinicia a contagem', () => {
    const result = evaluateRateLimit({ count: 3, window_started_at: min(-15) }, NOW, limit);
    expect(result).toEqual({ allowed: true, next: { count: 1, window_started_at: NOW } });
  });
});
