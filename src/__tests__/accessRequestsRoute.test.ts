/**
 * POST /api/access-requests (UC-01) — FEAT-ajustes-registro-e-busca-consultor:
 * documento obrigatório do especialista, lista branca de campos (sem volume,
 * sem região do consultor), gravação pelo Admin SDK. Admin SDK mockado.
 */
const mockSettingsGet = jest.fn();
const mockPendingGet = jest.fn();
const mockConsultantGet = jest.fn();
const mockAdd = jest.fn();

function query(get: jest.Mock) {
  const q: Record<string, unknown> = {};
  q.where = jest.fn(() => q);
  q.limit = jest.fn(() => q);
  q.get = get;
  return q;
}

jest.mock('../lib/firebase-admin', () => ({
  adminDb: {
    doc: jest.fn(() => ({ get: (...a: unknown[]) => mockSettingsGet(...a) })),
    collection: jest.fn((name: string) =>
      name === 'consultants'
        ? query(mockConsultantGet)
        : { ...query(mockPendingGet), add: (...a: unknown[]) => mockAdd(...a) }
    ),
  },
  adminAuth: {},
  getAdminApp: jest.fn(),
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TS' },
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/access-requests/route';

const especialista = {
  role: 'especialista',
  full_name: 'Helena Vidal',
  email: 'Helena@Clinica.com.br',
  phone: '(11) 99999-8888',
  council_number: 'CRM-SP 142337',
  business_name: 'Clínica Cíngulo',
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

const request = (body: unknown) =>
  new NextRequest('http://localhost/api/access-requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockSettingsGet.mockResolvedValue({ exists: false, data: () => undefined });
  mockPendingGet.mockResolvedValue({ empty: true });
  mockConsultantGet.mockResolvedValue({ empty: false, docs: [{ id: 'cons-1' }] });
  mockAdd.mockResolvedValue({ id: 'req-1' });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('POST /api/access-requests', () => {
  it('creates a specialist request with the document (digits only) and without volume', async () => {
    const res = await POST(
      request({
        ...especialista,
        volume: '30–80',
        consultant_reference: 'Fulano',
        consultant_code: '847291',
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      message: 'Solicitação enviada com sucesso!',
      id: 'req-1',
    });
    expect(mockAdd).toHaveBeenCalledWith({
      role: 'especialista',
      type: 'clinica',
      full_name: 'Helena Vidal',
      email: 'helena@clinica.com.br',
      phone: '(11) 99999-8888',
      council_number: 'CRM-SP 142337',
      consultant_code: '847291',
      consultant_id: 'cons-1',
      business_name: 'Clínica Cíngulo',
      document_type: 'cnpj',
      document_number: '11222333000181',
      status: 'pendente',
      created_at: 'SERVER_TS',
      updated_at: 'SERVER_TS',
    });
  });

  it('creates a consultant request without region, document or volume', async () => {
    const res = await POST(
      request({ ...consultor, business_name: 'Sudeste 2', document_number: 'x', volume: '150+' })
    );
    expect(res.status).toBe(200);
    const gravado = mockAdd.mock.calls[0][0];
    expect(gravado).toMatchObject({ role: 'consultor', type: 'autonomo', consultant_code: null });
    expect(gravado).not.toHaveProperty('business_name');
    expect(gravado).not.toHaveProperty('document_number');
    expect(gravado).not.toHaveProperty('volume');
  });

  it.each([
    [{ ...especialista, document_number: '' }, 'CPF ou CNPJ é obrigatório'],
    [
      { ...especialista, document_number: '11.222.333/0001-82' },
      'CNPJ inválido: dígito verificador incorreto',
    ],
    [{ ...especialista, council_number: '' }, 'Número do conselho é obrigatório'],
    [{ ...especialista, business_name: '' }, 'Nome da clínica é obrigatório'],
    [{ ...consultor, council_number: '' }, 'ID Rennova é obrigatório'],
    ['nao-e-json', 'Corpo da requisição inválido'],
  ])('returns 400 for %p', async (body, error) => {
    const res = await POST(request(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('returns 400 for an unknown or inactive consultant code', async () => {
    mockConsultantGet.mockResolvedValue({ empty: true, docs: [] });
    const res = await POST(request({ ...especialista, consultant_code: '111111' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Código de consultor inválido ou inativo' });
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('returns 409 when the e-mail already has a pending request', async () => {
    mockPendingGet.mockResolvedValue({ empty: false });
    expect((await POST(request(especialista))).status).toBe(409);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('returns 403 when registration is disabled', async () => {
    mockSettingsGet.mockResolvedValue({
      exists: true,
      data: () => ({ registration_enabled: false }),
    });
    expect((await POST(request(especialista))).status).toBe(403);
  });

  it('returns 500 without leaking the error nor logging personal data', async () => {
    mockAdd.mockRejectedValue(new Error('PERMISSION_DENIED interno'));
    const res = await POST(request(especialista));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Erro ao processar solicitação' });
    const logs = (console.error as jest.Mock).mock.calls.flat().map(String).join(' ');
    expect(logs).not.toContain('11222333000181');
    expect(logs).not.toContain('helena@clinica.com.br');
  });
});
