/**
 * Serviço para gerenciar usuários de clínicas
 */

import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";

export interface ClinicUser {
  uid: string;
  email: string;
  displayName: string;
  role: "clinic_admin" | "clinic_user";
  active: boolean;
  created_at: any;
  updated_at: any;
}

export interface CreateClinicUserData {
  tenantId: string;
  email: string;
  password: string;
  displayName: string;
  role: "clinic_admin" | "clinic_user";
}

/**
 * Lista todos os usuários de uma clínica
 */
export async function listClinicUsers(tenantId: string) {
  try {
    // Usar coleção raiz users com filtro por tenant_id
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("tenant_id", "==", tenantId));
    const snapshot = await getDocs(q);

    const users: ClinicUser[] = snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    } as ClinicUser));

    // Separar admin e usuários regulares
    const admin = users.find((u) => u.role === "clinic_admin");
    const regularUsers = users.filter((u) => u.role === "clinic_user");

    return {
      users,
      admin,
      regularUsers,
      total: users.length,
    };
  } catch (error) {
    console.error("Erro ao listar usuários da clínica:", error);
    throw new Error("Erro ao carregar usuários da clínica");
  }
}

/**
 * Cria um novo usuário da clínica
 * NOTA: Em produção, isso deve ser feito via Cloud Function com Firebase Admin SDK
 * para configurar custom claims. Aqui estamos usando createUserWithEmailAndPassword
 * que funciona no emulador mas não configura os claims automaticamente.
 */
export async function createClinicUser(data: CreateClinicUserData) {
  try {
    const { tenantId, email, password, displayName, role } = data;

    // Validação básica
    if (!email || !password || !displayName || !tenantId) {
      throw new Error("Todos os campos são obrigatórios");
    }

    if (password.length < 6) {
      throw new Error("A senha deve ter no mínimo 6 caracteres");
    }

    // Criar usuário no Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const userId = userCredential.user.uid;

    // Adicionar usuário à coleção raiz users
    const userDocRef = doc(db, "users", userId);
    await setDoc(userDocRef, {
      uid: userId,
      tenant_id: tenantId,
      email,
      displayName,
      full_name: displayName,
      role,
      active: true,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    return {
      userId,
      message: "Usuário criado com sucesso",
    };
  } catch (error: any) {
    console.error("Erro ao criar usuário:", error);

    // Tratamento de erros específicos do Firebase
    if (error.code === "auth/email-already-in-use") {
      throw new Error("Este email já está em uso");
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Email inválido");
    } else if (error.code === "auth/weak-password") {
      throw new Error("Senha muito fraca");
    }

    throw new Error(error.message || "Erro ao criar usuário");
  }
}
