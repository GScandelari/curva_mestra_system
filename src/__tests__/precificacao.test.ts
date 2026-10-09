import {
  parseHorario,
  validarPeriodosDia,
  calcularHorasDia,
  contarOcorrenciasDiaSemanaNoMes,
  calcularHorasMes,
  mesesEntre,
  calcularParcelasRestantes,
  boletoCompoeCusto,
  calcularParcelasPagasNoMes,
  calcularCustoFixoMensal,
  calcularCapacidadeSimultanea,
  calcularCustoHora,
  validarParametrosMarkup,
  calcularDivisorPorFormaPagamento,
  calcularDivisoresMarkup,
  calcularPrecosPorForma,
  calcularCustoHoraAplicado,
  normalizarParametrosMarkup,
  normalizarCustoHoraConfig,
  parseFormaPagamento,
  somaMarkupMaisCara,
  taxaPagamentoPct,
  calcularResumoCustoHora,
  calcularCustoMedioPorProduto,
  calcularCustoMaterialProtocolo,
  calcularPrecificacaoProtocolo,
  calcularCustoMaterialSolicitacao,
  calcularPrecificacaoProcedimento,
  mesReferenciaDoProcedimento,
  montarSnapshotPrecificacao,
  resolverDuracaoProcedimento,
  DURACAO_PADRAO_MINUTOS,
  parseDuracaoMinutos,
  calcularProdutosRennova,
  separarMaterialParaConsultor,
  mesCorrenteSaoPaulo,
  formatarMesReferencia,
  criarConfigPadrao,
  extrairConfigInput,
  validarCustoHoraConfig,
  type LoteParaCusto,
  type CustoMaterialProtocolo,
} from '@/lib/precificacao';
import type { BoletoTec, DisponibilidadeDia, DiaSemanaKey } from '@/types';

const diaUtil: DisponibilidadeDia = {
  ativo: true,
  periodos: [
    { inicio: '08:00', fim: '12:00' },
    { inicio: '13:00', fim: '17:00' },
  ],
};
const sabado: DisponibilidadeDia = { ativo: true, periodos: [{ inicio: '08:00', fim: '12:00' }] };
const inativo: DisponibilidadeDia = { ativo: false, periodos: [] };

const disponibilidadeOficial: Record<DiaSemanaKey, DisponibilidadeDia> = {
  dom: inativo,
  seg: diaUtil,
  ter: diaUtil,
  qua: diaUtil,
  qui: diaUtil,
  sex: diaUtil,
  sab: sabado,
};

function configOficial() {
  const config = criarConfigPadrao('clinic_a');
  config.custos_fixos_base.aluguel = 30000;
  config.disponibilidade = disponibilidadeOficial;
  config.markup = {
    imposto_pct: 6,
    debito_pct: 3,
    credito_pct: 3,
    comissao_pct: 0,
    margem_pct: 30,
  };
  return config;
}

function boleto(overrides: Partial<BoletoTec> = {}): BoletoTec {
  return {
    id: 'b1',
    descricao: 'Laser',
    valor_parcela: 5000,
    total_parcelas: 24,
    parcelas_pagas: 10,
    mes_referencia: '2026-10',
    ...overrides,
  };
}

function lote(overrides: Partial<LoteParaCusto>): LoteParaCusto {
  return {
    codigo_produto: '9990001',
    valor_unitario: 100,
    quantidade_disponivel: 0,
    quantidade_inicial: 0,
    active: true,
    ...overrides,
  };
}

describe('parseHorario', () => {
  it('converts valid times to minutes', () => {
    expect(parseHorario('08:00')).toBe(480);
    expect(parseHorario('23:59')).toBe(1439);
  });

  it.each(['24:00', '8:0', 'ab:cd', ''])('returns null for %p', (valor) => {
    expect(parseHorario(valor)).toBeNull();
  });
});

describe('validarPeriodosDia', () => {
  it('accepts two non-overlapping periods', () => {
    expect(validarPeriodosDia(diaUtil)).toBeNull();
  });

  it('accepts touching periods', () => {
    expect(
      validarPeriodosDia({
        ativo: true,
        periodos: [
          { inicio: '08:00', fim: '12:00' },
          { inicio: '12:00', fim: '14:00' },
        ],
      })
    ).toBeNull();
  });

  it('rejects overlapping periods', () => {
    expect(
      validarPeriodosDia({
        ativo: true,
        periodos: [
          { inicio: '08:00', fim: '12:00' },
          { inicio: '11:00', fim: '14:00' },
        ],
      })
    ).toBe('Períodos sobrepostos');
  });

  it('rejects end before or equal to start', () => {
    expect(validarPeriodosDia({ ativo: true, periodos: [{ inicio: '18:00', fim: '17:00' }] })).toBe(
      'O fim deve ser posterior ao início'
    );
    expect(validarPeriodosDia({ ativo: true, periodos: [{ inicio: '08:00', fim: '08:00' }] })).toBe(
      'O fim deve ser posterior ao início'
    );
  });

  it('rejects an active day without periods and accepts an inactive one', () => {
    expect(validarPeriodosDia({ ativo: true, periodos: [] })).toBe('Dia ativo sem períodos');
    expect(validarPeriodosDia(inativo)).toBeNull();
  });
});

