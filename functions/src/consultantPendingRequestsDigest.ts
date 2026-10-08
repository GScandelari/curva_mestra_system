/**
 * Consultant Pending Requests Digest — lógica pura do e-mail diário de UC-57.
 * Zero import de Firestore. ESPELHO MANUAL de
 * src/lib/consultantPendingRequestsDigest.ts (fonte canônica, testada via Jest)
 * — o deploy de functions/ empacota só functions/src (firebase.json /
 * functions/tsconfig.json), então functions/src não pode importar de src/lib
 * diretamente (compilaria localmente, mas o arquivo nunca seria enviado ao
 * runtime real). Qualquer mudança em src/lib/consultantPendingRequestsDigest.ts
 * precisa ser replicada aqui também.
 */

export interface PendingRequestDigestItem {
  full_name: string;
  business_name: string;
  created_at: Date | null;
}

export const DIGEST_TIME_ZONE = 'America/Sao_Paulo';

/**
 * `renderTemplate` (UC-55) não escapa variáveis — o bloco é HTML pré-montado
 * (mesmo padrão de `motivoBlock`). Nome/clínica vêm de um formulário público
 * (UC-01), então todo dado do solicitante é escapado aqui.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDigestDate(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return 'data não informada';
  return date.toLocaleString('pt-BR', {
    timeZone: DIGEST_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Monta a lista HTML das solicitações pendentes de um consultor, da mais
 * antiga para a mais recente (a mais antiga é a mais urgente).
 */
export function buildPendingRequestsDigestHtml(items: PendingRequestDigestItem[]): string {
  const sorted = [...items].sort(
    (a, b) => (a.created_at?.getTime() ?? 0) - (b.created_at?.getTime() ?? 0)
  );
  const lines = sorted.map(
    (item) =>
      `<li style="margin-bottom: 8px;"><strong>${escapeHtml(item.full_name || 'Solicitante')}</strong>` +
      ` — ${escapeHtml(item.business_name || '-')}` +
      ` <span style="color: #6b7280;">(enviada em ${formatDigestDate(item.created_at)})</span></li>`
  );
  return `<ul style="padding-left: 20px;">${lines.join('')}</ul>`;
}

/**
 * Variáveis do template `consultant_pending_access_requests_digest`
 * (scripts/seed-email-templates.ts). Um e-mail por consultor, cobrindo todas
 * as pendências vinculadas a ele (UC-57 RN-01/RN-02).
 */
export function buildConsultantDigestVariables(
  consultantName: string,
  items: PendingRequestDigestItem[]
): Record<string, string> {
  return {
    consultantName: escapeHtml(consultantName || 'Consultor'),
    pendingCount: String(items.length),
    pendingRequestsBlock: buildPendingRequestsDigestHtml(items),
  };
}
