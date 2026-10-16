import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from '@/lib/services/accessRequestRouteHelpers';
import { validateRejectReason } from '@/lib/nfPendingRejection';
import { rejectPendingProduct } from '@/lib/services/pendingRejectionServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Recusa de pendência de catálogo (system_admin): a pendência vira 'recusada',
 * nada entra no estoque e a clínica é notificada com o motivo. O tenant vem da
 * pendência, nunca do corpo da requisição.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const decoded = await verifyBearerToken(req);
    if (decoded instanceof NextResponse) return decoded;

    if (decoded.is_system_admin !== true || decoded.active !== true) {
      return NextResponse.json(
        { error: 'Apenas administradores do sistema podem recusar pendências' },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }
    const validacao = validateRejectReason((body as { motivo?: unknown } | null)?.motivo);
    if (!validacao.ok) return NextResponse.json({ error: validacao.error }, { status: 400 });

    const { id } = await context.params;
    const result = await rejectPendingProduct({
      pendingId: id,
      motivo: validacao.motivo,
      uid: decoded.uid,
      actorName: (decoded.name as string | undefined) || decoded.email || 'System Admin',
    });

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Pendência não encontrada' }, { status: 404 });
    }
    if (result.kind === 'conflict') {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    return NextResponse.json({ ok: true, importId: result.importId });
  } catch (error: unknown) {
    // Sem logar o motivo nem dados da NF
    console.error('[admin/pending-products/reject] Erro ao recusar pendência:', error);
    return NextResponse.json({ error: 'Erro interno ao recusar a pendência' }, { status: 500 });
  }
}
