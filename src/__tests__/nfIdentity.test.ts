import {
  buildIdentityKey,
  chaveMatchesIdentity,
  computeChaveAcessoDV,
  formatCnpj,
  formatImportId,
  formatNFLabel,
  isValidCnpj,
  normalizeCnpj,
  normalizeLeadingZeros,
  normalizeNumeroNF,
  normalizeSerie,
  parseChaveAcesso,
  validateManualIdentity,
} from '@/lib/nfIdentity';

// CNPJs com DV válido; chaves com cUF 35, AAMM 2503, modelo 55, nNF 26229
const CNPJ_A = '12345678000195';
const CHAVE_A = '35250312345678000195550010000262291000262299';
const CHAVE_PUBLICA = '52060433009911002506550120000007800267301615';

describe('normalizeNumeroNF', () => {
  it.each([
    ['026229', '26229'],
    [' 026.229 ', '26229'],
    [26229, '26229'],
    ['000', ''],
    ['abc', ''],
    [null, ''],
  ])('%p → %p', (raw, esperado) => {
    expect(normalizeNumeroNF(raw)).toBe(esperado);
  });
});

describe('normalizeSerie', () => {
  it.each([
    ['001', '1'],
    ['000', '0'],
    ['999', '999'],
    ['1000', ''],
    ['', ''],
    ['abc', ''],
  ])('%p → %p', (raw, esperado) => {
    expect(normalizeSerie(raw)).toBe(esperado);
  });
});

describe('normalizeLeadingZeros', () => {
  it.each([
    ['0012345', '12345'],
    ['00A12', 'A12'],
    ['000', '0'],
    [' 007X ', '7X'],
    ['BT2024A', 'BT2024A'],
    ['', ''],
  ])('%p → %p', (raw, esperado) => {
    expect(normalizeLeadingZeros(raw)).toBe(esperado);
  });
});

describe('normalizeCnpj / isValidCnpj', () => {
  it('accepts a masked valid CNPJ and returns the 14 canonical positions', () => {
    expect(normalizeCnpj('12.345.678/0001-95')).toBe(CNPJ_A);
    expect(normalizeCnpj('34.771.518/0001-40')).toBe('34771518000140');
  });

  it('keeps the leading zero of a valid CNPJ', () => {
    expect(normalizeCnpj('01234567000195')).toBe('01234567000195');
  });

  it('rejects a wrong check digit, 13 digits and repeated characters', () => {
    expect(normalizeCnpj('12345678000199')).toBe('');
    expect(normalizeCnpj('1234567000195')).toBe('');
    expect(isValidCnpj('11111111111111')).toBe(false);
  });

  it('accepts the alphanumeric example from Receita Federal', () => {
    expect(isValidCnpj('12ABC34501DE35')).toBe(true);
    expect(normalizeCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
    expect(isValidCnpj('12ABC34501DE31')).toBe(false);
  });
});

describe('computeChaveAcessoDV', () => {
  it('matches the public example key', () => {
    expect(computeChaveAcessoDV(CHAVE_PUBLICA.slice(0, 43))).toBe(5);
  });

  it.each([
    ['35250312345678000195550010000262291000262299', 9],
    ['35250398765432000198550010000262291000262297', 7],
    ['35250312345678000195550020000262291000262295', 5],
    ['35250301234567000195550010000262291000262299', 9],
  ])('computes the DV of %s', (chave, dv) => {
    expect(computeChaveAcessoDV(chave.slice(0, 43))).toBe(dv);
  });
});

describe('parseChaveAcesso', () => {
  it('extracts CNPJ, model, series and number with or without the NFe prefix', () => {
    const esperado = {
      chave: CHAVE_A,
      cnpj: CNPJ_A,
      modelo: '55',
      serie: '1',
      numero: '26229',
    };
    expect(parseChaveAcesso(CHAVE_A)).toEqual(esperado);
    expect(parseChaveAcesso(`NFe${CHAVE_A}`)).toEqual(esperado);
    expect(parseChaveAcesso(` 3525 0312 3456 7800 0195 5500 1000 0262 2910 0026 2299 `)).toEqual(
      esperado
    );
  });

  it('rejects 43 positions, a wrong DV and letters outside the CNPJ', () => {
    expect(parseChaveAcesso(CHAVE_A.slice(0, 43))).toBeNull();
    expect(parseChaveAcesso(`${CHAVE_A.slice(0, 43)}0`)).toBeNull();
    expect(parseChaveAcesso(`A${CHAVE_A.slice(1)}`)).toBeNull();
  });
});

describe('chaveMatchesIdentity', () => {
  const chave = parseChaveAcesso(CHAVE_A)!;
  const identidade = { cnpj: CNPJ_A, serie: '1', numero: '26229' };

  it('matches the same identity', () => {
    expect(chaveMatchesIdentity(chave, identidade)).toBe(true);
  });

  it.each([
    { ...identidade, serie: '2' },
    { ...identidade, numero: '26230' },
    { ...identidade, cnpj: '98765432000198' },
  ])('rejects a different identity %p', (outra) => {
    expect(chaveMatchesIdentity(chave, outra)).toBe(false);
  });
});

describe('validateManualIdentity', () => {
  const valido = { numero: '026229', cnpj: '12.345.678/0001-95', serie: '001' };

  it('accepts a valid identity without access key, normalized', () => {
    expect(validateManualIdentity(valido)).toEqual({
      ok: true,
      identity: { cnpj: CNPJ_A, serie: '1', numero: '26229' },
    });
  });

  it('accepts a matching access key', () => {
    expect(validateManualIdentity({ ...valido, chave: `NFe${CHAVE_A}` })).toEqual({
      ok: true,
      identity: { cnpj: CNPJ_A, serie: '1', numero: '26229' },
      chave_acesso: CHAVE_A,
    });
  });

  it.each([
    [{ ...valido, numero: 'abc' }, 'Número da NF inválido'],
    [{ ...valido, cnpj: '12345678000199' }, 'CNPJ do emitente inválido'],
    [{ ...valido, serie: '' }, 'Série inválida'],
    [{ ...valido, chave: '123' }, 'Chave de acesso inválida'],
    [
      { ...valido, numero: '26230', chave: CHAVE_A },
      'A chave de acesso não confere com CNPJ, série e número informados',
    ],
  ])('rejects %p', (input, error) => {
    expect(validateManualIdentity(input)).toEqual({ ok: false, error });
  });
});

describe('formats', () => {
  it('builds the identity key and labels', () => {
    const identidade = { cnpj: CNPJ_A, serie: '1', numero: '26229' };
    expect(buildIdentityKey(identidade)).toBe('12345678000195_1_26229');
    expect(formatCnpj(CNPJ_A)).toBe('12.345.678/0001-95');
    expect(formatImportId(1000)).toBe('ID 1000');
    expect(formatImportId('1001')).toBe('ID 1001');
    expect(formatNFLabel(identidade)).toBe('NF 26229 · série 1 · CNPJ 12.345.678/0001-95');
  });
});
