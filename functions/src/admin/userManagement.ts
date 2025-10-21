import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';

/**
 * Cloud Function para gerenciar usuários administrativos
 * Esta função permite definir roles e claims customizados
 */
export const setUserRole = onCall(async (request) => {
  // Verificar se o usuário está autenticado
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
  }

  const { uid, role, clinicId, isAdmin } = request.data;

  // Validar parâmetros
  if (!uid || !role) {
    throw new HttpsError('invalid-argument', 'UID e role são obrigatórios');
  }

  // Validar roles permitidos
  const allowedRoles = ['admin', 'manager', 'doctor', 'receptionist'];
  if (!allowedRoles.includes(role)) {
    throw new HttpsError('invalid-argument', `Role deve ser um dos: ${allowedRoles.join(', ')}`);
  }

  try {
    // Definir custom claims
    const customClaims = {
      role,
      clinicId: clinicId || 'default-clinic',
      isAdmin: isAdmin || role === 'admin',
      permissions: getPermissionsByRole(role)
    };

    // Aplicar custom claims ao usuário
    await getAuth().setCustomUserClaims(uid, customClaims);

    // Atualizar o perfil do usuário no Authentication
    await getAuth().updateUser(uid, {
      displayName: `${role.charAt(0).toUpperCase() + role.slice(1)} User`
    });

    return {
      success: true,
      message: `Usuário ${uid} agora tem role: ${role}`,
      claims: customClaims
    };
  } catch (error) {
    console.error('Erro ao definir role do usuário:', error);
    throw new HttpsError('internal', 'Erro interno ao definir role do usuário');
  }
});

/**
 * Função para obter permissões baseadas no role
 */
function getPermissionsByRole(role: string): string[] {
  const rolePermissions = {
    admin: [
      'view_products', 'manage_products', 'view_requests', 'approve_requests',
      'view_patients', 'manage_patients', 'view_invoices', 'manage_invoices',
      'view_reports', 'manage_users', 'view_analytics', 'manage_settings'
    ],
    manager: [
      'view_products', 'manage_products', 'view_requests', 'approve_requests',
      'view_reports', 'view_invoices', 'manage_invoices'
    ],
    doctor: [
      'view_products', 'request_products', 'view_patients', 'manage_patients',
      'view_invoices'
    ],
    receptionist: [
      'view_patients', 'manage_patients', 'view_requests', 'view_invoices'
    ]
  };

  return rolePermissions[role as keyof typeof rolePermissions] || [];
}

/**
 * Função para listar usuários (apenas para admins)
 */
export const listUsers = onCall(async (request) => {
  // Verificar se o usuário está autenticado
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
  }

  // Verificar se o usuário é admin
  if (!request.auth.token.isAdmin) {
    throw new HttpsError('permission-denied', 'Apenas admins podem listar usuários');
  }

  try {
    const listUsersResult = await getAuth().listUsers(1000);
    
    const users = listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      disabled: user.disabled,
      customClaims: user.customClaims || {},
      creationTime: user.metadata.creationTime,
      lastSignInTime: user.metadata.lastSignInTime
    }));

    return {
      success: true,
      users
    };
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    throw new HttpsError('internal', 'Erro interno ao listar usuários');
  }
});

/**
 * Função para obter informações de um usuário específico
 */
export const getUserInfo = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
  }

  const { uid } = request.data;
  
  // Se não especificar UID, retorna info do usuário atual
  const targetUid = uid || request.auth.uid;

  try {
    const user = await getAuth().getUser(targetUid);
    
    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        customClaims: user.customClaims || {},
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime
      }
    };
  } catch (error) {
    console.error('Erro ao obter informações do usuário:', error);
    throw new HttpsError('internal', 'Erro interno ao obter informações do usuário');
  }
});