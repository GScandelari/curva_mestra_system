export const dynamic = 'force-dynamic';

/**
 * API Route: Ler / Salvar nova versão de um Template de E-mail (UC-55)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { actorNameFromToken } from '@/lib/auditLogAdmin';
import { getEmailTemplate, saveEmailTemplateVersion } from '@/lib/services/emailTemplateAdmin';

async function requireSystemAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) };
  }

  const token = authHeader.split('Bearer ')[1];
  const decodedToken = await adminAuth.verifyIdToken(token);

  if (!decodedToken.is_system_admin) {
    return {
      error: NextResponse.json(
        { error: 'Apenas administradores do sistema podem acessar templates de e-mail' },
        { status: 403 }
      ),
    };
  }

  return { decodedToken };
}

export async function GET(req: NextRequest, context: { params: Promise<{ tipo: string }> }) {
  try {
    const auth = await requireSystemAdmin(req);
    if (auth.error) return auth.error;

    const { tipo } = await context.params;
    const template = await getEmailTemplate(tipo);

    if (!template) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    console.error('Erro ao buscar template de e-mail:', error);
    return NextResponse.json({ error: 'Erro ao buscar template de e-mail' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ tipo: string }> }) {
  try {
    const auth = await requireSystemAdmin(req);
    if (auth.error) return auth.error;

    const { tipo } = await context.params;
    const { subject, body } = await req.json();

    if (!subject || !body) {
      return NextResponse.json({ error: 'Assunto e corpo são obrigatórios' }, { status: 400 });
    }

    await saveEmailTemplateVersion(
      tipo,
      { subject, body },
      {
        uid: auth.decodedToken!.uid,
        name: actorNameFromToken(auth.decodedToken!),
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar template de e-mail';
    const status = message.includes('não encontrado') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
