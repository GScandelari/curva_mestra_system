export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: consultantId } = await params;
    const { password, requirePasswordChange } = await request.json();

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (!decodedToken.is_system_admin) {
      return NextResponse.json(
        { error: 'Apenas administradores do sistema podem definir senhas' },
        { status: 403 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      );
    }

    const consultantDoc = await adminDb.collection('consultants').doc(consultantId).get();
    if (!consultantDoc.exists) {
      return NextResponse.json({ error: 'Consultor não encontrado' }, { status: 404 });
    }

    const userId = consultantDoc.data()?.user_id;
    if (!userId) {
      return NextResponse.json(
        { error: 'Consultor não possui usuário de autenticação vinculado' },
        { status: 400 }
      );
    }

    await adminAuth.updateUser(userId, { password });

    const userRecord = await adminAuth.getUser(userId);
    const currentClaims = userRecord.customClaims || {};

    if (requirePasswordChange) {
      await adminAuth.setCustomUserClaims(userId, {
        ...currentClaims,
        requirePasswordChange: true,
      });
    } else {
      const { requirePasswordChange: _removed, ...restClaims } = currentClaims;
      await adminAuth.setCustomUserClaims(userId, restClaims);
    }

    await adminDb
      .collection('consultants')
      .doc(consultantId)
      .update({
        requirePasswordChange: requirePasswordChange ?? false,
        passwordSetByAdminAt: FieldValue.serverTimestamp(),
        passwordSetByAdmin: decodedToken.uid,
        updated_at: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      success: true,
      message: requirePasswordChange
        ? 'Senha definida. O consultor deverá alterá-la no próximo login.'
        : 'Senha definida com sucesso.',
    });
  } catch (error: any) {
    console.error('Erro ao definir senha do consultor:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao definir senha. Tente novamente.' },
      { status: 500 }
    );
  }
}
