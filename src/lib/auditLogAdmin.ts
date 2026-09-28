import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { buildAuditLogPayload, type NewAuditLogInput } from '@/lib/auditLogPayload';

/**
 * Grava entrada de auditoria via Admin SDK (rotas de API). Nunca propaga erro:
 * uma falha na auditoria não pode quebrar a operação administrativa principal.
 */
export async function writeAuditLogAdmin(input: NewAuditLogInput): Promise<void> {
  try {
    await adminDb.collection('audit_log').add({
      ...buildAuditLogPayload(input),
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao gravar entrada de auditoria:', error);
  }
}

export function actorNameFromToken(token: { name?: string; email?: string }): string {
  return token.name || token.email || 'Admin';
}
