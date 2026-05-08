import { normalizeBrand } from '@/lib/brandUtils';

describe('normalizeBrand', () => {
  it('normalizes lowercase rennova to Rennova', () => {
    expect(normalizeBrand('rennova')).toBe('Rennova');
  });

  it('normalizes uppercase RENNOVA to Rennova', () => {
    expect(normalizeBrand('RENNOVA')).toBe('Rennova');
  });

  it('normalizes mixed case RenNova to Rennova', () => {
    expect(normalizeBrand('RenNova')).toBe('Rennova');
  });

  it('trims whitespace before normalizing Rennova', () => {
    expect(normalizeBrand('  Rennova  ')).toBe('Rennova');
  });

  it('returns already correct Rennova unchanged', () => {
    expect(normalizeBrand('Rennova')).toBe('Rennova');
  });

  it('returns other brands as-is (trimmed)', () => {
    expect(normalizeBrand('Allergan')).toBe('Allergan');
    expect(normalizeBrand('allergan')).toBe('allergan');
    expect(normalizeBrand('  Merz  ')).toBe('Merz');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeBrand('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeBrand('   ')).toBe('');
  });
});
