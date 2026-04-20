import { formatCNPJInput, formatPhoneInput, parseAddressFromString } from '@/lib/formatters';

describe('formatCNPJInput', () => {
  it('formats partial input progressively', () => {
    expect(formatCNPJInput('12')).toBe('12');
    expect(formatCNPJInput('12345')).toBe('12.345');
    expect(formatCNPJInput('12345678')).toBe('12.345.678');
    expect(formatCNPJInput('123456780001')).toBe('12.345.678/0001');
    expect(formatCNPJInput('12345678000195')).toBe('12.345.678/0001-95');
  });

  it('strips non-numeric characters', () => {
    expect(formatCNPJInput('12.345.678/0001-95')).toBe('12.345.678/0001-95');
  });

  it('truncates at 14 digits', () => {
    expect(formatCNPJInput('123456780001951234')).toBe('12.345.678/0001-95');
  });

  it('returns empty string for empty input', () => {
    expect(formatCNPJInput('')).toBe('');
  });
});

describe('formatPhoneInput', () => {
  it('formats 10-digit landline', () => {
    expect(formatPhoneInput('1133334444')).toBe('(11) 3333-4444');
  });

  it('formats 11-digit mobile', () => {
    expect(formatPhoneInput('11987654321')).toBe('(11) 98765-4321');
  });

  it('strips non-numeric characters', () => {
    expect(formatPhoneInput('(11) 98765-4321')).toBe('(11) 98765-4321');
  });

  it('truncates at 11 digits', () => {
    expect(formatPhoneInput('119876543219999')).toBe('(11) 98765-4321');
  });

  it('returns empty string for empty input', () => {
    expect(formatPhoneInput('')).toBe('');
  });
});

describe('parseAddressFromString', () => {
  it('extracts city, state and CEP from full address string', () => {
    const result = parseAddressFromString('Rua das Flores, 123, São Paulo - SP, 01310-100');
    expect(result.city).toBe('São Paulo');
    expect(result.state).toBe('SP');
    expect(result.cep).toBe('01310-100');
  });

  it('handles address without dash separator', () => {
    const result = parseAddressFromString('Rua X, 01310-100');
    expect(result.city).toBe('');
    expect(result.state).toBe('');
    expect(result.cep).toBe('01310-100');
  });

  it('returns empty values for short/invalid address', () => {
    const result = parseAddressFromString('Rua Simples');
    expect(result.city).toBe('');
    expect(result.state).toBe('');
    expect(result.cep).toBe('');
  });

  it('returns empty values for empty string', () => {
    const result = parseAddressFromString('');
    expect(result.city).toBe('');
    expect(result.state).toBe('');
    expect(result.cep).toBe('');
  });
});
