/**
 * POST /api/admin/pending-products/[id]/reject: só system_admin ativo, motivo
 * validado, tenant vindo da pendência (o corpo não escolhe tenant) e
 * mapeamento dos resultados do serviço. Admin SDK e serviço mockados.
 */
const mockVerifyIdToken = jest.fn();
const mockReject = jest.fn();

jest.mock('../lib/firebase-admin', () => ({
  adminAuth: { verifyIdToken: (...a: unknown[]) => mockVerifyIdToken(...a) },
  adminDb: {},
  getAdminApp: jest.fn(),
}));

jest.mock('../lib/services/pendingRejectionServer', () => ({
  rejectPendingProduct: (...a: unknown[]) => mockReject(...a),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/pending-products/[id]/reject/route';

const systemAdmin = {
  uid: 'sa',
  name: 'Admin QA',
  is_system_admin: true,
  active: true,
};

function request(
  body: unknown = { motivo: 'Código inexistente na Rennova' },
  token: string | null = 'tok'
) {
  return new NextRequest('http://localhost/api/admin/pending-products/p1/reject', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: 'tenant-a_1000_1' }) };

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyIdToken.mockResolvedValue(systemAdmin);
  mockReject.mockResolvedValue({ kind: 'rejected', tenantId: 'tenant-a', importId: '1000' });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('POST /api/admin/pending-products/[id]/reject', () => {
  it('returns 401 without token and for an invalid token', async () => {
    expect((await POST(request(undefined, null), ctx)).status).toBe(401);
    mockVerifyIdToken.mockRejectedValue(new Error('invalid'));
    expect((await POST(request(), ctx)).status).toBe(401);
    expect(mockReject).not.toHaveBeenCalled();
  });

  it.each([
    ['clinic_admin', { uid: 'u', role: 'clinic_admin', tenant_id: 'tenant-a', active: true }],
    ['consultor', { uid: 'c', is_consultant: true, active: true }],
    ['system_admin inativo', { ...systemAdmin, active: false }],
  ])('returns 403 for %s', async (_, claims) => {
    mockVerifyIdToken.mockResolvedValue(claims);
    const res = await POST(request(), ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: 'Apenas administradores do sistema podem recusar pendências',
    });
    expect(mockReject).not.toHaveBeenCalled();
  });

  it.each([{}, { motivo: 'abc' }, { motivo: 'x'.repeat(501) }, 'nao-e-json'])(
    'returns 400 for an invalid body %p',
    async (body) => {
      expect((await POST(request(body), ctx)).status).toBe(400);
      expect(mockReject).not.toHaveBeenCalled();
    }
  );

  it('rejects with the trimmed reason and the pending ID from the path, ignoring a forged tenant', async () => {
    const res = await POST(
      request({ motivo: '  Código inexistente  ', tenantId: 'tenant-b' }),
      ctx
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, importId: '1000' });
    expect(mockReject).toHaveBeenCalledWith({
      pendingId: 'tenant-a_1000_1',
      motivo: 'Código inexistente',
      uid: 'sa',
      actorName: 'Admin QA',
    });
  });

  it('maps not found to 404 and an already resolved pending to 409', async () => {
    mockReject.mockResolvedValueOnce({ kind: 'not_found' });
    expect((await POST(request(), ctx)).status).toBe(404);
    mockReject.mockResolvedValueOnce({
      kind: 'conflict',
      error: 'Esta pendência já foi resolvida ou recusada.',
    });
    const res = await POST(request(), ctx);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Esta pendência já foi resolvida ou recusada.' });
  });

  it('returns 500 without logging the reason', async () => {
    mockReject.mockRejectedValueOnce(new Error('boom'));
    const res = await POST(request({ motivo: 'Motivo sensível' }), ctx);
    expect(res.status).toBe(500);
    const logs = (console.error as jest.Mock).mock.calls.flat().map(String).join(' ');
    expect(logs).not.toContain('Motivo sensível');
  });
});
