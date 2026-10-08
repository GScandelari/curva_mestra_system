export const dynamic = 'force-dynamic';

/**
 * API Route: Consultor aprova solicitação de acesso (UC-56)
 *
 * Rota separada da aprovação pelo System Admin (`.../approve`, UC-02) para não
 * tocar na autorização daquela rota (UC-02 RN-06). Ambas executam a mesma
 * cadeia de criação (accessRequestApproval.ts, UC-56 RN-09).
 *
 * Autorização:
 * - Bearer token de consultor ATIVO: claims `is_consultant`, `consultant_id`,
 *   `active === true` + documento `consultants/{id}` com `status: "active"`
 *   (RN-07 — o claim pode estar desatualizado, o documento é a fonte de verdade).
 * - Elegibilidade (RN-01 a RN-05): `canConsultantApprove` — só bloqueia
 *   solicitação vinculada a OUTRO consultor com menos de 48h de `created_at`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { AccessRequest } from '@/types';
import { canConsultantApprove } from '@/lib/consultantAccessApproval';
import {
  createTenantAndUserFromAccessRequest,
  EmailAlreadyInUseError,
} from '@/lib/services/accessRequestApproval';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const consultantId = decodedToken.consultant_id as string | undefined;
    if (!decodedToken.is_consultant || !consultantId || decodedToken.active !== true) {
      return NextResponse.json(
        { error: 'Apenas consultores ativos podem aprovar solicitações' },
        { status: 403 }
      );
    }

    const consultantDoc = await adminDb.collection('consultants').doc(consultantId).get();
    if (!consultantDoc.exists || consultantDoc.data()?.status !== 'active') {
      return NextResponse.json(
        { error: 'Apenas consultores ativos podem aprovar solicitações' },
        { status: 403 }
      );
    }

    const params = await context.params;
    const requestId = params.id;

    const requestDoc = await adminDb.collection('access_requests').doc(requestId).get();
    if (!requestDoc.exists) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    const request = requestDoc.data() as AccessRequest;

    if (request.status !== 'pendente') {
      return NextResponse.json({ error: 'Solicitação já foi processada' }, { status: 400 });
    }

    if (
      !canConsultantApprove({
        requestConsultantId: request.consultant_id,
        actingConsultantId: consultantId,
        createdAt: request.created_at,
      })
    ) {
      return NextResponse.json(
        { error: 'Esta solicitação está em período de exclusividade de outro consultor' },
        { status: 403 }
      );
    }

    const approverName =
      (consultantDoc.data()?.name as string | undefined) ||
      decodedToken.name ||
      decodedToken.email ||
      'Consultor Rennova';

    try {
      const data = await createTenantAndUserFromAccessRequest(request, requestId, {
        uid: decodedToken.uid,
        name: approverName,
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
    console.error('❌ Erro ao aprovar solicitação (consultor):', error);
    const message = error instanceof Error ? error.message : 'Erro ao processar aprovação';
    return NextResponse.json({ error: message || 'Erro ao processar aprovação' }, { status: 500 });
  }
}
