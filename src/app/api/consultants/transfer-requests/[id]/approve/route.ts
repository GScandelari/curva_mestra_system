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

    const { tenant_id, requesting_consultant_id, current_consultant_id } = transferData;

    const requestingConsultantDoc = await adminDb
      .collection('consultants')
      .doc(requesting_consultant_id)
      .get();

    if (!requestingConsultantDoc.exists) {
      return NextResponse.json({ error: 'Consultor solicitante não encontrado' }, { status: 404 });
    }

    const requestingConsultantData = requestingConsultantDoc.data()!;

    const tenantDoc = await adminDb.collection('tenants').doc(tenant_id).get();

    if (!tenantDoc.exists) {
      return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 404 });
    }

    // Batch: atualizar transfer request, consultores e tenant atomicamente
    const batch = adminDb.batch();

    batch.update(transferDoc.ref, {
      status: 'approved',
      approved_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    // Remover tenant do consultor atual
    const currentConsultantRef = adminDb.collection('consultants').doc(current_consultant_id);
    batch.update(currentConsultantRef, {
      authorized_tenants: FieldValue.arrayRemove(tenant_id),
      updated_at: FieldValue.serverTimestamp(),
    });

    // Adicionar tenant ao novo consultor
    batch.update(requestingConsultantDoc.ref, {
      authorized_tenants: FieldValue.arrayUnion(tenant_id),
      updated_at: FieldValue.serverTimestamp(),
    });

    // Atualizar tenant com dados do novo consultor
    batch.update(tenantDoc.ref, {
      consultant_id: requesting_consultant_id,
      consultant_code: requestingConsultantData.code,
      consultant_name: requestingConsultantData.name,
      updated_at: FieldValue.serverTimestamp(),
    });

    // Notificação informativa para clinic_admin
    const notifRef = adminDb.collection(`tenants/${tenant_id}/notifications`).doc();
    batch.set(notifRef, {
      type: 'consultant_linked',
      title: 'Consultor alterado',
      message: `Seu consultor foi alterado para ${requestingConsultantData.name} (${requestingConsultantData.code}). Acesse Minha Clínica para mais detalhes.`,
      action_url: '/clinic/my-clinic?tab=consultant',
      read: false,
      created_at: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Atualizar custom claims do novo consultor (adicionar tenant)
    if (requestingConsultantData.user_id) {
      const userRecord = await adminAuth.getUser(requestingConsultantData.user_id);
      const currentClaims = userRecord.customClaims || {};
      const updatedTenants = [...(currentClaims.authorized_tenants || [])];
      if (!updatedTenants.includes(tenant_id)) updatedTenants.push(tenant_id);
      await adminAuth.setCustomUserClaims(requestingConsultantData.user_id, {
        ...currentClaims,
        authorized_tenants: updatedTenants,
      });
    }

    // Atualizar custom claims do consultor atual (remover tenant)
    const currentConsultantDoc = await adminDb
      .collection('consultants')
      .doc(current_consultant_id)
      .get();
    const currentConsultantData = currentConsultantDoc.data();

    if (currentConsultantData?.user_id) {
      const userRecord = await adminAuth.getUser(currentConsultantData.user_id);
      const currentClaims = userRecord.customClaims || {};
      const updatedTenants = (currentClaims.authorized_tenants || []).filter(
        (t: string) => t !== tenant_id
      );
      await adminAuth.setCustomUserClaims(currentConsultantData.user_id, {
        ...currentClaims,
        authorized_tenants: updatedTenants,
      });
    }

    // Email para o consultor solicitante
    try {
      await adminDb.collection('email_queue').add({
        to: requestingConsultantData.email,
        subject: 'Transferência aprovada - Curva Mestra',
        body: `<p>Olá ${requestingConsultantData.name},</p>
<p>Sua solicitação de transferência para a clínica <strong>${transferData.tenant_name}</strong> foi aprovada!</p>
<p>Você já pode acessar os dados da clínica no Portal do Consultor.</p>
<p>Atenciosamente,<br>Equipe Curva Mestra</p>`,
        status: 'pending',
        type: 'consultant_transfer_approved',
        created_at: FieldValue.serverTimestamp(),
      });
    } catch (emailError) {
      console.warn('Erro ao enviar email:', emailError);
    }

    return NextResponse.json({ success: true, message: 'Transferência aprovada com sucesso' });
  } catch (error: any) {
    console.error('Erro ao aprovar transferência:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao aprovar transferência' },
      { status: 500 }
    );
  }
}
