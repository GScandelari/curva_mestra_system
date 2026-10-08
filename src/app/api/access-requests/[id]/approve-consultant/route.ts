export const dynamic = 'force-dynamic';

/**
 * API Route: Consultor aprova solicitação de acesso (UC-56)
 *
 * Rota separada da aprovação pelo System Admin (`.../approve`, UC-02) para não
 * tocar na autorização daquela rota (UC-02 RN-06). Ambas executam a mesma
 * cadeia de criação (accessRequestApproval.ts, UC-56 RN-09).
 *
 * Autorização:
 * - Consultor ATIVO pelo claim e pelo documento `consultants/{id}` (RN-07).
 * - Elegibilidade (RN-01 a RN-05): `canConsultantApprove` — só bloqueia
 *   solicitação vinculada a OUTRO consultor com menos de 48h de `created_at`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { canConsultantApprove } from '@/lib/consultantAccessApproval';
import {
  approveAccessRequestResponse,
  internalErrorResponse,
  loadPendingAccessRequest,
  verifyActiveConsultant,
} from '@/lib/services/accessRequestRouteHelpers';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const consultant = await verifyActiveConsultant(
      req,
      'Apenas consultores ativos podem aprovar solicitações'
    );
    if (consultant instanceof NextResponse) return consultant;

    const { id: requestId } = await context.params;
    const request = await loadPendingAccessRequest(requestId);
    if (request instanceof NextResponse) return request;

    const eligible = canConsultantApprove({
      requestConsultantId: request.consultant_id,
      actingConsultantId: consultant.consultantId,
      createdAt: request.created_at,
    });
    if (!eligible) {
      return NextResponse.json(
        { error: 'Esta solicitação está em período de exclusividade de outro consultor' },
        { status: 403 }
      );
    }

    const { decodedToken } = consultant;
    return await approveAccessRequestResponse(request, requestId, {
      uid: decodedToken.uid,
      name:
        consultant.consultantName || decodedToken.name || decodedToken.email || 'Consultor Rennova',
    });
  } catch (error: unknown) {
    return internalErrorResponse(
      '❌ Erro ao aprovar solicitação (consultor):',
      error,
      'Erro ao processar aprovação'
    );
  }
}
