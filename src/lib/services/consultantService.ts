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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Consultant, ConsultantStatus, Tenant } from '@/types';
import { cleanDocument } from '@/lib/utils/documentValidation';

const CONSULTANTS_COLLECTION = 'consultants';
const TENANTS_COLLECTION = 'tenants';

/**
 * Gera código único de 6 dígitos para o consultor
 */
export async function generateUniqueCode(): Promise<string> {
  let code: string;
  let attempts = 0;

  do {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    code = String(100000 + (buf[0] % 900000));

    const existing = await getDocs(
      query(collection(db, CONSULTANTS_COLLECTION), where('code', '==', code), limit(1))
    );

    if (existing.empty) {
      return code;
    }

    attempts++;
  } while (attempts < 10);

  throw new Error('Falha ao gerar código único após 10 tentativas');
}

/**
 * Cria um novo consultor
 */
export async function createConsultant(data: {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  created_by: string;
}): Promise<{ success: boolean; message: string; consultant?: Consultant }> {
  try {
    // Verificar se já existe consultor com este email
    const existingByEmail = await getDocs(
      query(
        collection(db, CONSULTANTS_COLLECTION),
        where('email', '==', data.email.toLowerCase()),
        limit(1)
      )
    );

    if (!existingByEmail.empty) {
      return { success: false, message: 'Já existe um consultor com este email' };
    }

    // Gerar código único
    const code = await generateUniqueCode();

    const consultantData: Omit<Consultant, 'id'> = {
      user_id: data.user_id,
      code,
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone,
      status: 'active',
      authorized_tenants: [],
      created_at: serverTimestamp() as Timestamp,
      updated_at: serverTimestamp() as Timestamp,
      created_by: data.created_by,
    };

    const docRef = await addDoc(collection(db, CONSULTANTS_COLLECTION), consultantData);

    const consultant: Consultant = {
      id: docRef.id,
      ...consultantData,
    };

    return {
      success: true,
      message: 'Consultor criado com sucesso',
      consultant,
    };
  } catch (error) {
    console.error('Erro ao criar consultor:', error);
    return {
      success: false,
      message: 'Erro ao criar consultor. Tente novamente.',
    };
  }
}

/**
 * Busca consultor por ID
 */
export async function getConsultant(consultantId: string): Promise<Consultant | null> {
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
    console.error('Erro ao buscar consultor:', error);
    return null;
  }
}

/**
 * Busca consultor por código de 6 dígitos
 */
export async function getConsultantByCode(code: string): Promise<Consultant | null> {
  try {
    const q = query(collection(db, CONSULTANTS_COLLECTION), where('code', '==', code), limit(1));
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
    console.error('Erro ao buscar consultor por código:', error);
    return null;
  }
}

/**
 * Busca consultor por user_id do Firebase Auth
 */