describe('calcularHorasDia', () => {
  it('sums the periods of an active day', () => {
    expect(calcularHorasDia(diaUtil)).toBe(8);
    expect(calcularHorasDia(sabado)).toBe(4);
    expect(
      calcularHorasDia({ ativo: true, periodos: [{ inicio: '08:30', fim: '12:15' }] })
    ).toBeCloseTo(3.75, 5);
  });

  it('returns 0 for an inactive day', () => {
    expect(calcularHorasDia({ ativo: false, periodos: diaUtil.periodos })).toBe(0);
  });
});

describe('contarOcorrenciasDiaSemanaNoMes', () => {
  it('counts October 2026 (starts on a Thursday)', () => {
    expect(contarOcorrenciasDiaSemanaNoMes(2026, 10)).toEqual({
      dom: 4,
      seg: 4,
      ter: 4,
      qua: 4,
      qui: 5,
      sex: 5,
      sab: 5,
    });
  });

  it('counts November 2026', () => {
    expect(contarOcorrenciasDiaSemanaNoMes(2026, 11)).toEqual({
      dom: 5,
      seg: 5,
      ter: 4,
      qua: 4,
      qui: 4,
      sex: 4,
      sab: 4,
    });
  });

  it('counts February 2027 as 4 of each day', () => {
    expect(Object.values(contarOcorrenciasDiaSemanaNoMes(2027, 2))).toEqual([4, 4, 4, 4, 4, 4, 4]);
  });

  it('counts the leap February 2028 as 29 days', () => {
    const soma = Object.values(contarOcorrenciasDiaSemanaNoMes(2028, 2)).reduce((a, b) => a + b);
    expect(soma).toBe(29);
  });
});

describe('calcularHorasMes', () => {
  it('matches the official example for October 2026', () => {
    expect(calcularHorasMes(disponibilidadeOficial, 2026, 10)).toBe(196);
  });

  it('uses the real weekdays of November 2026', () => {
    expect(calcularHorasMes(disponibilidadeOficial, 2026, 11)).toBe(184);
  });

  it('returns 0 when every day is inactive', () => {
    expect(calcularHorasMes(criarConfigPadrao('t').disponibilidade, 2026, 10)).toBe(0);
  });
});

describe('mesesEntre', () => {
  it('computes month differences', () => {
    expect(mesesEntre('2026-10', '2026-10')).toBe(0);
    expect(mesesEntre('2026-10', '2027-01')).toBe(3);
    expect(mesesEntre('2026-10', '2026-09')).toBe(-1);
  });
});

describe('calcularParcelasRestantes / boletoCompoeCusto', () => {
  it('keeps an active boleto in the reference month', () => {
    expect(calcularParcelasRestantes(boleto(), '2026-10')).toBe(14);
    expect(boletoCompoeCusto(boleto(), '2026-10')).toBe(true);
  });

  it('drops a fully paid boleto', () => {
    const quitado = boleto({ parcelas_pagas: 24 });
    expect(calcularParcelasRestantes(quitado, '2026-10')).toBe(0);
    expect(boletoCompoeCusto(quitado, '2026-10')).toBe(false);
  });

  it('advances one installment per month after the reference', () => {
    const quaseQuitado = boleto({ parcelas_pagas: 22 });
    expect(calcularParcelasRestantes(quaseQuitado, '2026-11')).toBe(1);
    expect(boletoCompoeCusto(quaseQuitado, '2026-11')).toBe(true);
    expect(calcularParcelasRestantes(quaseQuitado, '2026-12')).toBe(0);
    expect(boletoCompoeCusto(quaseQuitado, '2026-12')).toBe(false);
  });

  it('shows the installments paid up to the given month', () => {
    expect(calcularParcelasPagasNoMes(boleto(), '2026-10')).toBe(10);
    expect(calcularParcelasPagasNoMes(boleto(), '2026-12')).toBe(12);
    expect(calcularParcelasPagasNoMes(boleto({ parcelas_pagas: 23 }), '2027-03')).toBe(24);
  });

  it('does not move backwards before the reference month', () => {
    expect(calcularParcelasRestantes(boleto(), '2026-09')).toBe(14);
  });
});

describe('calcularCustoFixoMensal', () => {
  it('breaks down base, custom items and active boletos', () => {
    const config = configOficial();
    expect(calcularCustoFixoMensal(config, '2026-10').total).toBe(30000);

    config.custos_fixos_personalizados = [{ id: 'p1', nome: 'Café', valor: 500 }];
    expect(calcularCustoFixoMensal(config, '2026-10').total).toBe(30500);

    config.boletos_tec = [boleto()];
    expect(calcularCustoFixoMensal(config, '2026-10')).toEqual({
      base: 30000,
      personalizados: 500,
      boletos: 5000,
      total: 35500,
    });

    config.boletos_tec = [boleto({ parcelas_pagas: 24 })];
    expect(calcularCustoFixoMensal(config, '2026-10').boletos).toBe(0);
  });
});

describe('calcularCapacidadeSimultanea', () => {
  it('uses the minimum between rooms and professionals', () => {
    expect(calcularCapacidadeSimultanea(1, 1)).toBe(1);
    expect(calcularCapacidadeSimultanea(2, 1)).toBe(1);
    expect(calcularCapacidadeSimultanea(1, 3)).toBe(1);
    expect(calcularCapacidadeSimultanea(2, 2)).toBe(2);
  });
});

