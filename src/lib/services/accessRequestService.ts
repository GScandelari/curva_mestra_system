/**
 * Serviço de Solicitações de Acesso
 * Gerencia requisições de novos usuários para entrar em clínicas
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
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AccessRequest, AccessRequestStatus, TenantLimits, DocumentType } from "@/types";
import {
  validateDocument,
  cleanDocument,
  getDocumentType,
  getMaxUsersForDocumentType,
} from "@/lib/utils/documentValidation";

const ACCESS_REQUESTS_COLLECTION = "access_requests";

/**
 * Cria uma nova solicitação de acesso
 */
export async function createAccessRequest(data: {
  document: string; // CPF ou CNPJ
  document_type: DocumentType; // Tipo do documento
  full_name: string;
  email: string;
  password: string;
}): Promise<{ success: boolean; message: string; requestId?: string }> {
  try {
    // Limpar documento
    const documentClean = cleanDocument(data.document);

    // Validar documento
    if (!validateDocument(documentClean)) {
      return {
        success: false,
        message: data.document_type === "cpf" ? "CPF inválido" : "CNPJ inválido"
      };
    }

    // Verificar se já existe solicitação pendente para este email
    const existingRequestQuery = query(
      collection(db, ACCESS_REQUESTS_COLLECTION),
      where("email", "==", data.email.toLowerCase()),
      where("status", "in", ["pendente", "aprovada"])
    );
    const existingRequests = await getDocs(existingRequestQuery);

    if (!existingRequests.empty) {
      return {
        success: false,
        message: "Já existe uma solicitação pendente para este email",
      };
    }

    // Buscar tenant pelo documento
    const tenantsQuery = query(
      collection(db, "tenants"),
      where("document_number", "==", documentClean)
    );
    const tenantsSnapshot = await getDocs(tenantsQuery);

    let tenant_id: string | undefined;
    let tenant_name: string | undefined;
    let has_available_slots = false;

    if (!tenantsSnapshot.empty) {
      const tenantDoc = tenantsSnapshot.docs[0];
      tenant_id = tenantDoc.id;
      tenant_name = tenantDoc.data().name;

      // Verificar limites de usuários
      const limits = await getTenantLimits(tenant_id);
      has_available_slots = limits.available_slots > 0;
    }

    // Criar solicitação
    const accessRequest: Omit<AccessRequest, "id"> = {
      type: data.document_type === "cnpj" ? "clinica" : "autonomo",
      document_type: data.document_type,
      document_number: documentClean,
      full_name: data.full_name,
      email: data.email.toLowerCase(),
      phone: "",
      password: "", // Senha será definida pelo usuário após aprovação
      business_name: data.full_name,
      status: "pendente",
      created_at: serverTimestamp() as Timestamp,
      updated_at: serverTimestamp() as Timestamp,
    };

    const docRef = await addDoc(
      collection(db, ACCESS_REQUESTS_COLLECTION),
      accessRequest
    );

    // Mensagens diferentes para CPF e CNPJ
    let statusMessage: string;

    if (data.document_type === "cpf") {
      if (tenant_id) {
        statusMessage = "Solicitação enviada! Este CPF já possui cadastro. Aguarde avaliação do administrador.";
      } else {
        statusMessage = "Solicitação enviada! Será criada uma conta individual (1 usuário). Aguarde aprovação do administrador do sistema.";
      }
    } else {
      // CNPJ
      if (tenant_id) {
        if (has_available_slots) {
          statusMessage = "Solicitação enviada! Aguarde aprovação do administrador da clínica.";
        } else {
          statusMessage = "Solicitação enviada! A clínica atingiu o limite de 5 usuários. Aguarde avaliação do administrador.";
        }
      } else {
        statusMessage = "Solicitação enviada! Este CNPJ não está cadastrado. Aguarde avaliação do administrador do sistema.";
      }
    }

    return {
      success: true,
      message: statusMessage,
      requestId: docRef.id,
    };
  } catch (error) {
    console.error("Erro ao criar solicitação de acesso:", error);
    return {
      success: false,
      message: "Erro ao criar solicitação. Tente novamente.",
    };
  }
}

/**
 * Lista solicitações de acesso
 */
