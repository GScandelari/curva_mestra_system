export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { ConsultantTransferRequest } from '@/types';
import {
  getApproverConsultantId,
  isInviteRequest,
  isRequestExpired,
} from '@/lib/consultantRequests';

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
      return NextResponse.json(
        { error: 'Pedido de transferência não encontrado' },
        { status: 404 }
      );
    }

    const transferData = transferDoc.data()! as ConsultantTransferRequest;
    const approverConsultantId = getApproverConsultantId(transferData);
    const isInvite = isInviteRequest(transferData);

    const isSystemAdmin = decodedToken.is_system_admin;
    const isApprover =
      decodedToken.is_consultant && decodedToken.consultant_id === approverConsultantId;

    if (!isSystemAdmin && !isApprover) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    if (transferData.status !== 'pending') {
      return NextResponse.json({ error: 'Pedido já foi processado' }, { status: 400 });
    }

    // RN-11: pendência expirada não pode mais ser rejeitada
    if (isRequestExpired({ expires_at: transferData.expires_at })) {
      return NextResponse.json({ error: 'Este pedido expirou' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { reason } = body;

    await transferDoc.ref.update({
      status: 'rejected',
      rejection_reason: reason || 'Não especificado',
      rejected_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    if (isInvite) {
      // RN-04: convite recusado notifica a clínica in-app (sem email — não há
      // "consultor solicitante" distinto do aprovador nesse tipo).
      try {
        await adminDb.collection(`tenants/${transferData.tenant_id}/notifications`).add({
          type: 'consultant_invite_rejected',
          title: 'Convite recusado',
          message: `${transferData.requesting_consultant_name} (${transferData.requesting_consultant_code}) recusou o convite de vínculo.`,
          action_url: '/clinic/consultant/invite',
          read: false,
          created_at: FieldValue.serverTimestamp(),
        });
      } catch (notifError) {
        console.warn('Erro ao criar notificação de convite recusado:', notifError);
      }
    } else {
      // Comportamento de transferência 100% inalterado: email ao consultor solicitante,
      // sem notificação in-app para a clínica.
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
    }

    return NextResponse.json({
      success: true,
      message: isInvite ? 'Convite recusado' : 'Pedido de transferência rejeitado',
    });
  } catch (error: any) {
    console.error('Erro ao rejeitar transferência:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao rejeitar transferência' },
      { status: 500 }
    );
  }
}
