/**
 * Cadeia compartilhada de aprovação de solicitação de acesso (server-only,
 * Admin SDK): tenant + usuário Auth + custom claims + documento `users/{uid}` +
 * atualização da solicitação + link de definição de senha + e-mail de
 * boas-vindas. Única implementação, chamada por:
 * - `POST /api/access-requests/[id]/approve` (System Admin, UC-02)
 * - `POST /api/access-requests/[id]/approve-consultant` (Consultor, UC-56)
 * Extraída de approve/route.ts conforme UC-02/RNF-04 e UC-56/RNF-03/RN-09 —
 * cada rota faz apenas a própria autenticação/autorização antes de chamar.
 */

import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { enqueueTemplatedEmail } from '@/lib/services/emailTemplateAdmin';
import type { AccessRequest, Tenant, UserRole } from '@/types';

export interface AccessRequestApprover {
  uid: string;
  name: string;
}

export interface AccessRequestApprovalResult {
  tenant_id: string;
  user_id: string;
  email: string;
  business_name: string;
}

/** `auth/email-already-exists` ao criar o usuário (UC-02 8b / UC-56 8d). */
export class EmailAlreadyInUseError extends Error {
  constructor() {
    super('Este email já está em uso');
    this.name = 'EmailAlreadyInUseError';
  }
}

/**
 * Executa a cadeia de criação para uma solicitação já validada como
 * `pendente` pelo chamador. Se a criação do usuário (ou qualquer etapa até a
 * atualização da solicitação) falhar, o tenant criado é revertido (UC-02 RN-04).
 * Falhas no link de senha ou no e-mail não revertem a aprovação (RN-05).
 *
 * O usuário Auth é criado SEM senha: antes, uma senha temporária aleatória era
 * gerada só para ser descartada logo em seguida (o usuário nunca a via). O
 * acesso continua sendo definido exclusivamente pelo link de
 * `generatePasswordResetLink` enviado no e-mail de boas-vindas (UC-02 RN-03).
 */
export async function createTenantAndUserFromAccessRequest(
  request: AccessRequest,
  requestId: string,
  approver: AccessRequestApprover
): Promise<AccessRequestApprovalResult> {
  // max_users baseado no role / type (UC-02 RN-02)
  const max_users = request.type === 'autonomo' || request.role === 'consultor' ? 1 : 5;

  const tenantData: Omit<Tenant, 'id'> = {
    name: request.business_name,
    document_type: request.document_type ?? 'cnpj',
    document_number: request.document_number ?? '',
    email: request.email,
    phone: request.phone || '',
    max_users,
    active: true,
    created_at: FieldValue.serverTimestamp() as unknown as Tenant['created_at'],
    updated_at: FieldValue.serverTimestamp() as unknown as Tenant['updated_at'],
    // Adicionar address apenas se existir (Firestore não aceita undefined)
    ...(request.address && {
      address: {
        street: request.address,
        city: request.city || '',
        state: request.state || '',
        zip: request.cep || '',
      },
    }),
  };

  const tenantRef = await adminDb.collection('tenants').add(tenantData);
  const tenant_id = tenantRef.id;

  console.log(`✅ Tenant criado: ${tenant_id} - ${request.business_name}`);

  let user_id: string;
  try {
    const userRecord = await adminAuth.createUser({
      email: request.email,
      displayName: request.full_name,
      emailVerified: false,
    });
    user_id = userRecord.uid;

    await adminAuth.setCustomUserClaims(user_id, {
      tenant_id,
      role: 'clinic_admin' as UserRole,
      is_system_admin: false,
      active: true,
    });

    console.log(`✅ Usuário criado: ${user_id} - ${request.email}`);

    await adminDb
      .collection('users')
      .doc(user_id)
      .set({
        tenant_id,
        email: request.email,
        full_name: request.full_name,
        phone: request.phone,
        role: 'clinic_admin' as UserRole,
        active: true,
        skip_welcome_email: true,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

    await adminDb.collection('access_requests').doc(requestId).update({
      status: 'aprovada',
      tenant_id,
      user_id,
      approved_by: approver.uid,
      approved_by_name: approver.name,
      approved_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
  } catch (authError: unknown) {
    console.error('❌ Erro ao criar usuário, revertendo tenant:', authError);
    await adminDb.collection('tenants').doc(tenant_id).delete();

    if ((authError as { code?: string })?.code === 'auth/email-already-exists') {
      throw new EmailAlreadyInUseError();
    }
    throw authError;
  }

  // Link para o usuário definir a própria senha
  let passwordResetLink = 'https://curvamestra.com.br/login';
  try {
    passwordResetLink = await adminAuth.generatePasswordResetLink(request.email);
    console.log(`✅ Link de redefinição de senha gerado para ${request.email}`);
  } catch (resetErr) {
    console.warn(`⚠️ Não foi possível gerar link de redefinição:`, resetErr);
  }

  // E-mail de boas-vindas via fila (não falha a aprovação)
  try {
    await enqueueTemplatedEmail(
      'welcome_approval',
      request.email,
      {
        displayName: request.full_name,
        email: request.email,
        businessName: request.business_name,
        passwordResetLink,
      },
      { metadata: { user_id, tenant_id } }
    );
    console.log(`✅ E-mail de boas-vindas adicionado à fila para ${request.email}`);
  } catch (emailError) {
    console.warn(`⚠️ Erro ao adicionar e-mail à fila:`, emailError);
  }

  return {
    tenant_id,
    user_id,
    email: request.email,
    business_name: request.business_name,
  };
}
