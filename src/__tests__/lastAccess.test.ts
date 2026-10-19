/**
 * Último acesso (FEAT-ultimo-acesso-usuarios): cálculo a partir do metadata do
 * Auth, validação do body da API, lotes de UIDs e rótulo em pt-BR (Brasília).
 */
import {
  LAST_ACCESS_LIMIT_ERROR,
  LAST_ACCESS_MAX_UIDS,
  LAST_ACCESS_UIDS_ERROR,
  chunkUids,
  computeLastAccess,
  formatLastAccessLabel,
  parseLastAccessRequest,
} from '../lib/lastAccess';

describe('computeLastAccess', () => {
  it('usa a data mais recente entre renovação e login (formato RFC 1123 do Admin SDK)', () => {
    expect(
      computeLastAccess({
        lastSignInTime: 'Mon, 12 Oct 2026 12:00:00 GMT',
        lastRefreshTime: 'Sat, 17 Oct 2026 18:30:00 GMT',
      })
    ).toBe('2026-10-17T18:30:00.000Z');
    expect(
      computeLastAccess({
        lastSignInTime: 'Sun, 18 Oct 2026 10:00:00 GMT',
        lastRefreshTime: 'Sat, 17 Oct 2026 18:30:00 GMT',
      })
    ).toBe('2026-10-18T10:00:00.000Z');
  });

  it('aceita só uma das datas', () => {
    expect(computeLastAccess({ lastSignInTime: '2026-10-01T09:00:00Z' })).toBe(
      '2026-10-01T09:00:00.000Z'
    );
    expect(
      computeLastAccess({ lastRefreshTime: '2026-10-02T09:00:00Z', lastSignInTime: null })
    ).toBe('2026-10-02T09:00:00.000Z');
  });

  it('devolve null sem datas válidas (nunca acessou)', () => {
    expect(computeLastAccess({})).toBeNull();
    expect(computeLastAccess({ lastSignInTime: '', lastRefreshTime: null })).toBeNull();
    expect(computeLastAccess({ lastSignInTime: 'não é data' })).toBeNull();
    expect(computeLastAccess(null)).toBeNull();
    expect(computeLastAccess(undefined)).toBeNull();
  });
});

describe('parseLastAccessRequest', () => {
  it('aceita a lista, remove espaços, vazios e duplicados', () => {
    expect(parseLastAccessRequest({ uids: ['a', ' b ', 'a', 'b'] })).toEqual({
      ok: true,
      uids: ['a', 'b'],
    });
  });

  it.each([
    [null],
    [{}],
    [{ uids: 'a' }],
    [{ uids: [] }],
    [{ uids: ['a', 1] }],
    [{ uids: ['a', '   '] }],
    [{ uids: ['x'.repeat(129)] }],
  ])('rejeita body inválido %p', (body) => {
    expect(parseLastAccessRequest(body)).toEqual({ ok: false, error: LAST_ACCESS_UIDS_ERROR });
  });

  it('aceita até o limite e rejeita acima dele (contando sem duplicados)', () => {
    const limite = Array.from({ length: LAST_ACCESS_MAX_UIDS }, (_, i) => `u${i}`);
    expect(parseLastAccessRequest({ uids: [...limite, 'u0'] })).toEqual({ ok: true, uids: limite });
    expect(parseLastAccessRequest({ uids: [...limite, 'extra'] })).toEqual({
      ok: false,
      error: LAST_ACCESS_LIMIT_ERROR,
    });
  });
});

describe('chunkUids', () => {
  it('divide em lotes sem duplicados nem vazios', () => {
    expect(chunkUids(['a', 'b', 'a', '', 'c', 'd', 'e'], 2)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e'],
    ]);
    expect(chunkUids([])).toEqual([]);
  });

  it('usa lotes de 100 por padrão', () => {
    const uids = Array.from({ length: 250 }, (_, i) => `u${i}`);
    expect(chunkUids(uids).map((c) => c.length)).toEqual([100, 100, 50]);
  });
});

describe('formatLastAccessLabel', () => {
  it('formata em dd/mm/aaaa HH:mm no horário de Brasília, sem vírgula', () => {
    expect(formatLastAccessLabel('2026-10-17T18:30:00.000Z')).toBe('17/10/2026 15:30');
    expect(formatLastAccessLabel('2026-10-18T02:05:00.000Z')).toBe('17/10/2026 23:05');
    expect(formatLastAccessLabel('2026-10-18T03:00:00.000Z')).toBe('18/10/2026 00:00');
  });

  it('diferencia "sem dado" de "nunca acessou"', () => {
    expect(formatLastAccessLabel(undefined)).toBe('—');
    expect(formatLastAccessLabel(null)).toBe('Nunca acessou');
    expect(formatLastAccessLabel('inválida')).toBe('—');
  });
});
