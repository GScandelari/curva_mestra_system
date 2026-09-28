const mockAddDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockCollection = jest.fn((...args: unknown[]) => ({ kind: 'collection', args }));
const mockCollectionGroup = jest.fn((...args: unknown[]) => ({ kind: 'group', args }));
const mockQuery = jest.fn((...args: unknown[]) => ({ kind: 'query', args }));
const mockWhere = jest.fn((...args: unknown[]) => ({ kind: 'where', args }));
const mockOrderBy = jest.fn((...args: unknown[]) => ({ kind: 'orderBy', args }));
const mockLimit = jest.fn((n: number) => ({ kind: 'limit', n }));

jest.mock('firebase/firestore', () => ({
  collection: (...a: unknown[]) => mockCollection(...a),
  collectionGroup: (...a: unknown[]) => mockCollectionGroup(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  orderBy: (...a: unknown[]) => mockOrderBy(...a),
  limit: (n: number) => mockLimit(n),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
  addDoc: (...a: unknown[]) => mockAddDoc(...a),
  serverTimestamp: () => 'SERVER_TS',
  Timestamp: class {},
}));

const mockAuth: { currentUser: null | { uid: string; displayName?: string; email?: string } } = {
  currentUser: null,
};

jest.mock('../lib/firebase', () => ({
  db: { name: 'db' },
  get auth() {
    return mockAuth;
  },
}));

import { writeAuditLog, writeAdminAuditLog, listAuditLog } from '@/lib/services/auditLogService';
import type { NewAuditLogInput } from '@/lib/auditLogPayload';

const input: NewAuditLogInput = {
  tenant_id: 't-1',
  entity_type: 'tenant',
  entity_id: 't-1',
  action: 'update',
  descricao: 'Clínica editada',
  actor_id: 'uid-1',
  actor_name: 'Admin',
  actor_role: 'system_admin',
};

const ts = (iso: string) => ({ toDate: () => new Date(iso) });
const snap = (docs: Array<{ id: string; data: Record<string, unknown> }>) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
  size: docs.length,
});

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.currentUser = null;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => errorSpy.mockRestore());

describe('writeAuditLog', () => {
  it('grava em audit_log com payload e serverTimestamp', async () => {
    mockAddDoc.mockResolvedValue({ id: 'log-1' });

    await writeAuditLog(input);

    expect(mockCollection).toHaveBeenCalledWith({ name: 'db' }, 'audit_log');
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenant_id: 't-1',
        entity_type: 'tenant',
        action: 'update',
        actor_id: 'uid-1',
        timestamp: 'SERVER_TS',
      })
    );
  });

  it('lança erro genérico quando addDoc falha', async () => {
    mockAddDoc.mockRejectedValue(new Error('permission-denied'));

    await expect(writeAuditLog(input)).rejects.toThrow('Falha ao gravar entrada de auditoria');
  });
});

