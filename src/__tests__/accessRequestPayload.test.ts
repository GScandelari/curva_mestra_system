import {
  BUSINESS_NAME_REQUIRED_ERROR,
  COUNCIL_REQUIRED_ERROR,
  DOCUMENT_REQUIRED_ERROR,
  DOCUMENT_TYPE_ERROR,
  RENNOVA_ID_REQUIRED_ERROR,
  getAccessRequestBusinessName,
  validateAccessRequestInput,
} from '@/lib/accessRequestPayload';
import { INVALID_CONSULTANT_CODE_ERROR } from '@/lib/validations/serverValidations';

const CNPJ_VALIDO = '11222333000181';
const CPF_VALIDO = '52998224725';

const especialista = {
  role: 'especialista',
  full_name: '  Helena Vidal ',
  email: ' Helena@Clinica.com.br ',
  phone: '(11) 99999-8888',
  council_number: ' CRM-SP 142337 ',
  business_name: ' Clínica Cíngulo ',
  document_type: 'cnpj',
  document_number: '11.222.333/0001-81',
};

const consultor = {
  role: 'consultor',
  full_name: 'Paulo Souza',
  email: 'paulo@rennova.com.br',
  phone: '(21) 98888-7777',
  council_number: 'RNV-CR-0427',
};

describe('validateAccessRequestInput — especialista', () => {
  it('normalizes the fields and keeps only digits in the document', () => {
    expect(validateAccessRequestInput(especialista)).toEqual({
      ok: true,
      value: {
        role: 'especialista',
        full_name: 'Helena Vidal',
        email: 'helena@clinica.com.br',
        phone: '(11) 99999-8888',
        council_number: 'CRM-SP 142337',
        business_name: 'Clínica Cíngulo',
        document_type: 'cnpj',
        document_number: CNPJ_VALIDO,
      },
    });
  });

  it('accepts a CPF and an optional consultant code', () => {
    const r = validateAccessRequestInput({
      ...especialista,
      document_type: 'cpf',
      document_number: '529.982.247-25',
      consultant_code: ' 847291 ',
    });
    expect(r).toMatchObject({
      ok: true,
      value: { document_type: 'cpf', document_number: CPF_VALIDO, consultant_code: '847291' },
    });
  });

  it('ignores legacy and unknown fields (volume, consultant_reference)', () => {
    const r = validateAccessRequestInput({
      ...especialista,
      volume: '30–80',
      consultant_reference: 'Fulano',
      tenant_id: 'x',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).not.toHaveProperty('volume');
      expect(r.value).not.toHaveProperty('consultant_reference');
      expect(r.value).not.toHaveProperty('tenant_id');
    }
  });

  it.each([
    [{ council_number: '  ' }, COUNCIL_REQUIRED_ERROR],
    [{ business_name: '' }, BUSINESS_NAME_REQUIRED_ERROR],
    [{ document_number: '' }, DOCUMENT_REQUIRED_ERROR],
    [{ document_number: '...' }, DOCUMENT_REQUIRED_ERROR],
    [{ document_type: 'rg' }, DOCUMENT_TYPE_ERROR],
    [{ document_type: undefined }, DOCUMENT_TYPE_ERROR],
    [{ document_number: '11.222.333/0001-82' }, 'CNPJ inválido: dígito verificador incorreto'],
    [{ document_type: 'cpf' }, 'CPF deve ter 11 dígitos'],
    [{ document_type: 'cnpj', document_number: CPF_VALIDO }, 'CNPJ deve ter 14 dígitos'],
    [
      { document_type: 'cpf', document_number: '111.111.111-11' },
      'CPF inválido: todos os dígitos são iguais',
    ],
    [{ consultant_code: '12345' }, INVALID_CONSULTANT_CODE_ERROR],
    [{ consultant_code: 'abc123' }, INVALID_CONSULTANT_CODE_ERROR],
  ])('rejects %p', (patch, error) => {
    expect(validateAccessRequestInput({ ...especialista, ...patch })).toEqual({ ok: false, error });
  });
});

describe('validateAccessRequestInput — consultor', () => {
  it('needs no business name nor document, and ignores them if sent', () => {
    expect(
      validateAccessRequestInput({
        ...consultor,
        business_name: 'Sudeste 2',
        document_type: 'cnpj',
        document_number: 'lixo',
        consultant_code: '000',
        volume: '150+',
      })
    ).toEqual({
      ok: true,
      value: {
        role: 'consultor',
        full_name: 'Paulo Souza',
        email: 'paulo@rennova.com.br',
        phone: '(21) 98888-7777',
        council_number: 'RNV-CR-0427',
      },
    });
  });

  it('requires the Rennova ID', () => {
    expect(validateAccessRequestInput({ ...consultor, council_number: '' })).toEqual({
      ok: false,
      error: RENNOVA_ID_REQUIRED_ERROR,
    });
  });
});

describe('validateAccessRequestInput — common fields (current messages)', () => {
  it.each([
    [{}, 'Perfil (especialista / consultor) é obrigatório'],
    [{ ...consultor, role: 'admin' }, "Perfil deve ser 'especialista' ou 'consultor'"],
    [{ ...consultor, full_name: '' }, 'Nome completo é obrigatório'],
    [{ ...consultor, full_name: 'Paulo' }, 'Informe nome e sobrenome'],
    [{ ...consultor, email: '' }, 'E-mail é obrigatório'],
    [{ ...consultor, email: 'x@' }, 'Formato de e-mail inválido'],
    [{ ...consultor, phone: '' }, 'Telefone é obrigatório'],
    [{ ...consultor, phone: '123' }, 'Telefone deve ter 10 ou 11 dígitos (com DDD)'],
  ])('rejects %p', (body, error) => {
    expect(validateAccessRequestInput(body)).toEqual({ ok: false, error });
  });

  it('handles non-object bodies', () => {
    expect(validateAccessRequestInput(null)).toEqual({
      ok: false,
      error: 'Perfil (especialista / consultor) é obrigatório',
    });
  });
});

describe('getAccessRequestBusinessName', () => {
  it('uses the business name and falls back to the full name', () => {
    expect(getAccessRequestBusinessName({ business_name: ' Clínica X ', full_name: 'A B' })).toBe(
      'Clínica X'
    );
    expect(getAccessRequestBusinessName({ business_name: '', full_name: 'Paulo Souza' })).toBe(
      'Paulo Souza'
    );
    expect(getAccessRequestBusinessName({ full_name: 'Paulo Souza' })).toBe('Paulo Souza');
  });
});
