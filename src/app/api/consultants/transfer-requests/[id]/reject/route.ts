export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const transferId = params.id;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    const transferDoc = await adminDb
      .collection('consultant_transfer_requests')
      .doc(transferId)
      .get();

    if (!transferDoc.exists) {
      return NextResponse.json({ error: 'Pedido de transferência não encontrado' }, { status: 404 });
    }

    const transferData = transferDoc.data()!;

    const isSystemAdmin = decodedToken.is_system_admin;
    const isCurrentConsultant =
      decodedToken.is_consultant &&
      decodedToken.consultant_id === transferData.current_consultant_id;

    if (!isSystemAdmin && !isCurrentConsultant) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    if (transferData.status !== 'pending') {
      return NextResponse.json({ error: 'Pedido já foi processado' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    await transferDoc.ref.update({
      status: 'rejected',
      rejection_reason: reason || 'Não especificado',
      rejected_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    // Buscar dados do consultor solicitante para email
    try {
      const requestingConsultantDoc = await adminDb
        .collection('consultants')
        .doc(transferData.requesting_consultant_id)
        .get();
      const requestingConsultantData = requestingConsultantDoc.data();

      if (requestingConsultantData?.email) {
        await adminDb.collection('email_queue').add({
          to: requestingConsultantData.email,
          subject: 'Pedido de transferência não aprovado - Curva Mestra',
          body: `<p>Olá ${requestingConsultantData.name},</p>
<p>Seu pedido de transferência para a clínica <strong>${transferData.tenant_name}</strong> não foi aprovado pelo consultor atual.</p>
${reason ? `<p><strong>Motivo:</strong> ${reason}</p>` : ''}
<p>Atenciosamente,<br>Equipe Curva Mestra</p>`,
          status: 'pending',
          type: 'consultant_transfer_rejected',
          created_at: FieldValue.serverTimestamp(),
        });
      }
    } catch (emailError) {
      console.warn('Erro ao enviar email:', emailError);
    }

    return NextResponse.json({ success: true, message: 'Pedido de transferência rejeitado' });
  } catch (error: any) {
    console.error('Erro ao rejeitar transferência:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao rejeitar transferência' },
      { status: 500 }
    );
  }
}
