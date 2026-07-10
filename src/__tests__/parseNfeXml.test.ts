import {
  convertXmlDate,
  extractText,
  parseNfeXml,
  mapFormaPagamento,
  inferTipoNota,
} from '@/lib/parseNfeXml';
import type { XmlParseError } from '@/types/nf';

// ─── convertXmlDate ───────────────────────────────────────────────────────────

describe('convertXmlDate', () => {
  it('converts YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(convertXmlDate('2029-12-01')).toBe('01/12/2029');
  });

  it('extracts date part from ISO 8601 with time offset', () => {
    expect(convertXmlDate('2025-03-31T17:52:00-03:00')).toBe('31/03/2025');
  });

  it('returns 31/12/2099 for undefined', () => {
    expect(convertXmlDate(undefined)).toBe('31/12/2099');
  });

  it('returns 31/12/2099 for empty string', () => {
    expect(convertXmlDate('')).toBe('31/12/2099');
  });

  it('returns 31/12/2099 for malformed string', () => {
    expect(convertXmlDate('invalid')).toBe('31/12/2099');
  });
});

// ─── extractText ──────────────────────────────────────────────────────────────

describe('extractText', () => {
  it('returns trimmed string for string nodes', () => {
    expect(extractText('  ABC  ')).toBe('ABC');
  });

  it('converts number nodes to string', () => {
    expect(extractText(12345)).toBe('12345');
  });

  it('returns empty string for null/undefined', () => {
    expect(extractText(null)).toBe('');
    expect(extractText(undefined)).toBe('');
  });
});

// ─── mapFormaPagamento ─────────────────────────────────────────────────────────

describe('mapFormaPagamento', () => {
  it('maps 90 to "Sem Pagamento"', () => {
    expect(mapFormaPagamento('90')).toBe('Sem Pagamento');
  });

  it('maps 15 to "Boleto Bancário"', () => {
    expect(mapFormaPagamento('15')).toBe('Boleto Bancário');
  });

  it('maps 03 to "Cartão de Crédito"', () => {
    expect(mapFormaPagamento('03')).toBe('Cartão de Crédito');
  });

  it('maps 17 to "Pagamento Instantâneo (PIX)"', () => {
    expect(mapFormaPagamento('17')).toBe('Pagamento Instantâneo (PIX)');
  });

  it('appends xPag when tPag=99 (Outros)', () => {
    expect(mapFormaPagamento('99', 'Outros')).toBe('Outros - Outros');
  });

  it('returns just "Outros" when tPag=99 without xPag', () => {
    expect(mapFormaPagamento('99')).toBe('Outros');
  });

  it('returns "Não Informado" for unknown code', () => {
    expect(mapFormaPagamento('77')).toBe('Não Informado');
  });
});

// ─── inferTipoNota ───────────────────────────────────────────────────────────

describe('inferTipoNota', () => {
  it('classifies bonificação NFs regardless of accents', () => {
    expect(inferTipoNota('Remessa em bonificacao doacao ou brinde')).toBe('bonificacao');
  });

  it('classifies venda NFs even with truncated text', () => {
    expect(inferTipoNota('Venda de mercadoria adquirida ou recebida de terceiros desti')).toBe(
      'venda'
    );
    expect(inferTipoNota('Venda de mercadoria adquirida ou recebida de terceiros')).toBe('venda');
  });

  it('is case-insensitive', () => {
    expect(inferTipoNota('VENDA DE MERCADORIA')).toBe('venda');
  });

  it('returns "outro" for unrecognized natOp', () => {
    expect(inferTipoNota('Devolução de mercadoria')).toBe('outro');
  });

  it('returns "outro" for undefined', () => {
    expect(inferTipoNota(undefined)).toBe('outro');
  });
});

// ─── parseNfeXml ─────────────────────────────────────────────────────────────

const makeXml = (
  detContent: string,
  nNF = '27117',
  opts: { natOp?: string; pagContent?: string } = {}
) => `
<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe>
      <ide>
        <nNF>${nNF}</nNF>
        <dhEmi>2025-03-31T17:52:00-03:00</dhEmi>
        ${opts.natOp ? `<natOp>${opts.natOp}</natOp>` : ''}
      </ide>
      <emit>
        <xNome>RENNOVA</xNome>
        <CNPJ>12345678000199</CNPJ>
      </emit>
      ${detContent}
      ${opts.pagContent ? `<pag>${opts.pagContent}</pag>` : ''}
    </infNFe>
  </NFe>
</nfeProc>`;

const detWithRastro = `
<det nItem="1">
  <prod>
    <cProd>3076528</cProd>
    <xProd>Botox 100UI</xProd>
    <qCom>5.0000</qCom>
    <vUnCom>250.00</vUnCom>
    <rastro>
      <nLote>BT2024A</nLote>
      <dFab>2024-01-15</dFab>
      <dVal>2026-01-15</dVal>
    </rastro>
  </prod>
</det>`;

const detWithoutRastro = `
<det nItem="1">
  <prod>
    <cProd>9999999</cProd>
    <xProd>Produto Sem Rastro</xProd>
    <qCom>3.0000</qCom>
    <vUnCom>10.00</vUnCom>
  </prod>
</det>`;

const detWithMultipleRastros = `
<det nItem="1">
  <prod>
    <cProd>1111111</cProd>
    <xProd>Produto Multi Lote</xProd>
    <qCom>10.0000</qCom>
    <vUnCom>50.00</vUnCom>
    <rastro>
      <nLote>LOTE_A</nLote>
      <dFab>2024-01-01</dFab>
      <dVal>2026-01-01</dVal>
    </rastro>
    <rastro>
      <nLote>LOTE_B</nLote>
      <dFab>2024-06-01</dFab>
      <dVal>2026-06-01</dVal>
    </rastro>
  </prod>
</det>`;

