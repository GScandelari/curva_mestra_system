const RENNOVA_CANONICAL = 'Rennova';

export function normalizeBrand(input: string): string {
  const trimmed = input.trim();
  if (trimmed.toLowerCase() === RENNOVA_CANONICAL.toLowerCase()) {
    return RENNOVA_CANONICAL;
  }
  return trimmed;
}
