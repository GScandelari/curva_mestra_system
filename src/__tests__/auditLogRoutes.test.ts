/**
 * Rotas de API instrumentadas com audit_log (UC-53, RN-02).
 * Usa o helper real writeAuditLogAdmin; só o Admin SDK é mockado.
 */
const mockAuditAdd = jest.fn();
const mockDocs: Record<string, Record<string, unknown> | undefined> = {};

const mockVerifyIdToken = jest.fn();
const mockGetUser = jest.fn();
const mockSetClaims = jest.fn();
const mockUpdateUser = jest.fn();
const mockCreateUser = jest.fn();

function makeCollection(name: string) {
  if (name === 'audit_log') return { add: (...a: unknown[]) => mockAuditAdd(...a) };
  const chain: Record<string, unknown> = {};
  chain.where = () => chain;
  chain.limit = () => chain;
  chain.orderBy = () => chain;
  chain.get = async () => ({ docs: [], size: 0, empty: true });
  chain.add = jest.fn().mockResolvedValue({ id: 'new-doc-id' });
  chain.doc = (id: string) => ({
    id,
    get: async () => {
      const data = mockDocs[`${name}/${id}`];
      return { exists: data !== undefined, id, data: () => data };
    },
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  });
  return chain;
}

jest.mock('../lib/firebase-admin', () => ({
  adminAuth: {
    verifyIdToken: (...a: unknown[]) => mockVerifyIdToken(...a),
    getUser: (...a: unknown[]) => mockGetUser(...a),
    setCustomUserClaims: (...a: unknown[]) => mockSetClaims(...a),
    updateUser: (...a: unknown[]) => mockUpdateUser(...a),
    createUser: (...a: unknown[]) => mockCreateUser(...a),
    deleteUser: jest.fn(),
  },
  adminDb: { collection: (name: string) => makeCollection(name) },
  getAdminAuth: () => ({
    verifyIdToken: (...a: unknown[]) => mockVerifyIdToken(...a),
    createUser: (...a: unknown[]) => mockCreateUser(...a),
    setCustomUserClaims: (...a: unknown[]) => mockSetClaims(...a),
    deleteUser: jest.fn(),
  }),
  getAdminFirestore: () => ({ collection: (name: string) => makeCollection(name) }),
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TS', delete: () => 'DELETE_FIELD' },
}));

import { NextRequest } from 'next/server';
import { PUT as putUser } from '@/app/api/users/[id]/route';
import { POST as postUserCreate } from '@/app/api/users/create/route';
import { PUT as putConsultant, DELETE as deleteConsultant } from '@/app/api/consultants/[id]/route';
import {
  POST as suspendTenant,
  DELETE as reactivateTenant,
} from '@/app/api/tenants/[id]/suspend/route';

function req(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/test', {
    method,
    headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const systemAdminToken = {
  uid: 'admin-1',
  name: 'Guilherme',
  email: 'g@x.com',
  is_system_admin: true,
};

let errorSpy: jest.SpyInstance;
let logSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockDocs)) delete mockDocs[k];
  mockAuditAdd.mockResolvedValue({ id: 'log-1' });
  mockVerifyIdToken.mockResolvedValue(systemAdminToken);
  mockGetUser.mockResolvedValue({ customClaims: {} });
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  errorSpy.mockRestore();
  logSpy.mockRestore();
});

describe('PUT /api/users/[id]', () => {
  beforeEach(() => {
    mockDocs['users/u-1'] = {
      role: 'clinic_user',
      active: true,
      tenant_id: 't-1',
      full_name: 'Ana',
    };
  });

  it('grava change_role com metadata de/para quando o papel muda', async () => {
    const res = await putUser(
      req('PUT', { displayName: 'Ana', role: 'clinic_admin', active: true }),
      ctx('u-1')
    );

    expect(res.status).toBe(200);
    expect(mockAuditAdd).toHaveBeenCalledTimes(1);
    expect(mockAuditAdd.mock.calls[0][0]).toMatchObject({
      tenant_id: 't-1',
      entity_type: 'user',
      entity_id: 'u-1',
      action: 'change_role',
      actor_id: 'admin-1',
      actor_name: 'Guilherme',
      actor_role: 'system_admin',
      metadata: { de: 'clinic_user', para: 'clinic_admin' },
      timestamp: 'SERVER_TS',
    });
  });

  it('grava deactivate quando o usuário é desativado', async () => {
    mockDocs['users/u-1'] = { role: 'clinic_user', active: true, tenant_id: 't-1' };

    await putUser(
      req('PUT', { displayName: 'Ana', role: 'clinic_user', active: false }),
      ctx('u-1')
    );

    expect(mockAuditAdd.mock.calls[0][0]).toMatchObject({ action: 'deactivate' });
  });

  it('não grava auditoria quando o usuário não existe (404)', async () => {
    const res = await putUser(
      req('PUT', { displayName: 'X', role: 'clinic_user', active: true }),
      ctx('inexistente')
    );

    expect(res.status).toBe(404);
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });

  it('não grava auditoria para chamador sem permissão (403)', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'u-9', is_system_admin: false });

    const res = await putUser(
      req('PUT', { displayName: 'Ana', role: 'clinic_user', active: true }),
      ctx('u-1')
    );

    expect(res.status).toBe(403);
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });

  it('a resposta continua 200 mesmo se a gravação da auditoria falhar', async () => {
    mockAuditAdd.mockRejectedValue(new Error('firestore indisponível'));

    const res = await putUser(
      req('PUT', { displayName: 'Ana', role: 'clinic_admin', active: true }),
      ctx('u-1')
    );

    expect(res.status).toBe(200);
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('POST /api/users/create', () => {
  beforeEach(() => {
    mockDocs['tenants/t-1'] = { name: 'Clínica A', active: true, max_users: 5 };
    mockCreateUser.mockResolvedValue({ uid: 'new-uid', email: 'n@x.com', displayName: 'Novo' });
  });

  it('system_admin criando usuário grava create com actor_role system_admin', async () => {
    const res = await postUserCreate(
      req('POST', {
        email: 'n@x.com',
        displayName: 'Novo',
        password: 'Senha123',
        role: 'clinic_user',
        tenant_id_override: 't-1',
      })
    );

    expect(res.status).toBe(201);
    expect(mockAuditAdd.mock.calls[0][0]).toMatchObject({
      tenant_id: 't-1',
      entity_type: 'user',
      entity_id: 'new-uid',
      action: 'create',
      actor_role: 'system_admin',
    });
  });

  it('clinic_admin criando usuário grava create com actor_role clinic_admin e tenant do token', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'ca-1',
      email: 'ca@x.com',
      role: 'clinic_admin',
      tenant_id: 't-1',
    });

    const res = await postUserCreate(
      req('POST', {
        email: 'n@x.com',
        displayName: 'Novo',
        password: 'Senha123',
        role: 'clinic_user',
      })
    );

    expect(res.status).toBe(201);
    expect(mockAuditAdd.mock.calls[0][0]).toMatchObject({
      tenant_id: 't-1',
      action: 'create',
      actor_role: 'clinic_admin',
      actor_name: 'ca@x.com',
    });
  });

  it('não grava auditoria quando a criação no Auth falha', async () => {
    mockCreateUser.mockRejectedValue({ code: 'auth/email-already-exists' });

    const res = await postUserCreate(
      req('POST', {
        email: 'n@x.com',
        displayName: 'Novo',
        password: 'Senha123',
        role: 'clinic_user',
        tenant_id_override: 't-1',
      })
    );

    expect(res.status).toBe(400);
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });
});

