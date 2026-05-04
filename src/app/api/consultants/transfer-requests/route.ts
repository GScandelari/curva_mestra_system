export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    const isSystemAdmin = decodedToken.is_system_admin;
    const isConsultant = decodedToken.is_consultant && decodedToken.consultant_id;

    if (!isSystemAdmin && !isConsultant) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = adminDb
      .collection('consultant_transfer_requests')
      .orderBy('created_at', 'desc') as FirebaseFirestore.Query;

    if (isConsultant && !isSystemAdmin) {
      query = query.where('current_consultant_id', '==', decodedToken.consultant_id);
    }

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const requests = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ success: true, data: requests });
  } catch (error: any) {
    console.error('Erro ao listar transfer requests:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar pedidos de transferência' },
      { status: 500 }
    );
  }
}
