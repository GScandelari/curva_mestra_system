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
import { initializeTenantOnboarding } from "./tenantOnboardingService";

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
    const { name, document_type, document_number, cnpj, max_users, email, plan_id = "semestral", phone, address, city, state, cep, active = false } = data;

    const tenantData = {
      name,
      document_type,
      document_number,
      cnpj: cnpj || document_number, // Manter compatibilidade
      max_users,
      email,
      plan_id,
      phone: phone || "",
      address: address || "",
      city: city || "",          // Cidade separada
      state: state || "",        // Estado separado
      cep: cep || "",            // CEP separado
      active, // Tenant inicia INATIVO até completar onboarding
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "tenants"), tenantData);

    // Inicializa registro de onboarding
    try {
      await initializeTenantOnboarding(docRef.id);
    } catch (onboardingError) {
      console.error("Erro ao inicializar onboarding:", onboardingError);
      // Não falhar a criação do tenant por erro no onboarding
    }

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
    if (data.document_type !== undefined) firestoreData.document_type = data.document_type;
    if (data.document_number !== undefined) firestoreData.document_number = data.document_number;
    if (data.cnpj !== undefined) firestoreData.cnpj = data.cnpj;
    if (data.max_users !== undefined) firestoreData.max_users = data.max_users;
    if (data.email !== undefined) firestoreData.email = data.email;
    if (data.phone !== undefined) firestoreData.phone = data.phone;
    if (data.address !== undefined) firestoreData.address = data.address;
    if (data.city !== undefined) firestoreData.city = data.city;
    if (data.state !== undefined) firestoreData.state = data.state;
    if (data.cep !== undefined) firestoreData.cep = data.cep;
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