describe('/api/consultants/[id]', () => {
  beforeEach(() => {
    mockDocs['consultants/c-1'] = { name: 'Carlos', status: 'active', user_id: 'cu-1' };
  });

  it('PUT com status suspended grava suspend com metadata de/para e tenant_id null', async () => {
    const res = await putConsultant(req('PUT', { status: 'suspended' }), ctx('c-1'));

    expect(res.status).toBe(200);
    expect(mockAuditAdd.mock.calls[0][0]).toMatchObject({
      tenant_id: null,
      entity_type: 'consultant',
      entity_id: 'c-1',
      action: 'suspend',
      metadata: { de: 'active', para: 'suspended' },
    });
  });

  it('PUT sem mudança de status grava update', async () => {
    await putConsultant(req('PUT', { name: 'Carlos Silva' }), ctx('c-1'));

    expect(mockAuditAdd.mock.calls[0][0]).toMatchObject({ action: 'update' });
    expect(mockAuditAdd.mock.calls[0][0]).not.toHaveProperty('metadata');
  });

  it('PUT reativando (status volta a active) grava reactivate', async () => {
    mockDocs['consultants/c-1'] = { name: 'Carlos', status: 'inactive', user_id: 'cu-1' };

    await putConsultant(req('PUT', { status: 'active' }), ctx('c-1'));

    expect(mockAuditAdd.mock.calls[0][0]).toMatchObject({
      action: 'reactivate',
      metadata: { de: 'inactive', para: 'active' },
    });
  });

  it('DELETE grava suspend (desativação) com metadata', async () => {
    const res = await deleteConsultant(req('DELETE'), ctx('c-1'));

    expect(res.status).toBe(200);
    expect(mockAuditAdd.mock.calls[0][0]).toMatchObject({
      entity_type: 'consultant',
      action: 'suspend',
      metadata: { de: 'active', para: 'inactive' },
    });
  });

  it('não grava auditoria quando o consultor não existe (404)', async () => {
    const res = await deleteConsultant(req('DELETE'), ctx('nope'));

    expect(res.status).toBe(404);
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });
});

describe('/api/tenants/[id]/suspend', () => {
  beforeEach(() => {
    mockDocs['tenants/t-1'] = { name: 'Clínica A', active: true };
  });

  it('POST grava suspend com o tenant_id da clínica e o motivo em metadata', async () => {
    const res = await suspendTenant(
      req('POST', { reason: 'payment_failure', details: '  fatura em aberto ' }),
      ctx('t-1')
    );

    expect(res.status).toBe(200);
    expect(mockAuditAdd.mock.calls[0][0]).toMatchObject({
      tenant_id: 't-1',
      entity_type: 'tenant',
      entity_id: 't-1',
      action: 'suspend',
      metadata: { reason: 'payment_failure', details: 'fatura em aberto' },
    });
  });

  it('POST com motivo inválido não grava auditoria (400)', async () => {
    const res = await suspendTenant(req('POST', { reason: 'xyz', details: 'd' }), ctx('t-1'));

    expect(res.status).toBe(400);
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });

  it('DELETE grava reactivate', async () => {
    const res = await reactivateTenant(req('DELETE'), ctx('t-1'));

    expect(res.status).toBe(200);
    expect(mockAuditAdd.mock.calls[0][0]).toMatchObject({
      tenant_id: 't-1',
      entity_type: 'tenant',
      action: 'reactivate',
    });
  });

  it('não grava auditoria quando a clínica não existe (404)', async () => {
    const res = await reactivateTenant(req('DELETE'), ctx('nope'));

    expect(res.status).toBe(404);
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });
});
