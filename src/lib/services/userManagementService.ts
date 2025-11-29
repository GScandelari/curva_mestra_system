/**
 * User Management Service
 * Gerenciamento de usuários multi-tenant com controle de limites
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User, UserRole } from "@/types";
import { getActiveLicenseByTenant } from "./licenseService";

// ============================================================================
// TYPES
// ============================================================================

export interface InviteUserInput {
  email: string;
  full_name: string;
  role: "clinic_admin" | "clinic_user";
}

export interface UserWithStatus extends User {
  last_login?: Timestamp;
  invited_at?: Timestamp;
  invitation_status?: "pending" | "accepted";
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
    // 1. Buscar licença ativa do tenant
    const license = await getActiveLicenseByTenant(tenantId);

    if (!license) {
      return {
        canAdd: false,
        currentCount: 0,
        maxUsers: 0,
        error: "Tenant não possui licença ativa",
      };
    }

    // 2. Contar usuários ativos do tenant
    const usersRef = collection(db, "users");
    const q = query(
      usersRef,
      where("tenant_id", "==", tenantId),
      where("active", "==", true)
    );
    const snapshot = await getDocs(q);
    const currentCount = snapshot.size;

    // 3. Verificar limite
    const maxUsers = license.max_users;
    const canAdd = currentCount < maxUsers;

    return {
      canAdd,
      currentCount,
      maxUsers,
      error: canAdd ? undefined : `Limite de ${maxUsers} usuários atingido`,
    };
  } catch (error) {
    console.error("Erro ao verificar limite de usuários:", error);
    return {
      canAdd: false,
      currentCount: 0,
      maxUsers: 0,
      error: "Erro ao verificar limite de usuários",
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
    const usersRef = collection(db, "users");
    const q = query(
      usersRef,
      where("tenant_id", "==", tenantId),
      orderBy("created_at", "desc")
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
    console.error("Erro ao listar usuários:", error);
    throw new Error("Falha ao listar usuários");
  }
}

/**
 * Busca um usuário por ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));

    if (!userDoc.exists()) {
      return null;
    }

    const data = userDoc.data();
    return {
      uid: userDoc.id,
      ...data,
    } as User;
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
    throw new Error("Falha ao buscar usuário");
  }
}

/**
 * Busca usuários por role
 */
