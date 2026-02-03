/**
 * Serviço de Consultores
 * Gerencia consultores externos e seus vínculos com clínicas
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Consultant,
  ConsultantStatus,
  ConsultantClaim,
  ConsultantClaimStatus,
  Tenant,
} from "@/types";
import { cleanDocument, validateCPF } from "@/lib/utils/documentValidation";

const CONSULTANTS_COLLECTION = "consultants";
const CONSULTANT_CLAIMS_COLLECTION = "consultant_claims";
const TENANTS_COLLECTION = "tenants";

/**
 * Gera código único de 6 dígitos para o consultor
 */
export async function generateUniqueCode(): Promise<string> {
  let code: string;
  let attempts = 0;

  do {
    // Gera número entre 100000 e 999999
    code = String(Math.floor(100000 + Math.random() * 900000));

    const existing = await getDocs(
      query(
        collection(db, CONSULTANTS_COLLECTION),
        where("code", "==", code),
        limit(1)
      )
    );

    if (existing.empty) {
      return code;
    }

    attempts++;
  } while (attempts < 10);

  throw new Error("Falha ao gerar código único após 10 tentativas");
}

/**
 * Cria um novo consultor
 */
export async function createConsultant(data: {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  created_by: string;
}): Promise<{ success: boolean; message: string; consultant?: Consultant }> {
  try {
    // Limpar e validar CPF
    const cpfClean = cleanDocument(data.cpf);
    if (!validateCPF(cpfClean)) {
      return { success: false, message: "CPF inválido" };
    }

    // Verificar se já existe consultor com este CPF
    const existingByCpf = await getDocs(
      query(
        collection(db, CONSULTANTS_COLLECTION),
        where("cpf", "==", cpfClean),
        limit(1)
      )
    );

    if (!existingByCpf.empty) {
      return { success: false, message: "Já existe um consultor com este CPF" };
    }

    // Verificar se já existe consultor com este email
    const existingByEmail = await getDocs(
      query(
        collection(db, CONSULTANTS_COLLECTION),
        where("email", "==", data.email.toLowerCase()),
        limit(1)
      )
    );

    if (!existingByEmail.empty) {
      return { success: false, message: "Já existe um consultor com este email" };
    }

    // Gerar código único
    const code = await generateUniqueCode();

    const consultantData: Omit<Consultant, "id"> = {
      user_id: data.user_id,
      code,
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone,
      cpf: cpfClean,
      status: "active",
      authorized_tenants: [],
      created_at: serverTimestamp() as Timestamp,
      updated_at: serverTimestamp() as Timestamp,
      created_by: data.created_by,
    };

    const docRef = await addDoc(
      collection(db, CONSULTANTS_COLLECTION),
      consultantData
    );

    const consultant: Consultant = {
      id: docRef.id,
      ...consultantData,
    };

    return {
      success: true,
      message: "Consultor criado com sucesso",
      consultant,
    };
  } catch (error) {
    console.error("Erro ao criar consultor:", error);
    return {
      success: false,
      message: "Erro ao criar consultor. Tente novamente.",
    };
  }
}

/**
 * Busca consultor por ID
 */
