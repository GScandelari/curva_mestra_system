/**
 * Email Template Rendering — lógica pura de renderização de templates de
 * e-mail (UC-55). ESPELHO MANUAL de src/lib/emailTemplateRendering.ts —
 * o deploy de functions/ empacota só functions/src (firebase.json /
 * functions/tsconfig.json), então functions/src não pode importar de
 * src/lib diretamente (compilaria localmente, mas o arquivo nunca seria
 * enviado ao runtime real). Só `renderTemplate` é espelhada aqui (é a
 * única usada para enviar) — qualquer mudança nela em src/lib precisa ser
 * replicada aqui também.
 */

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Substitui todas as ocorrências de {{chave}} pelo valor correspondente em
 * `variables`. Chaves sem correspondência permanecem literais no texto —
 * nunca lança erro, para nunca travar o envio de um e-mail de produção por
 * uma variável ausente.
 */
export function renderTemplate(text: string, variables: Record<string, string>): string {
  return text.replace(VARIABLE_PATTERN, (match, key) => {
    return key in variables ? variables[key] : match;
  });
}
