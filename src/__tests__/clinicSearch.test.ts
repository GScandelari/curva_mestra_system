import {
  MAX_NAME_RESULTS,
  NAME_QUERY_TOO_SHORT_ERROR,
  SEARCH_QUERY_INVALID_ERROR,
  classifyClinicSearchQuery,
  filterTenantsByName,
  normalizeSearchText,
} from '@/lib/clinicSearch';

describe('normalizeSearchText', () => {
  it('lowercases, strips accents and collapses spaces', () => {
    expect(normalizeSearchText('  Clínica   CÍNGULO  São João ')).toBe('clinica cingulo sao joao');
  });
});

describe('classifyClinicSearchQuery', () => {
  it.each([
    ['11.222.333/0001-81', { kind: 'document', document: '11222333000181' }],
    ['529.982.247-25', { kind: 'document', document: '52998224725' }],
    ['52998224725', { kind: 'document', document: '52998224725' }],
    ['Cíngulo', { kind: 'name', term: 'cingulo' }],
    ['  Linda   Mello ', { kind: 'name', term: 'linda mello' }],
    ['Clínica 24h', { kind: 'name', term: 'clinica 24h' }],
  ])('%p → %p', (raw, esperado) => {
    expect(classifyClinicSearchQuery(raw)).toEqual(esperado);
  });

  it.each([['ab'], ['a b'], ['é']])('rejects a short name %p', (raw) => {
    expect(classifyClinicSearchQuery(raw)).toEqual({
      kind: 'invalid',
      error: NAME_QUERY_TOO_SHORT_ERROR,
    });
  });

  it.each([[''], ['   '], ['123'], ['1234567890'], ['123456789012'], [null], [undefined]])(
    'rejects %p as invalid',
    (raw) => {
      expect(classifyClinicSearchQuery(raw)).toEqual({
        kind: 'invalid',
        error: SEARCH_QUERY_INVALID_ERROR,
      });
    }
  );
});

describe('filterTenantsByName', () => {
  const tenants = [
    { id: 't3', name: 'Clínica Linda Mello', specialistNames: ['Linda Mello'] },
    { id: 't1', name: 'Clínica ABC', specialistNames: ['Ana Beatriz Costa'] },
    { id: 't2', name: 'Studio Derme', specialistNames: ['Carla Mendes', 'João Mello'] },
  ];

  it('matches the clinic name, accent and case insensitive', () => {
    expect(filterTenantsByName(tenants, 'linda').matches.map((t) => t.id)).toEqual(['t3']);
    expect(filterTenantsByName(tenants, 'clinica').matches.map((t) => t.id)).toEqual(['t1', 't3']);
  });

  it('matches a specialist name, and all words must be in the same field', () => {
    expect(filterTenantsByName(tenants, 'carla').matches.map((t) => t.id)).toEqual(['t2']);
    expect(filterTenantsByName(tenants, 'mello').matches.map((t) => t.id)).toEqual(['t3', 't2']);
    expect(filterTenantsByName(tenants, 'joao mello').matches.map((t) => t.id)).toEqual(['t2']);
    // "carla" num especialista e "joao" no outro → não casa
    expect(filterTenantsByName(tenants, 'carla joao').matches).toEqual([]);
    // palavra da clínica + palavra do especialista → não casa
    expect(filterTenantsByName(tenants, 'studio carla').matches).toEqual([]);
  });

  it('sorts by clinic name and cuts at the limit', () => {
    const muitos = Array.from({ length: MAX_NAME_RESULTS + 3 }, (_, i) => ({
      id: `id-${String(i).padStart(2, '0')}`,
      name: `Clínica Teste ${String(100 - i)}`,
      specialistNames: [],
    }));
    const r = filterTenantsByName(muitos, 'teste');
    expect(r.matches).toHaveLength(MAX_NAME_RESULTS);
    expect(r.truncated).toBe(true);
    expect(r.matches[0].name).toBe('Clínica Teste 100');
    expect(filterTenantsByName(tenants, 'clinica', 1)).toMatchObject({ truncated: true });
    expect(filterTenantsByName(tenants, 'clinica')).toMatchObject({ truncated: false });
  });

  it('returns nothing for an empty term', () => {
    expect(filterTenantsByName(tenants, '')).toEqual({ matches: [], truncated: false });
  });
});
