export const dynamic = 'force-dynamic';

/**
 * API Route: Solicitações de acesso pendentes, visão do consultor (UC-56)
 * GET - Lista TODAS as solicitações `pendente` (RN-04 — visibilidade universal
 * para qualquer consultor ativo), anotando em cada uma se o consultor
 * autenticado pode aprová-la agora (`eligible_now`, RN-01 a RN-05).
 *
 * Servida via Admin SDK em vez de abrir `firestore.rules` de `access_requests`
 * para `isConsultant()` (UC-56 RNF-02): mantém a coleção — que contém PII de
 * solicitantes — legível pelo client SDK só para system_admin, mesmo padrão
 * já usado por POST /api/access-requests. Usa o índice composto existente
 * (status ASC, created_at DESC), o mesmo da tela do admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { AccessRequest } from '@/types';
import { canConsultantApprove, computeExclusivityExpiresAt } from '@/lib/consultantAccessApproval';
import {
  internalErrorResponse,
  verifyActiveConsultant,
} from '@/lib/services/accessRequestRouteHelpers';

function toIso(value: unknown): string | null {
  const v = value as { toDate?: () => Date } | undefined;
  return v?.toDate ? v.toDate().toISOString() : null;
}

export async function GET(req: NextRequest) {
  try {
    const consultant = await verifyActiveConsultant(
      req,
      'Acesso restrito a consultores ativos',
      'Token não fornecido'
    );
    if (consultant instanceof NextResponse) return consultant;
    const { consultantId } = consultant;

    const snapshot = await adminDb
      .collection('access_requests')
      .where('status', '==', 'pendente')
      .orderBy('created_at', 'desc')
      .get();

    // Nomes dos consultores vinculados (para a tela indicar "de quem" é a exclusividade)
    const linkedIds = Array.from(
      new Set(
        snapshot.docs
          .map((d) => (d.data() as AccessRequest).consultant_id)
          .filter((id): id is string => !!id)
      )
    );
    const linkedNames = new Map<string, string>();
    if (linkedIds.length > 0) {
      const refs = linkedIds.map((id) => adminDb.collection('consultants').doc(id));
      const docs = await adminDb.getAll(...refs);
      for (const doc of docs) {
        if (doc.exists) linkedNames.set(doc.id, (doc.data()?.name as string) || '');
      }
    }

    const now = new Date();
    const data = snapshot.docs.map((doc) => {
      const request = doc.data() as AccessRequest;
      const linkedConsultantId = request.consultant_id || null;
      return {
        id: doc.id,
        role: request.role,
        full_name: request.full_name,
        email: request.email,
        phone: request.phone,
        council_number: request.council_number,
        business_name: request.business_name,
        volume: request.volume ?? null,
        consultant_code: request.consultant_code ?? null,
        consultant_id: linkedConsultantId,
        consultant_name: linkedConsultantId ? linkedNames.get(linkedConsultantId) || null : null,
        created_at: toIso(request.created_at),
        linked_to_me: linkedConsultantId === consultantId,
        exclusivity_expires_at:
          linkedConsultantId && request.created_at
            ? computeExclusivityExpiresAt(request.created_at).toISOString()
            : null,
        eligible_now: canConsultantApprove(
          {
            requestConsultantId: linkedConsultantId,
            actingConsultantId: consultantId,
            createdAt: request.created_at,
          },
          now
        ),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return internalErrorResponse(
      '[GET /api/consultants/me/pending-access-requests] erro:',
      error,
      'Erro ao listar solicitações'
    );
  }
}
