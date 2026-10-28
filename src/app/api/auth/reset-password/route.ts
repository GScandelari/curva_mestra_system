export const dynamic = 'force-dynamic';

/**
 * API Route: Executar Reset de Senha
 * POST /api/auth/reset-password
 *
 * Consome o token e atualiza a senha do usuário
 * Body: { token: string, new_password: string, session?: string }
 * `session` é obrigatória para link de primeiro acesso (POST password-token/open)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { consumeToken, invalidateUserTokens } from '@/lib/services/passwordResetService';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const { token, new_password, session } = await request.json();

    // Validar parâmetros
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token não fornecido' }, { status: 400 });
    }

    if (!new_password) {
      return NextResponse.json(
        { success: false, error: 'Nova senha não fornecida' },
        { status: 400 }
      );
    }

    // Validar força da senha
    if (new_password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Consumir token (verifica validade e marca como usado)
    const consumeResult = await consumeToken(
      token,
      typeof session === 'string' ? session : undefined
    );

    if (!consumeResult.success) {
      return NextResponse.json(
        { success: false, reason: consumeResult.reason, error: consumeResult.error },
        { status: consumeResult.reason ? 400 : 500 }
      );
    }

    const userId = consumeResult.userId!;
    const userEmail = consumeResult.userEmail!;

    // Atualizar senha no Firebase Auth. Quem recebeu o link no e-mail
    // comprovou a posse do endereço.
    await adminAuth.updateUser(userId, {
      password: new_password,
      emailVerified: true,
    });

    // Remover flag de requirePasswordChange se existir
    const userRecord = await adminAuth.getUser(userId);
    const currentClaims = userRecord.customClaims || {};

    if (currentClaims.requirePasswordChange) {
      await adminAuth.setCustomUserClaims(userId, {
        ...currentClaims,
        requirePasswordChange: false,
      });
    }

    // Atualizar documento do usuário no Firestore
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (userDoc.exists) {
      await adminDb.collection('users').doc(userId).update({
        requirePasswordChange: false,
        passwordChangedAt: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    // Invalidar quaisquer outros tokens pendentes do usuário
    await invalidateUserTokens(userId);

    console.log(`Senha redefinida com sucesso para: ${userEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Senha redefinida com sucesso! Você já pode fazer login.',
    });
  } catch (error: any) {
    console.error('Erro ao redefinir senha:', error);

    // Verificar erros específicos do Firebase Auth
    if (error.code === 'auth/user-not-found') {
      return NextResponse.json(
        { success: false, error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    if (error.code === 'auth/weak-password') {
      return NextResponse.json(
        { success: false, error: 'A senha é muito fraca. Use pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erro ao redefinir senha. Tente novamente.' },
      { status: 500 }
    );
  }
}
