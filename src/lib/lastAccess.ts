/**
 * Último acesso de usuários (FEAT-ultimo-acesso-usuarios).
 *
 * A fonte é o metadata do Firebase Auth: o último acesso é a data mais recente
 * entre lastRefreshTime e lastSignInTime. Como useAuth força a renovação do
 * token a cada abertura do app, lastRefreshTime reflete o uso real.
 * Funções puras, sem dependência de Firebase.
 */

export const LAST_ACCESS_MAX_UIDS = 100;
const MAX_UID_LENGTH = 128;

/** ISO 8601 (UTC) por UID; null = nunca acessou. */
export type LastAccessMap = Record<string, string | null>;

export interface AuthMetadataLike {
  lastSignInTime?: string | null;
  lastRefreshTime?: string | null;
}

export const LAST_ACCESS_UIDS_ERROR = 'Informe a lista de usuários (uids)';
export const LAST_ACCESS_LIMIT_ERROR = `Máximo de ${LAST_ACCESS_MAX_UIDS} usuários por consulta`;

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function computeLastAccess(metadata: AuthMetadataLike | null | undefined): string | null {
  const times = [parseTime(metadata?.lastRefreshTime), parseTime(metadata?.lastSignInTime)].filter(
    (t): t is number => t !== null
  );
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toISOString();
}

function uniqueUids(uids: string[]): string[] {
  return [...new Set(uids.map((u) => u.trim()).filter((u) => u.length > 0))];
}

export function parseLastAccessRequest(
  body: unknown
): { ok: true; uids: string[] } | { ok: false; error: string } {
  const raw = (body as { uids?: unknown } | null)?.uids;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: LAST_ACCESS_UIDS_ERROR };
  const valid = raw.every(
    (u) => typeof u === 'string' && u.trim().length > 0 && u.trim().length <= MAX_UID_LENGTH
  );
  if (!valid) return { ok: false, error: LAST_ACCESS_UIDS_ERROR };

  const uids = uniqueUids(raw as string[]);
  if (uids.length > LAST_ACCESS_MAX_UIDS) return { ok: false, error: LAST_ACCESS_LIMIT_ERROR };
  return { ok: true, uids };
}

export function chunkUids(uids: string[], size: number = LAST_ACCESS_MAX_UIDS): string[][] {
  const unique = uniqueUids(uids);
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += size) chunks.push(unique.slice(i, i + size));
  return chunks;
}

const LABEL_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** undefined → '—' (sem dado); null → 'Nunca acessou'; ISO → 'dd/mm/aaaa HH:mm' (Brasília). */
export function formatLastAccessLabel(value: string | null | undefined): string {
  if (value === undefined) return '—';
  if (value === null) return 'Nunca acessou';
  const time = parseTime(value);
  if (time === null) return '—';
  const parts = Object.fromEntries(
    LABEL_FORMAT.formatToParts(new Date(time)).map((p) => [p.type, p.value])
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}