export async function getConsultantByUserId(userId: string): Promise<Consultant | null> {
  try {
    const q = query(
      collection(db, CONSULTANTS_COLLECTION),
      where('user_id', '==', userId),
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
    console.error('Erro ao buscar consultor por user_id:', error);
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
    let q = query(collection(db, CONSULTANTS_COLLECTION), orderBy('created_at', 'desc'));

    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
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
    console.error('Erro ao listar consultores:', error);
    return [];
  }
}

/**
 * Busca consultores por código, nome ou telefone (para transferência)
 */
export async function searchConsultants(searchTerm: string): Promise<Consultant[]> {
  try {
    // Buscar todos consultores ativos
    const q = query(collection(db, CONSULTANTS_COLLECTION), where('status', '==', 'active'));
    const snapshot = await getDocs(q);

    const searchLower = searchTerm.toLowerCase();
    const consultants = snapshot.docs.map((doc) => ({
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
    console.error('Erro ao buscar consultores:', error);
    return [];
  }
}

/**
 * Atualiza dados do consultor
 */
export async function updateConsultant(
  consultantId: string,
  data: Partial<Pick<Consultant, 'name' | 'phone' | 'email' | 'status'>>
): Promise<{ success: boolean; message: string }> {
  try {
    const docRef = doc(db, CONSULTANTS_COLLECTION, consultantId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, message: 'Consultor não encontrado' };
    }

    // Se mudando email, verificar duplicidade
    if (data.email) {
      const existingByEmail = await getDocs(
        query(
          collection(db, CONSULTANTS_COLLECTION),
          where('email', '==', data.email.toLowerCase()),
          limit(1)
        )
      );

      if (!existingByEmail.empty && existingByEmail.docs[0].id !== consultantId) {
        return { success: false, message: 'Email já está em uso' };
      }
    }

    await updateDoc(docRef, {
      ...data,
      email: data.email?.toLowerCase(),
      updated_at: serverTimestamp(),
    });

    return { success: true, message: 'Consultor atualizado com sucesso' };
  } catch (error) {
    console.error('Erro ao atualizar consultor:', error);
    return { success: false, message: 'Erro ao atualizar consultor' };
  }
}

/**
 * Suspende ou reativa um consultor
 */
export async function toggleConsultantStatus(
  consultantId: string,
  newStatus: 'active' | 'suspended'
): Promise<{ success: boolean; message: string }> {
  try {
    const docRef = doc(db, CONSULTANTS_COLLECTION, consultantId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, message: 'Consultor não encontrado' };
    }

    await updateDoc(docRef, {
      status: newStatus,
      updated_at: serverTimestamp(),
    });

    return {
      success: true,
      message:
        newStatus === 'suspended'
          ? 'Consultor suspenso com sucesso'
          : 'Consultor reativado com sucesso',
    };
  } catch (error) {
    console.error('Erro ao alterar status do consultor:', error);
    return { success: false, message: 'Erro ao alterar status do consultor' };
  }
}

// ============================================================================
// VÍNCULO DIRETO (TRANSFERÊNCIA)
// ============================================================================

/**
 * Busca clínicas por CNPJ/CPF para o consultor reivindicar
 */
export async function searchTenantsByDocument(document: string): Promise<Tenant[]> {
  try {
    const cleanDoc = cleanDocument(document);

    const q = query(
      collection(db, TENANTS_COLLECTION),
      where('document_number', '==', cleanDoc),
      where('active', '==', true)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Tenant[];
  } catch (error) {
    console.error('Erro ao buscar clínicas:', error);
    return [];
  }
}

/**
 * Obtém o consultor atual de uma clínica
 */
export async function getTenantConsultant(tenantId: string): Promise<Consultant | null> {
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
    console.error('Erro ao buscar consultor da clínica:', error);
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
      return { success: false, message: 'Clínica não encontrada' };
    }

    const tenantData = tenantDoc.data() as Tenant;
    const oldConsultantId = tenantData.consultant_id;

    const newConsultant = await getConsultant(newConsultantId);

    if (!newConsultant) {
      return { success: false, message: 'Novo consultor não encontrado' };
    }

    if (newConsultant.status !== 'active') {
      return { success: false, message: 'Novo consultor não está ativo' };
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
      message: 'Consultoria transferida com sucesso',
    };
  } catch (error) {
    console.error('Erro ao transferir consultoria:', error);
    return { success: false, message: 'Erro ao transferir consultoria' };
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
      return { success: false, message: 'Clínica não encontrada' };
    }

    const tenantData = tenantDoc.data() as Tenant;
    const consultantId = tenantData.consultant_id;

    if (!consultantId) {
      return { success: false, message: 'Clínica não possui consultor vinculado' };
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
      message: 'Consultor removido com sucesso',
    };
  } catch (error) {
    console.error('Erro ao remover consultor:', error);
    return { success: false, message: 'Erro ao remover consultor' };
  }
}

/**
 * Lista clínicas vinculadas a um consultor
 */
export async function getConsultantClinics(consultantId: string): Promise<Tenant[]> {
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
    console.error('Erro ao buscar clínicas do consultor:', error);
    return [];
  }
}