describe('calcularCustoHora', () => {
  it('divides the fixed cost by hours times capacity', () => {
    expect(calcularCustoHora(30000, 196, 1)).toBeCloseTo(153.06, 2);
    expect(calcularCustoHora(35000, 196, 1)).toBeCloseTo(178.57, 2);
    expect(calcularCustoHora(30000, 196, 2)).toBeCloseTo(76.53, 2);
    expect(calcularCustoHora(0, 196, 1)).toBe(0);
  });

  it('returns null without available hours', () => {
    expect(calcularCustoHora(30000, 0, 1)).toBeNull();
  });
});

describe('validarParametrosMarkup / calcularDivisorPorFormaPagamento', () => {
  it('accepts the official markup', () => {
    const m = { imposto_pct: 6, debito_pct: 3, credito_pct: 3, comissao_pct: 0, margem_pct: 30 };
    expect(validarParametrosMarkup(m)).toBeNull();
    expect(calcularDivisorPorFormaPagamento(m, 'credito')).toBeCloseTo(0.61, 5);
  });

  it('returns divisor 1 when every percentage is zero', () => {
    const m = { imposto_pct: 0, debito_pct: 0, credito_pct: 0, comissao_pct: 0, margem_pct: 0 };
    expect(validarParametrosMarkup(m)).toBeNull();
    expect(calcularDivisorPorFormaPagamento(m, 'credito')).toBe(1);
  });

  it.each([
    [{ imposto_pct: 6, debito_pct: 3, credito_pct: 3, comissao_pct: 61, margem_pct: 30 }],
    [{ imposto_pct: 50, debito_pct: 50, credito_pct: 50, comissao_pct: 10, margem_pct: 0 }],
  ])('rejects a sum of 100%% or more (%p)', (m) => {
    expect(validarParametrosMarkup(m)).toBe('A soma dos percentuais deve ser menor que 100%');
    expect(calcularDivisorPorFormaPagamento(m, 'credito')).toBeNull();
  });

  it('rejects negative percentages', () => {
    const m = { imposto_pct: -1, debito_pct: 0, credito_pct: 0, comissao_pct: 0, margem_pct: 0 };
    expect(validarParametrosMarkup(m)).toBe('Percentuais não podem ser negativos');
    expect(calcularDivisorPorFormaPagamento(m, 'credito')).toBeNull();
  });

  it('accepts a sum just below 100%', () => {
    const m = { imposto_pct: 99.99, debito_pct: 0, credito_pct: 0, comissao_pct: 0, margem_pct: 0 };
    expect(validarParametrosMarkup(m)).toBeNull();
    expect(calcularDivisorPorFormaPagamento(m, 'credito')).toBeCloseTo(0.0001, 6);
  });
});

describe('calcularResumoCustoHora', () => {
  it('summarizes the official example', () => {
    const resumo = calcularResumoCustoHora(configOficial(), '2026-10');
    expect(resumo.horasMes).toBe(196);
    expect(resumo.capacidade).toBe(1);
    expect(resumo.custoHora).toBeCloseTo(153.06, 2);
    expect(resumo.divisores.credito).toBeCloseTo(0.61, 5);
  });

  it('has no hourly cost for the default config', () => {
    expect(calcularResumoCustoHora(criarConfigPadrao('t'), '2026-10').custoHora).toBeNull();
  });
});

describe('calcularCustoMedioPorProduto', () => {
  it('weights active lots with stock by available quantity', () => {
    const custos = calcularCustoMedioPorProduto([
      lote({ quantidade_disponivel: 10, valor_unitario: 100 }),
      lote({ quantidade_disponivel: 30, valor_unitario: 120 }),
      lote({ quantidade_disponivel: 0, quantidade_inicial: 50, valor_unitario: 999 }),
      lote({ quantidade_disponivel: 40, valor_unitario: 999, active: false }),
    ]);
    expect(custos.get('9990001')?.custoMedio).toBeCloseTo(115, 5);
    expect(custos.get('9990001')?.criterio).toBe('estoque_atual');
  });

  it('falls back to the initial quantity of every lot', () => {
    const custos = calcularCustoMedioPorProduto([
      lote({ quantidade_inicial: 20, valor_unitario: 90 }),
      lote({ quantidade_inicial: 5, valor_unitario: 110, active: false }),
    ]);
    expect(custos.get('9990001')?.custoMedio).toBeCloseTo(94, 5);
    expect(custos.get('9990001')?.criterio).toBe('historico');
  });

  it('ignores invalid unit values', () => {
    const custos = calcularCustoMedioPorProduto([
      lote({ quantidade_disponivel: 10, valor_unitario: 100 }),
      lote({ quantidade_disponivel: 10, valor_unitario: undefined }),
      lote({ quantidade_disponivel: 10, valor_unitario: NaN }),
      lote({ quantidade_disponivel: 10, valor_unitario: 'abc' }),
      lote({ quantidade_disponivel: 10, valor_unitario: -5 }),
    ]);
    expect(custos.get('9990001')?.custoMedio).toBe(100);
  });

  it('accepts a unit value of zero', () => {
    const custos = calcularCustoMedioPorProduto([
      lote({ quantidade_disponivel: 10, valor_unitario: 0 }),
    ]);
    expect(custos.get('9990001')?.custoMedio).toBe(0);
  });

  it('leaves out a product without any valid lot', () => {
    const custos = calcularCustoMedioPorProduto([lote({ valor_unitario: undefined })]);
    expect(custos.has('9990001')).toBe(false);
  });
});

