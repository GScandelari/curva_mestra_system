export const dynamic = 'force-dynamic';

/**
 * API Route: Listar Templates de E-mail (UC-55)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { EmailTemplateDoc } from '@/types';

export async function GET(req: NextRequest) {
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

    const snap = await adminDb.collection('email_templates').get();
    const data: EmailTemplateDoc[] = snap.docs.map((doc) => doc.data() as EmailTemplateDoc);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao listar templates de e-mail:', error);
    return NextResponse.json({ error: 'Erro ao listar templates de e-mail' }, { status: 500 });
  }
}
