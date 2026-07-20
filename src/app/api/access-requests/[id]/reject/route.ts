export const dynamic = 'force-dynamic';

/**
 * API Route: Rejeitar Solicitação de Acesso Antecipado
 * Marca solicitação como rejeitada e envia e-mail de notificação
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { AccessRequest } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST - Rejeitar solicitação
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Verificar autenticação
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (!decodedToken.is_system_admin) {
      return NextResponse.json(
        { error: 'Apenas administradores do sistema podem rejeitar solicitações' },
        { status: 403 }
      );
    }

    const rejected_by_uid = decodedToken.uid;
    const rejected_by_name = decodedToken.name || decodedToken.email || 'System Admin';

    const params = await context.params;
    const requestId = params.id;
    const { rejection_reason } = await req.json();

    // 1. Buscar solicitação
    const requestDoc = await adminDb.collection('access_requests').doc(requestId).get();

    if (!requestDoc.exists) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    const request = requestDoc.data() as AccessRequest;

    if (request.status !== 'pendente') {
      return NextResponse.json({ error: 'Solicitação já foi processada' }, { status: 400 });
    }

    // 2. Atualizar solicitação para rejeitada
    await adminDb
      .collection('access_requests')
      .doc(requestId)
      .update({
        status: 'rejeitada',
        rejected_by: rejected_by_uid,
        rejected_by_name,
        rejection_reason: rejection_reason || null,
        rejected_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

    console.log(`✅ Solicitação ${requestId} rejeitada por ${rejected_by_name}`);

    // 3. Enviar e-mail de rejeição
    try {
      const functionUrl =
        process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL ||
        'https://southamerica-east1-curva-mestra.cloudfunctions.net';

      // Obter token do admin para autenticar na Cloud Function
      const adminToken = await adminAuth.createCustomToken(rejected_by_uid);

      const emailResponse = await fetch(`${functionUrl}/sendAccessRejectionEmail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          data: {
            email: request.email,
            displayName: request.full_name,
            businessName: request.business_name,
            rejectionReason: rejection_reason,
          },
        }),
      });

      if (emailResponse.ok) {
        console.log(`✅ E-mail de rejeição enviado para ${request.email}`);
      } else {
        console.warn(`⚠️ Falha ao enviar e-mail de rejeição: ${emailResponse.statusText}`);
      }
    } catch (emailError) {
      // Não falhar a rejeição se o e-mail falhar
      console.warn(
        `⚠️ Erro ao enviar e-mail de rejeição (SMTP pode não estar configurado):`,
        emailError
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Solicitação rejeitada com sucesso.',
      data: {
        email: request.email,
        business_name: request.business_name,
        rejection_reason: rejection_reason || null,
      },
    });
  } catch (error: any) {
    console.error('❌ Erro ao rejeitar solicitação:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar rejeição' },
      { status: 500 }
    );
  }
}
