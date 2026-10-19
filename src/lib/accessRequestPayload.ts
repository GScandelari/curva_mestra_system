/**
 * Validação pura do corpo de POST /api/access-requests (UC-01) —
 * FEAT-ajustes-registro-e-busca-consultor. Usada pela API e por /register
 * (mesmas mensagens). Monta o registro só a partir do valor normalizado: campos
 * que não estão na lista (volume, consultant_reference e, para o consultor,
 * business_name, documento e código) são ignorados sem erro.
 */

import {
  validateConsultantCode,
  validateDocument,
  validateEmail,
  validateFullName,
  validatePhone,
} from '@/lib/validations/serverValidations';
import type { AccessRequestRole, DocumentType } from '@/types';

export const DOCUMENT_REQUIRED_ERROR = 'CPF ou CNPJ é obrigatório';
export const DOCUMENT_TYPE_ERROR = "Tipo de documento deve ser 'cpf' ou 'cnpj'";
export const COUNCIL_REQUIRED_ERROR = 'Número do conselho é obrigatório';
export const RENNOVA_ID_REQUIRED_ERROR = 'ID Rennova é obrigatório';
export const BUSINESS_NAME_REQUIRED_ERROR = 'Nome da clínica é obrigatório';

export interface NormalizedAccessRequestInput {
  role: AccessRequestRole;
  full_name: string;
  email: string; // trim + minúsculas
  phone: string;
  council_number: string;
  // só especialista
  business_name?: string;
  document_type?: DocumentType;
  document_number?: string; // só dígitos
  consultant_code?: string; // formato já validado; existência é checada na rota
}

export type AccessRequestInputResult =
  | { ok: true; value: NormalizedAccessRequestInput }
  | { ok: false; error: string };

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function validarEspecialista(
  b: Record<string, unknown>
): { ok: true; extra: Partial<NormalizedAccessRequestInput> } | { ok: false; error: string } {
  const businessName = texto(b.business_name);
  if (!businessName) return { ok: false, error: BUSINESS_NAME_REQUIRED_ERROR };

  const documentNumber = texto(b.document_number).replace(/\D/g, '');
  if (!documentNumber) return { ok: false, error: DOCUMENT_REQUIRED_ERROR };
  const documentType = b.document_type;
  if (documentType !== 'cpf' && documentType !== 'cnpj') {
    return { ok: false, error: DOCUMENT_TYPE_ERROR };
  }
  const documento = validateDocument(documentNumber, documentType);
  if (!documento.valid) return { ok: false, error: documento.error ?? DOCUMENT_REQUIRED_ERROR };

  const consultantCode = texto(b.consultant_code);
  if (consultantCode) {
    const codigo = validateConsultantCode(consultantCode);
    if (!codigo.valid) return { ok: false, error: codigo.error! };
  }

  return {
    ok: true,
    extra: {
      business_name: businessName,
      document_type: documentType,
      document_number: documentNumber,
      ...(consultantCode ? { consultant_code: consultantCode } : {}),
    },
  };
}

export function validateAccessRequestInput(data: unknown): AccessRequestInputResult {
  const b = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;

  if (!b.role) return { ok: false, error: 'Perfil (especialista / consultor) é obrigatório' };
  if (b.role !== 'especialista' && b.role !== 'consultor') {
    return { ok: false, error: "Perfil deve ser 'especialista' ou 'consultor'" };
  }
  const role = b.role;

  const fullName = texto(b.full_name);
  if (!fullName) return { ok: false, error: 'Nome completo é obrigatório' };
  const nome = validateFullName(fullName);
  if (!nome.valid) return { ok: false, error: nome.error! };

  const email = texto(b.email);
  const emailCheck = validateEmail(email);
  if (!emailCheck.valid) return { ok: false, error: emailCheck.error! };

  const phone = texto(b.phone);
  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.valid) return { ok: false, error: phoneCheck.error! };

  const councilNumber = texto(b.council_number);
  if (!councilNumber) {
    return {
      ok: false,
      error: role === 'especialista' ? COUNCIL_REQUIRED_ERROR : RENNOVA_ID_REQUIRED_ERROR,
    };
  }

  const base: NormalizedAccessRequestInput = {
    role,
    full_name: fullName,
    email: email.toLowerCase(),
    phone,
    council_number: councilNumber,
  };
  if (role === 'consultor') return { ok: true, value: base };

  const especialista = validarEspecialista(b);
  if (!especialista.ok) return especialista;
  return { ok: true, value: { ...base, ...especialista.extra } };
}

/**
 * Nome do tenant / da clínica a partir de uma solicitação: business_name
 * (especialista ou consultor antigo, com região) ou, sem ele, o nome completo
 * do solicitante (consultor a partir desta feature).
 */
export function getAccessRequestBusinessName(request: {
  business_name?: string | null;
  full_name: string;
}): string {
  return request.business_name?.trim() || request.full_name;
}
