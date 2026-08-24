export const dynamic = 'force-dynamic';

/**
 * API Route: Convite de consultor pela clínica (cenário 1a — clínica sem consultor vinculado)
 * GET - Obter o convite pendente e não expirado atual da clínica, se houver
 * POST - Criar um convite para um consultor específico
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { computeExpiresAt, isRequestExpired } from '@/lib/consultantRequests';

/**
 * GET - Obter o convite pendente e não expirado atual da clínica (RF-13)
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const tenantId = params.id;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (decodedToken.tenant_id !== tenantId || decodedToken.role !== 'clinic_admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Filtro puro por igualdade (tenant_id + type + status) — RF-03 garante no máximo um
    // convite pending por tenant na prática, então não há necessidade de orderBy/índice
    // dedicado aqui: os poucos documentos retornados são ordenados em memória.
    const snapshot = await adminDb
      .collection('consultant_transfer_requests')
      .where('tenant_id', '==', tenantId)
      .where('type', '==', 'invite')
      .where('status', '==', 'pending')
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ success: true, data: null });
    }

    const mostRecent = snapshot.docs
      .map((doc) => ({ id: doc.id, ref: doc, data: doc.data() }))
      .sort(
        (a, b) => (b.data.created_at?.toMillis?.() ?? 0) - (a.data.created_at?.toMillis?.() ?? 0)
      )[0];

    // Convite pendente porém já expirado não conta como "ativo" para esta consulta (RN-12)
    if (isRequestExpired({ expires_at: mostRecent.data.expires_at })) {
      return NextResponse.json({ success: true, data: null });
    }

    return NextResponse.json({ success: true, data: { id: mostRecent.id, ...mostRecent.data } });
  } catch (error: any) {
    console.error('Erro ao buscar convite pendente:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar convite pendente' },
      { status: 500 }
    );
  }
}

/**
 * POST - Criar um convite de vínculo para um consultor específico (RF-01)
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const tenantId = params.id;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (decodedToken.tenant_id !== tenantId || decodedToken.role !== 'clinic_admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await req.json();
    const { consultant_id } = body;

    if (!consultant_id) {
      return NextResponse.json({ error: 'consultant_id é obrigatório' }, { status: 400 });
    }

    const tenantDoc = await adminDb.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) {
      return NextResponse.json({ error: 'Clínica não encontrada' }, { status: 404 });
    }
    const tenantData = tenantDoc.data();

    // RN-02: convite só pode ser criado quando a clínica ainda não tem consultor
    if (tenantData?.consultant_id) {
      return NextResponse.json(
        {
          error:
            'Esta clínica já possui um consultor vinculado. Para trocar, aguarde uma solicitação de transferência do consultor interessado.',
        },
        { status: 400 }
      );
    }

    const consultantDoc = await adminDb.collection('consultants').doc(consultant_id).get();
    if (!consultantDoc.exists) {
      return NextResponse.json({ error: 'Consultor não encontrado' }, { status: 404 });
    }
    const consultantData = consultantDoc.data();

    if (consultantData?.status !== 'active') {
      return NextResponse.json({ error: 'Consultor não está ativo' }, { status: 400 });
    }

    // RF-03/RN-12: bloquear apenas se já existir convite pending NÃO expirado
    const existingInvites = await adminDb
      .collection('consultant_transfer_requests')
      .where('tenant_id', '==', tenantId)
      .where('type', '==', 'invite')
      .where('status', '==', 'pending')
      .get();

    const activeInvite = existingInvites.docs.find(
      (doc) => !isRequestExpired({ expires_at: doc.data().expires_at })
    );

    if (activeInvite) {
      return NextResponse.json(
        { error: 'Já existe um convite pendente para esta clínica' },
        { status: 400 }
      );
    }

    const now = new Date();
    const invitedByName = decodedToken.name || decodedToken.email || 'Clinic Admin';

    const inviteRef = await adminDb.collection('consultant_transfer_requests').add({
      type: 'invite',
      requesting_consultant_id: consultant_id,
      requesting_consultant_name: consultantData?.name,
      requesting_consultant_code: consultantData?.code,
      tenant_id: tenantId,
      tenant_name: tenantData?.name,
      tenant_document: tenantData?.document_number,
      invited_by_user_id: decodedToken.uid,
      invited_by_user_name: invitedByName,
      status: 'pending',
      expires_at: Timestamp.fromDate(computeExpiresAt(now)),
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    // Notificar o consultor convidado por email
    try {
      if (consultantData?.email) {
        await adminDb.collection('email_queue').add({
          to: consultantData.email,
          subject: 'Convite de vínculo com clínica - Curva Mestra',
          body: `<p>Olá ${consultantData.name},</p>
<p>A clínica <strong>${tenantData?.name}</strong> convidou você para ser o consultor vinculado a ela.</p>
<p>Acesse o Portal do Consultor para aceitar ou recusar este convite.</p>
<p>Atenciosamente,<br>Equipe Curva Mestra</p>`,
          status: 'pending',
          type: 'consultant_invite_created',
          created_at: FieldValue.serverTimestamp(),
        });
      }
    } catch (emailError) {
      console.warn('Erro ao enviar email:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'Convite enviado ao consultor',
      data: { id: inviteRef.id },
    });
  } catch (error: any) {
    console.error('Erro ao criar convite de consultor:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao criar convite de consultor' },
      { status: 500 }
    );
  }
}