export async function getUsersByRole(
  tenantId: string,
  role: UserRole
): Promise<User[]> {
  try {
    const usersRef = collection(db, "users");
    const q = query(
      usersRef,
      where("tenant_id", "==", tenantId),
      where("role", "==", role),
      where("active", "==", true)
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
    console.error("Erro ao buscar usuários por role:", error);
    throw new Error("Falha ao buscar usuários por role");
  }
}

/**
 * Atualiza informações de um usuário
 */
export async function updateUser(
  userId: string,
  updates: {
    displayName?: string;
    role?: "clinic_admin" | "clinic_user";
    active?: boolean;
  }
): Promise<void> {
  try {
    const userRef = doc(db, "users", userId);

    await updateDoc(userRef, {
      ...updates,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    throw new Error("Falha ao atualizar usuário");
  }
}

/**
 * Suspende um usuário (marca como inativo)
 */
export async function suspendUser(userId: string): Promise<void> {
  try {
    await updateUser(userId, { active: false });
  } catch (error) {
    console.error("Erro ao suspender usuário:", error);
    throw new Error("Falha ao suspender usuário");
  }
}

/**
 * Reativa um usuário suspenso
 */
export async function reactivateUser(userId: string): Promise<void> {
  try {
    await updateUser(userId, { active: true });
  } catch (error) {
    console.error("Erro ao reativar usuário:", error);
    throw new Error("Falha ao reativar usuário");
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
    console.error("Erro ao deletar usuário:", error);
    throw new Error("Falha ao deletar usuário");
  }
}

// ============================================================================
// CONVITES (PENDING INVITATIONS)
// ============================================================================

/**
 * Cria um convite para novo usuário
 * Retorna um código de ativação que deve ser enviado por email
 */
export async function createUserInvitation(
  tenantId: string,
  invitedBy: string,
  input: InviteUserInput
): Promise<{
  success: boolean;
  invitationId?: string;
  activationCode?: string;
  error?: string;
}> {
  try {
    // 1. Verificar limite de usuários
    const limitCheck = await canAddUser(tenantId);
    if (!limitCheck.canAdd) {
      return {
        success: false,
        error: limitCheck.error || "Limite de usuários atingido",
      };
    }

    // 2. Verificar se email já está cadastrado
    const usersRef = collection(db, "users");
    const emailQuery = query(usersRef, where("email", "==", input.email));
    const emailSnapshot = await getDocs(emailQuery);

    if (!emailSnapshot.empty) {
      return {
        success: false,
        error: "Este email já está cadastrado no sistema",
      };
    }

    // 3. Gerar código de ativação (8 dígitos)
    const activationCode = Math.floor(10000000 + Math.random() * 90000000).toString();

    // 4. Criar convite na coleção de access_requests
    const invitationRef = await addDoc(collection(db, "access_requests"), {
      tenant_id: tenantId,
      full_name: input.full_name,
      email: input.email,
      role: input.role,
      status: "aprovada", // Já aprovada pois é convite interno
      activation_code: activationCode,
      activation_code_expires_at: Timestamp.fromDate(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
      ),
      invited_by: invitedBy,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    return {
      success: true,
      invitationId: invitationRef.id,
      activationCode,
    };
  } catch (error: any) {
    console.error("Erro ao criar convite:", error);
    return {
      success: false,
      error: error.message || "Erro ao criar convite",
    };
  }
}

/**
 * Lista convites pendentes de um tenant
 */
export async function listPendingInvitations(tenantId: string): Promise<any[]> {
  try {
    const invitationsRef = collection(db, "access_requests");
    const q = query(
      invitationsRef,
      where("tenant_id", "==", tenantId),
      where("status", "==", "aprovada"),
      orderBy("created_at", "desc")
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Erro ao listar convites:", error);
    throw new Error("Falha ao listar convites");
  }
}

/**
 * Cancela um convite pendente
 */
export async function cancelInvitation(invitationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, "access_requests", invitationId), {
      status: "rejeitada",
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Erro ao cancelar convite:", error);
    throw new Error("Falha ao cancelar convite");
  }
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Obtém estatísticas de usuários do tenant
 */
export async function getUsersStats(tenantId: string): Promise<{
  total: number;
  active: number;
  inactive: number;
  admins: number;
  users: number;
  pendingInvitations: number;
  availableSlots: number;
  maxUsers: number;
}> {
  try {
    const users = await listTenantUsers(tenantId);
    const limitCheck = await canAddUser(tenantId);
    const invitations = await listPendingInvitations(tenantId);

    const active = users.filter((u) => u.active).length;
    const inactive = users.filter((u) => !u.active).length;
    const admins = users.filter(
      (u) => u.role === "clinic_admin" && u.active
    ).length;
    const regularUsers = users.filter(
      (u) => u.role === "clinic_user" && u.active
    ).length;

    return {
      total: users.length,
      active,
      inactive,
      admins,
      users: regularUsers,
      pendingInvitations: invitations.length,
      availableSlots: limitCheck.maxUsers - limitCheck.currentCount,
      maxUsers: limitCheck.maxUsers,
    };
  } catch (error) {
    console.error("Erro ao obter estatísticas de usuários:", error);
    throw new Error("Falha ao obter estatísticas");
  }
}

/**
 * Verifica se um usuário é o único admin do tenant
 */
export async function isOnlyAdmin(
  tenantId: string,
  userId: string
): Promise<boolean> {
  try {
    const admins = await getUsersByRole(tenantId, "clinic_admin");
    return admins.length === 1 && admins[0].uid === userId;
  } catch (error) {
    console.error("Erro ao verificar se é único admin:", error);
    return false;
  }
}
