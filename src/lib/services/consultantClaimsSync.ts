import { adminAuth } from '@/lib/firebase-admin';

/**
 * Sincroniza `authorized_tenants` nas custom claims de um consultor após uma
 * escrita já confirmada no Firestore (vínculo/transferência/remoção de clínica).
 *
 * Custom claims do Firebase Auth não participam de transações/batches do
 * Firestore -- por isso essa etapa sempre roda DEPOIS do commit no Firestore,
 * nunca dentro dele. Falhas aqui não devem derrubar a operação já persistida
 * (o Firestore é a fonte da verdade); o chamador decide o que fazer com
 * `synced: false` (ex.: avisar o usuário, logar para reconciliação manual).
 */
export async function syncConsultantAuthorizedTenants(
  userId: string,
  tenantId: string,
  action: 'add' | 'remove'
): Promise<{ synced: boolean; error?: unknown }> {
  try {
    const userRecord = await adminAuth.getUser(userId);
    const currentClaims = userRecord.customClaims || {};
    const current: string[] = currentClaims.authorized_tenants || [];

    const authorized_tenants =
      action === 'add'
        ? current.includes(tenantId)
          ? current
          : [...current, tenantId]
        : current.filter((t) => t !== tenantId);

    await adminAuth.setCustomUserClaims(userId, {
      ...currentClaims,
      authorized_tenants,
    });

    return { synced: true };
  } catch (error) {
    console.warn(
      `[consultantClaimsSync] Falha ao sincronizar tenant ${tenantId} (${action}) para o usuário ${userId}:`,
      error
    );
    return { synced: false, error };
  }
}
