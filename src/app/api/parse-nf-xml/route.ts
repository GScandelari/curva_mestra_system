import { NextRequest, NextResponse } from 'next/server';
import { parseNfeXml } from '@/lib/parseNfeXml';
import type { XmlParseError } from '@/types/nf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.xml')) {
      return NextResponse.json(
        { error: 'Apenas arquivos XML são aceitos nesta rota' },
        { status: 400 }
      );
    }

    const xmlContent = await file.text();

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

    return NextResponse.json({
      parsedNF: result.data,
      warnings: result.errors as XmlParseError[],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro interno ao processar o arquivo';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
