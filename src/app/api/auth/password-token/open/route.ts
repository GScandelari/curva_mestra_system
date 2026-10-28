export const dynamic = 'force-dynamic';

/**
 * API Route: Abrir Link de Primeiro Acesso
 * POST /api/auth/password-token/open
 *
 * Marca o link como aberto (uso único) e devolve a sessão de 30 min
 * necessária para salvar a senha.
 * Body: { token: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { openFirstAccessToken } from '@/lib/services/passwordResetService';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ success: false, error: 'Token não fornecido' }, { status: 400 });
    }

    const result = await openFirstAccessToken(token);

    if (!result.success) {
      return NextResponse.json(
        { success: false, reason: result.reason, error: result.error },
        { status: result.reason ? 400 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      session: result.session,
      session_expires_at: result.sessionExpiresAt!.toISOString(),
      email_masked: result.emailMasked,
    });
  } catch (error) {
    console.error('Erro ao abrir link de primeiro acesso:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao processar o link. Tente novamente.' },
      { status: 500 }
    );
  }
}
