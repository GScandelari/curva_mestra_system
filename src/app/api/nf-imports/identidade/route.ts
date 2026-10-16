import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from '@/lib/services/accessRequestRouteHelpers';
import { checkParseNfeClaims } from '@/lib/validations/nfeUploadValidation';
import { validateManualIdentity } from '@/lib/nfIdentity';
import { lookupNfIdentity } from '@/lib/services/nfImportServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Consulta antecipada de duplicidade (UC-11-RN-06): diz se a NF (CNPJ +
 * série + número) já existe na clínica, com ID e origem. Não grava nada; a
 * transação da confirmação continua sendo a checagem que vale. O tenant vem
 * SEMPRE do token — um tenantId na query é ignorado.
 */
export async function GET(request: NextRequest) {
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

    const params = request.nextUrl.searchParams;
    const validacao = validateManualIdentity({
      numero: params.get('numero') ?? '',
      cnpj: params.get('cnpj') ?? '',
      serie: params.get('serie') ?? '',
    });
    if (!validacao.ok) {
      return NextResponse.json({ error: validacao.error }, { status: 400, headers: NO_STORE });
    }

    const result = await lookupNfIdentity(tenantId, validacao.identity);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error: unknown) {
    // Sem logar a identidade da NF
    console.error('[nf-imports/identidade] Erro na consulta:', error);
    return NextResponse.json(
      { error: 'Erro interno ao consultar a NF' },
      { status: 500, headers: NO_STORE }
    );
  }
}