export async function getConsultant(
  consultantId: string
): Promise<Consultant | null> {
  try {
    const docRef = doc(db, CONSULTANTS_COLLECTION, consultantId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as Consultant;
  } catch (error) {
    console.error("Erro ao buscar consultor:", error);
    return null;
  }
}

/**
 * Busca consultor por código de 6 dígitos
 */
export async function getConsultantByCode(
  code: string
): Promise<Consultant | null> {
  try {
    const q = query(
      collection(db, CONSULTANTS_COLLECTION),
      where("code", "==", code),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as Consultant;
  } catch (error) {
    console.error("Erro ao buscar consultor por código:", error);
    return null;
  }
}

/**
 * Busca consultor por user_id do Firebase Auth
 */
export async function getConsultantByUserId(
  userId: string
): Promise<Consultant | null> {
  try {
    const q = query(
      collection(db, CONSULTANTS_COLLECTION),
      where("user_id", "==", userId),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as Consultant;
  } catch (error) {
    console.error("Erro ao buscar consultor por user_id:", error);
    return null;
  }
}

/**
 * Lista todos os consultores
 */
export async function listConsultants(filters?: {
  status?: ConsultantStatus;
  search?: string;
}): Promise<Consultant[]> {
  try {
    let q = query(
      collection(db, CONSULTANTS_COLLECTION),
      orderBy("created_at", "desc")
    );

    if (filters?.status) {
      q = query(q, where("status", "==", filters.status));
    }

    const snapshot = await getDocs(q);
    let consultants = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Consultant[];

    // Filtro de busca em memória (nome, email, código, telefone)
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      consultants = consultants.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.email.toLowerCase().includes(searchLower) ||
          c.code.includes(filters.search!) ||
          c.phone.includes(filters.search!)
      );
    }

    return consultants;
  } catch (error) {
    console.error("Erro ao listar consultores:", error);
    return [];
  }
}

/**
 * Busca consultores por código, nome ou telefone (para transferência)
 */
export async function searchConsultants(searchTerm: string): Promise<Consultant[]> {
  try {
    // Buscar todos consultores ativos
    const q = query(
      collection(db, CONSULTANTS_COLLECTION),
      where("status", "==", "active")
    );
    const snapshot = await getDocs(q);

    const searchLower = searchTerm.toLowerCase();
    const consultants = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Consultant[];

    // Filtrar em memória
    return consultants.filter(
      (c) =>
        c.code.includes(searchTerm) ||
        c.name.toLowerCase().includes(searchLower) ||
        c.phone.includes(searchTerm) ||
        c.email.toLowerCase().includes(searchLower)
    );
  } catch (error) {
    console.error("Erro ao buscar consultores:", error);
    return [];
  }
}

/**
 * Atualiza dados do consultor
 */
export async function updateConsultant(
  consultantId: string,
  data: Partial<Pick<Consultant, "name" | "phone" | "email" | "status">>
): Promise<{ success: boolean; message: string }> {
  try {
    const docRef = doc(db, CONSULTANTS_COLLECTION, consultantId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, message: "Consultor não encontrado" };
    }

    // Se mudando email, verificar duplicidade
    if (data.email) {
      const existingByEmail = await getDocs(
        query(
          collection(db, CONSULTANTS_COLLECTION),
          where("email", "==", data.email.toLowerCase()),
          limit(1)
        )
      );

      if (!existingByEmail.empty && existingByEmail.docs[0].id !== consultantId) {
        return { success: false, message: "Email já está em uso" };
      }
    }

    await updateDoc(docRef, {
      ...data,
      email: data.email?.toLowerCase(),
      updated_at: serverTimestamp(),
    });

    return { success: true, message: "Consultor atualizado com sucesso" };
  } catch (error) {
    console.error("Erro ao atualizar consultor:", error);
    return { success: false, message: "Erro ao atualizar consultor" };
  }
}

/**
 * Suspende ou reativa um consultor
 */
export async function toggleConsultantStatus(
  consultantId: string,
  newStatus: "active" | "suspended"
): Promise<{ success: boolean; message: string }> {
  try {
    const docRef = doc(db, CONSULTANTS_COLLECTION, consultantId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, message: "Consultor não encontrado" };
    }

    await updateDoc(docRef, {
      status: newStatus,
      updated_at: serverTimestamp(),
    });

    return {
      success: true,
      message: newStatus === "suspended"
        ? "Consultor suspenso com sucesso"
        : "Consultor reativado com sucesso",
    };
  } catch (error) {
    console.error("Erro ao alterar status do consultor:", error);
    return { success: false, message: "Erro ao alterar status do consultor" };
  }
}

// ============================================================================
// REIVINDICAÇÕES (CLAIMS)
// ============================================================================

/**
 * Cria uma reivindicação de vínculo com uma clínica
 */
