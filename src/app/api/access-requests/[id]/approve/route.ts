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
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { AccessRequest } from '@/types';
import {
  createTenantAndUserFromAccessRequest,
  EmailAlreadyInUseError,
} from '@/lib/services/accessRequestApproval';

/**
 * POST - Aprovar solicitação e criar tenant + usuário
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (!decodedToken.is_system_admin) {
      return NextResponse.json(
        { error: 'Apenas administradores do sistema podem aprovar solicitações' },
        { status: 403 }
      );
    }

    const approved_by_uid = decodedToken.uid;
    const approved_by_name = decodedToken.name || decodedToken.email || 'System Admin';

    const params = await context.params;
    const requestId = params.id;

    // Buscar solicitação
    const requestDoc = await adminDb.collection('access_requests').doc(requestId).get();

    if (!requestDoc.exists) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    const request = requestDoc.data() as AccessRequest;

    if (request.status !== 'pendente') {
      return NextResponse.json({ error: 'Solicitação já foi processada' }, { status: 400 });
    }

    try {
      const data = await createTenantAndUserFromAccessRequest(request, requestId, {
        uid: approved_by_uid,
        name: approved_by_name,
      });

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
  } catch (error: unknown) {
    console.error('❌ Erro ao aprovar solicitação:', error);
    const message = error instanceof Error ? error.message : 'Erro ao processar aprovação';
    return NextResponse.json({ error: message || 'Erro ao processar aprovação' }, { status: 500 });
  }
}
