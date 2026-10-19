/**
 * POST /api/admin/users/last-access (FEAT-ultimo-acesso-usuarios): só
 * system_admin ativo, validação do body e mapa de último acesso a partir do
 * metadata do Firebase Auth.
 */
const mockVerifyIdToken = jest.fn();
const mockGetUsers = jest.fn();

jest.mock('../lib/firebase-admin', () => ({
  adminAuth: {
    verifyIdToken: (...a: unknown[]) => mockVerifyIdToken(...a),
    getUsers: (...a: unknown[]) => mockGetUsers(...a),
  },
  adminDb: {},
  getAdminApp: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/users/last-access/route';

const systemAdmin = { uid: 'sa', is_system_admin: true, active: true };

const request = (body: unknown, token: string | null = 'tok') =>
  new NextRequest('http://localhost/api/admin/users/last-access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockVerifyIdToken.mockResolvedValue(systemAdmin);
  mockGetUsers.mockResolvedValue({
    users: [
      {
        uid: 'u1',
        metadata: {
          lastSignInTime: 'Mon, 12 Oct 2026 12:00:00 GMT',
          lastRefreshTime: 'Sat, 17 Oct 2026 18:30:00 GMT',
        },
      },
      { uid: 'u2', metadata: { lastSignInTime: null, lastRefreshTime: null } },
    ],
    notFound: [{ uid: 'u3' }],
  });
});

afterEach(() => jest.restoreAllMocks());

describe('POST /api/admin/users/last-access', () => {
  it('401 sem token', async () => {
    const res = await POST(request({ uids: ['u1'] }, null));
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(mockGetUsers).not.toHaveBeenCalled();
  });

  it('401 com token inválido', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('invalid'));
    const res = await POST(request({ uids: ['u1'] }));
    expect(res.status).toBe(401);
  });

  it.each([
    [{ uid: 'ca', role: 'clinic_admin', tenant_id: 't1', active: true }],
    [{ uid: 'c', is_consultant: true, consultant_id: 'c1', active: true }],
    [{ uid: 'sa', is_system_admin: true, active: false }],
  ])('403 para quem não é system_admin ativo (%p)', async (claims) => {
    mockVerifyIdToken.mockResolvedValue(claims);
    const res = await POST(request({ uids: ['u1'] }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Acesso negado' });
    expect(mockGetUsers).not.toHaveBeenCalled();
  });

  it.each([['{nao-json'], [{}], [{ uids: [] }]])('400 com body inválido (%p)', async (body) => {
    const res = await POST(request(body));
    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(mockGetUsers).not.toHaveBeenCalled();
  });

  it('400 acima de 100 usuários', async () => {
    const uids = Array.from({ length: 101 }, (_, i) => `u${i}`);
    const res = await POST(request({ uids }));
    expect(res.status).toBe(400);
  });

  it('200 com o mapa: data mais recente, null para quem nunca acessou, inexistentes de fora', async () => {
    const res = await POST(request({ uids: ['u1', 'u2', 'u3', 'u1'] }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({
      data: { u1: '2026-10-17T18:30:00.000Z', u2: null },
    });
    expect(mockGetUsers).toHaveBeenCalledWith([{ uid: 'u1' }, { uid: 'u2' }, { uid: 'u3' }]);
  });

  it('500 genérico se o Auth falhar, sem expor detalhes', async () => {
    mockGetUsers.mockRejectedValue(new Error('auth/internal-error details'));
    const res = await POST(request({ uids: ['u1'] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Erro ao consultar último acesso' });
  });
});
