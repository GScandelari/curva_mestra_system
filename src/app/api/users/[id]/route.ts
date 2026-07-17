export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params;

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (!decodedToken.is_system_admin) {
      return NextResponse.json(
        { error: 'Apenas administradores do sistema podem editar usuários' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { displayName, role, active, confirmLastAdmin } = body;

    if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
      return NextResponse.json({ error: 'Nome completo é obrigatório' }, { status: 400 });
    }

    if (role !== 'clinic_admin' && role !== 'clinic_user') {
      return NextResponse.json(
        { error: "Função inválida. Deve ser 'clinic_admin' ou 'clinic_user'" },
        { status: 400 }
      );
    }

    if (typeof active !== 'boolean') {
      return NextResponse.json({ error: "Campo 'active' deve ser booleano" }, { status: 400 });
    }

    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const userData = userDoc.data();

    // Defesa em profundidade — a UI nunca oferece "Editar" para estes casos (RN-04/RN-05 do UC-36)
    if (userData?.role === 'system_admin') {
      return NextResponse.json(
        { error: 'Não é permitido editar administradores do sistema' },
        { status: 403 }
      );
    }

    if (userData?.role === 'clinic_consultant') {
      return NextResponse.json(
        { error: 'Consultores devem ser editados em /admin/consultants' },
        { status: 403 }
      );
    }

    const tenantId = userData?.tenant_id;
    const wasActiveClinicAdmin = userData?.role === 'clinic_admin' && userData?.active === true;
    const willLoseAdminStatus =
      wasActiveClinicAdmin && (role !== 'clinic_admin' || active === false);

    if (willLoseAdminStatus && tenantId) {
      const otherAdminsSnapshot = await adminDb
        .collection('users')
        .where('tenant_id', '==', tenantId)
        .where('role', '==', 'clinic_admin')
        .get();

      const otherActiveAdmins = otherAdminsSnapshot.docs.filter(
        (doc) => doc.id !== userId && doc.data().active === true
      );

      if (otherActiveAdmins.length === 0 && confirmLastAdmin !== true) {
        return NextResponse.json(
          {
            error:
              'Este usuário é o único administrador ativo desta clínica. Se prosseguir, a clínica ficará sem nenhum admin local. Deseja continuar mesmo assim?',
            code: 'LAST_ADMIN_CONFIRMATION_REQUIRED',
          },
          { status: 409 }
        );
      }
    }

    // Padrão correto de custom claims — nunca espalhar o documento Firestore
    const userRecord = await adminAuth.getUser(userId);
    const currentClaims = userRecord.customClaims || {};

    await adminAuth.setCustomUserClaims(userId, {
      ...currentClaims,
      role,
      active,
    });

    await adminAuth.updateUser(userId, { disabled: !active });

    await userRef.update({
      displayName,
      full_name: displayName,
      role,
      active,
      updated_at: FieldValue.serverTimestamp(),
    });

    console.log(
      `✅ Usuário ${userId} atualizado (claims sincronizadas) pelo admin ${decodedToken.uid}`
    );

    return NextResponse.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao atualizar usuário:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar usuário. Tente novamente.' },
      { status: 500 }
    );
  }
}
