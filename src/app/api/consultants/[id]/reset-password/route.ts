export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  createPasswordResetToken,
  generateResetLink,
  generateResetPasswordEmailHtml,
} from '@/lib/services/passwordResetService';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: consultantId } = await params;

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (!decodedToken.is_system_admin) {
      return NextResponse.json(
        { error: 'Apenas administradores do sistema podem redefinir senhas' },
        { status: 403 }
      );
    }

    const consultantDoc = await adminDb.collection('consultants').doc(consultantId).get();
    if (!consultantDoc.exists) {
      return NextResponse.json({ error: 'Consultor não encontrado' }, { status: 404 });
    }

    const consultantData = consultantDoc.data()!;
    const userId = consultantData.user_id;
    if (!userId) {
      return NextResponse.json(
        { error: 'Consultor não possui usuário de autenticação vinculado' },
        { status: 400 }
      );
    }

    let userRecord;
    try {
      userRecord = await adminAuth.getUser(userId);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        return NextResponse.json(
          { error: 'Usuário não encontrado no sistema de autenticação' },
          { status: 404 }
        );
      }
      throw authError;
    }

    const userEmail = userRecord.email;
    if (!userEmail) {
      return NextResponse.json({ error: 'Consultor não possui email cadastrado' }, { status: 400 });
    }

    const { token: resetToken, expiresAt } = await createPasswordResetToken(
      userId,
      userEmail,
      decodedToken.uid
    );

    const resetLink = generateResetLink(resetToken);
    const emailHtml = generateResetPasswordEmailHtml(
      userRecord.displayName || consultantData.name || 'Consultor',
      resetLink
    );

    await adminDb.collection('email_queue').add({
      to: userEmail,
      subject: 'Redefinição de Senha - Curva Mestra',
      body: emailHtml,
      status: 'pending',
      type: 'password_reset',
      metadata: {
        user_id: userId,
        consultant_id: consultantId,
        expires_at: expiresAt.toISOString(),
      },
      created_at: FieldValue.serverTimestamp(),
    });

    await adminDb.collection('consultants').doc(consultantId).update({
      passwordResetRequestedAt: FieldValue.serverTimestamp(),
      passwordResetRequestedBy: decodedToken.uid,
      updated_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: 'Email de redefinição de senha enviado com sucesso.',
      email: userEmail,
    });
  } catch (error: any) {
    console.error('Erro ao solicitar reset de senha do consultor:', error);
    return NextResponse.json(
      { error: 'Erro ao solicitar redefinição de senha. Tente novamente.' },
      { status: 500 }
    );
  }
}