describe('calcularCustoMaterialProtocolo', () => {
  const custos = new Map([['9990001', { custoMedio: 115, criterio: 'estoque_atual' as const }]]);

  it('multiplies the suggested quantity by the average cost', () => {
    const material = calcularCustoMaterialProtocolo(
      [{ codigo_produto: '9990001', nome_produto: 'Produto A', quantidade_sugerida: 2 }],
      custos
    );
    expect(material.total).toBe(230);
    expect(material.incompleto).toBe(false);
  });

  it('flags items without cost and sums only the priced ones', () => {
    const material = calcularCustoMaterialProtocolo(
      [
        { codigo_produto: '9990001', nome_produto: 'Produto A', quantidade_sugerida: 2 },
        { codigo_produto: '9990002', nome_produto: 'Produto B', quantidade_sugerida: 1 },
      ],
      custos
    );
    expect(material.total).toBe(230);
    expect(material.incompleto).toBe(true);
    expect(material.codigosSemCusto).toEqual(['9990002']);
  });

  it('returns zero for an empty protocol', () => {
    expect(calcularCustoMaterialProtocolo([], custos).total).toBe(0);
  });
});

describe('calcularPrecificacaoProtocolo', () => {
  const material: CustoMaterialProtocolo = {
    total: 800,
    incompleto: false,
    codigosSemCusto: [],
    itens: [],
  };
  const custoHora = 30000 / 196;

  it('matches the official example', () => {
    const preco = calcularPrecificacaoProtocolo({
      duracaoMinutos: 60,
      custoHora,
      divisores: { pix_dinheiro: 0.61, debito: 0.61, credito: 0.61 },
      custoMaterial: material,
    });
    expect(preco.custoHoraAplicado).toBeCloseTo(153.06, 2);
    expect(preco.custoReal).toBeCloseTo(953.06, 2);
    expect(preco.precosSugeridos.credito).toBeCloseTo(1562.4, 2);
  });

  it('applies the hourly cost proportionally to the duration', () => {
    const preco = calcularPrecificacaoProtocolo({
      duracaoMinutos: 30,
      custoHora,
      divisores: { pix_dinheiro: 0.61, debito: 0.61, credito: 0.61 },
      custoMaterial: material,
    });
    expect(preco.custoHoraAplicado).toBeCloseTo(76.53, 2);
  });

  it('returns nulls without an hourly cost', () => {
    const preco = calcularPrecificacaoProtocolo({
      duracaoMinutos: 60,
      custoHora: null,
      divisores: { pix_dinheiro: 0.61, debito: 0.61, credito: 0.61 },
      custoMaterial: material,
    });
    expect(preco.custoHoraAplicado).toBeNull();
    expect(preco.custoReal).toBeNull();
    expect(preco.precosSugeridos.credito).toBeNull();
  });

  it.each([undefined, 0])('prices a protocol without duration as one hour (%p)', (duracao) => {
    const preco = calcularPrecificacaoProtocolo({
      duracaoMinutos: duracao,
      custoHora,
      divisores: { pix_dinheiro: 0.64, debito: 0.62, credito: 0.6 },
      custoMaterial: material,
    });
    expect(DURACAO_PADRAO_MINUTOS).toBe(60);
    expect(preco.duracaoConsiderada).toBe(60);
    expect(preco.duracaoPadrao).toBe(true);
    expect(preco.custoReal).toBeCloseTo(953.06, 2);
    expect(preco.precosSugeridos.pix_dinheiro).toBeCloseTo(1489.16, 2);
    expect(preco.precosSugeridos.debito).toBeCloseTo(1537.2, 2);
    expect(preco.precosSugeridos.credito).toBeCloseTo(1588.44, 2);
  });

  it('keeps the protocol duration when informed', () => {
    const preco = calcularPrecificacaoProtocolo({
      duracaoMinutos: 30,
      custoHora,
      divisores: { pix_dinheiro: 0.64, debito: 0.62, credito: 0.6 },
      custoMaterial: { ...material, total: 0 },
    });
    expect(preco.duracaoConsiderada).toBe(30);
    expect(preco.duracaoPadrao).toBe(false);
  });

  it('prices STEP 4 protocols P2 and P4 with the one-hour default', () => {
    const divisores = { pix_dinheiro: 0.64, debito: 0.62, credito: 0.6 };
    const p2 = calcularPrecificacaoProtocolo({
      custoHora,
      divisores,
      custoMaterial: { ...material, total: 0 },
    });
    expect(p2.custoReal).toBeCloseTo(153.06, 2);
    expect(p2.precosSugeridos.pix_dinheiro).toBeCloseTo(239.16, 2);
    expect(p2.precosSugeridos.credito).toBeCloseTo(255.1, 2);
    const p4 = calcularPrecificacaoProtocolo({
      custoHora,
      divisores,
      custoMaterial: { ...material, total: 115 },
    });
    expect(p4.custoReal).toBeCloseTo(268.06, 2);
    expect(p4.precosSugeridos.pix_dinheiro).toBeCloseTo(418.85, 2);
    expect(p4.precosSugeridos.credito).toBeCloseTo(446.77, 2);
  });

  it('keeps the real cost when the markup is invalid', () => {
    const preco = calcularPrecificacaoProtocolo({
      duracaoMinutos: 60,
      custoHora,
      divisores: { pix_dinheiro: null, debito: null, credito: null },
      custoMaterial: material,
    });
    expect(preco.custoReal).toBeCloseTo(953.06, 2);
    expect(preco.precosSugeridos.credito).toBeNull();
  });
});

