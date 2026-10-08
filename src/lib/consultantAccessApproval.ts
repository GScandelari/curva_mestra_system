import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Regras puras de elegibilidade do UC-56 (Consultor Aprova Solicitação de
 * Acesso Vinculada ao Seu Código). Zero import de Firestore em runtime — usada
 * tanto por `POST /api/access-requests/[id]/approve-consultant` (decisão
 * autoritativa) quanto por `GET /api/consultants/me/pending-access-requests`
 * (anotação de cada linha da tela), para que as duas nunca divirjam.
 */

/**
 * Janela de exclusividade: 2 dias CORRIDOS (48h) a partir de `created_at`,
 * sem exclusão de fim de semana/feriado (UC-56 RN-02/RN-03/RNF-04). "2 dias
 * úteis" é só o texto exibido em /register — não é a regra de cálculo.
 */
export const EXCLUSIVITY_WINDOW_HOURS = 48;

const EXCLUSIVITY_WINDOW_MS = EXCLUSIVITY_WINDOW_HOURS * 60 * 60 * 1000;

/**
 * Normaliza um timestamp vindo como `Timestamp` do Admin SDK, como
 * `{ _seconds }` (Timestamp serializado por `NextResponse.json()`), `Date` ou
 * string — mesmo padrão de `toDateSafe` em `consultantRequests.ts`.
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

/** Momento em que a exclusividade do consultor vinculado termina (created_at + 48h). */
export function computeExclusivityExpiresAt(createdAt: unknown): Date {
  return new Date(toDateSafe(createdAt).getTime() + EXCLUSIVITY_WINDOW_MS);
}

export interface ConsultantApprovalInput {
  /** `consultant_id` gravado na solicitação (UC-01 RN-08), ou ausente */
  requestConsultantId?: string | null;
  /** `consultant_id` do consultor autenticado que quer aprovar */
  actingConsultantId: string;
  /** `created_at` da solicitação */
  createdAt: unknown;
}

/**
 * Decide se o consultor autenticado pode aprovar a solicitação agora:
 * - sem consultor vinculado → qualquer consultor ativo, desde o início (RN-05);
 * - vinculada ao próprio consultor → sempre (RN-02);
 * - vinculada a outro consultor → só depois de 48h de `created_at` (RN-03).
 * Único cenário bloqueado: vínculo com outro consultor e janela ainda aberta
 * (Fluxo de Exceção 8a). Não verifica status do consultor (RN-07) nem da
 * solicitação — responsabilidade de quem chama.
 */
export function canConsultantApprove(
  input: ConsultantApprovalInput,
  now: Date = new Date()
): boolean {
  if (!input.requestConsultantId) return true;
  if (input.requestConsultantId === input.actingConsultantId) return true;
  return now.getTime() >= computeExclusivityExpiresAt(input.createdAt).getTime();
}
