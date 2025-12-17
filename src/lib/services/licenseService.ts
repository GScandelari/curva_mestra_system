/**
 * License Service
 * Gerenciamento completo de licenças multi-tenant
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
import { License, LicenseStatus } from "@/types";

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Criar nova licença para um tenant
 */
export async function createLicense(licenseData: {
  tenant_id: string;
  plan_id: string;
  max_users: number;
  features: string[];
  start_date: Date;
  end_date: Date;
  auto_renew?: boolean;
}): Promise<string> {
  try {
    const licenseRef = await addDoc(collection(db, "licenses"), {
      ...licenseData,
      status: "ativa" as LicenseStatus,
      start_date: Timestamp.fromDate(licenseData.start_date),
      end_date: Timestamp.fromDate(licenseData.end_date),
      auto_renew: licenseData.auto_renew ?? false,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });

    return licenseRef.id;
  } catch (error) {
    console.error("Erro ao criar licença:", error);
    throw new Error("Falha ao criar licença");
  }
}

/**
 * Atualizar licença existente
 */
export async function updateLicense(
  licenseId: string,
  updateData: {
    plan_id?: string;
    max_users?: number;
    features?: string[];
    start_date?: Date;
    end_date?: Date;
    auto_renew?: boolean;
    status?: LicenseStatus;
  }
): Promise<void> {
  try {
    const licenseRef = doc(db, "licenses", licenseId);
    
    const dataToUpdate: any = {
      ...updateData,
      updated_at: serverTimestamp(),
    };

    // Converter datas para Timestamp se fornecidas
    if (updateData.start_date) {
      dataToUpdate.start_date = Timestamp.fromDate(updateData.start_date);
    }
    if (updateData.end_date) {
      dataToUpdate.end_date = Timestamp.fromDate(updateData.end_date);
    }

    await updateDoc(licenseRef, dataToUpdate);
  } catch (error) {
    console.error("Erro ao atualizar licença:", error);
    throw new Error("Falha ao atualizar licença");
  }
}

/**
 * Buscar licença ativa de um tenant
 */
