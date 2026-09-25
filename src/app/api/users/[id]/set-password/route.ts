export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { writeAuditLogAdmin, actorNameFromToken } from '@/lib/auditLogAdmin';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: userId } = await params;
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

    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    if (userDoc.data()?.role === 'system_admin') {
      return NextResponse.json(
        { error: 'Não é permitido alterar senha de administradores do sistema' },
        { status: 403 }
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
      .collection('users')
      .doc(userId)
      .update({
        requirePasswordChange: requirePasswordChange ?? false,
        passwordSetByAdminAt: FieldValue.serverTimestamp(),
        passwordSetByAdmin: decodedToken.uid,
        updated_at: FieldValue.serverTimestamp(),
      });

    await writeAuditLogAdmin({
      tenant_id: userDoc.data()?.tenant_id ?? null,
      entity_type: 'user',
      entity_id: userId,
      action: 'set_password',
      descricao: `Senha do usuário "${userDoc.data()?.full_name || userDoc.data()?.email || userId}" definida pelo administrador`,
      actor_id: decodedToken.uid,
      actor_name: actorNameFromToken(decodedToken),
      actor_role: 'system_admin',
    });

    console.log(`✅ Senha definida pelo admin ${decodedToken.uid} para usuário ${userId}`);

    return NextResponse.json({
      success: true,
      message: requirePasswordChange
        ? 'Senha definida. O usuário deverá alterá-la no próximo login.'
        : 'Senha definida com sucesso.',
    });
  } catch (error: any) {
    console.error('Erro ao definir senha:', error);
    return NextResponse.json({ error: 'Erro ao definir senha. Tente novamente.' }, { status: 500 });
  }
}
