import { NextRequest, NextResponse } from 'next/server';
import { parseNfeXml } from '@/lib/parseNfeXml';
import { verifyBearerToken } from '@/lib/services/accessRequestRouteHelpers';
import {
  checkParseNfeClaims,
  checkRequestContentLength,
  validateNfeUploadEntries,
  type NfeUploadGuardResult,
} from '@/lib/validations/nfeUploadValidation';
import { checkWriteBudget } from '@/lib/nfImportPlanner';
import { formatImportId } from '@/lib/nfIdentity';
import { confirmXmlImport, saveNfXmlFileBestEffort } from '@/lib/services/nfImportServer';
import type { ParsedNF } from '@/types/nf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function guardResponse(result: Exclude<NfeUploadGuardResult, { ok: true }>) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}

/**
 * Confirma a importação de uma NF-e via XML (UC-10). O servidor refaz o parse
 * do arquivo (não confia no preview do navegador) e grava tudo numa transação.
 * O tenant vem SEMPRE do token — nunca do formulário.
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
    const tenantId = decoded.tenant_id as string;

    const lengthCheck = checkRequestContentLength(request.headers.get('content-length'));
    if (!lengthCheck.ok) return guardResponse(lengthCheck);

    const formData = await request.formData();
    const files = Array.from(formData.values()).filter((v): v is File => v instanceof File);
    const entriesCheck = validateNfeUploadEntries(
      files.map((f) => ({ name: f.name, size: f.size }))
    );
    if (!entriesCheck.ok) return guardResponse(entriesCheck);

    const arquivo = files[0];
    const buffer = Buffer.from(await arquivo.arrayBuffer());

    let parsedNF: ParsedNF;
    try {
      parsedNF = parseNfeXml(buffer.toString('utf8')).data;
    } catch (parseError: unknown) {
      const msg =
        typeof parseError === 'object' && parseError !== null && 'message' in parseError
          ? String((parseError as { message: string }).message)
          : 'Erro ao interpretar o XML da NF-e';
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    // Pior caso: cada linha vira item de estoque ou pendência (+3 fixas)
    const budget = checkWriteBudget(3, parsedNF.produtos.length);
    if (!budget.ok) return NextResponse.json({ error: budget.error }, { status: budget.status });

    const result = await confirmXmlImport({
      tenantId,
      uid: decoded.uid,
      parsedNF,
      arquivoNome: arquivo.name,
    });

    if (result.kind === 'blocked') {
      return NextResponse.json(
        { error: result.reason, importId: result.importId },
        { status: 409 }
      );
    }

    const arquivoStatus = await saveNfXmlFileBestEffort(tenantId, result.importId, buffer);

    return NextResponse.json(
      {
        importId: result.importId,
        idLabel: formatImportId(result.importId),
        numero: parsedNF.numero,
        serie: parsedNF.serie,
        cnpj: parsedNF.cnpj_fornecedor,
        produtosImportados: result.produtosImportados,
        pendentes: result.pendentes,
        arquivoSalvo: arquivoStatus === 'salvo',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('[nf-imports/xml] Erro ao confirmar importação:', error);
    const msg = error instanceof Error ? error.message : 'Erro interno ao importar a NF-e';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
