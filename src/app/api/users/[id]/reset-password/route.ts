export const dynamic = 'force-dynamic';

/**
 * API Route: Reset de Senha por Admin
 * POST /api/users/[id]/reset-password
 *
 * Gera um token de reset e envia email com link seguro
 * NÃO gera senha temporária - usuário define a própria senha via link
 */

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
    const { id: userId } = await params;

    // Obter token do usuário autenticado
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Verificar se é system_admin
    const isSystemAdmin = decodedToken.is_system_admin === true;

    if (!isSystemAdmin) {
      return NextResponse.json(
        { error: 'Apenas administradores do sistema podem redefinir senhas' },
        { status: 403 }
      );
    }

    // Verificar se o usuário existe no Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const userData = userDoc.data();

    // Não permitir redefinir senha de system_admin
    if (userData?.role === 'system_admin') {
      return NextResponse.json(
        { error: 'Não é permitido redefinir senha de administradores do sistema' },
        { status: 403 }
      );
    }

    // Verificar se o usuário existe no Firebase Auth
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
      return NextResponse.json({ error: 'Usuário não possui email cadastrado' }, { status: 400 });
    }

    // Criar token de reset de senha
    const { token: resetToken, expiresAt } = await createPasswordResetToken(
      userId,
      userEmail,
      decodedToken.uid,
      userData?.tenant_id
    );

    // Gerar link de reset
    const resetLink = generateResetLink(resetToken);

    // Adicionar email à fila
    const emailHtml = generateResetPasswordEmailHtml(
      userRecord.displayName || userData?.full_name || 'Usuário',
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
        tenant_id: userData?.tenant_id,
        expires_at: expiresAt.toISOString(),
      },
      created_at: FieldValue.serverTimestamp(),
    });

    // Registrar no Firestore para auditoria
    await adminDb.collection('users').doc(userId).update({
      passwordResetRequestedAt: FieldValue.serverTimestamp(),
      passwordResetRequestedBy: decodedToken.uid,
      updated_at: FieldValue.serverTimestamp(),
    });

    console.log(`✅ Token de reset de senha gerado para ${userEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Email de redefinição de senha enviado com sucesso.',
      email: userEmail,
    });
  } catch (error: any) {
    console.error('Erro ao solicitar reset de senha:', error);

    return NextResponse.json(
      { error: 'Erro ao solicitar redefinição de senha. Tente novamente.' },
      { status: 500 }
    );
  }
}
