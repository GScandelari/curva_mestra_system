/**
 * Identidade e normalização de NF-e (BUGFIX-identidade-e-duplicidade-nfe).
 * Funções 100% puras — usadas pelo parser, pelas rotas de confirmação e pelas
 * telas. Uma nota é a mesma quando CNPJ do emitente + série + número coincidem
 * (UC-10-RN-14); a chave de acesso é só um dado gravado e conferido.
 *
 * CNPJ e chave aceitam o leiaute alfanumérico (NT Conjunta 2025.001): valor de
 * cada caractere = código ASCII − 48, o que mantém os dígitos com o próprio
 * valor — o mesmo algoritmo valida o CNPJ numérico e o alfanumérico.
 */

import type { NFIdentity } from '@/types/nf';

const charValue = (c: string): number => c.charCodeAt(0) - 48;

function mod11Digit(sum: number): number {
  const resto = sum % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function asText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

/** Número da NF: só dígitos, sem zeros à esquerda ('026.229' → '26229'); vazio se não houver. */
export function normalizeNumeroNF(raw: unknown): string {
  return asText(raw).replace(/\D/g, '').replace(/^0+/, '');
}

/** Série (0..999) sem zeros à esquerda ('001' → '1', '000' → '0'); vazio se inválida. */
export function normalizeSerie(raw: unknown): string {
  const texto = asText(raw);
  if (!/^\d+$/.test(texto)) return '';
  const serie = Number(texto);
  return serie > 999 ? '' : String(serie);
}

/** Remove zeros à esquerda mantendo um '0' quando o valor é só zeros ('00A12' → 'A12'). */
export function normalizeLeadingZeros(raw: unknown): string {
  const texto = asText(raw);
  if (texto === '') return '';
  const semZeros = texto.replace(/^0+/, '');
  return semZeros === '' ? '0' : semZeros;
}

const PESOS_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_DV2 = [6, ...PESOS_DV1];

function cnpjCheckDigit(base: string, pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < pesos.length; i++) soma += charValue(base[i]) * pesos[i];
  return mod11Digit(soma);
}

/** CNPJ de 14 posições (numérico ou alfanumérico) com os dois DVs corretos. */
export function isValidCnpj(cnpj14: string): boolean {
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj14)) return false;
  if (/^(.)\1{13}$/.test(cnpj14)) return false;
  const dv1 = cnpjCheckDigit(cnpj14, PESOS_DV1);
  const dv2 = cnpjCheckDigit(cnpj14.slice(0, 12) + dv1, PESOS_DV2);
  return cnpj14.slice(12) === `${dv1}${dv2}`;
}

/** CNPJ canônico de 14 posições (sem máscara, maiúsculo) ou vazio se inválido — sem "reparo". */
export function normalizeCnpj(raw: unknown): string {
  const cnpj = asText(raw)
    .replace(/[.\/\-\s]/g, '')
    .toUpperCase();
  return isValidCnpj(cnpj) ? cnpj : '';
}

export function formatCnpj(cnpj14: string): string {
  return `${cnpj14.slice(0, 2)}.${cnpj14.slice(2, 5)}.${cnpj14.slice(5, 8)}/${cnpj14.slice(8, 12)}-${cnpj14.slice(12)}`;
}

/**
 * Máscara de digitação 00.000.000/0000-00: aceita letras nas 12 primeiras
 * posições (CNPJ alfanumérico) e só dígitos nas 2 últimas (DV).
 */
export function maskCnpjInput(raw: string): string {
  const chars: string[] = [];
  for (const c of raw.toUpperCase()) {
    if (chars.length >= 14) break;
    if (chars.length < 12 ? /[0-9A-Z]/.test(c) : /[0-9]/.test(c)) chars.push(c);
  }
  const v = chars.join('');
  let out = v.slice(0, 2);
  if (v.length > 2) out += `.${v.slice(2, 5)}`;
  if (v.length > 5) out += `.${v.slice(5, 8)}`;
  if (v.length > 8) out += `/${v.slice(8, 12)}`;
  if (v.length > 12) out += `-${v.slice(12)}`;
  return out;
}

/** DV da chave de acesso: módulo 11 com pesos 2..9 da direita para a esquerda. */
export function computeChaveAcessoDV(first43: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = first43.length - 1; i >= 0; i--) {
    soma += charValue(first43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  return mod11Digit(soma);
}

export interface ChaveAcessoInfo {
  chave: string;
  cnpj: string;
  modelo: string;
  serie: string;
  numero: string;
}

/**
 * Chave de 44 posições (aceita o prefixo 'NFe' e espaços). Leiaute:
 * cUF(2) AAMM(4) CNPJ(14) modelo(2) série(3) nNF(9) tpEmis(1) cNF(8) DV(1).
 */
export function parseChaveAcesso(raw: unknown): ChaveAcessoInfo | null {
  const chave = asText(raw).replace(/\s/g, '').replace(/^NFe/i, '').toUpperCase();
  if (!/^[0-9]{6}[0-9A-Z]{12}[0-9]{26}$/.test(chave)) return null;
  if (computeChaveAcessoDV(chave.slice(0, 43)) !== Number(chave[43])) return null;
  return {
    chave,
    cnpj: chave.slice(6, 20),
    modelo: chave.slice(20, 22),
    serie: normalizeSerie(chave.slice(22, 25)),
    numero: normalizeNumeroNF(chave.slice(25, 34)),
  };
}

/** Chave do documento `nf_identidades`: `${cnpj}_${serie}_${numero}`. */
export function buildIdentityKey(id: NFIdentity): string {
  return `${id.cnpj}_${id.serie}_${id.numero}`;
}

export function chaveMatchesIdentity(chave: ChaveAcessoInfo, id: NFIdentity): boolean {
  return chave.cnpj === id.cnpj && chave.serie === id.serie && chave.numero === id.numero;
}

/** Identidade da inserção manual (UC-11): CNPJ e série obrigatórios, chave opcional. */
export function validateManualIdentity(input: {
  numero: string;
  cnpj: string;
  serie: string;
  chave?: string;
}): { ok: true; identity: NFIdentity; chave_acesso?: string } | { ok: false; error: string } {
  const numero = normalizeNumeroNF(input.numero);
  if (!numero) return { ok: false, error: 'Número da NF inválido' };
  const cnpj = normalizeCnpj(input.cnpj);
  if (!cnpj) return { ok: false, error: 'CNPJ do emitente inválido' };
  const serie = normalizeSerie(input.serie);
  if (!serie) return { ok: false, error: 'Série inválida' };
  const identity: NFIdentity = { cnpj, serie, numero };

  if (!input.chave || asText(input.chave) === '') return { ok: true, identity };
  const chave = parseChaveAcesso(input.chave);
  if (!chave) return { ok: false, error: 'Chave de acesso inválida' };
  if (!chaveMatchesIdentity(chave, identity)) {
    return {
      ok: false,
      error: 'A chave de acesso não confere com CNPJ, série e número informados',
    };
  }
  return { ok: true, identity, chave_acesso: chave.chave };
}

/** ID legível do registro de importação — nunca "NF 1000", para não confundir com o número. */
export function formatImportId(id: string | number): string {
  return `ID ${id}`;
}

export function formatNFLabel(id: NFIdentity): string {
  return `NF ${id.numero} · série ${id.serie} · CNPJ ${formatCnpj(id.cnpj)}`;
}