const detMalformed = `
<det nItem="1">
  <prod>
    <qCom>5.0000</qCom>
    <vUnCom>10.00</vUnCom>
  </prod>
</det>`;

describe('parseNfeXml', () => {
  it('parses valid XML with one product with rastro', () => {
    const { data, errors } = parseNfeXml(makeXml(detWithRastro));
    expect(errors).toHaveLength(0);
    expect(data.numero).toBe('27117');
    expect(data.fornecedor).toBe('RENNOVA');
    expect(data.cnpj_fornecedor).toBe('12345678000199');
    expect(data.produtos).toHaveLength(1);
    expect(data.produtos[0].codigo).toBe('3076528');
    expect(data.produtos[0].lote).toBe('BT2024A');
    expect(data.produtos[0].dt_validade).toBe('15/01/2026');
    expect(data.produtos[0].dt_fabricacao).toBe('15/01/2024');
    expect(data.produtos[0].sem_rastro).toBeUndefined();
  });

  it('handles product without <rastro> — sets sem_rastro=true, lote=NÃO_INFORMADO', () => {
    const { data, errors } = parseNfeXml(makeXml(detWithoutRastro));
    expect(errors).toHaveLength(0);
    expect(data.produtos).toHaveLength(1);
    expect(data.produtos[0].lote).toBe('NÃO_INFORMADO');
    expect(data.produtos[0].dt_validade).toBe('31/12/2099');
    expect(data.produtos[0].sem_rastro).toBe(true);
  });

  it('generates one NFProduct per <rastro> when multiple rastros exist', () => {
    const { data, errors } = parseNfeXml(makeXml(detWithMultipleRastros));
    expect(errors).toHaveLength(0);
    expect(data.produtos).toHaveLength(2);
    expect(data.produtos[0].lote).toBe('LOTE_A');
    expect(data.produtos[1].lote).toBe('LOTE_B');
    // Ambos com a mesma quantidade do <det>
    expect(data.produtos[0].quantidade).toBe(10);
    expect(data.produtos[1].quantidade).toBe(10);
  });

  it('defaults tipo_nota to "outro" when <natOp> is absent', () => {
    const { data } = parseNfeXml(makeXml(detWithRastro));
    expect(data.natureza_operacao).toBeUndefined();
    expect(data.forma_pagamento).toBeUndefined();
    expect(data.tipo_nota).toBe('outro');
  });

  it('extracts venda simples (NF-e real 114528): tPag=99 único com xPag', () => {
    const { data } = parseNfeXml(
      makeXml(detWithRastro, '114528', {
        natOp: 'Venda de mercadoria adquirida ou recebida de terceiros',
        pagContent: '<detPag><tPag>99</tPag><xPag>Outros</xPag><vPag>527.99</vPag></detPag>',
      })
    );
    expect(data.natureza_operacao).toBe('Venda de mercadoria adquirida ou recebida de terceiros');
    expect(data.forma_pagamento).toBe('Outros - Outros');
    expect(data.tipo_nota).toBe('venda');
  });

  it('extracts venda com boleto (NF-e real 529068): tPag=15', () => {
    const { data } = parseNfeXml(
      makeXml(detWithRastro, '529068', {
        natOp: 'Venda de mercadoria adquirida ou recebida de terceiros desti',
        pagContent: '<detPag><tPag>15</tPag><vPag>226.99</vPag></detPag>',
      })
    );
    expect(data.forma_pagamento).toBe('Boleto Bancário');
    expect(data.tipo_nota).toBe('venda');
  });

  it('picks the primary <detPag> by highest vPag, ignoring the zero-value duplicate (NF-e real 112600)', () => {
    const { data } = parseNfeXml(
      makeXml(detWithRastro, '112600', {
        natOp: 'Venda de mercadoria adquirida ou recebida de terceiros',
        pagContent:
          '<detPag><tPag>99</tPag><xPag>Outros</xPag><vPag>1919.96</vPag></detPag>' +
          '<detPag><tPag>99</tPag><xPag>outros</xPag><vPag>0.00</vPag></detPag>',
      })
    );
    expect(data.forma_pagamento).toBe('Outros - Outros');
    expect(data.tipo_nota).toBe('venda');
  });

  it('extracts bonificação com detPag fantasma (NF-e real 528999): tPag=90 + tPag=99 vPag=0.00', () => {
    const { data } = parseNfeXml(
      makeXml(detWithRastro, '528999', {
        natOp: 'Remessa em bonificacao doacao ou brinde',
        pagContent:
          '<detPag><tPag>90</tPag><vPag>0.00</vPag></detPag>' +
          '<detPag><tPag>99</tPag><xPag>outros</xPag><vPag>0.00</vPag></detPag>',
      })
    );
    expect(data.forma_pagamento).toBe('Sem Pagamento');
    expect(data.tipo_nota).toBe('bonificacao');
  });

  it('throws XmlParseError with INVALID_FORMAT when infNFe is absent', () => {
    expect(() => parseNfeXml('<root><notNfe/></root>')).toThrow(
      expect.objectContaining({ code: 'INVALID_FORMAT' })
    );
  });

  it('puts malformed <det> in errors[], not in data.produtos', () => {
    const { data, errors } = parseNfeXml(makeXml(detWithRastro + detMalformed));
    expect(data.produtos).toHaveLength(1); // só o válido
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('MALFORMED_PRODUCT');
    expect(errors[0].itemIndex).toBe(1);
  });

  it('throws XmlParseError with INVALID_FORMAT for empty string', () => {
    expect(() => parseNfeXml('')).toThrow(
      expect.objectContaining({ code: 'INVALID_FORMAT' } satisfies Partial<XmlParseError>)
    );
  });
});
