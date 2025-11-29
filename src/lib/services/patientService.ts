/**
 * Patient Service
 * Gerenciamento completo de pacientes
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
  limit as firestoreLimit,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Patient,
  PatientWithStats,
  CreatePatientInput,
  UpdatePatientInput,
} from "@/types/patient";

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Gera um código único de paciente
 * Formato: PAC + timestamp (últimos 8 dígitos)
 */
function generatePatientCode(): string {
  const timestamp = Date.now().toString();
  const code = "PAC" + timestamp.slice(-8);
  return code;
}

/**
 * Valida e formata CPF (remove pontos e traços)
 */
function formatCPF(cpf: string): string {
  return cpf.replace(/[^\d]/g, "");
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Cria um novo paciente
 */
export async function createPatient(
  tenantId: string,
  userId: string,
  userName: string,
  input: CreatePatientInput
): Promise<{
  success: boolean;
  patientId?: string;
  error?: string;
}> {
  try {
    // 1. Gerar código se não fornecido
    const codigo = input.codigo?.trim() || generatePatientCode();

    // 2. Verificar se código já existe
    const existingPatient = await getPatientByCode(tenantId, codigo);
    if (existingPatient) {
      return {
        success: false,
        error: `Já existe um paciente com o código ${codigo}`,
      };
    }

    // 3. Validar CPF se fornecido
    let cpf = input.cpf?.trim();
    if (cpf) {
      cpf = formatCPF(cpf);
      if (cpf.length !== 11) {
        return {
          success: false,
          error: "CPF inválido (deve ter 11 dígitos)",
        };
      }
    }

    // 4. Criar documento
    const patientRef = await addDoc(
      collection(db, "tenants", tenantId, "patients"),
      {
        tenant_id: tenantId,
        codigo,
        nome: input.nome.trim(),
        telefone: input.telefone?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        data_nascimento: input.data_nascimento?.trim() || null,
        cpf: cpf || null,
        observacoes: input.observacoes?.trim() || null,
        active: true,
        created_by: userId,
        created_by_name: userName,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }
    );

    return {
      success: true,
      patientId: patientRef.id,
    };
  } catch (error: any) {
    console.error("Erro ao criar paciente:", error);
    return {
      success: false,
      error: error.message || "Erro ao criar paciente",
    };
  }
}

/**
 * Busca paciente por ID
 */
export async function getPatientById(
  tenantId: string,
  patientId: string
): Promise<Patient | null> {
  try {
    const patientDoc = await getDoc(
      doc(db, "tenants", tenantId, "patients", patientId)
    );

    if (!patientDoc.exists()) {
      return null;
    }

    return {
      id: patientDoc.id,
      ...patientDoc.data(),
    } as Patient;
  } catch (error) {
    console.error("Erro ao buscar paciente:", error);
    throw new Error("Falha ao buscar paciente");
  }
}

/**
 * Busca paciente por código
 */
export async function getPatientByCode(
  tenantId: string,
  codigo: string
): Promise<Patient | null> {
  try {
    const q = query(
      collection(db, "tenants", tenantId, "patients"),
      where("codigo", "==", codigo),
      firestoreLimit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as Patient;
  } catch (error) {
    console.error("Erro ao buscar paciente por código:", error);
    throw new Error("Falha ao buscar paciente");
  }
}

/**
 * Lista todos os pacientes do tenant
 */
export async function listPatients(
  tenantId: string,
  options?: {
    active?: boolean;
    limit?: number;
    searchTerm?: string;
  }
): Promise<Patient[]> {
  try {
    // Query simples apenas com orderBy
    let q = query(
      collection(db, "tenants", tenantId, "patients"),
      orderBy("created_at", "desc")
    );

    if (options?.limit) {
      q = query(q, firestoreLimit(options.limit));
    }

    const snapshot = await getDocs(q);

    let patients = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Patient[];

    // Filtro por active (aplicado em memória)
    if (options?.active !== undefined) {
      patients = patients.filter((p) => p.active === options.active);
    }

    // Filtro por busca (nome, código, CPF)
    if (options?.searchTerm) {
      const term = options.searchTerm.toLowerCase();
      patients = patients.filter(
        (p) =>
          p.nome.toLowerCase().includes(term) ||
          p.codigo.toLowerCase().includes(term) ||
          (p.cpf && p.cpf.includes(term)) ||
          (p.telefone && p.telefone.includes(term))
      );
    }

    return patients;
  } catch (error) {
    console.error("Erro ao listar pacientes:", error);
    throw new Error("Falha ao listar pacientes");
  }
}

/**
 * Lista pacientes com estatísticas (total de procedimentos, etc.)
 */
export async function listPatientsWithStats(
  tenantId: string,
  options?: {
    active?: boolean;
    limit?: number;
  }
): Promise<PatientWithStats[]> {
  try {
    const patients = await listPatients(tenantId, options);
    const patientsWithStats: PatientWithStats[] = [];

    // Buscar solicitações para cada paciente
    for (const patient of patients) {
      const solicitacoesRef = collection(db, "tenants", tenantId, "solicitacoes");
      const q = query(
        solicitacoesRef,
        where("paciente_codigo", "==", patient.codigo),
        orderBy("dt_procedimento", "desc")
      );

      const solicitacoesSnapshot = await getDocs(q);

      let totalGasto = 0;
      let ultimoProcedimento: Timestamp | undefined;

      solicitacoesSnapshot.forEach((doc) => {
        const data = doc.data();

        // Calcular valor total
        if (data.produtos_solicitados && Array.isArray(data.produtos_solicitados)) {
          data.produtos_solicitados.forEach((produto: any) => {
            totalGasto += (produto.quantidade || 0) * (produto.valor_unitario || 0);
          });
        }

        // Pegar última data de procedimento
        if (data.dt_procedimento && !ultimoProcedimento) {
          ultimoProcedimento = data.dt_procedimento;
        }
      });

      patientsWithStats.push({
        ...patient,
        total_procedimentos: solicitacoesSnapshot.size,
        ultimo_procedimento: ultimoProcedimento,
        total_gasto: totalGasto,
      });
    }

    return patientsWithStats;
  } catch (error) {
    console.error("Erro ao listar pacientes com stats:", error);
    throw new Error("Falha ao listar pacientes com estatísticas");
  }
}

/**
 * Atualiza dados de um paciente
 */
export async function updatePatient(
  tenantId: string,
  patientId: string,
  updates: UpdatePatientInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const patientRef = doc(db, "tenants", tenantId, "patients", patientId);

    // Validar CPF se estiver sendo atualizado
    let cpf = updates.cpf?.trim();
    if (cpf) {
      cpf = formatCPF(cpf);
      if (cpf.length !== 11) {
        return {
          success: false,
          error: "CPF inválido (deve ter 11 dígitos)",
        };
      }
    }

    const updateData: any = {
      updated_at: serverTimestamp(),
    };

    if (updates.nome !== undefined) updateData.nome = updates.nome.trim();
    if (updates.telefone !== undefined) updateData.telefone = updates.telefone?.trim() || null;
    if (updates.email !== undefined) updateData.email = updates.email?.trim().toLowerCase() || null;
    if (updates.data_nascimento !== undefined) updateData.data_nascimento = updates.data_nascimento?.trim() || null;
    if (cpf !== undefined) updateData.cpf = cpf || null;
    if (updates.observacoes !== undefined) updateData.observacoes = updates.observacoes?.trim() || null;
    if (updates.active !== undefined) updateData.active = updates.active;

    await updateDoc(patientRef, updateData);

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao atualizar paciente:", error);
    return {
      success: false,
      error: error.message || "Erro ao atualizar paciente",
    };
  }
}

/**
 * Desativa um paciente (soft delete)
 */
export async function deactivatePatient(
  tenantId: string,
  patientId: string
): Promise<void> {
  try {
    await updatePatient(tenantId, patientId, { active: false });
  } catch (error) {
    console.error("Erro ao desativar paciente:", error);
    throw new Error("Falha ao desativar paciente");
  }
}

/**
 * Reativa um paciente
 */
export async function reactivatePatient(
  tenantId: string,
  patientId: string
): Promise<void> {
  try {
    await updatePatient(tenantId, patientId, { active: true });
  } catch (error) {
    console.error("Erro ao reativar paciente:", error);
    throw new Error("Falha ao reativar paciente");
  }
}

/**
 * Deleta um paciente permanentemente
 * ATENÇÃO: Apenas use se não houver solicitações vinculadas
 */
export async function deletePatient(
  tenantId: string,
  patientId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Verificar se há solicitações vinculadas
    const patient = await getPatientById(tenantId, patientId);
    if (!patient) {
      return {
        success: false,
        error: "Paciente não encontrado",
      };
    }

    const solicitacoesRef = collection(db, "tenants", tenantId, "solicitacoes");
    const q = query(
      solicitacoesRef,
      where("paciente_codigo", "==", patient.codigo),
      firestoreLimit(1)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return {
        success: false,
        error: "Não é possível deletar: paciente possui procedimentos registrados",
      };
    }

    // Se não houver solicitações, pode deletar
    await deleteDoc(doc(db, "tenants", tenantId, "patients", patientId));

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao deletar paciente:", error);
    return {
      success: false,
      error: error.message || "Erro ao deletar paciente",
    };
  }
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Obtém estatísticas de pacientes do tenant
 */
export async function getPatientsStats(tenantId: string): Promise<{
  total: number;
  ativos: number;
  inativos: number;
  novos_mes: number; // Cadastrados no mês atual
}> {
  try {
    const patients = await listPatients(tenantId);

    const ativos = patients.filter((p) => p.active).length;
    const inativos = patients.filter((p) => !p.active).length;

    // Contar novos no mês
    const now = new Date();
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();

    const novos_mes = patients.filter((p) => {
      const createdAt = (p.created_at as Timestamp).toDate();
      return (
        createdAt.getMonth() === mesAtual &&
        createdAt.getFullYear() === anoAtual
      );
    }).length;

    return {
      total: patients.length,
      ativos,
      inativos,
      novos_mes,
    };
  } catch (error) {
    console.error("Erro ao obter estatísticas de pacientes:", error);
    throw new Error("Falha ao obter estatísticas");
  }
}

/**
 * Busca histórico de procedimentos de um paciente
 */
export async function getPatientHistory(
  tenantId: string,
  patientCode: string
): Promise<any[]> {
  try {
    const solicitacoesRef = collection(db, "tenants", tenantId, "solicitacoes");
    const q = query(
      solicitacoesRef,
      where("paciente_codigo", "==", patientCode),
      orderBy("dt_procedimento", "desc")
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Erro ao buscar histórico do paciente:", error);
    throw new Error("Falha ao buscar histórico");
  }
}
