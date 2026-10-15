import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from '@/lib/services/accessRequestRouteHelpers';
import { checkParseNfeClaims } from '@/lib/validations/nfeUploadValidation';
import { validateManualLaunchRequest } from '@/lib/validations/nfManualLaunchValidation';
import { checkManualWriteBudget } from '@/lib/nfImportPlanner';
import { formatImportId } from '@/lib/nfIdentity';
import { confirmManualLaunch } from '@/lib/services/nfImportServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lançamento manual de NF (UC-11): cria o registro ou complementa o da mesma
 * nota (mesmo ID). O tenant vem SEMPRE do token — campos do corpo são ignorados.
 */
export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyBearerToken(
      request,
      'Sessão inválida ou expirada. Faça login novamente.'
    );
    if (decoded instanceof NextResponse) return decoded;

    const claimsCheck = checkParseNfeClaims({
      role: decoded.role,
      active: decoded.active,
      tenant_id: decoded.tenant_id,
    });
    if (!claimsCheck.ok) {
      return NextResponse.json({ error: claimsCheck.error }, { status: claimsCheck.status });
    }
    const tenantId = decoded.tenant_id as string;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    const validation = validateManualLaunchRequest(body);
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
    const { identity, chave_acesso, tipo, produtos } = validation.value;

    // Registro novo: contador + registro + identidade; complemento: só o registro
    const budget = checkManualWriteBudget(3, produtos.length);
    if (!budget.ok) return NextResponse.json({ error: budget.error }, { status: budget.status });

    const result = await confirmManualLaunch({
      tenantId,
      uid: decoded.uid,
      identity,
      chave_acesso,
      tipo,
      produtos,
    });

    if (result.kind === 'blocked') {
      return NextResponse.json(
        { error: result.reason, importId: result.importId },
        { status: 409 }
      );
    }
    if (result.kind === 'invalid') {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    const complemento = result.kind === 'complemented';
    return NextResponse.json(
      {
        importId: result.importId,
        idLabel: formatImportId(result.importId),
        complemento,
        produtosImportados: result.produtosImportados,
      },
      { status: complemento ? 200 : 201 }
    );
  } catch (error: unknown) {
    console.error('[nf-imports/manual] Erro ao lançar a NF:', error);
    const msg = error instanceof Error ? error.message : 'Erro interno ao lançar a NF';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
