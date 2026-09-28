const mockAdd = jest.fn();

jest.mock('../lib/firebase-admin', () => ({
  adminDb: { collection: jest.fn(() => ({ add: mockAdd })) },
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: jest.fn(() => 'SERVER_TS') },
}));

import { adminDb } from '@/lib/firebase-admin';
import { writeAuditLogAdmin, actorNameFromToken } from '@/lib/auditLogAdmin';
import type { NewAuditLogInput } from '@/lib/auditLogPayload';

const input: NewAuditLogInput = {
  tenant_id: null,
  entity_type: 'consultant',
  entity_id: 'c-1',
  action: 'create',
  descricao: 'Consultor criado',
  actor_id: 'uid-1',
  actor_name: 'Admin',
  actor_role: 'system_admin',
};

describe('writeAuditLogAdmin', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  it('grava na coleção audit_log com o payload e o timestamp do servidor', async () => {
    mockAdd.mockResolvedValue({ id: 'log-1' });

    await writeAuditLogAdmin(input);

    expect(adminDb.collection).toHaveBeenCalledWith('audit_log');
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith({
      tenant_id: null,
      entity_type: 'consultant',
      entity_id: 'c-1',
      action: 'create',
      descricao: 'Consultor criado',
      actor_id: 'uid-1',
      actor_name: 'Admin',
      actor_role: 'system_admin',
      timestamp: 'SERVER_TS',
    });
  });

  it('inclui metadata quando informada', async () => {
    mockAdd.mockResolvedValue({ id: 'log-2' });

    await writeAuditLogAdmin({ ...input, metadata: { de: 'active', para: 'inactive' } });

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { de: 'active', para: 'inactive' } })
    );
  });

  it('nunca propaga erro quando a gravação falha (só registra no console)', async () => {
    mockAdd.mockRejectedValue(new Error('firestore indisponível'));

    await expect(writeAuditLogAdmin(input)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('actorNameFromToken', () => {
  it('prioriza name', () => {
    expect(actorNameFromToken({ name: 'Maria', email: 'maria@x.com' })).toBe('Maria');
  });

  it('usa email quando não há name', () => {
    expect(actorNameFromToken({ email: 'maria@x.com' })).toBe('maria@x.com');
  });

  it("usa 'Admin' quando não há name nem email", () => {
    expect(actorNameFromToken({})).toBe('Admin');
  });
});