export async function listAccessRequests(filters?: {
  status?: AccessRequestStatus;
  tenant_id?: string;
}): Promise<AccessRequest[]> {
  try {
    let q = query(
      collection(db, ACCESS_REQUESTS_COLLECTION),
      orderBy("created_at", "desc")
    );

    if (filters?.status) {
      q = query(q, where("status", "==", filters.status));
    }

    if (filters?.tenant_id) {
      q = query(q, where("tenant_id", "==", filters.tenant_id));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AccessRequest[];
  } catch (error) {
    console.error("Erro ao listar solicitações:", error);
    return [];
  }
}

/**
 * Obtém uma solicitação específica
 */
export async function getAccessRequest(
  requestId: string
): Promise<AccessRequest | null> {
  try {
    const docRef = doc(db, ACCESS_REQUESTS_COLLECTION, requestId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as AccessRequest;
  } catch (error) {
    console.error("Erro ao obter solicitação:", error);
    return null;
  }
}

/**
 * DEPRECATED: Usar API route /api/access-requests/[id]/approve
 * Aprova uma solicitação e gera código de ativação
 */
export async function approveAccessRequest(
  requestId: string,
  approvedBy: { uid: string; name: string }
): Promise<{ success: boolean; message: string; activationCode?: string }> {
  return {
    success: false,
    message: "Esta função foi depreciada. Use a API route /api/access-requests/[id]/approve",
  };
}

/**
 * Rejeita uma solicitação
 */
export async function rejectAccessRequest(
  requestId: string,
  rejectedBy: { uid: string; name: string },
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const request = await getAccessRequest(requestId);

    if (!request) {
      return { success: false, message: "Solicitação não encontrada" };
    }

    if (request.status !== "pendente") {
      return { success: false, message: "Solicitação já foi processada" };
    }

    const docRef = doc(db, ACCESS_REQUESTS_COLLECTION, requestId);
    await updateDoc(docRef, {
      status: "rejeitada",
      rejected_by: rejectedBy.uid,
      rejected_by_name: rejectedBy.name,
      rejection_reason: reason || "Não especificado",
      rejected_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    // TODO: Enviar email de rejeição via Cloud Function

    return {
      success: true,
      message: "Solicitação rejeitada com sucesso.",
    };
  } catch (error) {
    console.error("Erro ao rejeitar solicitação:", error);
    return {
      success: false,
      message: "Erro ao rejeitar solicitação. Tente novamente.",
    };
  }
}

/**
 * DEPRECATED: Fluxo antigo de ativação com código
 * Ativa uma conta com código
 */
export async function activateAccountWithCode(
  email: string,
  activationCode: string
): Promise<{
  success: boolean;
  message: string;
  requestData?: {
    email: string;
    password: string;
    full_name: string;
    tenant_id?: string;
  };
}> {
  return {
    success: false,
    message: "Esta função foi depreciada. Use o novo fluxo de aprovação automática.",
  };
}

/**
 * Obtém limites de usuários de um tenant
 */
export async function getTenantLimits(
  tenantId: string
): Promise<TenantLimits> {
  try {
    // Buscar tenant
    const tenantDoc = await getDoc(doc(db, "tenants", tenantId));
    if (!tenantDoc.exists()) {
      return { tenant_id: tenantId, max_users: 0, current_users: 0, available_slots: 0 };
    }

    const tenantData = tenantDoc.data();
    const max_users = tenantData.max_users || 0;

    // Contar usuários ativos
    const usersQuery = query(
      collection(db, `tenants/${tenantId}/users`),
      where("active", "==", true)
    );
    const usersSnapshot = await getDocs(usersQuery);
    const current_users = usersSnapshot.size;

    return {
      tenant_id: tenantId,
      max_users,
      current_users,
      available_slots: Math.max(0, max_users - current_users),
    };
  } catch (error) {
    console.error("Erro ao obter limites do tenant:", error);
    return { tenant_id: tenantId, max_users: 0, current_users: 0, available_slots: 0 };
  }
}

/**
 * Conta solicitações pendentes para um tenant
 */
export async function countPendingRequests(tenantId: string): Promise<number> {
  try {
    const requestsQuery = query(
      collection(db, ACCESS_REQUESTS_COLLECTION),
      where("tenant_id", "==", tenantId),
      where("status", "==", "pendente")
    );
    const snapshot = await getDocs(requestsQuery);
    return snapshot.size;
  } catch (error) {
    console.error("Erro ao contar solicitações pendentes:", error);
    return 0;
  }
}
