/**
 * GET /api/nf-imports/identidade: mesmas guardas das rotas de importação,
 * tenant vindo do token, validação da identidade e resposta só de fatos.
 * Admin SDK e serviço mockados.
 */
const mockVerifyIdToken = jest.fn();
const mockLookup = jest.fn();

jest.mock('../lib/firebase-admin', () => ({
  adminAuth: { verifyIdToken: (...a: unknown[]) => mockVerifyIdToken(...a) },
  adminDb: {},
  getAdminApp: jest.fn(),
}));

jest.mock('../lib/services/nfImportServer', () => ({
  lookupNfIdentity: (...a: unknown[]) => mockLookup(...a),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/nf-imports/identidade/route';

const admin = { uid: 'u1', role: 'clinic_admin', active: true, tenant_id: 'tenant-a' };

function request(
  query = 'cnpj=12.345.678/0001-95&serie=001&numero=026229',
  token: string | null = 'tok'
) {
  return new NextRequest(`http://localhost/api/nf-imports/identidade?${query}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyIdToken.mockResolvedValue(admin);
  mockLookup.mockResolvedValue({ existe: false });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('GET /api/nf-imports/identidade', () => {
  it('returns 401 without token', async () => {
    expect((await GET(request(undefined, null))).status).toBe(401);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it.each([
    ['clinic_user', { ...admin, role: 'clinic_user' }],
    ['consultor', { ...admin, role: 'clinic_consultant', is_consultant: true }],
    ['system_admin', { uid: 'sa', role: 'system_admin', is_system_admin: true, active: true }],
    ['inativo', { ...admin, active: false }],
  ])('returns 403 for %s', async (_, claims) => {
    mockVerifyIdToken.mockResolvedValue(claims);
    expect((await GET(request())).status).toBe(403);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it.each([
    ['cnpj=12345678000199&serie=1&numero=1', 'CNPJ do emitente inválido'],
    ['cnpj=12345678000195&serie=&numero=1', 'Série inválida'],
    ['cnpj=12345678000195&serie=1&numero=000', 'Número da NF inválido'],
  ])('returns 400 for %s', async (query, error) => {
    const res = await GET(request(query));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('normalizes the identity and uses the tenant from the token (forged tenant ignored)', async () => {
    const res = await GET(
      request('cnpj=12.345.678/0001-95&serie=001&numero=026229&tenantId=tenant-b')
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ existe: false });
    expect(mockLookup).toHaveBeenCalledWith('tenant-a', {
      cnpj: '12345678000195',
      serie: '1',
      numero: '26229',
    });
  });

  it('returns the facts of an existing NF', async () => {
    const fatos = {
      existe: true,
      importId: '1000',
      idLabel: 'ID 1000',
      origem: 'xml',
      hasPending: true,
      hasRejected: false,
    };
    mockLookup.mockResolvedValue(fatos);
    expect(await (await GET(request())).json()).toEqual(fatos);
  });

  it('returns 500 without logging the identity', async () => {
    mockLookup.mockRejectedValue(new Error('boom'));
    const res = await GET(request());
    expect(res.status).toBe(500);
    const logs = (console.error as jest.Mock).mock.calls.flat().map(String).join(' ');
    expect(logs).not.toContain('12345678000195');
    expect(logs).not.toContain('26229');
  });
});
