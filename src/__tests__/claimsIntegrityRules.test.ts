import { diffClaims, ExpectedClaims } from '@/lib/claimsIntegrityRules';

const expected: ExpectedClaims = {
  tenant_id: 'tenant_abc123',
  role: 'clinic_admin',
  active: true,
};

describe('diffClaims', () => {
  it('retorna lista vazia quando os claims reais batem exatamente com os esperados', () => {
    expect(
      diffClaims(expected, {
        tenant_id: 'tenant_abc123',
        role: 'clinic_admin',
        active: true,
        is_system_admin: false,
      })
    ).toEqual([]);
  });

  it('detecta claims completamente ausentes (undefined)', () => {
    const differences = diffClaims(expected, undefined);
    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatch(/ausentes\/vazios/);
  });

  it('detecta claims vazios (objeto sem nenhuma chave)', () => {
    const differences = diffClaims(expected, {});
    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatch(/ausentes\/vazios/);
  });

  it('detecta tenant_id divergente', () => {
    const differences = diffClaims(expected, {
      tenant_id: 'tenant_outro',
      role: 'clinic_admin',
      active: true,
    });
    expect(differences).toEqual([
      'tenant_id divergente: esperado "tenant_abc123", atual "tenant_outro"',
    ]);
  });

  it('detecta role divergente', () => {
    const differences = diffClaims(expected, {
      tenant_id: 'tenant_abc123',
      role: 'clinic_user',
      active: true,
    });
    expect(differences).toEqual(['role divergente: esperado "clinic_admin", atual "clinic_user"']);
  });

  it('detecta active divergente', () => {
    const differences = diffClaims(expected, {
      tenant_id: 'tenant_abc123',
      role: 'clinic_admin',
      active: false,
    });
    expect(differences).toEqual(['active divergente: esperado true, atual false']);
  });

  it('detecta is_system_admin inesperadamente true', () => {
    const differences = diffClaims(expected, {
      tenant_id: 'tenant_abc123',
      role: 'clinic_admin',
      active: true,
      is_system_admin: true,
    });
    expect(differences).toEqual([
      'is_system_admin inesperado: true (deveria ser false para este papel)',
    ]);
  });

  it('acumula múltiplas divergências ao mesmo tempo', () => {
    const differences = diffClaims(expected, {
      tenant_id: 'tenant_outro',
      role: 'clinic_user',
      active: false,
      is_system_admin: true,
    });
    expect(differences).toHaveLength(4);
  });

  it('não reporta is_system_admin ausente (undefined) como divergência', () => {
    const differences = diffClaims(expected, {
      tenant_id: 'tenant_abc123',
      role: 'clinic_admin',
      active: true,
    });
    expect(differences).toEqual([]);
  });
});
