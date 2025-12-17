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
  PatientEditLog,
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
 * Busca pacientes por termo (autocomplete)
 * Busca por código, nome, CPF e telefone
 */
export async function searchPatients(
  tenantId: string,
  searchTerm: string,
  limit: number = 10,
  searchFilter: "all" | "codigo" | "nome" | "telefone" = "all"
): Promise<Patient[]> {
  try {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    // Buscar todos os pacientes (limite maior para filtrar depois)
    const q = query(
      collection(db, "tenants", tenantId, "patients"),
      orderBy("created_at", "desc"),
      firestoreLimit(100)
    );

    const snapshot = await getDocs(q);

    const patients = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Patient[];

    // Filtrar por termo de busca (includes = contém o texto em qualquer parte)
    const term = searchTerm.toLowerCase();

    // Remover formatação do termo se for numérico (para busca em telefone/CPF)
    const termNumerico = term.replace(/\D/g, '');

    const filtered = patients.filter(
      (p) => {
        // Busca em nome e código (case insensitive)
        const matchNome = p.nome.toLowerCase().includes(term);
        const matchCodigo = p.codigo.toLowerCase().includes(term);

        // Busca em CPF e telefone (apenas dígitos)
        const matchCPF = p.cpf && p.cpf.replace(/\D/g, '').includes(termNumerico);
        const matchTelefone = p.telefone && p.telefone.replace(/\D/g, '').includes(termNumerico);

        // Aplicar filtro específico
        if (searchFilter === "codigo") return matchCodigo;
        if (searchFilter === "nome") return matchNome;
        if (searchFilter === "telefone") return matchTelefone;

        // "all" - buscar em todos os campos
        return matchNome || matchCodigo || matchCPF || matchTelefone;
      }
    );

    // Retornar apenas o limite solicitado
    return filtered.slice(0, limit);
  } catch (error) {
    console.error("Erro ao buscar pacientes:", error);
    throw new Error("Falha ao buscar pacientes");
  }
}

/**
 * Lista pacientes com estatísticas (total de procedimentos, etc.)
 */
export async function listPatientsWithStats(
  tenantId: string,
  options?: {
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
 * Atualiza dados de um paciente e cria log de edição
 */
export async function updatePatient(
  tenantId: string,
  patientId: string,
  updates: UpdatePatientInput,
  userId?: string,
  userName?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const patientRef = doc(db, "tenants", tenantId, "patients", patientId);

    // Buscar dados atuais do paciente para comparar
    const currentPatient = await getPatientById(tenantId, patientId);
    if (!currentPatient) {
      return {
        success: false,
        error: "Paciente não encontrado",
      };
    }

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

    // Rastrear mudanças para o log
    const changes: Array<{ field: string; old_value: any; new_value: any }> = [];

    if (updates.nome !== undefined && updates.nome.trim() !== currentPatient.nome) {
      updateData.nome = updates.nome.trim();
      changes.push({ field: "nome", old_value: currentPatient.nome, new_value: updates.nome.trim() });
    }
    if (updates.telefone !== undefined && (updates.telefone?.trim() || null) !== (currentPatient.telefone || null)) {
      updateData.telefone = updates.telefone?.trim() || null;
      changes.push({ field: "telefone", old_value: currentPatient.telefone, new_value: updates.telefone?.trim() || null });
    }
    if (updates.email !== undefined && (updates.email?.trim().toLowerCase() || null) !== (currentPatient.email || null)) {
      updateData.email = updates.email?.trim().toLowerCase() || null;
      changes.push({ field: "email", old_value: currentPatient.email, new_value: updates.email?.trim().toLowerCase() || null });
    }
    if (updates.data_nascimento !== undefined && (updates.data_nascimento?.trim() || null) !== (currentPatient.data_nascimento || null)) {
      updateData.data_nascimento = updates.data_nascimento?.trim() || null;
      changes.push({ field: "data_nascimento", old_value: currentPatient.data_nascimento, new_value: updates.data_nascimento?.trim() || null });
    }
    if (cpf !== undefined && (cpf || null) !== (currentPatient.cpf || null)) {
      updateData.cpf = cpf || null;
      changes.push({ field: "cpf", old_value: currentPatient.cpf, new_value: cpf || null });
    }
    if (updates.observacoes !== undefined && (updates.observacoes?.trim() || null) !== (currentPatient.observacoes || null)) {
      updateData.observacoes = updates.observacoes?.trim() || null;
      changes.push({ field: "observacoes", old_value: currentPatient.observacoes, new_value: updates.observacoes?.trim() || null });
    }

    // Atualizar paciente
    await updateDoc(patientRef, updateData);

    // Criar log de edição se houver mudanças e userId fornecido
    if (changes.length > 0 && userId && userName) {
      await addDoc(
        collection(db, "tenants", tenantId, "patient_edit_logs"),
        {
          patient_id: patientId,
          patient_codigo: currentPatient.codigo,
          changes,
          edited_by: userId,
          edited_by_name: userName,
          edited_at: serverTimestamp(),
        }
      );
    }

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
  novos_mes: number; // Cadastrados no mês atual
  novos_3_meses: number; // Cadastrados nos últimos 3 meses
}> {
  try {
    const patients = await listPatients(tenantId);

    const now = new Date();
    const mesAtual = now.getMonth();
    const anoAtual = now.getFullYear();

    // Data de 3 meses atrás
    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);

    // Contar novos no mês atual
    const novos_mes = patients.filter((p) => {
      const createdAt = (p.created_at as Timestamp).toDate();
      return (
        createdAt.getMonth() === mesAtual &&
        createdAt.getFullYear() === anoAtual
      );
    }).length;

    // Contar novos nos últimos 3 meses
    const novos_3_meses = patients.filter((p) => {
      const createdAt = (p.created_at as Timestamp).toDate();
      return createdAt >= tresMesesAtras;
    }).length;

    return {
      total: patients.length,
      novos_mes,
      novos_3_meses,
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

/**
 * Busca logs de edição de um paciente
 */
export async function getPatientEditLogs(
  tenantId: string,
  patientId: string
): Promise<PatientEditLog[]> {
  try {
    const logsRef = collection(db, "tenants", tenantId, "patient_edit_logs");
    const q = query(
      logsRef,
      where("patient_id", "==", patientId),
      orderBy("edited_at", "desc")
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PatientEditLog[];
  } catch (error) {
    console.error("Erro ao buscar logs de edição:", error);
    throw new Error("Falha ao buscar logs de edição");
  }
}
