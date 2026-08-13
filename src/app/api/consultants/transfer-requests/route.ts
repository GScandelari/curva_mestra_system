export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { ConsultantPendencyType } from '@/types';
import { normalizeLegacyType } from '@/lib/consultantRequests';

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
    const type = searchParams.get('type') as ConsultantPendencyType | null;

    // --- system_admin: sem filtro de aprovador, comportamento essencialmente inalterado ---
    if (isSystemAdmin) {
      let query = adminDb
        .collection('consultant_transfer_requests')
        .orderBy('created_at', 'desc') as FirebaseFirestore.Query;

      if (status) {
        query = query.where('status', '==', status);
      }
      if (type) {
        query = query.where('type', '==', type);
      }

      const snapshot = await query.get();
      const requests = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      return NextResponse.json({ success: true, data: requests });
    }

    // --- consultor: mescla pendências de transferência (aprovador atual) e de convite (convidado) ---
    const consultantId = decodedToken.consultant_id;

    let transferQuery = adminDb
      .collection('consultant_transfer_requests')
      .where('current_consultant_id', '==', consultantId) as FirebaseFirestore.Query;
    let inviteQuery = adminDb
      .collection('consultant_transfer_requests')
      .where('type', '==', 'invite')
      .where('requesting_consultant_id', '==', consultantId) as FirebaseFirestore.Query;

    if (status) {
      transferQuery = transferQuery.where('status', '==', status);
      inviteQuery = inviteQuery.where('status', '==', status);
    }

    const [transferSnapshot, inviteSnapshot] = await Promise.all([
      type === 'invite' ? Promise.resolve(null) : transferQuery.get(),
      type === 'transfer' ? Promise.resolve(null) : inviteQuery.get(),
    ]);

    const transferDocs = transferSnapshot
      ? transferSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          // Query A não filtra por type no Firestore (evita índice adicional para type == null) —
          // documentos legados sem type entram aqui e são normalizados como 'transfer'.
          .filter((doc: any) => normalizeLegacyType(doc.type) !== 'invite')
      : [];
    const inviteDocs = inviteSnapshot
      ? inviteSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      : [];

    const requests = [...transferDocs, ...inviteDocs].sort((a: any, b: any) => {
      const aTime = a.created_at?.toMillis?.() ?? 0;
      const bTime = b.created_at?.toMillis?.() ?? 0;
      return bTime - aTime;
    });

    return NextResponse.json({ success: true, data: requests });
  } catch (error: any) {
    console.error('Erro ao listar transfer requests:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar pedidos de transferência' },
      { status: 500 }
    );
  }
}
