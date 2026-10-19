export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * API Route: último acesso dos usuários (FEAT-ultimo-acesso-usuarios).
 * POST { uids: string[] } (até 100) → { data: { [uid]: ISO | null } }
 *
 * Só system_admin ativo. Lê o metadata do Firebase Auth (nada é gravado).
 * UIDs inexistentes no Auth ficam fora da resposta.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { verifyBearerToken } from '@/lib/services/accessRequestRouteHelpers';
import { computeLastAccess, parseLastAccessRequest, type LastAccessMap } from '@/lib/lastAccess';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(req: NextRequest) {
  try {
    const decoded = await verifyBearerToken(req, 'Token não fornecido');
    if (decoded instanceof NextResponse) {
      decoded.headers.set('Cache-Control', 'no-store');
      return decoded;
    }

    if (!(decoded.is_system_admin === true && decoded.active === true)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403, headers: NO_STORE });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    const parsed = parseLastAccessRequest(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
    }

    const result = await adminAuth.getUsers(parsed.uids.map((uid) => ({ uid })));
    const data: LastAccessMap = {};
    for (const user of result.users) {
      data[user.uid] = computeLastAccess(user.metadata);
    }
    return NextResponse.json({ data }, { headers: NO_STORE });
  } catch (error: unknown) {
    console.error('Erro ao consultar último acesso:', error);
    return NextResponse.json(
      { error: 'Erro ao consultar último acesso' },
      { status: 500, headers: NO_STORE }
    );
  }
}
