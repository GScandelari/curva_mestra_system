import { convertXmlDate, extractText, parseNfeXml } from '@/lib/parseNfeXml';
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

// ─── parseNfeXml ─────────────────────────────────────────────────────────────

const makeXml = (detContent: string, nNF = '27117') => `
<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe>
      <ide>
        <nNF>${nNF}</nNF>
        <dhEmi>2025-03-31T17:52:00-03:00</dhEmi>
      </ide>
      <emit>
        <xNome>RENNOVA</xNome>
        <CNPJ>12345678000199</CNPJ>
      </emit>
      ${detContent}
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
