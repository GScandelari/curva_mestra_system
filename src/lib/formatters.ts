export function formatCNPJInput(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 14);
  return numbers
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function formatPhoneInput(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 10) {
    return numbers.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return numbers.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

export function parseAddressFromString(address: string): {
  city: string;
  state: string;
  cep: string;
} {
  const result = { city: '', state: '', cep: '' };
  const parts = address.split(',');
  if (parts.length < 2) return result;

  const lastPart = parts[parts.length - 1].trim();
  const secondLastPart = parts[parts.length - 2].trim();

  const cepMatch = lastPart.match(/\d{5}-?\d{3}/);
  if (cepMatch) result.cep = cepMatch[0];

  const dashIdx = secondLastPart.lastIndexOf(' - ');
  if (dashIdx !== -1) {
    const candidate = secondLastPart.slice(dashIdx + 3).trim();
    if (candidate.length === 2 && candidate === candidate.toUpperCase()) {
      result.city = secondLastPart.slice(0, dashIdx).trim();
      result.state = candidate;
    }
  }

  return result;
}
