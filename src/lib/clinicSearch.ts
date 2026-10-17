/**
 * Busca de clínicas pelo consultor (Buscar Clínicas) — regras puras
 * (FEAT-ajustes-registro-e-busca-consultor). Usadas pela tela e pela rota
 * GET /api/tenants/search: classificação da consulta (documento ou nome),
 * normalização de texto e casamento por nome da clínica ou do especialista.
 */

export const MIN_NAME_QUERY_LENGTH = 3;
export const MAX_NAME_RESULTS = 20;
export const SEARCH_QUERY_INVALID_ERROR =
  'Informe o CPF (11 dígitos), o CNPJ (14 dígitos) ou ao menos 3 letras do nome';
export const NAME_QUERY_TOO_SHORT_ERROR =
  'Digite ao menos 3 letras do nome da clínica ou do especialista';

/** Minúsculas, sem acento, espaços colapsados, sem espaço nas pontas. */
export function normalizeSearchText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export type ClinicSearchQuery =
  | { kind: 'document'; document: string }
  | { kind: 'name'; term: string }
  | { kind: 'invalid'; error: string };

/**
 * Com letra → busca por nome (nomes de clínica com número, como "Clínica 24h",
 * sempre têm letra). Sem letra e com 11 ou 14 dígitos → documento.
 */
export function classifyClinicSearchQuery(raw: string | null | undefined): ClinicSearchQuery {
  const texto = (raw ?? '').trim();
  if (/\p{L}/u.test(texto)) {
    const term = normalizeSearchText(texto);
    if (term.replace(/ /g, '').length < MIN_NAME_QUERY_LENGTH) {
      return { kind: 'invalid', error: NAME_QUERY_TOO_SHORT_ERROR };
    }
    return { kind: 'name', term };
  }
  const digitos = texto.replace(/\D/g, '');
  if (digitos.length === 11 || digitos.length === 14)
    return { kind: 'document', document: digitos };
  return { kind: 'invalid', error: SEARCH_QUERY_INVALID_ERROR };
}

export interface NameSearchCandidate {
  id: string;
  name: string;
  specialistNames: string[];
}

function casa(tokens: string[], texto: string): boolean {
  const alvo = normalizeSearchText(texto);
  return tokens.every((t) => alvo.includes(t));
}

/**
 * Casa quando TODAS as palavras do termo aparecem no nome da clínica ou no
 * nome de um mesmo especialista. Ordena pelo nome da clínica e corta no limite.
 */
export function filterTenantsByName<T extends NameSearchCandidate>(
  candidates: T[],
  term: string,
  limit: number = MAX_NAME_RESULTS
): { matches: T[]; truncated: boolean } {
  const tokens = term.split(' ').filter(Boolean);
  if (tokens.length === 0) return { matches: [], truncated: false };
  const encontrados = candidates
    .filter((c) => casa(tokens, c.name) || c.specialistNames.some((n) => casa(tokens, n)))
    .sort((a, b) => {
      const porNome = normalizeSearchText(a.name).localeCompare(normalizeSearchText(b.name));
      return porNome !== 0 ? porNome : a.id.localeCompare(b.id);
    });
  return { matches: encontrados.slice(0, limit), truncated: encontrados.length > limit };
}
