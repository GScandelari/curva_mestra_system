export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue, WriteBatch } from 'firebase-admin/firestore';

/**
 * POST - Vincular consultor a uma clínica (auto-link) ou iniciar transferência
 */
export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Apenas consultores podem criar reivindicações
    if (!decodedToken.is_consultant || !decodedToken.consultant_id) {
      return NextResponse.json(
        { error: 'Apenas consultores podem criar reivindicações' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { tenant_id } = body;

    if (!tenant_id) {
      return NextResponse.json({ error: 'tenant_id é obrigatório' }, { status: 400 });
    }

    const consultantId = decodedToken.consultant_id;

    // Buscar dados do consultor
    const consultantDoc = await adminDb.collection('consultants').doc(consultantId).get();

    if (!consultantDoc.exists) {
      return NextResponse.json({ error: 'Consultor não encontrado' }, { status: 404 });
    }

    const consultantData = consultantDoc.data();

    // Buscar dados da clínica
    const tenantDoc = await adminDb.collection('tenants').doc(tenant_id).get();

    if (!tenantDoc.exists) {
      return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 404 });
    }

    const tenantData = tenantDoc.data();

    // Impedir se o consultor já é o atual desta clínica
    if (tenantData?.consultant_id === consultantId) {
      return NextResponse.json(
        { error: 'Você já é o consultor vinculado a esta clínica' },
        { status: 400 }
      );
    }

    // --- CASO 1: Clínica SEM consultor → auto-link imediato ---
    if (!tenantData?.consultant_id) {
      // Verificar se já existe claim pendente duplicado
      const existingClaim = await adminDb
        .collection('consultant_claims')
        .where('consultant_id', '==', consultantId)
        .where('tenant_id', '==', tenant_id)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

      if (!existingClaim.empty) {
        return NextResponse.json(
          { error: 'Já existe uma solicitação pendente para esta clínica' },
          { status: 400 }
        );
      }

      const batch: WriteBatch = adminDb.batch();

      // Registrar claim como approved (auditoria)
      const claimRef = adminDb.collection('consultant_claims').doc();
      batch.set(claimRef, {
        consultant_id: consultantId,
        consultant_name: consultantData?.name,
        consultant_code: consultantData?.code,
        tenant_id,
        tenant_name: tenantData?.name,
        tenant_document: tenantData?.document_number,
        status: 'approved',
        approved_at: FieldValue.serverTimestamp(),
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

      // Adicionar tenant ao consultor
      batch.update(consultantDoc.ref, {
        authorized_tenants: FieldValue.arrayUnion(tenant_id),
        updated_at: FieldValue.serverTimestamp(),
      });

      // Atualizar tenant com dados do consultor
      batch.update(tenantDoc.ref, {
        consultant_id: consultantId,
        consultant_code: consultantData?.code,
        consultant_name: consultantData?.name,
        updated_at: FieldValue.serverTimestamp(),
      });

      // Notificação informativa para clinic_admin
      const notifRef = adminDb.collection(`tenants/${tenant_id}/notifications`).doc();
      batch.set(notifRef, {
        type: 'consultant_linked',
        title: 'Consultor vinculado',
        message: `${consultantData?.name} (${consultantData?.code}) foi vinculado como consultor da sua clínica.`,
        action_url: '/clinic/my-clinic?tab=consultant',
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });

      await batch.commit();

      // Atualizar custom claims do consultor
      if (consultantData?.user_id) {
        try {
          const userRecord = await adminAuth.getUser(consultantData.user_id);
          const currentClaims = userRecord.customClaims || {};
          const updatedTenants = [...(currentClaims.authorized_tenants || [])];
          if (!updatedTenants.includes(tenant_id)) updatedTenants.push(tenant_id);
          await adminAuth.setCustomUserClaims(consultantData.user_id, {
            ...currentClaims,
            authorized_tenants: updatedTenants,
          });
        } catch (claimsError) {
          console.warn('Erro ao atualizar custom claims:', claimsError);
        }
      }

      return NextResponse.json({
        success: true,
        auto_linked: true,
        message: 'Vínculo estabelecido com sucesso',
      });
    }

    // --- CASO 2: Clínica COM consultor → criar pedido de transferência ---
    const existingTransfer = await adminDb
      .collection('consultant_transfer_requests')
      .where('requesting_consultant_id', '==', consultantId)
      .where('tenant_id', '==', tenant_id)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existingTransfer.empty) {
      return NextResponse.json(
        { error: 'Já existe um pedido de transferência pendente para esta clínica' },
        { status: 400 }
      );
    }

    // Buscar dados do consultor atual
    const currentConsultantDoc = await adminDb
      .collection('consultants')
      .doc(tenantData.consultant_id)
      .get();
    const currentConsultantData = currentConsultantDoc.data();

    const transferRef = await adminDb.collection('consultant_transfer_requests').add({
      requesting_consultant_id: consultantId,
      requesting_consultant_name: consultantData?.name,
      requesting_consultant_code: consultantData?.code,
      current_consultant_id: tenantData.consultant_id,
      current_consultant_name: currentConsultantData?.name || tenantData.consultant_name,
      tenant_id,
      tenant_name: tenantData?.name,
      tenant_document: tenantData?.document_number,
      status: 'pending',
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    // Notificar consultor atual por email
    try {
      if (currentConsultantData?.email) {
        await adminDb.collection('email_queue').add({
          to: currentConsultantData.email,
          subject: 'Pedido de transferência de clínica - Curva Mestra',
          body: `<p>Olá ${currentConsultantData.name},</p>
<p>O consultor <strong>${consultantData?.name} (${consultantData?.code})</strong> solicitou assumir a consultoria da clínica <strong>${tenantData?.name}</strong>, atualmente vinculada a você.</p>
<p>Acesse o Portal do Consultor para aprovar ou rejeitar este pedido.</p>
<p>Atenciosamente,<br>Equipe Curva Mestra</p>`,
          status: 'pending',
          type: 'consultant_transfer_request',
          created_at: FieldValue.serverTimestamp(),
        });
      }
    } catch (emailError) {
      console.warn('Erro ao enviar email:', emailError);
    }

    return NextResponse.json({
      success: true,
      auto_linked: false,
      transfer_requested: true,
      message: 'Pedido de transferência enviado ao consultor atual',
      data: { id: transferRef.id },
    });
  } catch (error: any) {
    console.error('Erro ao criar reivindicação:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao criar reivindicação' },
      { status: 500 }
    );
  }
}
