import { XMLParser } from 'fast-xml-parser';
import type { ParsedNF, NFProduct, XmlParseError } from '@/types/nf';

export function convertXmlDate(isoDate: string | undefined | null): string {
  if (!isoDate) return '31/12/2099';
  const datePart = isoDate.substring(0, 10);
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day || year.length !== 4) return '31/12/2099';
  return `${day}/${month}/${year}`;
}

export function extractText(node: unknown): string {
  if (typeof node === 'string') return node.trim();
  if (typeof node === 'number') return String(node);
  return '';
}

export function parseNfeXml(xmlContent: string): { data: ParsedNF; errors: XmlParseError[] } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    isArray: (tagName) => tagName === 'det' || tagName === 'rastro',
  });

  const parsed = parser.parse(xmlContent) as Record<string, unknown>;

  const root = parsed as Record<string, Record<string, unknown>>;
  const nfe =
    (root?.nfeProc?.NFe as Record<string, unknown>)?.infNFe ??
    (root?.NFe as Record<string, unknown>)?.infNFe ??
    null;

  if (!nfe) {
    throw {
      code: 'INVALID_FORMAT',
      message: 'Arquivo não reconhecido como NF-e SEFAZ v4.00. Nó infNFe não encontrado.',
    } satisfies XmlParseError;
  }

  const ide = (nfe as Record<string, unknown>).ide ?? {};
  const emit = (nfe as Record<string, unknown>).emit ?? {};
  const numeroNF = extractText((ide as Record<string, unknown>).nNF);

  if (!numeroNF) {
    throw {
      code: 'MISSING_NF_NUMBER',
      message: 'Número da NF-e (<nNF>) não encontrado no XML.',
    } satisfies XmlParseError;
  }

  const detRaw = (nfe as Record<string, unknown>).det;
  const detArray: unknown[] = Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];

  if (detArray.length === 0) {
    throw {
      code: 'NO_PRODUCTS_FOUND',
      message: 'Nenhum produto (<det>) encontrado no XML.',
    } satisfies XmlParseError;
  }

  const produtos: NFProduct[] = [];
  const errors: XmlParseError[] = [];

  detArray.forEach((det: unknown, index: number) => {
    const detObj = det as Record<string, unknown>;
    const prod = (detObj?.prod ?? {}) as Record<string, unknown>;
    const cProd = extractText(prod.cProd);
    const xProd = extractText(prod.xProd);

    if (!cProd || !xProd) {
      errors.push({
        code: 'MALFORMED_PRODUCT',
        message: `Produto no item ${index + 1} sem código (<cProd>) ou nome (<xProd>).`,
        itemIndex: index,
      });
      return;
    }

    const quantidade = parseFloat(extractText(prod.qCom)) || 0;
    const valorUnitario = parseFloat(extractText(prod.vUnCom)) || 0;

    const rastroRaw = prod.rastro;
    const rastros: unknown[] = Array.isArray(rastroRaw) ? rastroRaw : rastroRaw ? [rastroRaw] : [];

    if (rastros.length === 0) {
      produtos.push({
        codigo: cProd,
        nome_produto: xProd.toUpperCase(),
        lote: 'NÃO_INFORMADO',
        quantidade,
        dt_validade: '31/12/2099',
        valor_unitario: valorUnitario,
        sem_rastro: true,
      });
      return;
    }

    rastros.forEach((rastro: unknown) => {
      const rastroObj = rastro as Record<string, unknown>;
      const nLote = extractText(rastroObj.nLote) || 'NÃO_INFORMADO';
      const dVal = convertXmlDate(extractText(rastroObj.dVal));
      const dFab = convertXmlDate(extractText(rastroObj.dFab));

      produtos.push({
        codigo: cProd,
        nome_produto: xProd.toUpperCase(),
        lote: nLote,
        quantidade,
        dt_validade: dVal,
        dt_fabricacao: dFab,
        valor_unitario: valorUnitario,
      });
    });
  });

  if (produtos.length === 0 && errors.length > 0) {
    throw {
      code: 'NO_PRODUCTS_FOUND',
      message: 'Nenhum produto válido pôde ser extraído do XML.',
    } satisfies XmlParseError;
  }

  return {
    data: {
      numero: extractText((ide as Record<string, unknown>).nNF),
      data_emissao: extractText((ide as Record<string, unknown>).dhEmi) || undefined,
      fornecedor: extractText((emit as Record<string, unknown>).xNome) || undefined,
      cnpj_fornecedor: extractText((emit as Record<string, unknown>).CNPJ) || undefined,
      produtos,
    },
    errors,
  };
}
