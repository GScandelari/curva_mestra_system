/**
 * Helpers de rota (server-only) compartilhados pelas rotas de solicitação de
 * acesso: aprovação pelo System Admin (UC-02), aprovação pelo consultor e
 * listagem do consultor (UC-56). Cada helper devolve o valor esperado ou a
 * `NextResponse` de erro pronta — o chamador só repassa a resposta.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { AccessRequest } from '@/types';
import {
  createTenantAndUserFromAccessRequest,
  EmailAlreadyInUseError,
  type AccessRequestApprover,
} from '@/lib/services/accessRequestApproval';

export async function verifyBearerToken(
  req: NextRequest,
  missingTokenMessage = 'Não autorizado'
): Promise<DecodedIdToken | NextResponse> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: missingTokenMessage }, { status: 401 });
  }
  try {
    return await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
}

export interface ActiveConsultant {
  decodedToken: DecodedIdToken;
  consultantId: string;
  consultantName?: string;
}

/**
 * Exige consultor ativo pelo claim E pelo documento `consultants/{id}`
 * (UC-56 RN-07 — o claim pode estar desatualizado após uma suspensão).
 */
export async function verifyActiveConsultant(
  req: NextRequest,
  deniedMessage: string,
  missingTokenMessage?: string
): Promise<ActiveConsultant | NextResponse> {
  const decodedToken = await verifyBearerToken(req, missingTokenMessage);
  if (decodedToken instanceof NextResponse) return decodedToken;

  const denied = NextResponse.json({ error: deniedMessage }, { status: 403 });
  const consultantId = decodedToken.consultant_id as string | undefined;
  if (!decodedToken.is_consultant || !consultantId || decodedToken.active !== true) {
    return denied;
  }

  const consultantDoc = await adminDb.collection('consultants').doc(consultantId).get();
  if (!consultantDoc.exists || consultantDoc.data()?.status !== 'active') {
    return denied;
  }

  return {
    decodedToken,
    consultantId,
    consultantName: consultantDoc.data()?.name as string | undefined,
  };
}

export async function loadPendingAccessRequest(
  requestId: string
): Promise<AccessRequest | NextResponse> {
  const requestDoc = await adminDb.collection('access_requests').doc(requestId).get();
  if (!requestDoc.exists) {
    return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
  }

  const request = requestDoc.data() as AccessRequest;
  if (request.status !== 'pendente') {
    return NextResponse.json({ error: 'Solicitação já foi processada' }, { status: 400 });
  }
  return request;
}

export async function approveAccessRequestResponse(
  request: AccessRequest,
  requestId: string,
  approver: AccessRequestApprover
): Promise<NextResponse> {
  try {
    const data = await createTenantAndUserFromAccessRequest(request, requestId, approver);
    return NextResponse.json({
      success: true,
      message:
        'Solicitação aprovada! Um e-mail com o link para definir a senha foi enviado ao usuário.',
      data,
    });
  } catch (approvalError) {
    if (approvalError instanceof EmailAlreadyInUseError) {
      return NextResponse.json({ error: approvalError.message }, { status: 400 });
    }
    throw approvalError;
  }
}

export function internalErrorResponse(
  logLabel: string,
  error: unknown,
  fallbackMessage: string
): NextResponse {
  console.error(logLabel, error);
  const message = error instanceof Error && error.message ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}