describe('parseDuracaoMinutos', () => {
  it('treats an empty field as no duration', () => {
    expect(parseDuracaoMinutos('')).toEqual({ valor: null });
    expect(parseDuracaoMinutos('   ')).toEqual({ valor: null });
  });

  it('accepts integers from 1 to 1440', () => {
    expect(parseDuracaoMinutos('60')).toEqual({ valor: 60 });
    expect(parseDuracaoMinutos('1')).toEqual({ valor: 1 });
    expect(parseDuracaoMinutos('1440')).toEqual({ valor: 1440 });
  });

  it.each(['0', '1441', '30.5', '-5', 'abc'])('rejects %p', (texto) => {
    expect(parseDuracaoMinutos(texto)).toEqual({
      erro: 'Informe uma duração entre 1 e 1440 minutos',
    });
  });
});

describe('mesCorrenteSaoPaulo', () => {
  it('uses the São Paulo time zone', () => {
    expect(mesCorrenteSaoPaulo(new Date('2026-11-01T02:00:00Z'))).toBe('2026-10');
    expect(mesCorrenteSaoPaulo(new Date('2026-10-15T12:00:00Z'))).toBe('2026-10');
  });
});

describe('formatarMesReferencia', () => {
  it('formats the month in Portuguese', () => {
    expect(formatarMesReferencia('2026-10')).toBe('outubro/2026');
  });
});

describe('calcularProdutosRennova', () => {
  it('includes products with any Rennova lot after normalization', () => {
    const rennova = calcularProdutosRennova([
      lote({ codigo_produto: 'A', brand: 'Rennova' }),
      lote({ codigo_produto: 'B', brand: ' rennova ' }),
      lote({ codigo_produto: 'C', brand: 'Marca X' }),
      lote({ codigo_produto: 'D' }),
      lote({ codigo_produto: 'E', brand: 'Rennova' }),
      lote({ codigo_produto: 'E' }),
    ]);
    expect(Array.from(rennova).sort()).toEqual(['A', 'B', 'E']);
  });
});

describe('separarMaterialParaConsultor', () => {
  const custos = new Map([
    ['9990001', { custoMedio: 115, criterio: 'estoque_atual' as const }],
    ['9990003', { custoMedio: 50, criterio: 'estoque_atual' as const }],
  ]);
  const rennova = new Set(['9990001', '9990004']);

  it('aggregates non-Rennova items as other materials (P3)', () => {
    const material = calcularCustoMaterialProtocolo(
      [
        { codigo_produto: '9990001', nome_produto: 'Rennova A', quantidade_sugerida: 1 },
        { codigo_produto: '9990003', nome_produto: 'Material Terceiro', quantidade_sugerida: 2 },
      ],
      custos
    );
    const visao = separarMaterialParaConsultor(material, rennova);
    expect(visao.total).toBe(215);
    expect(visao.itensRennova.map((i) => i.codigo_produto)).toEqual(['9990001']);
    expect(visao.outrosMateriais).toEqual({ subtotal: 100, quantidadeItens: 1, incompleto: false });
  });

  it('has no other materials when every item is Rennova', () => {
    const material = calcularCustoMaterialProtocolo(
      [{ codigo_produto: '9990001', nome_produto: 'Rennova A', quantidade_sugerida: 1 }],
      custos
    );
    expect(separarMaterialParaConsultor(material, rennova).outrosMateriais).toBeNull();
  });

  it('never names a non-Rennova item without cost', () => {
    const material = calcularCustoMaterialProtocolo(
      [{ codigo_produto: '9990009', nome_produto: 'Sem custo', quantidade_sugerida: 1 }],
      custos
    );
    const visao = separarMaterialParaConsultor(material, rennova);
    expect(visao.outrosMateriais?.incompleto).toBe(true);
    expect(visao.incompletoRennova).not.toContain('9990009');
  });

  it('names a Rennova item without cost', () => {
    const material = calcularCustoMaterialProtocolo(
      [{ codigo_produto: '9990004', nome_produto: 'Rennova sem custo', quantidade_sugerida: 1 }],
      custos
    );
    expect(separarMaterialParaConsultor(material, rennova).incompletoRennova).toEqual(['9990004']);
  });
});

describe('extrairConfigInput', () => {
  it('drops tenant and write metadata', () => {
    const input = extrairConfigInput(configOficial());
    expect(input).not.toHaveProperty('tenant_id');
    expect(input.custos_fixos_base.aluguel).toBe(30000);
    expect(input.disponibilidade.seg).toEqual(diaUtil);
  });
});

