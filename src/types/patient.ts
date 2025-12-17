/**
 * Types para Pacientes
 */

import { Timestamp } from "firebase/firestore";

export interface Patient {
  id: string;
  tenant_id: string;
  codigo: string; // Código único do paciente (gerado automaticamente ou manual)
  nome: string;
  telefone?: string;
  email?: string;
  data_nascimento?: string; // formato: DD/MM/YYYY
  cpf?: string; // opcional
  observacoes?: string;
  created_by: string;
  created_by_name?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface PatientWithStats extends Patient {
  total_procedimentos: number;
  ultimo_procedimento?: Timestamp;
  total_gasto?: number;
}

export interface CreatePatientInput {
  codigo?: string; // Opcional - se não fornecido, será gerado automaticamente
  nome: string;
  telefone?: string;
  email?: string;
  data_nascimento?: string;
  cpf?: string;
  observacoes?: string;
}

export interface UpdatePatientInput {
  nome?: string;
  telefone?: string;
  email?: string;
  data_nascimento?: string;
  cpf?: string;
  observacoes?: string;
}

export interface PatientEditLog {
  id: string;
  patient_id: string;
  patient_codigo: string;
  changes: {
    field: string;
    old_value: any;
    new_value: any;
  }[];
  edited_by: string;
  edited_by_name: string;
  edited_at: Timestamp;
}
