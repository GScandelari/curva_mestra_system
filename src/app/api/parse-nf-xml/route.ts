import { NextRequest, NextResponse } from 'next/server';
import { parseNfeXml } from '@/lib/parseNfeXml';
import { verifyBearerToken } from '@/lib/services/accessRequestRouteHelpers';
import {
  checkParseNfeClaims,
  checkRequestContentLength,
  validateNfeUploadEntries,
  type NfeUploadGuardResult,
} from '@/lib/validations/nfeUploadValidation';
import type { XmlParseError } from '@/types/nf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function guardResponse(result: Exclude<NfeUploadGuardResult, { ok: true }>) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}

/**
 * UC-10-RN-13: só clinic_admin ativo importa NF-e; ordem das checagens
 * 401 (token) → 403 (claims) → 413 (Content-Length, antes de ler o corpo) →
 * 400/413 (arquivo) → 422 (parse) → 200.
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
    if (!claimsCheck.ok) return guardResponse(claimsCheck);

    const lengthCheck = checkRequestContentLength(request.headers.get('content-length'));
    if (!lengthCheck.ok) return guardResponse(lengthCheck);

    const formData = await request.formData();
    // Conta TODOS os arquivos do formulário, não só a chave `file`
    const files = Array.from(formData.values()).filter((v): v is File => v instanceof File);
    const entriesCheck = validateNfeUploadEntries(
      files.map((f) => ({ name: f.name, size: f.size }))
    );
    if (!entriesCheck.ok) return guardResponse(entriesCheck);

    const xmlContent = await files[0].text();

    let result: ReturnType<typeof parseNfeXml>;
    try {
      result = parseNfeXml(xmlContent);
    } catch (parseError: unknown) {
      const msg =
        typeof parseError === 'object' && parseError !== null && 'message' in parseError
          ? String((parseError as { message: string }).message)
          : 'Erro ao interpretar o XML da NF-e';
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    console.warn('[parse-nf-xml] Natureza da operação extraída do XML:', {
      numero: result.data.numero,
      natureza_operacao: result.data.natureza_operacao,
      forma_pagamento: result.data.forma_pagamento,
      tipo_nota: result.data.tipo_nota,
    });

    return NextResponse.json({
      parsedNF: result.data,
      warnings: result.errors as XmlParseError[],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro interno ao processar o arquivo';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
