/**
 * Email Template Rendering — lógica pura de renderização/validação de
 * templates de e-mail (UC-55). Zero import de Firebase (client ou Admin SDK)
 * — compartilhada entre `src/lib/services/emailTemplateAdmin.ts` (Admin SDK,
 * API routes) e o editor (preview client-side, RF-03). Como o deploy de
 * functions/ empacota só functions/src (firebase.json/tsconfig.json), este
 * arquivo é espelhado manualmente em functions/src/emailTemplateRendering.ts
 * (só a função renderTemplate, usada para enviar) — qualquer mudança em
 * renderTemplate aqui precisa ser replicada lá também.
 */

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Substitui todas as ocorrências de {{chave}} pelo valor correspondente em
 * `variables`. Chaves sem correspondência permanecem literais no texto —
 * nunca lança erro, para nunca travar o envio de um e-mail de produção por
 * uma variável ausente (risco mitigado por validateTemplateVariables no
 * momento de salvar, não no momento de enviar).
 */
export function renderTemplate(text: string, variables: Record<string, string>): string {
  return text.replace(VARIABLE_PATTERN, (match, key) => {
    return key in variables ? variables[key] : match;
  });
}

/** Lista (sem duplicados, ordem de primeira ocorrência) das chaves {{chave}} usadas em um texto. */
export function extractVariableKeys(text: string): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

export interface TemplateValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Inválido se subject+body usar uma chave fora de allowedKeys, ou se alguma
 * requiredKeys não aparecer em subject+body (RF-05/RNF-05).
 */
export function validateTemplateVariables(
  subject: string,
  body: string,
  allowedKeys: string[],
  requiredKeys: string[]
): TemplateValidationResult {
  const usedKeys = extractVariableKeys(`${subject}\n${body}`);
  const allowedSet = new Set(allowedKeys);

  for (const key of usedKeys) {
    if (!allowedSet.has(key)) {
      return { valid: false, error: `Variável {{${key}}} não é permitida para este template` };
    }
  }

  const usedSet = new Set(usedKeys);
  for (const key of requiredKeys) {
    if (!usedSet.has(key)) {
      return { valid: false, error: `Variável obrigatória {{${key}}} foi removida` };
    }
  }

  return { valid: true };
}
