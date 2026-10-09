import {
  buildAuditLogPayload,
  determineUserAuditAction,
  determineConsultantAuditAction,
  determineFinancialShareAuditAction,
  type NewAuditLogInput,
} from '@/lib/auditLogPayload';

const baseInput: NewAuditLogInput = {
  tenant_id: null,
  entity_type: 'master_product',
  entity_id: 'prod-1',
  action: 'create',
  descricao: 'Produto criado',
  actor_id: 'uid-1',
  actor_name: 'Fulano',
  actor_role: 'system_admin',
};

describe('buildAuditLogPayload', () => {
  it('preserves tenant_id: null instead of removing it', () => {
    const payload = buildAuditLogPayload(baseInput);
    expect(payload).toHaveProperty('tenant_id', null);
  });

  it('omits the metadata key entirely when metadata is absent', () => {
    const payload = buildAuditLogPayload(baseInput);
    expect(payload).not.toHaveProperty('metadata');
  });

  it('preserves metadata when present', () => {
    const payload = buildAuditLogPayload({
      ...baseInput,
      metadata: { de: 'clinic_user', para: 'clinic_admin' },
    });
    expect(payload).toHaveProperty('metadata', { de: 'clinic_user', para: 'clinic_admin' });
  });

  it('includes all required fields', () => {
    const payload = buildAuditLogPayload({ ...baseInput, tenant_id: 'tenant-1' });
    expect(payload).toEqual({
      tenant_id: 'tenant-1',
      entity_type: 'master_product',
      entity_id: 'prod-1',
      action: 'create',
      descricao: 'Produto criado',
      actor_id: 'uid-1',
      actor_name: 'Fulano',
      actor_role: 'system_admin',
    });
  });
});

describe('determineUserAuditAction', () => {
  it('returns change_role with metadata when role changes', () => {
    const result = determineUserAuditAction(
      { role: 'clinic_user', active: true },
      { role: 'clinic_admin', active: true }
    );
    expect(result).toEqual({
      action: 'change_role',
      metadata: { de: 'clinic_user', para: 'clinic_admin' },
    });
  });

  it('returns deactivate when active goes true -> false', () => {
    const result = determineUserAuditAction(
      { role: 'clinic_user', active: true },
      { role: 'clinic_user', active: false }
    );
    expect(result).toEqual({ action: 'deactivate' });
  });

  it('returns activate when active goes false -> true', () => {
    const result = determineUserAuditAction(
      { role: 'clinic_user', active: false },
      { role: 'clinic_user', active: true }
    );
    expect(result).toEqual({ action: 'activate' });
  });

  it('returns update when nothing relevant changed', () => {
    const result = determineUserAuditAction(
      { role: 'clinic_user', active: true },
      { role: 'clinic_user', active: true }
    );
    expect(result).toEqual({ action: 'update' });
  });

  it('prioritizes change_role when both role and active change simultaneously', () => {
    const result = determineUserAuditAction(
      { role: 'clinic_user', active: true },
      { role: 'clinic_admin', active: false }
    );
    expect(result.action).toBe('change_role');
  });
});

describe('determineConsultantAuditAction', () => {
  it('returns reactivate when status becomes active', () => {
    const result = determineConsultantAuditAction({ status: 'suspended' }, { status: 'active' });
    expect(result).toEqual({ action: 'reactivate', metadata: { de: 'suspended', para: 'active' } });
  });

  it('returns suspend when status becomes suspended', () => {
    const result = determineConsultantAuditAction({ status: 'active' }, { status: 'suspended' });
    expect(result).toEqual({ action: 'suspend', metadata: { de: 'active', para: 'suspended' } });
  });

  it('returns suspend when status becomes inactive', () => {
    const result = determineConsultantAuditAction({ status: 'active' }, { status: 'inactive' });
    expect(result).toEqual({ action: 'suspend', metadata: { de: 'active', para: 'inactive' } });
  });

  it('returns update when status is unchanged', () => {
    const result = determineConsultantAuditAction({ status: 'active' }, { status: 'active' });
    expect(result).toEqual({ action: 'update' });
  });
});

describe('determineFinancialShareAuditAction', () => {
  const off = { compartilhar_com_consultor: false, compartilhado_com_consultant_id: null };
  const onX = { compartilhar_com_consultor: true, compartilhado_com_consultant_id: 'cons-x' };
  const onY = { compartilhar_com_consultor: true, compartilhado_com_consultant_id: 'cons-y' };

  it('does not audit when sharing stays off', () => {
    expect(determineFinancialShareAuditAction(null, off)).toBeNull();
    expect(determineFinancialShareAuditAction(off, off)).toBeNull();
  });

  it('audits share when sharing is turned on', () => {
    expect(determineFinancialShareAuditAction(null, onX)).toEqual({
      action: 'share_with_consultant',
      metadata: { consultant_id: 'cons-x' },
    });
    expect(determineFinancialShareAuditAction(off, onX)).toEqual({
      action: 'share_with_consultant',
      metadata: { consultant_id: 'cons-x' },
    });
  });

  it('does not audit when sharing stays on for the same consultant', () => {
    expect(determineFinancialShareAuditAction(onX, onX)).toBeNull();
  });

  it('audits unshare when sharing is turned off', () => {
    expect(determineFinancialShareAuditAction(onX, off)).toEqual({
      action: 'unshare_with_consultant',
      metadata: { consultant_id: 'cons-x' },
    });
  });

  it('audits share with the previous consultant when the recipient changes', () => {
    expect(determineFinancialShareAuditAction(onX, onY)).toEqual({
      action: 'share_with_consultant',
      metadata: { consultant_id: 'cons-y', consultant_anterior_id: 'cons-x' },
    });
  });

  it('records the consultant change reason on automatic unshare', () => {
    expect(determineFinancialShareAuditAction(onX, off, { trocaDeConsultor: true })).toEqual({
      action: 'unshare_with_consultant',
      metadata: { consultant_id: 'cons-x', motivo: 'troca_de_consultor' },
    });
  });
});
