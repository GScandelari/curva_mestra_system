/**
 * Claims Integrity Rules — lógica pura de comparação entre os custom claims
 * esperados (derivados do documento `users/{uid}` no Firestore, fonte de
 * verdade) e os custom claims reais (Firebase Auth). Zero import de
 * Firestore/Auth (client ou Admin SDK) — compartilhada entre
 * functions/src/claimsIntegrityCheck.ts (Admin SDK, Scheduled/Callable
 * Functions) e, potencialmente, qualquer leitura futura no client. Como o
 * deploy de functions/ empacota só functions/src (firebase.json/tsconfig),
 * este arquivo é espelhado manualmente em functions/src/claimsIntegrityRules.ts —
 * qualquer mudança aqui precisa ser replicada lá também (mesma convenção de
 * alertRules.ts).
 */

/** Papéis de usuário de clínica cobertos pela verificação de integridade. */
export type ClinicRole = 'clinic_admin' | 'clinic_user';

/** Claims esperados, derivados do documento `users/{uid}` no Firestore. */
export interface ExpectedClaims {
  tenant_id: string;
  role: ClinicRole;
  active: boolean;
}

/**
 * Formato mínimo dos custom claims reais, lidos de
 * `admin.auth().getUser(uid).customClaims`. `undefined` representa um
 * usuário sem claims nenhum (objeto `customClaims` ausente).
 */
export interface ActualClaims {
  tenant_id?: unknown;
  role?: unknown;
  active?: unknown;
  is_system_admin?: unknown;
}

/**
 * Compara os claims esperados (Firestore, fonte de verdade) contra os
 * claims reais (Firebase Auth) de um usuário `clinic_admin`/`clinic_user`.
 * Retorna a lista de divergências encontradas, em português, pronta para
 * exibição/e-mail — lista vazia significa "sem divergências".
 */
export function diffClaims(expected: ExpectedClaims, actual: ActualClaims | undefined): string[] {
  const differences: string[] = [];

  if (!actual || Object.keys(actual).length === 0) {
    differences.push('Nenhum custom claim definido (claims ausentes/vazios)');
    return differences;
  }

  if (actual.tenant_id !== expected.tenant_id) {
    differences.push(
      `tenant_id divergente: esperado "${expected.tenant_id}", atual ${JSON.stringify(actual.tenant_id)}`
    );
  }

  if (actual.role !== expected.role) {
    differences.push(
      `role divergente: esperado "${expected.role}", atual ${JSON.stringify(actual.role)}`
    );
  }

  if (actual.active !== expected.active) {
    differences.push(
      `active divergente: esperado ${expected.active}, atual ${JSON.stringify(actual.active)}`
    );
  }

  // clinic_admin/clinic_user nunca devem ter is_system_admin === true --
  // isso elevaria indevidamente o acesso do usuário a todos os tenants.
  if (actual.is_system_admin === true) {
    differences.push('is_system_admin inesperado: true (deveria ser false para este papel)');
  }

  return differences;
}
