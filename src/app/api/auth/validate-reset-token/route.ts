export const dynamic = 'force-dynamic';

/**
 * API Route: Validar Token de Reset de Senha
 * GET /api/auth/validate-reset-token?token=xxx
 *
 * Valida um token sem consumi-lo nem abri-lo (nunca altera o token)
 * Retorna a finalidade e informações mascaradas do usuário
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/services/passwordResetService';

export async function GET(request: NextRequest) {
  try {
    // Obter token da query string
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token não fornecido' }, { status: 400 });
    }

    // Validar token
    const result = await validateToken(token);

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, purpose: result.purpose, reason: result.reason, error: result.error },
        { status: result.reason ? 400 : 500 }
      );
    }

    return NextResponse.json({
      valid: true,
      purpose: result.purpose,
      email_masked: result.emailMasked,
    });
  } catch (error: any) {
    console.error('Erro ao validar token de reset:', error);
    return NextResponse.json(
      { valid: false, error: 'Erro ao validar token. Tente novamente.' },
      { status: 500 }
    );
  }
}
