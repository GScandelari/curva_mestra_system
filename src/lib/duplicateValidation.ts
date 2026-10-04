/**
 * Helper puro e genérico para checar se um valor já existe entre os itens
 * carregados de uma coleção, opcionalmente ignorando o próprio registro
 * (caso de edição).
 *
 * Usado por formulários que hoje não têm nenhuma validação de duplicidade
 * antes de salvar (ex.: slug/ordem de documentos legais, nome de
 * protocolo) — ver ONLY_FOR_DEVS/PO_BA_Docs/_MAPA-DE-BUGS-E-MELHORIAS.md,
 * itens UC-33-RN-01, UC-33-RN-02 e UC-20-RN-06.
 *
 * Comparação de strings é sempre case-insensitive e ignora espaços nas
 * pontas (trim); comparação de números é exata.
 */
export function isDuplicateValue<T>(
  items: T[],
  value: string | number,
  getValue: (item: T) => string | number,
  excludeId?: string,
  getId?: (item: T) => string
): boolean {
  return items.some((item) => {
    if (excludeId !== undefined && getId && getId(item) === excludeId) {
      return false;
    }

    const existingValue = getValue(item);

    if (typeof value === 'string' && typeof existingValue === 'string') {
      return existingValue.trim().toLowerCase() === value.trim().toLowerCase();
    }

    return existingValue === value;
  });
}
