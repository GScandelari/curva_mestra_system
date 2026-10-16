/**
 * GET /api/tenants/search — busca por documento ou nome
 * (FEAT-ajustes-registro-e-busca-consultor): guarda de consultor ativo ou
 * system_admin ativo, classificação da consulta, compatibilidade com
 * ?document= e serviço de busca por nome (filtro em memória).
 */
const mockVerifyIdToken = jest.fn();
const mockConsultantGet = jest.fn();
const mockTenantsGet = jest.fn();
const mockUsersGet = jest.fn();
const mockWhere = jest.fn();

jest.mock('../lib/firebase-admin', () => ({
  adminAuth: { verifyIdToken: (...a: unknown[]) => mockVerifyIdToken(...a) },
  adminDb: {
    collection: jest.fn((name: string) => {
      if (name === 'consultants') return { doc: () => ({ get: () => mockConsultantGet() }) };
      const get = name === 'users' ? mockUsersGet : mockTenantsGet;
      const q: Record<string, unknown> = {};
      q.where = jest.fn((...a: unknown[]) => {
        mockWhere(name, ...a);
        return q;
      });
      q.get = get;
      return q;
    }),
  },
  getAdminApp: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/tenants/search/route';

const consultor = { uid: 'c', is_consultant: true, consultant_id: 'cons-1', active: true };
const doc = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });

const tenants = [
  doc('t1', {
    name: 'Clínica Linda Mello',
    document_type: 'cnpj',
    document_number: '11222333000181',
    email: 'linda@clinica.com',
    consultant_id: 'cons-1',
    consultant_name: 'Paulo',
    active: true,
  }),
  doc('t2', { name: 'Studio Derme', email: 's@d.com', active: true }),
];
const users = [
  doc('u1', { role: 'clinic_admin', tenant_id: 't2', full_name: 'Carla Mendes', active: true }),
  doc('u2', { role: 'clinic_admin', tenant_id: 't2', full_name: 'Oculto Inativo', active: false }),
];

const request = (query: string, token: string | null = 'tok') =>
  new NextRequest(`http://localhost/api/tenants/search?${query}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyIdToken.mockResolvedValue(consultor);
  mockConsultantGet.mockResolvedValue({ exists: true, data: () => ({ status: 'active' }) });
  mockTenantsGet.mockResolvedValue({ docs: tenants });
  mockUsersGet.mockResolvedValue({ docs: users });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('GET /api/tenants/search — acesso', () => {
  it('returns 401 without token', async () => {
    expect((await GET(request('q=linda', null))).status).toBe(401);
  });

  it.each([
    ['clinic_admin', { uid: 'a', role: 'clinic_admin', tenant_id: 't1', active: true }],
    ['consultor inativo (claim)', { ...consultor, active: false }],
    ['system_admin inativo', { uid: 's', is_system_admin: true, active: false }],
  ])('returns 403 for %s', async (_, claims) => {
    mockVerifyIdToken.mockResolvedValue(claims);
    const res = await GET(request('q=linda'));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Acesso restrito a consultores ativos' });
    expect(mockTenantsGet).not.toHaveBeenCalled();
  });

  it('returns 403 for a suspended consultant document', async () => {
    mockConsultantGet.mockResolvedValue({ exists: true, data: () => ({ status: 'suspended' }) });
    expect((await GET(request('q=linda'))).status).toBe(403);
  });

  it('lets an active system_admin search without consultant document', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 's', is_system_admin: true, active: true });
    expect((await GET(request('q=linda'))).status).toBe(200);
    expect(mockConsultantGet).not.toHaveBeenCalled();
  });
});

describe('GET /api/tenants/search — consulta', () => {
  it('searches by document (q and legacy document param), only active tenants', async () => {
    for (const q of ['q=11.222.333%2F0001-81', 'document=11222333000181']) {
      jest.clearAllMocks();
      mockVerifyIdToken.mockResolvedValue(consultor);
      mockConsultantGet.mockResolvedValue({ exists: true, data: () => ({ status: 'active' }) });
      mockTenantsGet.mockResolvedValue({ docs: [tenants[0]] });
      const res = await GET(request(q));
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      const body = await res.json();
      expect(body.truncated).toBe(false);
      expect(body.data.map((t: { id: string }) => t.id)).toEqual(['t1']);
      expect(mockWhere).toHaveBeenCalledWith('tenants', 'document_number', '==', '11222333000181');
      expect(mockWhere).toHaveBeenCalledWith('tenants', 'active', '==', true);
    }
  });

  it('searches by clinic name and by active specialist name, same result format', async () => {
    const porClinica = await (await GET(request('q=Linda'))).json();
    expect(porClinica).toEqual({
      success: true,
      truncated: false,
      data: [
        {
          id: 't1',
          name: 'Clínica Linda Mello',
          document_type: 'cnpj',
          document_number: '11222333000181',
          email: 'linda@clinica.com',
          consultant_id: 'cons-1',
          consultant_name: 'Paulo',
        },
      ],
    });
    const porEspecialista = await (await GET(request('q=carla'))).json();
    expect(porEspecialista.data.map((t: { id: string }) => t.id)).toEqual(['t2']);
    // especialista inativo não conta
    expect((await (await GET(request('q=oculto'))).json()).data).toEqual([]);
    expect(mockWhere).toHaveBeenCalledWith('tenants', 'active', '==', true);
    expect(mockWhere).toHaveBeenCalledWith('users', 'role', '==', 'clinic_admin');
  });

  it.each([
    ['q=ab', 'Digite ao menos 3 letras do nome da clínica ou do especialista'],
    ['q=123', 'Informe o CPF (11 dígitos), o CNPJ (14 dígitos) ou ao menos 3 letras do nome'],
    ['', 'Informe o CPF (11 dígitos), o CNPJ (14 dígitos) ou ao menos 3 letras do nome'],
  ])('returns 400 for %p', async (q, error) => {
    const res = await GET(request(q));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
  });

  it('returns 500 without logging the search term', async () => {
    mockTenantsGet.mockRejectedValue(new Error('boom'));
    const res = await GET(request('q=Linda%20Mello'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Erro ao buscar clínicas' });
    const logs = (console.error as jest.Mock).mock.calls.flat().map(String).join(' ');
    expect(logs).not.toContain('Linda');
  });
});
