/**
 * User Management Service
 * Gerenciamento de usuários multi-tenant com controle de limites
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, UserRole } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface UserWithStatus extends User {
  last_login?: Timestamp;
  invited_at?: Timestamp;
  invitation_status?: 'pending' | 'accepted';
}

// ============================================================================
// TENANT LIMITS
// ============================================================================

/**
 * Verifica se o tenant pode adicionar mais usuários
 */
export async function canAddUser(tenantId: string): Promise<{
  canAdd: boolean;
  currentCount: number;
  maxUsers: number;
  error?: string;
}> {
  try {
    // 1. Buscar max_users direto do tenant
    const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));

    if (!tenantDoc.exists()) {
      return {
        canAdd: false,
        currentCount: 0,
        maxUsers: 0,
        error: 'Tenant não encontrado',
      };
    }

    const tenantData = tenantDoc.data();
    const maxUsers: number = tenantData?.max_users ?? 5;

    // 2. Contar usuários ativos do tenant
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('tenant_id', '==', tenantId), where('active', '==', true));
    const snapshot = await getDocs(q);
    const currentCount = snapshot.size;

    // 3. Verificar limite
    const canAdd = currentCount < maxUsers;

    return {
      canAdd,
      currentCount,
      maxUsers,
      error: canAdd ? undefined : `Limite de ${maxUsers} usuários atingido`,
    };
  } catch (error) {
    console.error('Erro ao verificar limite de usuários:', error);
    return {
      canAdd: false,
      currentCount: 0,
      maxUsers: 0,
      error: 'Erro ao verificar limite de usuários',
    };
  }
}

// ============================================================================
// USER CRUD
// ============================================================================

/**
 * Lista todos os usuários de um tenant
 */
export async function listTenantUsers(tenantId: string): Promise<User[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('tenant_id', '==', tenantId), orderBy('created_at', 'desc'));

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        ...data,
      } as User;
    });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    throw new Error('Falha ao listar usuários');
  }
}

/**
 * Busca um usuário por ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (!userDoc.exists()) {
      return null;
    }

    const data = userDoc.data();
    return {
      uid: userDoc.id,
      ...data,
    } as User;
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    throw new Error('Falha ao buscar usuário');
  }
}

/**
 * Busca usuários por role
 */
export async function getUsersByRole(tenantId: string, role: UserRole): Promise<User[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('tenant_id', '==', tenantId),
      where('role', '==', role),
      where('active', '==', true)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: doc.id,
        ...data,
      } as User;
    });
  } catch (error) {
    console.error('Erro ao buscar usuários por role:', error);
    throw new Error('Falha ao buscar usuários por role');
  }
}

/**
 * Atualiza informações de um usuário
 */
export async function updateUser(
  userId: string,
  updates: {
    displayName?: string;
    role?: 'clinic_admin' | 'clinic_user';
    active?: boolean;
  }
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);

    await updateDoc(userRef, {
      ...updates,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    throw new Error('Falha ao atualizar usuário');
  }
}

/**
 * Suspende um usuário (marca como inativo)
 */
export async function suspendUser(userId: string): Promise<void> {
  try {
    await updateUser(userId, { active: false });
  } catch (error) {
    console.error('Erro ao suspender usuário:', error);
    throw new Error('Falha ao suspender usuário');
  }
}

/**
 * Reativa um usuário suspenso
 */
export async function reactivateUser(userId: string): Promise<void> {
  try {
    await updateUser(userId, { active: true });
  } catch (error) {
    console.error('Erro ao reativar usuário:', error);
    throw new Error('Falha ao reativar usuário');
  }
}

/**
 * Deleta um usuário (soft delete - marca como inativo)
 */
export async function deleteUser(userId: string): Promise<void> {
  try {
    // Soft delete - apenas marca como inativo
    await suspendUser(userId);

    // Se quiser hard delete no futuro, descomentar:
    // await deleteDoc(doc(db, "users", userId));
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    throw new Error('Falha ao deletar usuário');
  }
}

/**
 * Verifica se um usuário é o único admin do tenant
 */
export async function isOnlyAdmin(tenantId: string, userId: string): Promise<boolean> {
  try {
    const admins = await getUsersByRole(tenantId, 'clinic_admin');
    return admins.length === 1 && admins[0].uid === userId;
  } catch (error) {
    console.error('Erro ao verificar se é único admin:', error);
    return false;
  }
}
