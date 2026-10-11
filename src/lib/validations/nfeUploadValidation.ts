/**
 * Guardas puras de POST /api/parse-nf-xml (UC-10-RN-13): quem pode importar,
 * tamanho máximo e formato do envio. Sem import de Firebase — testáveis com Jest
 * e chamadas pela rota na ordem 401 → 403 → 413 → 400/413.
 */

export const MAX_NFE_XML_BYTES = 10 * 1024 * 1024; // UC-10 RNF-01 — igual ao FileUpload (maxSizeMB=10)
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export type NfeUploadGuardResult =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 413; error: string };

export interface NfeUploadClaims {
  role?: unknown;
  active?: unknown;
  tenant_id?: unknown;
}

export interface NfeUploadEntry {
  name: string;
  size: number;
}

const ARQUIVO_GRANDE = 'Arquivo muito grande. Máximo: 10MB';

/** 403 se não for clinic_admin ativo com tenant_id preenchido. */
export function checkParseNfeClaims(claims: NfeUploadClaims): NfeUploadGuardResult {
  const ok =
    claims.role === 'clinic_admin' &&
    claims.active === true &&
    typeof claims.tenant_id === 'string' &&
    claims.tenant_id.length > 0;
  return ok
    ? { ok: true }
    : {
        ok: false,
        status: 403,
        error: 'Apenas administradores ativos da clínica podem importar NF-e',
      };
}

/**
 * 413 antes de ler o corpo quando o Content-Length declarado já passa do limite.
 * Header ausente ou inválido segue adiante — a checagem do arquivo cobre depois.
 */
export function checkRequestContentLength(header: string | null): NfeUploadGuardResult {
  if (!header) return { ok: true };
  const bytes = Number(header);
  if (!Number.isFinite(bytes) || bytes < 0) return { ok: true };
  return bytes > MAX_NFE_XML_BYTES + MULTIPART_OVERHEAD_BYTES
    ? { ok: false, status: 413, error: ARQUIVO_GRANDE }
    : { ok: true };
}

/** Exatamente um arquivo .xml, não vazio, de até 10MB. */
export function validateNfeUploadEntries(entries: NfeUploadEntry[]): NfeUploadGuardResult {
  if (entries.length === 0) return { ok: false, status: 400, error: 'Nenhum arquivo enviado' };
  if (entries.length > 1) {
    return { ok: false, status: 400, error: 'Envie apenas um arquivo XML por vez' };
  }
  const [arquivo] = entries;
  if (!arquivo.name.toLowerCase().endsWith('.xml')) {
    return { ok: false, status: 400, error: 'Apenas arquivos XML são aceitos nesta rota' };
  }
  if (arquivo.size === 0) return { ok: false, status: 400, error: 'Arquivo vazio' };
  if (arquivo.size > MAX_NFE_XML_BYTES) return { ok: false, status: 413, error: ARQUIVO_GRANDE };
  return { ok: true };
}