export async function createConsultantClaim(data: {
  consultant_id: string;
  consultant_name: string;
  consultant_code: string;
  tenant_id: string;
  tenant_name: string;
  tenant_document: string;
}): Promise<{ success: boolean; message: string; claimId?: string }> {
  try {
    // Verificar se já existe reivindicação pendente
    const existingClaim = await getDocs(
      query(
        collection(db, CONSULTANT_CLAIMS_COLLECTION),
        where("consultant_id", "==", data.consultant_id),
        where("tenant_id", "==", data.tenant_id),
        where("status", "==", "pending"),
        limit(1)
      )
    );

    if (!existingClaim.empty) {
      return {
        success: false,
        message: "Já existe uma solicitação pendente para esta clínica",
      };
    }

    // Verificar se a clínica já tem consultor
    const tenantDoc = await getDoc(doc(db, TENANTS_COLLECTION, data.tenant_id));
    if (tenantDoc.exists() && tenantDoc.data().consultant_id) {
      return {
        success: false,
        message: "Esta clínica já possui um consultor vinculado",
      };
    }

    const claimData: Omit<ConsultantClaim, "id"> = {
      consultant_id: data.consultant_id,
      consultant_name: data.consultant_name,
      consultant_code: data.consultant_code,
      tenant_id: data.tenant_id,
      tenant_name: data.tenant_name,
      tenant_document: data.tenant_document,
      status: "pending",
      created_at: serverTimestamp() as Timestamp,
      updated_at: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(
      collection(db, CONSULTANT_CLAIMS_COLLECTION),
      claimData
    );

    return {
      success: true,
      message: "Solicitação de vínculo enviada com sucesso",
      claimId: docRef.id,
    };
  } catch (error) {
    console.error("Erro ao criar reivindicação:", error);
    return { success: false, message: "Erro ao criar solicitação de vínculo" };
  }
}

/**
 * Lista reivindicações
 */
export async function listConsultantClaims(filters?: {
  consultant_id?: string;
  tenant_id?: string;
  status?: ConsultantClaimStatus;
}): Promise<ConsultantClaim[]> {
  try {
    let q = query(
      collection(db, CONSULTANT_CLAIMS_COLLECTION),
      orderBy("created_at", "desc")
    );

    if (filters?.consultant_id) {
      q = query(q, where("consultant_id", "==", filters.consultant_id));
    }

    if (filters?.tenant_id) {
      q = query(q, where("tenant_id", "==", filters.tenant_id));
    }

    if (filters?.status) {
      q = query(q, where("status", "==", filters.status));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ConsultantClaim[];
  } catch (error) {
    console.error("Erro ao listar reivindicações:", error);
    return [];
  }
}

/**
 * Busca uma reivindicação específica
 */
export async function getConsultantClaim(
  claimId: string
): Promise<ConsultantClaim | null> {
  try {
    const docRef = doc(db, CONSULTANT_CLAIMS_COLLECTION, claimId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as ConsultantClaim;
  } catch (error) {
    console.error("Erro ao buscar reivindicação:", error);
    return null;
  }
}

/**
 * Aprova uma reivindicação de vínculo
 */
export async function approveConsultantClaim(
  claimId: string,
  approvedBy: { uid: string; name: string }
): Promise<{ success: boolean; message: string }> {
  try {
    const claim = await getConsultantClaim(claimId);

    if (!claim) {
      return { success: false, message: "Solicitação não encontrada" };
    }

    if (claim.status !== "pending") {
      return { success: false, message: "Solicitação já foi processada" };
    }

    // Usar transação para garantir consistência
    await runTransaction(db, async (transaction) => {
      const claimRef = doc(db, CONSULTANT_CLAIMS_COLLECTION, claimId);
      const consultantRef = doc(db, CONSULTANTS_COLLECTION, claim.consultant_id);
      const tenantRef = doc(db, TENANTS_COLLECTION, claim.tenant_id);

      const consultantDoc = await transaction.get(consultantRef);
      const tenantDoc = await transaction.get(tenantRef);

      if (!consultantDoc.exists()) {
        throw new Error("Consultor não encontrado");
      }

      if (!tenantDoc.exists()) {
        throw new Error("Clínica não encontrada");
      }

      const consultantData = consultantDoc.data() as Consultant;
      const authorizedTenants = consultantData.authorized_tenants || [];

      // Atualizar reivindicação
      transaction.update(claimRef, {
        status: "approved",
        approved_by: approvedBy.uid,
        approved_by_name: approvedBy.name,
        approved_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // Adicionar tenant à lista do consultor
      transaction.update(consultantRef, {
        authorized_tenants: [...authorizedTenants, claim.tenant_id],
        updated_at: serverTimestamp(),
      });

      // Atualizar tenant com dados do consultor
      transaction.update(tenantRef, {
        consultant_id: claim.consultant_id,
        consultant_code: claim.consultant_code,
        consultant_name: claim.consultant_name,
        updated_at: serverTimestamp(),
      });
    });

    return {
      success: true,
      message: "Vínculo aprovado com sucesso",
    };
  } catch (error) {
    console.error("Erro ao aprovar reivindicação:", error);
    return { success: false, message: "Erro ao aprovar vínculo" };
  }
}

/**
 * Rejeita uma reivindicação de vínculo
 */
export async function rejectConsultantClaim(
  claimId: string,
  rejectedBy: { uid: string; name: string },
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const claim = await getConsultantClaim(claimId);

    if (!claim) {
      return { success: false, message: "Solicitação não encontrada" };
    }

    if (claim.status !== "pending") {
      return { success: false, message: "Solicitação já foi processada" };
    }

    const claimRef = doc(db, CONSULTANT_CLAIMS_COLLECTION, claimId);
    await updateDoc(claimRef, {
      status: "rejected",
      rejected_by: rejectedBy.uid,
      rejected_by_name: rejectedBy.name,
      rejected_at: serverTimestamp(),
      rejection_reason: reason || "Não especificado",
      updated_at: serverTimestamp(),
    });

    return {
      success: true,
      message: "Solicitação rejeitada",
    };
  } catch (error) {
    console.error("Erro ao rejeitar reivindicação:", error);
    return { success: false, message: "Erro ao rejeitar solicitação" };
  }
}

// ============================================================================
// VÍNCULO DIRETO (TRANSFERÊNCIA)
// ============================================================================

/**
 * Busca clínicas por CNPJ/CPF para o consultor reivindicar
 */
export async function searchTenantsByDocument(
  document: string
): Promise<Tenant[]> {
  try {
    const cleanDoc = cleanDocument(document);

    const q = query(
      collection(db, TENANTS_COLLECTION),
      where("document_number", "==", cleanDoc),
      where("active", "==", true)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Tenant[];
  } catch (error) {
    console.error("Erro ao buscar clínicas:", error);
    return [];
  }
}

/**
 * Obtém o consultor atual de uma clínica
 */
export async function getTenantConsultant(
  tenantId: string
): Promise<Consultant | null> {
  try {
    const tenantDoc = await getDoc(doc(db, TENANTS_COLLECTION, tenantId));

    if (!tenantDoc.exists()) {
      return null;
    }

    const tenantData = tenantDoc.data() as Tenant;

    if (!tenantData.consultant_id) {
      return null;
    }

    return getConsultant(tenantData.consultant_id);
  } catch (error) {
    console.error("Erro ao buscar consultor da clínica:", error);
    return null;
  }
}

/**
 * Transfere a consultoria de uma clínica para outro consultor
 */
export async function transferConsultant(
  tenantId: string,
  newConsultantId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const tenantDoc = await getDoc(doc(db, TENANTS_COLLECTION, tenantId));

    if (!tenantDoc.exists()) {
      return { success: false, message: "Clínica não encontrada" };
    }

    const tenantData = tenantDoc.data() as Tenant;
    const oldConsultantId = tenantData.consultant_id;

    const newConsultant = await getConsultant(newConsultantId);

    if (!newConsultant) {
      return { success: false, message: "Novo consultor não encontrado" };
    }

    if (newConsultant.status !== "active") {
      return { success: false, message: "Novo consultor não está ativo" };
    }

    // Usar transação para garantir consistência
    await runTransaction(db, async (transaction) => {
      const tenantRef = doc(db, TENANTS_COLLECTION, tenantId);
      const newConsultantRef = doc(db, CONSULTANTS_COLLECTION, newConsultantId);

      // Remover tenant do consultor antigo (se existir)
      if (oldConsultantId) {
        const oldConsultantRef = doc(db, CONSULTANTS_COLLECTION, oldConsultantId);
        const oldConsultantDoc = await transaction.get(oldConsultantRef);

        if (oldConsultantDoc.exists()) {
          const oldConsultantData = oldConsultantDoc.data() as Consultant;
          const updatedTenants = (oldConsultantData.authorized_tenants || []).filter(
            (t) => t !== tenantId
          );

          transaction.update(oldConsultantRef, {
            authorized_tenants: updatedTenants,
            updated_at: serverTimestamp(),
          });
        }
      }

      // Adicionar tenant ao novo consultor
      const newConsultantDoc = await transaction.get(newConsultantRef);
      const newConsultantData = newConsultantDoc.data() as Consultant;
      const authorizedTenants = newConsultantData.authorized_tenants || [];

      if (!authorizedTenants.includes(tenantId)) {
        transaction.update(newConsultantRef, {
          authorized_tenants: [...authorizedTenants, tenantId],
          updated_at: serverTimestamp(),
        });
      }

      // Atualizar tenant com novo consultor
      transaction.update(tenantRef, {
        consultant_id: newConsultantId,
        consultant_code: newConsultant.code,
        consultant_name: newConsultant.name,
        updated_at: serverTimestamp(),
      });
    });

    return {
      success: true,
      message: "Consultoria transferida com sucesso",
    };
  } catch (error) {
    console.error("Erro ao transferir consultoria:", error);
    return { success: false, message: "Erro ao transferir consultoria" };
  }
}

/**
 * Remove o consultor de uma clínica
 */
export async function removeConsultant(
  tenantId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const tenantDoc = await getDoc(doc(db, TENANTS_COLLECTION, tenantId));

    if (!tenantDoc.exists()) {
      return { success: false, message: "Clínica não encontrada" };
    }

    const tenantData = tenantDoc.data() as Tenant;
    const consultantId = tenantData.consultant_id;

    if (!consultantId) {
      return { success: false, message: "Clínica não possui consultor vinculado" };
    }

    // Usar transação para garantir consistência
    await runTransaction(db, async (transaction) => {
      const tenantRef = doc(db, TENANTS_COLLECTION, tenantId);
      const consultantRef = doc(db, CONSULTANTS_COLLECTION, consultantId);

      // Remover tenant da lista do consultor
      const consultantDoc = await transaction.get(consultantRef);

      if (consultantDoc.exists()) {
        const consultantData = consultantDoc.data() as Consultant;
        const updatedTenants = (consultantData.authorized_tenants || []).filter(
          (t) => t !== tenantId
        );

        transaction.update(consultantRef, {
          authorized_tenants: updatedTenants,
          updated_at: serverTimestamp(),
        });
      }

      // Remover dados do consultor do tenant
      transaction.update(tenantRef, {
        consultant_id: null,
        consultant_code: null,
        consultant_name: null,
        updated_at: serverTimestamp(),
      });
    });

    return {
      success: true,
      message: "Consultor removido com sucesso",
    };
  } catch (error) {
    console.error("Erro ao remover consultor:", error);
    return { success: false, message: "Erro ao remover consultor" };
  }
}

/**
 * Lista clínicas vinculadas a um consultor
 */
export async function getConsultantClinics(
  consultantId: string
): Promise<Tenant[]> {
  try {
    const consultant = await getConsultant(consultantId);

    if (!consultant) {
      return [];
    }

    const authorizedTenants = consultant.authorized_tenants || [];

    if (authorizedTenants.length === 0) {
      return [];
    }

    // Buscar cada tenant
    const tenants: Tenant[] = [];
    for (const tenantId of authorizedTenants) {
      const tenantDoc = await getDoc(doc(db, TENANTS_COLLECTION, tenantId));
      if (tenantDoc.exists()) {
        tenants.push({
          id: tenantDoc.id,
          ...tenantDoc.data(),
        } as Tenant);
      }
    }

    return tenants;
  } catch (error) {
    console.error("Erro ao buscar clínicas do consultor:", error);
    return [];
  }
}
