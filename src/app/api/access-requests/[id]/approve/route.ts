export const dynamic = 'force-dynamic';

/**
 * API Route: Aprovar Solicitação de Acesso (System Admin — UC-02)
 * Cria automaticamente tenant + usuário admin em um clique e envia ao
 * usuário o link para definir a própria senha.
 *
 * Sem nenhuma checagem de vínculo a consultor nem de janela de exclusividade
 * (UC-02 RN-06, confirmado pelo PO): o System Admin aprova qualquer
 * solicitação pendente, a qualquer momento. A cadeia de criação é
 * compartilhada com a rota do consultor (UC-56) — ver accessRequestApproval.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  approveAccessRequestResponse,
  internalErrorResponse,
  loadPendingAccessRequest,
  verifyBearerToken,
} from '@/lib/services/accessRequestRouteHelpers';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const decodedToken = await verifyBearerToken(req);
    if (decodedToken instanceof NextResponse) return decodedToken;

    if (!decodedToken.is_system_admin) {
      return NextResponse.json(
        { error: 'Apenas administradores do sistema podem aprovar solicitações' },
        { status: 403 }
      );
    }

    const { id: requestId } = await context.params;
    const request = await loadPendingAccessRequest(requestId);
    if (request instanceof NextResponse) return request;

    return await approveAccessRequestResponse(request, requestId, {
      uid: decodedToken.uid,
      name: decodedToken.name || decodedToken.email || 'System Admin',
    });
  } catch (error: unknown) {
    return internalErrorResponse(
      '❌ Erro ao aprovar solicitação:',
      error,
      'Erro ao processar aprovação'
    );
  }
}
