export const dynamic = 'force-dynamic';

/**
 * API Route: Cancelamento de convite de consultor pela clínica (RF-13)
 * DELETE - Cancela um convite pending e não expirado, criado pela própria clínica
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { isRequestExpired } from '@/lib/consultantRequests';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const params = await context.params;
    const tenantId = params.id;
    const requestId = params.requestId;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // RN-08/RN-09: apenas clinic_admin do próprio tenant pode cancelar
    if (decodedToken.tenant_id !== tenantId || decodedToken.role !== 'clinic_admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const requestDoc = await adminDb
      .collection('consultant_transfer_requests')
      .doc(requestId)
      .get();

    if (!requestDoc.exists || requestDoc.data()?.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 });
    }

    const requestData = requestDoc.data()!;

    // RN-09: apenas pendências type 'invite' podem ser canceladas pela clínica
    if (requestData.type !== 'invite') {
      return NextResponse.json(
        { error: 'Apenas convites podem ser cancelados pela clínica' },
        { status: 403 }
      );
    }

    if (requestData.status !== 'pending') {
      return NextResponse.json({ error: 'Este convite já foi processado' }, { status: 400 });
    }

    // RN-11: pendência expirada não pode ser cancelada explicitamente
    if (isRequestExpired({ expires_at: requestData.expires_at })) {
      return NextResponse.json({ error: 'Este pedido expirou' }, { status: 400 });
    }

    await requestDoc.ref.update({
      status: 'cancelled',
      cancelled_at: FieldValue.serverTimestamp(),
      cancelled_by_user_id: decodedToken.uid,
      updated_at: FieldValue.serverTimestamp(),
    });

    // RN-10: nenhum email/notificação é enviado ao cancelar um convite
    return NextResponse.json({ success: true, message: 'Convite cancelado com sucesso' });
  } catch (error: any) {
    console.error('Erro ao cancelar convite de consultor:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao cancelar convite de consultor' },
      { status: 500 }
    );
  }
}
