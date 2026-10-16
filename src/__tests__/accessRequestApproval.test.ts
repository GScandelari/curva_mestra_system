/**
 * Aprovação de solicitação (UC-02 / UC-56) — FEAT-ajustes-registro-e-busca-consultor:
 * CPF/CNPJ já usado por outra clínica bloqueia antes de qualquer escrita (409)
 * e solicitação sem nome de clínica (consultor) usa o nome completo.
 * Também a regressão de checkActiveConsultant/verifyActiveConsultant.
 */
const mockTenantsWhere = jest.fn();
const mockTenantsAdd = jest.fn();
const mockCreateUser = jest.fn();
const mockConsultantGet = jest.fn();
const mockEnqueue = jest.fn();
const mockVerifyIdToken = jest.fn();

jest.mock('../lib/firebase-admin', () => {
  const batch = { update: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
  return {
    adminAuth: {
      createUser: (...a: unknown[]) => mockCreateUser(...a),
      setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
      generatePasswordResetLink: jest.fn().mockResolvedValue('https://link'),
      verifyIdToken: (...a: unknown[]) => mockVerifyIdToken(...a),
    },
    adminDb: {
      batch: () => batch,
      collection: jest.fn((name: string) => {
        if (name === 'tenants') {
          return {
            where: (field: string, _op: string, value: string) => ({
              limit: () => ({ get: () => mockTenantsWhere(field, value) }),
            }),
            add: (...a: unknown[]) => mockTenantsAdd(...a),
            doc: () => ({ delete: jest.fn().mockResolvedValue(undefined) }),
          };
        }
        if (name === 'consultants') {
          return { doc: () => ({ get: () => mockConsultantGet() }) };
        }
        return { doc: () => ({ set: jest.fn().mockResolvedValue(undefined) }) };
      }),
    },
    getAdminApp: jest.fn(),
  };
});

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'TS', arrayUnion: (v: string) => ({ arrayUnion: v }) },
}));
jest.mock('../lib/services/emailTemplateAdmin', () => ({
  enqueueTemplatedEmail: (...a: unknown[]) => mockEnqueue(...a),
}));
jest.mock('../lib/services/consultantClaimsSync', () => ({
  syncConsultantAuthorizedTenants: jest.fn().mockResolvedValue(undefined),
}));

import { NextRequest, NextResponse } from 'next/server';
import {
  DocumentAlreadyInUseError,
  createTenantAndUserFromAccessRequest,
} from '@/lib/services/accessRequestApproval';
import {
  approveAccessRequestResponse,
  checkActiveConsultant,
  verifyActiveConsultant,
} from '@/lib/services/accessRequestRouteHelpers';
import type { AccessRequest } from '@/types';
import type { DecodedIdToken } from 'firebase-admin/auth';

const especialista = {
  role: 'especialista',
  type: 'clinica',
  full_name: 'Helena Vidal',
  email: 'helena@clinica.com.br',
  phone: '(11) 99999-8888',
  council_number: 'CRM-SP 1',
  business_name: 'Clínica Cíngulo',
  document_type: 'cnpj',
  document_number: '11222333000181',
  status: 'pendente',
} as unknown as AccessRequest;
const approver = { uid: 'sa', name: 'Admin' };
const vazio = { empty: true };

