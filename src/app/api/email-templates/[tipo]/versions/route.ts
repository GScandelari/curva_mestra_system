export const dynamic = 'force-dynamic';

/**
 * API Route: Histórico de Versões de um Template de E-mail (UC-55, RF-07)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { listEmailTemplateVersions } from '@/lib/services/emailTemplateAdmin';

export async function GET(req: NextRequest, context: { params: Promise<{ tipo: string }> }) {
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

    const { tipo } = await context.params;
    const versions = await listEmailTemplateVersions(tipo);

    return NextResponse.json({ success: true, data: versions });
  } catch (error) {
    console.error('Erro ao listar histórico de versões:', error);
    return NextResponse.json({ error: 'Erro ao listar histórico de versões' }, { status: 500 });
  }
}