describe('writeAdminAuditLog', () => {
  const partial = {
    tenant_id: null,
    entity_type: 'system_settings' as const,
    entity_id: 'global',
    action: 'update' as const,
    descricao: 'Configurações atualizadas',
  };

  it('não grava nem lança quando não há usuário logado', async () => {
    await expect(writeAdminAuditLog(partial)).resolves.toBeUndefined();
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('preenche o ator com o usuário logado (displayName) como system_admin', async () => {
    mockAuth.currentUser = { uid: 'uid-9', displayName: 'Guilherme', email: 'g@x.com' };
    mockAddDoc.mockResolvedValue({ id: 'log-1' });

    await writeAdminAuditLog(partial);

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actor_id: 'uid-9',
        actor_name: 'Guilherme',
        actor_role: 'system_admin',
        tenant_id: null,
      })
    );
  });

  it('usa email quando não há displayName e "Admin" quando não há nenhum dos dois', async () => {
    mockAddDoc.mockResolvedValue({ id: 'log-1' });

    mockAuth.currentUser = { uid: 'uid-9', email: 'g@x.com' };
    await writeAdminAuditLog(partial);
    expect(mockAddDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ actor_name: 'g@x.com' })
    );

    mockAuth.currentUser = { uid: 'uid-9' };
    await writeAdminAuditLog(partial);
    expect(mockAddDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ actor_name: 'Admin' })
    );
  });

  it('nunca propaga erro quando a gravação falha', async () => {
    mockAuth.currentUser = { uid: 'uid-9', displayName: 'Guilherme' };
    mockAddDoc.mockRejectedValue(new Error('offline'));

    await expect(writeAdminAuditLog(partial)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('listAuditLog', () => {
  const auditLogSnap = snap([
    {
      id: 'a1',
      data: {
        tenant_id: 't-1',
        entity_type: 'user',
        action: 'change_role',
        descricao: 'Papel alterado',
        actor_name: 'Admin',
        timestamp: ts('2026-09-10T10:00:00Z'),
      },
    },
    {
      id: 'a2',
      data: {
        tenant_id: null,
        entity_type: 'master_product',
        action: 'create',
        descricao: 'Produto criado',
        actor_name: 'Admin',
        timestamp: ts('2026-09-12T10:00:00Z'),
      },
    },
  ]);

  const activitySnap = snap([
    {
      id: 'i1',
      data: {
        tenant_id: 't-1',
        tipo: 'entrada',
        descricao: 'Entrada de estoque',
        created_by_name: 'Maria',
        timestamp: ts('2026-09-11T10:00:00Z'),
      },
    },
  ]);

  it('exige tenantId para o escopo clinic_admin', async () => {
    await expect(listAuditLog({ scope: 'clinic_admin' })).rejects.toThrow(
      'Falha ao carregar trilha de auditoria'
    );
  });

  it('unifica audit_log e inventory_activity ordenados por timestamp decrescente com rótulos PT-BR', async () => {
    mockGetDocs.mockResolvedValueOnce(auditLogSnap).mockResolvedValueOnce(activitySnap);

    const { items, hasMore } = await listAuditLog({ scope: 'system_admin' });

    expect(items.map((i) => i.id)).toEqual(['a2', 'i1', 'a1']);
    expect(items[0]).toMatchObject({
      source: 'audit_log',
      tenant_id: null,
      categoria: 'Produto Master',
      acao: 'Criar',
    });
    expect(items[1]).toMatchObject({
      source: 'inventory_activity',
      categoria: 'Estoque',
      ator: 'Maria',
      acao: 'entrada',
    });
    expect(items[2]).toMatchObject({ categoria: 'Usuário', acao: 'Alterar Papel' });
    expect(hasMore).toBe(false);
  });

  it('system_admin lê audit_log sem filtro de tenant e inventory_activity via collectionGroup', async () => {
    mockGetDocs.mockResolvedValue(snap([]));

    await listAuditLog({ scope: 'system_admin' });

    expect(mockCollectionGroup).toHaveBeenCalledWith({ name: 'db' }, 'inventory_activity');
    expect(mockWhere).not.toHaveBeenCalled();
  });

  it('clinic_admin filtra audit_log por tenant_id e lê a subcoleção do próprio tenant', async () => {
    mockGetDocs.mockResolvedValue(snap([]));

    await listAuditLog({ scope: 'clinic_admin', tenantId: 't-1' });

    expect(mockWhere).toHaveBeenCalledWith('tenant_id', '==', 't-1');
    expect(mockCollection).toHaveBeenCalledWith(
      { name: 'db' },
      'tenants',
      't-1',
      'inventory_activity'
    );
    expect(mockCollectionGroup).not.toHaveBeenCalled();
  });

  it('hasMore é verdadeiro quando alguma fonte atinge o pageSize', async () => {
    mockGetDocs.mockResolvedValueOnce(auditLogSnap).mockResolvedValueOnce(snap([]));

    const { hasMore } = await listAuditLog({ scope: 'system_admin', pageSize: 2 });

    expect(hasMore).toBe(true);
    expect(mockLimit).toHaveBeenCalledWith(2);
  });

  it('usa valores de fallback quando faltam campos opcionais', async () => {
    mockGetDocs
      .mockResolvedValueOnce(snap([]))
      .mockResolvedValueOnce(snap([{ id: 'i2', data: {} }]));

    const { items } = await listAuditLog({ scope: 'system_admin' });

    expect(items[0]).toMatchObject({ ator: '—', acao: '—', descricao: '—', tenant_id: null });
    expect(items[0].timestamp.getTime()).toBe(0);
  });

  it('lança erro genérico quando a leitura falha', async () => {
    mockGetDocs.mockRejectedValue(new Error('permission-denied'));

    await expect(listAuditLog({ scope: 'system_admin' })).rejects.toThrow(
      'Falha ao carregar trilha de auditoria'
    );
  });
});