beforeEach(() => {
  jest.clearAllMocks();
  mockTenantsWhere.mockResolvedValue(vazio);
  mockTenantsAdd.mockResolvedValue({ id: 'tenant-novo' });
  mockCreateUser.mockResolvedValue({ uid: 'user-novo' });
  mockConsultantGet.mockResolvedValue({ exists: false, data: () => undefined });
  mockEnqueue.mockResolvedValue(undefined);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('createTenantAndUserFromAccessRequest — documento', () => {
  it('creates the tenant with the request document when it is free', async () => {
    const r = await createTenantAndUserFromAccessRequest(especialista, 'req-1', approver);
    expect(r).toEqual({
      tenant_id: 'tenant-novo',
      user_id: 'user-novo',
      email: 'helena@clinica.com.br',
      business_name: 'Clínica Cíngulo',
    });
    expect(mockTenantsWhere).toHaveBeenCalledWith('document_number', '11222333000181');
    expect(mockTenantsWhere).toHaveBeenCalledWith('cnpj', '11222333000181');
    expect(mockTenantsAdd.mock.calls[0][0]).toMatchObject({
      name: 'Clínica Cíngulo',
      document_type: 'cnpj',
      document_number: '11222333000181',
    });
  });

  it.each([['document_number'], ['cnpj']])(
    'throws DocumentAlreadyInUseError before any write when %s is already used',
    async (campo) => {
      mockTenantsWhere.mockImplementation(async (field: string) =>
        field === campo ? { empty: false } : vazio
      );
      await expect(
        createTenantAndUserFromAccessRequest(especialista, 'req-1', approver)
      ).rejects.toBeInstanceOf(DocumentAlreadyInUseError);
      expect(mockTenantsAdd).not.toHaveBeenCalled();
      expect(mockCreateUser).not.toHaveBeenCalled();
      expect(mockEnqueue).not.toHaveBeenCalled();
    }
  );

  it('does not check old requests without a document', async () => {
    const antiga = { ...especialista, document_number: undefined, document_type: undefined };
    await createTenantAndUserFromAccessRequest(antiga as AccessRequest, 'req-1', approver);
    expect(mockTenantsWhere).not.toHaveBeenCalled();
    expect(mockTenantsAdd.mock.calls[0][0]).toMatchObject({
      document_type: 'cnpj',
      document_number: '',
    });
  });
});

describe('createTenantAndUserFromAccessRequest — nome', () => {
  it('uses the full name when the request has no business name (consultant)', async () => {
    const consultor = {
      ...especialista,
      role: 'consultor',
      type: 'autonomo',
      business_name: undefined,
      document_number: undefined,
    } as unknown as AccessRequest;
    const r = await createTenantAndUserFromAccessRequest(consultor, 'req-2', approver);
    expect(r.business_name).toBe('Helena Vidal');
    expect(mockTenantsAdd.mock.calls[0][0].name).toBe('Helena Vidal');
    expect(mockEnqueue.mock.calls[0][2]).toMatchObject({ businessName: 'Helena Vidal' });
  });

  it('keeps the legacy region of old consultant requests', async () => {
    const antigo = { ...especialista, role: 'consultor', business_name: ' Sudeste 2 ' };
    const r = await createTenantAndUserFromAccessRequest(
      antigo as AccessRequest,
      'req-3',
      approver
    );
    expect(r.business_name).toBe('Sudeste 2');
  });
});

describe('approveAccessRequestResponse', () => {
  it('maps a duplicated document to 409', async () => {
    mockTenantsWhere.mockResolvedValue({ empty: false });
    const res = await approveAccessRequestResponse(especialista, 'req-1', approver);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error:
        'Já existe uma clínica cadastrada com este CPF/CNPJ. Verifique com o solicitante antes de aprovar.',
    });
  });
});

describe('checkActiveConsultant / verifyActiveConsultant (regressão)', () => {
  const token = (extra: Record<string, unknown>) =>
    ({
      uid: 'c',
      is_consultant: true,
      consultant_id: 'cons-1',
      active: true,
      ...extra,
    }) as unknown as DecodedIdToken;

  it('accepts an active consultant (claim + document)', async () => {
    mockConsultantGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: 'active', name: 'Paulo' }),
    });
    const r = await checkActiveConsultant(token({}), 'negado');
    expect(r).toMatchObject({ consultantId: 'cons-1', consultantName: 'Paulo' });
  });

  it.each([[{ is_consultant: false }], [{ active: false }], [{ consultant_id: undefined }]])(
    'denies claims %p with 403',
    async (extra) => {
      const r = await checkActiveConsultant(token(extra), 'negado');
      expect(r).toBeInstanceOf(NextResponse);
      expect((r as NextResponse).status).toBe(403);
    }
  );

  it('denies a suspended consultant document', async () => {
    mockConsultantGet.mockResolvedValue({ exists: true, data: () => ({ status: 'suspended' }) });
    expect(((await checkActiveConsultant(token({}), 'negado')) as NextResponse).status).toBe(403);
  });

  it('verifyActiveConsultant still decodes the bearer token first', async () => {
    const semToken = new NextRequest('http://localhost/x');
    expect(((await verifyActiveConsultant(semToken, 'negado')) as NextResponse).status).toBe(401);
    mockVerifyIdToken.mockResolvedValue(token({}));
    mockConsultantGet.mockResolvedValue({ exists: true, data: () => ({ status: 'active' }) });
    const comToken = new NextRequest('http://localhost/x', {
      headers: { authorization: 'Bearer t' },
    });
    expect(await verifyActiveConsultant(comToken, 'negado')).toMatchObject({
      consultantId: 'cons-1',
    });
  });
});
