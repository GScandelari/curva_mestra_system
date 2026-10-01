export const dynamic = 'force-dynamic';

/**
 * API Route: Reverter um Template de E-mail para uma versão anterior (UC-55, RF-07/Fluxo 7c)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { actorNameFromToken } from '@/lib/auditLogAdmin';
import { revertEmailTemplateVersion } from '@/lib/services/emailTemplateAdmin';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ tipo: string; versionId: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (!decodedToken.is_system_admin) {
      return NextResponse.json(
        { error: 'Apenas administradores do sistema podem acessar templates de e-mail' },
        { status: 403 }
      );
    }

    const { tipo, versionId } = await context.params;

    await revertEmailTemplateVersion(tipo, versionId, {
      uid: decodedToken.uid,
      name: actorNameFromToken(decodedToken),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao reverter template de e-mail';
    const status = message.includes('não encontrad') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