describe('validarCustoHoraConfig', () => {
  it('has no errors for the official example', () => {
    expect(validarCustoHoraConfig(extrairConfigInput(configOficial())).total).toBe(0);
  });

  it('collects errors per section', () => {
    const input = extrairConfigInput(configOficial());
    input.disponibilidade.dom = { ativo: true, periodos: [] };
    input.custos_fixos_personalizados = [{ id: 'p1', nome: '  ', valor: 10 }];
    input.boletos_tec = [boleto({ id: 'b1', parcelas_pagas: 30 })];
    input.quantidade_salas = 0;
    input.markup = {
      imposto_pct: 50,
      debito_pct: 50,
      credito_pct: 50,
      comissao_pct: 0,
      margem_pct: 0,
    };
    input.custos_fixos_base.energia = -1;

    const erros = validarCustoHoraConfig(input);
    expect(erros.dias).toEqual({ dom: 'Dia ativo sem períodos' });
    expect(erros.personalizados).toEqual({ p1: 'Informe um nome (até 60 caracteres)' });
    expect(erros.boletos).toEqual({ b1: 'Parcelas pagas deve estar entre 0 e o total' });
    expect(erros.capacidade).toBe('Salas e profissionais devem ser inteiros ≥ 1');
    expect(erros.markup).toBe('A soma dos percentuais deve ser menor que 100%');
    expect(erros.base).toBe('Os valores não podem ser negativos');
    expect(erros.total).toBe(6);
  });

  it.each([
    [{ descricao: '' }, 'Informe a descrição'],
    [{ valor_parcela: 0 }, 'Informe o valor da parcela'],
    [{ total_parcelas: 0 }, 'Total de parcelas deve ser um inteiro ≥ 1'],
    [{ parcelas_pagas: 1.5 }, 'Parcelas pagas deve estar entre 0 e o total'],
  ])('validates a Boleto Tec field (%p)', (overrides, mensagem) => {
    const input = extrairConfigInput(configOficial());
    input.boletos_tec = [boleto({ id: 'b1', ...overrides })];
    expect(validarCustoHoraConfig(input).boletos.b1).toBe(mensagem);
  });
});

describe('forma de pagamento (RN-19, RN-20, RN-21)', () => {
  const markup = { imposto_pct: 6, debito_pct: 2, credito_pct: 4, comissao_pct: 0, margem_pct: 30 };

  it('parses known payment methods and defaults the rest to Pix/Dinheiro', () => {
    expect(parseFormaPagamento('debito')).toBe('debito');
    expect(parseFormaPagamento('credito')).toBe('credito');
    expect(parseFormaPagamento('pix_dinheiro')).toBe('pix_dinheiro');
    expect(parseFormaPagamento(undefined)).toBe('pix_dinheiro');
    expect(parseFormaPagamento('boleto')).toBe('pix_dinheiro');
  });

  it('charges no card fee on Pix/Dinheiro', () => {
    expect(taxaPagamentoPct(markup, 'pix_dinheiro')).toBe(0);
    expect(taxaPagamentoPct(markup, 'debito')).toBe(2);
    expect(taxaPagamentoPct(markup, 'credito')).toBe(4);
  });

  it('computes one divisor per payment method', () => {
    const divisores = calcularDivisoresMarkup(markup);
    expect(divisores.pix_dinheiro).toBeCloseTo(0.64, 6);
    expect(divisores.debito).toBeCloseTo(0.62, 6);
    expect(divisores.credito).toBeCloseTo(0.6, 6);
  });

  it('prices the official example for each payment method', () => {
    const custoReal = 30000 / 196 + 800;
    const precos = calcularPrecosPorForma(custoReal, calcularDivisoresMarkup(markup));
    expect(precos.pix_dinheiro).toBeCloseTo(1489.16, 2);
    expect(precos.debito).toBeCloseTo(1537.2, 2);
    expect(precos.credito).toBeCloseTo(1588.44, 2);
    expect(calcularPrecosPorForma(null, calcularDivisoresMarkup(markup))).toEqual({
      pix_dinheiro: null,
      debito: null,
      credito: null,
    });
  });

  it('validates the sum with the most expensive card fee', () => {
    const caro = { ...markup, credito_pct: 64 };
    expect(somaMarkupMaisCara(caro)).toBe(100);
    expect(validarParametrosMarkup(caro)).toBe('A soma dos percentuais deve ser menor que 100%');
    expect(calcularDivisoresMarkup(caro)).toEqual({
      pix_dinheiro: null,
      debito: null,
      credito: null,
    });
    expect(validarParametrosMarkup({ ...markup, debito_pct: -1 })).toBe(
      'Percentuais não podem ser negativos'
    );
  });

  it('reads the v1.2 single card fee as both debit and credit', () => {
    expect(
      normalizarParametrosMarkup({ imposto_pct: 6, cartao_pct: 3, comissao_pct: 0, margem_pct: 30 })
    ).toEqual({ imposto_pct: 6, debito_pct: 3, credito_pct: 3, comissao_pct: 0, margem_pct: 30 });
  });

  it('keeps current fields and drops the legacy one', () => {
    const normalizado = normalizarParametrosMarkup({ ...markup, cartao_pct: 9 });
    expect(normalizado).toEqual(markup);
    expect(normalizado).not.toHaveProperty('cartao_pct');
  });

  it('turns missing or invalid fields into zero', () => {
    expect(normalizarParametrosMarkup(undefined)).toEqual({
      imposto_pct: 0,
      debito_pct: 0,
      credito_pct: 0,
      comissao_pct: 0,
      margem_pct: 0,
    });
    expect(normalizarParametrosMarkup({ imposto_pct: 'x', margem_pct: NaN }).imposto_pct).toBe(0);
  });

  it('normalizes the markup of a stored config without touching other fields', () => {
    const config = { ...configOficial(), markup: { imposto_pct: 6, cartao_pct: 3 } as unknown };
    const normalizada = normalizarCustoHoraConfig(config);
    expect(normalizada.markup.credito_pct).toBe(3);
    expect(normalizada.custos_fixos_base.aluguel).toBe(30000);
  });

  it('applies the hourly cost only with a positive duration', () => {
    expect(calcularCustoHoraAplicado(120, 30)).toBe(60);
    expect(calcularCustoHoraAplicado(120, 0)).toBeNull();
    expect(calcularCustoHoraAplicado(120, null)).toBeNull();
    expect(calcularCustoHoraAplicado(null, 60)).toBeNull();
  });
});

