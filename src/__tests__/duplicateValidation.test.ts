import { isDuplicateValue } from '@/lib/duplicateValidation';

interface Doc {
  id: string;
  slug: string;
  order: number;
}

const items: Doc[] = [
  { id: 'a', slug: 'termos-de-uso', order: 1 },
  { id: 'b', slug: 'politica-de-privacidade', order: 2 },
];

describe('isDuplicateValue', () => {
  it('detects a duplicate string value (case-insensitive, trimmed)', () => {
    expect(isDuplicateValue(items, 'Termos-De-Uso', (i) => i.slug)).toBe(true);
    expect(isDuplicateValue(items, '  termos-de-uso  ', (i) => i.slug)).toBe(true);
  });

  it('returns false when the string value does not exist yet', () => {
    expect(isDuplicateValue(items, 'novo-documento', (i) => i.slug)).toBe(false);
  });

  it('detects a duplicate numeric value', () => {
    expect(isDuplicateValue(items, 2, (i) => i.order)).toBe(true);
  });

  it('returns false when the numeric value does not exist yet', () => {
    expect(isDuplicateValue(items, 99, (i) => i.order)).toBe(false);
  });

  it('ignores the item being edited when excludeId/getId are provided', () => {
    expect(
      isDuplicateValue(
        items,
        'termos-de-uso',
        (i) => i.slug,
        'a',
        (i) => i.id
      )
    ).toBe(false);
    expect(
      isDuplicateValue(
        items,
        1,
        (i) => i.order,
        'a',
        (i) => i.id
      )
    ).toBe(false);
  });

  it('still detects duplicates against a different item when editing one of them', () => {
    expect(
      isDuplicateValue(
        items,
        'politica-de-privacidade',
        (i) => i.slug,
        'a',
        (i) => i.id
      )
    ).toBe(true);
  });

  it('returns false for an empty list', () => {
    expect(isDuplicateValue([], 'anything', (i: Doc) => i.slug)).toBe(false);
  });
});
