import { XMLParser } from 'fast-xml-parser';
import type { ParsedNF, NFProduct, TipoNota, XmlParseError } from '@/types/nf';

const TPAG_LABELS: Record<string, string> = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'Cartão de Crédito',
  '04': 'Cartão de Débito',
  '05': 'Crédito Loja',
  '10': 'Vale Alimentação',
  '11': 'Vale Refeição',
  '12': 'Vale Presente',
  '13': 'Vale Combustível',
  '14': 'Duplicata Mercantil',
  '15': 'Boleto Bancário',
  '16': 'Depósito Bancário',
  '17': 'Pagamento Instantâneo (PIX)',
  '18': 'Transferência Bancária, Carteira Digital',
  '19': 'Programa de Fidelidade, Cashback, Crédito Virtual',
  '90': 'Sem Pagamento',
  '99': 'Outros',
};

/**
 * Mapeia o código oficial SEFAZ (tPag) para um rótulo legível.
 * Quando tPag=99 (Outros), agrega o texto livre de <xPag>.
 */
export function mapFormaPagamento(tPag: string, xPag?: string): string {
  const label = TPAG_LABELS[tPag] ?? 'Não Informado';
  if (tPag === '99' && xPag) {
    return `${label} - ${xPag}`;
  }
  return label;
}

/**
 * Classifica a natureza da operação (<natOp>) em Bonificação, Venda ou Outro,
 * por casamento de palavra-chave (acentos e caixa ignorados).
 */
export function inferTipoNota(natOp: string | undefined): TipoNota {
  const normalized = (natOp ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('bonific')) return 'bonificacao';
  if (normalized.includes('venda')) return 'venda';
  return 'outro';
}

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
    isArray: (tagName) => tagName === 'det' || tagName === 'rastro' || tagName === 'detPag',
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

  const naturezaOperacao = extractText((ide as Record<string, unknown>).natOp) || undefined;

  const pag = (nfe as Record<string, unknown>).pag as Record<string, unknown> | undefined;
  const detPagRaw = pag?.detPag;
  const detPagArray: unknown[] = Array.isArray(detPagRaw)
    ? detPagRaw
    : detPagRaw
      ? [detPagRaw]
      : [];

  // NF-e às vezes traz um <detPag> "fantasma" com vPag=0.00 além do pagamento real.
  // Escolhe o de maior vPag (empate: primeiro) como pagamento primário.
  const detPagPrimario = detPagArray.reduce<Record<string, unknown> | null>((best, cur) => {
    const curObj = cur as Record<string, unknown>;
    if (!best) return curObj;
    const bestValor = parseFloat(extractText(best.vPag)) || 0;
    const curValor = parseFloat(extractText(curObj.vPag)) || 0;
    return curValor > bestValor ? curObj : best;
  }, null);

  const formaPagamento = detPagPrimario
    ? mapFormaPagamento(
        extractText(detPagPrimario.tPag),
        extractText(detPagPrimario.xPag) || undefined
      )
    : undefined;

  return {
    data: {
      numero: extractText((ide as Record<string, unknown>).nNF),
      data_emissao: extractText((ide as Record<string, unknown>).dhEmi) || undefined,
      fornecedor: extractText((emit as Record<string, unknown>).xNome) || undefined,
      cnpj_fornecedor: extractText((emit as Record<string, unknown>).CNPJ) || undefined,
      natureza_operacao: naturezaOperacao,
      forma_pagamento: formaPagamento,
      tipo_nota: inferTipoNota(naturezaOperacao),
      produtos,
    },
    errors,
  };
}