describe('procedimento (RN-22 a RN-24, RN-31, D11 a D13)', () => {
  const markup = { imposto_pct: 6, debito_pct: 2, credito_pct: 4, comissao_pct: 0, margem_pct: 30 };
  const configProc = () => ({ ...configOficial(), markup: { ...markup } });
  const produtos200 = [{ quantidade: 2, valor_unitario: 100 }];

  const snapshot = (overrides: Partial<Parameters<typeof montarSnapshotPrecificacao>[0]> = {}) =>
    montarSnapshotPrecificacao({
      tenantId: 'clinic_a',
      solicitacaoId: 's1',
      config: configProc(),
      mesReferencia: '2026-10',
      duracao: { minutos: 60, origem: 'protocolo' },
      formaPagamento: 'credito',
      produtos: produtos200,
      origem: 'criacao',
      ...overrides,
    });

  describe('resolverDuracaoProcedimento', () => {
    it('always prefers the duration typed in the procedure', () => {
      expect(
        resolverDuracaoProcedimento({
          duracaoInformada: 45,
          protocoloAplicado: { duracao_minutos: 60 },
        })
      ).toEqual({ minutos: 45, origem: 'informada' });
      expect(resolverDuracaoProcedimento({ duracaoInformada: 45, protocoloAplicado: {} })).toEqual({
        minutos: 45,
        origem: 'informada',
      });
    });

    it('uses the protocol duration when nothing is typed', () => {
      expect(
        resolverDuracaoProcedimento({
          duracaoInformada: null,
          protocoloAplicado: { duracao_minutos: 30 },
        })
      ).toEqual({ minutos: 30, origem: 'protocolo' });
    });

    it.each([{}, { duracao_minutos: 0 }, null])(
      'falls back to one hour otherwise (%p)',
      (protocoloAplicado) => {
        expect(resolverDuracaoProcedimento({ duracaoInformada: null, protocoloAplicado })).toEqual({
          minutos: 60,
          origem: 'padrao',
        });
      }
    );
  });

  describe('mesReferenciaDoProcedimento', () => {
    it('reads the month of the procedure date', () => {
      expect(mesReferenciaDoProcedimento('2026-10-20')).toBe('2026-10');
      expect(mesReferenciaDoProcedimento('2026-11-01')).toBe('2026-11');
    });

    it('keeps the 1st in its own month for dates stored at UTC midnight', () => {
      expect(mesReferenciaDoProcedimento(new Date('2026-11-01'))).toBe('2026-11');
      expect(mesReferenciaDoProcedimento(new Date('2026-10-31T00:00:00Z'))).toBe('2026-10');
    });
  });

  describe('calcularCustoMaterialSolicitacao', () => {
    it('sums the lots actually used', () => {
      expect(
        calcularCustoMaterialSolicitacao([
          { quantidade: 2, valor_unitario: 100 },
          { quantidade: 1, valor_unitario: 0 },
        ])
      ).toEqual({ total: 200, incompleto: false });
    });

    it('flags lots without a valid unit value', () => {
      expect(
        calcularCustoMaterialSolicitacao([
          { quantidade: 2, valor_unitario: 100 },
          { quantidade: 1, valor_unitario: undefined },
        ])
      ).toEqual({ total: 200, incompleto: true });
    });
  });

  describe('calcularPrecificacaoProcedimento', () => {
    it('prices the official example for the three payment methods', () => {
      const calculo = calcularPrecificacaoProcedimento({
        duracaoMinutos: 60,
        custoHora: 30000 / 196,
        divisores: calcularDivisoresMarkup(markup),
        custoMaterial: { total: 800, incompleto: false },
      });
      expect(calculo.custoReal).toBeCloseTo(953.06, 2);
      expect(calculo.precos.pix_dinheiro).toBeCloseTo(1489.16, 2);
      expect(calculo.precos.debito).toBeCloseTo(1537.2, 2);
      expect(calculo.precos.credito).toBeCloseTo(1588.44, 2);
    });

    it('uses the November hours for a November procedure', () => {
      const calculo = calcularPrecificacaoProcedimento({
        duracaoMinutos: 60,
        custoHora: 30000 / 184,
        divisores: calcularDivisoresMarkup(markup),
        custoMaterial: { total: 800, incompleto: false },
      });
      expect(calculo.custoReal).toBeCloseTo(963.04, 2);
      expect(calculo.precos.pix_dinheiro).toBeCloseTo(1504.76, 2);
      expect(calculo.precos.debito).toBeCloseTo(1553.3, 2);
      expect(calculo.precos.credito).toBeCloseTo(1605.07, 2);
    });

    it('applies 45 minutes proportionally', () => {
      const calculo = calcularPrecificacaoProcedimento({
        duracaoMinutos: 45,
        custoHora: 30000 / 196,
        divisores: calcularDivisoresMarkup(markup),
        custoMaterial: { total: 200, incompleto: false },
      });
      expect(calculo.custoReal).toBeCloseTo(314.8, 2);
      expect(calculo.precos.pix_dinheiro).toBeCloseTo(491.87, 2);
      expect(calculo.precos.credito).toBeCloseTo(524.66, 2);
    });
  });

  describe('montarSnapshotPrecificacao', () => {
    it('records the October procedure with the three prices', () => {
      const s = snapshot();
      expect(s.mes_referencia).toBe('2026-10');
      expect(s.custo_hora).toBeCloseTo(153.0612, 4);
      expect(s.duracao_minutos).toBe(60);
      expect(s.duracao_origem).toBe('protocolo');
      expect(s.custo_material).toBe(200);
      expect(s.custo_material_incompleto).toBe(false);
      expect(s.custo_real).toBeCloseTo(353.0612, 4);
      expect(s.divisores.pix_dinheiro).toBeCloseTo(0.64, 6);
      expect(s.divisores.debito).toBeCloseTo(0.62, 6);
      expect(s.divisores.credito).toBeCloseTo(0.6, 6);
      expect(s.precos_sugeridos.pix_dinheiro).toBeCloseTo(551.66, 2);
      expect(s.precos_sugeridos.debito).toBeCloseTo(569.45, 2);
      expect(s.precos_sugeridos.credito).toBeCloseTo(588.44, 2);
      expect(s.markup).toEqual(markup);
      expect(s.forma_pagamento).toBe('credito');
      expect(s).toMatchObject({ tenant_id: 'clinic_a', solicitacao_id: 's1', origem: 'criacao' });
    });

    it('does not change values with the payment method', () => {
      const credito = snapshot();
      for (const forma of ['pix_dinheiro', 'debito'] as const) {
        const outro = snapshot({ formaPagamento: forma });
        expect(outro.forma_pagamento).toBe(forma);
        expect(outro.precos_sugeridos).toEqual(credito.precos_sugeridos);
        expect(outro.divisores).toEqual(credito.divisores);
      }
    });

    it('uses the hours of the procedure month', () => {
      const s = snapshot({ mesReferencia: '2026-11' });
      expect(s.custo_hora).toBeCloseTo(163.0435, 4);
      expect(s.precos_sugeridos.pix_dinheiro).toBeCloseTo(567.26, 2);
      expect(s.precos_sugeridos.debito).toBeCloseTo(585.55, 2);
      expect(s.precos_sugeridos.credito).toBeCloseTo(605.07, 2);
    });

    it('records the one-hour default for a protocol without duration', () => {
      const s = snapshot({
        duracao: { minutos: 60, origem: 'padrao' },
        produtos: [{ quantidade: 1, valor_unitario: 100 }],
      });
      expect(s.duracao_origem).toBe('padrao');
      expect(s.precos_sugeridos.pix_dinheiro).toBeCloseTo(395.41, 2);
      expect(s.precos_sugeridos.debito).toBeCloseTo(408.16, 2);
      expect(s.precos_sugeridos.credito).toBeCloseTo(421.77, 2);
    });

    it('keeps the material but no price without availability', () => {
      const config = configProc();
      config.disponibilidade = criarConfigPadrao('t').disponibilidade;
      const s = snapshot({ config });
      expect(s.custo_hora).toBeNull();
      expect(s.custo_real).toBeNull();
      expect(s.custo_material).toBe(200);
      expect(s.precos_sugeridos).toEqual({ pix_dinheiro: null, debito: null, credito: null });
    });

    it('records no divisors nor prices with an invalid markup', () => {
      const config = configProc();
      config.markup = { ...markup, credito_pct: 70 };
      const s = snapshot({ config });
      expect(s.divisores).toEqual({ pix_dinheiro: null, debito: null, credito: null });
      expect(s.precos_sugeridos).toEqual({ pix_dinheiro: null, debito: null, credito: null });
      expect(s.custo_real).toBeCloseTo(353.0612, 4);
    });

    it('flags incomplete material', () => {
      expect(
        snapshot({ produtos: [{ quantidade: 1, valor_unitario: 'abc' }] }).custo_material_incompleto
      ).toBe(true);
    });
  });
});
