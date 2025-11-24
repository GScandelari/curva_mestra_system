/**
 * Serviço para gerenciar Tenants diretamente via Firestore
 * Usado quando as Cloud Functions não estão disponíveis (desenvolvimento/emulador)
 */

import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Tenant,
  CreateTenantData,
  UpdateTenantData,
} from "@/types/tenant";

interface ListTenantsParams {
  limit?: number;
  activeOnly?: boolean;
}

// Converter Timestamp do Firestore para Date
function convertTimestamps(data: any): any {
  const converted = { ...data };
  Object.keys(converted).forEach((key) => {
    if (converted[key] instanceof Timestamp) {
      converted[key] = converted[key].toDate();
    }
  });
  return converted;
}

// Listar todos os tenants
export async function listTenants(params: ListTenantsParams = {}) {
  try {
    const { limit = 50, activeOnly = false } = params;

    let q = query(
      collection(db, "tenants"),
      orderBy("created_at", "desc"),
      firestoreLimit(limit)
    );

    if (activeOnly) {
      q = query(
        collection(db, "tenants"),
        where("active", "==", true),
        orderBy("created_at", "desc"),
        firestoreLimit(limit)
      );
    }

    const snapshot = await getDocs(q);

    const tenants: Tenant[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...convertTimestamps(data),
      } as Tenant;
    });

    return { tenants, count: tenants.length };
  } catch (error) {
    console.error("Erro ao listar tenants:", error);
    throw new Error("Erro ao carregar clínicas do Firestore");
  }
}

// Obter detalhes de um tenant
export async function getTenant(tenantId: string) {
  try {
    const docRef = doc(db, "tenants", tenantId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("Clínica não encontrada");
    }

    const tenant: Tenant = {
      id: docSnap.id,
      ...convertTimestamps(docSnap.data()),
    } as Tenant;

    return { tenant };
  } catch (error) {
    console.error("Erro ao obter tenant:", error);
    throw error;
  }
}

// Criar novo tenant
export async function createTenant(data: CreateTenantData) {
  try {
    const { name, cnpj, email, plan_id = "semestral", phone, address, active = true } = data;

    const tenantData = {
      name,
      cnpj,
      email,
      plan_id,
      phone: phone || "",
      address: address || "",
      active,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "tenants"), tenantData);

    return {
      tenantId: docRef.id,
      message: "Tenant criado com sucesso",
    };
  } catch (error) {
    console.error("Erro ao criar tenant:", error);
    throw new Error("Erro ao criar clínica no Firestore");
  }
}

// Atualizar tenant existente
export async function updateTenant(tenantId: string, data: UpdateTenantData) {
  try {
    if (!tenantId) {
      throw new Error("tenantId é obrigatório");
    }

    const docRef = doc(db, "tenants", tenantId);

    const firestoreData: any = {
      updated_at: serverTimestamp(),
    };

    if (data.name !== undefined) firestoreData.name = data.name;
    if (data.cnpj !== undefined) firestoreData.cnpj = data.cnpj;
    if (data.email !== undefined) firestoreData.email = data.email;
    if (data.phone !== undefined) firestoreData.phone = data.phone;
    if (data.address !== undefined) firestoreData.address = data.address;
    if (data.plan_id !== undefined) firestoreData.plan_id = data.plan_id;
    if (data.active !== undefined) firestoreData.active = data.active;

    await updateDoc(docRef, firestoreData);

    return {
      tenantId,
      message: "Tenant atualizado com sucesso",
    };
  } catch (error) {
    console.error("Erro ao atualizar tenant:", error);
    throw new Error("Erro ao atualizar clínica no Firestore");
  }
}

// Desativar tenant (soft delete)
export async function deactivateTenant(tenantId: string) {
  try {
    if (!tenantId) {
      throw new Error("tenantId é obrigatório");
    }

    const docRef = doc(db, "tenants", tenantId);

    await updateDoc(docRef, {
      active: false,
      updated_at: serverTimestamp(),
    });

    // Nota: Em produção, você também deveria desativar os usuários do tenant
    // Mas isso requer acesso admin, que só está disponível via Cloud Functions

    return {
      tenantId,
      message: "Tenant desativado com sucesso",
    };
  } catch (error) {
    console.error("Erro ao desativar tenant:", error);
    throw new Error("Erro ao desativar clínica no Firestore");
  }
}

// Reativar tenant
export async function reactivateTenant(tenantId: string) {
  try {
    if (!tenantId) {
      throw new Error("tenantId é obrigatório");
    }

    const docRef = doc(db, "tenants", tenantId);

    await updateDoc(docRef, {
      active: true,
      updated_at: serverTimestamp(),
    });

    return {
      tenantId,
      message: "Tenant reativado com sucesso",
    };
  } catch (error) {
    console.error("Erro ao reativar tenant:", error);
    throw new Error("Erro ao reativar clínica no Firestore");
  }
}