export async function getActiveLicenseByTenant(
  tenantId: string
): Promise<License | null> {
  try {
    const q = query(
      collection(db, "licenses"),
      where("tenant_id", "==", tenantId),
      where("status", "==", "ativa"),
      orderBy("end_date", "desc")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as License;
  } catch (error) {
    console.error("Erro ao buscar licença ativa:", error);
    throw new Error("Falha ao buscar licença ativa");
  }
}

/**
 * Buscar todas as licenças de um tenant
 */
export async function getLicensesByTenant(
  tenantId: string
): Promise<License[]> {
  try {
    const q = query(
      collection(db, "licenses"),
      where("tenant_id", "==", tenantId),
      orderBy("created_at", "desc")
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as License[];
  } catch (error) {
    console.error("Erro ao buscar licenças:", error);
    throw new Error("Falha ao buscar licenças");
  }
}

/**
 * Buscar licença por ID
 */
export async function getLicenseById(licenseId: string): Promise<License | null> {
  try {
    const licenseDoc = await getDoc(doc(db, "licenses", licenseId));

    if (!licenseDoc.exists()) {
      return null;
    }

    return {
      id: licenseDoc.id,
      ...licenseDoc.data(),
    } as License;
  } catch (error) {
    console.error("Erro ao buscar licença:", error);
    throw new Error("Falha ao buscar licença");
  }
}

/**
 * Atualizar status de uma licença
 */
export async function updateLicenseStatus(
  licenseId: string,
  status: LicenseStatus
): Promise<void> {
  try {
    await updateDoc(doc(db, "licenses", licenseId), {
      status,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Erro ao atualizar status da licença:", error);
    throw new Error("Falha ao atualizar status da licença");
  }
}

/**
 * Renovar licença (criar nova licença ou estender a atual)
 */
export async function renewLicense(
  licenseId: string,
  newEndDate: Date
): Promise<void> {
  try {
    await updateDoc(doc(db, "licenses", licenseId), {
      end_date: Timestamp.fromDate(newEndDate),
      status: "ativa" as LicenseStatus,
      updated_at: serverTimestamp(),
    });
  } catch (error) {
    console.error("Erro ao renovar licença:", error);
    throw new Error("Falha ao renovar licença");
  }
}

/**
 * Suspender licença
 */
export async function suspendLicense(licenseId: string): Promise<void> {
  try {
    await updateLicenseStatus(licenseId, "suspensa");
  } catch (error) {
    console.error("Erro ao suspender licença:", error);
    throw new Error("Falha ao suspender licença");
  }
}

/**
 * Reativar licença suspensa
 */
export async function reactivateLicense(licenseId: string): Promise<void> {
  try {
    await updateLicenseStatus(licenseId, "ativa");
  } catch (error) {
    console.error("Erro ao reativar licença:", error);
    throw new Error("Falha ao reativar licença");
  }
}

/**
 * Deletar licença
 */
export async function deleteLicense(licenseId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "licenses", licenseId));
  } catch (error) {
    console.error("Erro ao deletar licença:", error);
    throw new Error("Falha ao deletar licença");
  }
}

// ============================================================================
// VALIDATIONS
// ============================================================================

/**
 * Verificar se licença está ativa e válida
 */
export async function isLicenseValid(tenantId: string): Promise<boolean> {
  try {
    const license = await getActiveLicenseByTenant(tenantId);

    if (!license) {
      return false;
    }

    // Verificar se está expirada
    const now = new Date();
    const endDate = (license.end_date as Timestamp).toDate();

    if (endDate < now) {
      // Marcar como expirada automaticamente
      await updateLicenseStatus(license.id, "expirada");
      return false;
    }

    // Verificar se está suspensa
    if (license.status === "suspensa") {
      return false;
    }

    return license.status === "ativa";
  } catch (error) {
    console.error("Erro ao verificar validade da licença:", error);
    return false;
  }
}

/**
 * Calcular dias restantes até expiração
 */
export function getDaysUntilExpiration(license: License): number {
  const now = new Date();
  const endDate = (license.end_date as Timestamp).toDate();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Verificar se licença está próxima da expiração (15 dias)
 */
export function isLicenseExpiringSoon(license: License): boolean {
  const daysRemaining = getDaysUntilExpiration(license);
  return daysRemaining > 0 && daysRemaining <= 15;
}

/**
 * Buscar licenças que expiram em breve
 */
export async function getExpiringSoonLicenses(): Promise<License[]> {
  try {
    const q = query(
      collection(db, "licenses"),
      where("status", "==", "ativa"),
      orderBy("end_date", "asc")
    );

    const snapshot = await getDocs(q);

    const licenses = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as License[];

    // Filtrar apenas as que expiram em até 15 dias
    return licenses.filter((license) => isLicenseExpiringSoon(license));
  } catch (error) {
    console.error("Erro ao buscar licenças expirando:", error);
    throw new Error("Falha ao buscar licenças expirando");
  }
}

/**
 * Buscar licenças expiradas que precisam ser desativadas
 */
export async function getExpiredLicenses(): Promise<License[]> {
  try {
    const now = Timestamp.now();

    const q = query(
      collection(db, "licenses"),
      where("status", "==", "ativa"),
      where("end_date", "<", now)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as License[];
  } catch (error) {
    console.error("Erro ao buscar licenças expiradas:", error);
    throw new Error("Falha ao buscar licenças expiradas");
  }
}

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Buscar todas as licenças (system_admin only)
 */
export async function getAllLicenses(): Promise<License[]> {
  try {
    const q = query(collection(db, "licenses"), orderBy("created_at", "desc"));

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as License[];
  } catch (error) {
    console.error("Erro ao buscar todas as licenças:", error);
    throw new Error("Falha ao buscar todas as licenças");
  }
}

/**
 * Processar renovação automática de licenças
 * (Chamado por Cloud Function agendada)
 */
export async function processAutoRenewal(licenseId: string): Promise<void> {
  try {
    const license = await getLicenseById(licenseId);

    if (!license || !license.auto_renew) {
      return;
    }

    // Adicionar 1 ano à data de expiração
    const currentEndDate = (license.end_date as Timestamp).toDate();
    const newEndDate = new Date(currentEndDate);
    newEndDate.setFullYear(newEndDate.getFullYear() + 1);

    await renewLicense(licenseId, newEndDate);

    console.log(`Licença ${licenseId} renovada automaticamente até ${newEndDate}`);
  } catch (error) {
    console.error("Erro ao processar renovação automática:", error);
    throw new Error("Falha ao processar renovação automática");
  }
}
