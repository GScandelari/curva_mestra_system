/**
 * Precificação pela Hora Clínica
 * Funções 100% puras (RNF-03 da FEAT-precificacao-hora-clinica) — sem nenhum
 * import de Firebase. Valores calculados nunca são persistidos (RNF-04):
 * dependem do mês corrente e são recalculados a cada leitura.
 */

import { normalizeBrand } from '@/lib/brandUtils';
import type {
  BoletoTec,
  CustoFixoBaseKey,
  CustoHoraConfig,
  DiaSemanaKey,
  DisponibilidadeDia,
  FormaPagamento,
  ParametrosMarkup,
  ProtocoloItem,
} from '@/types';

// ============================================================================
// CONSTANTES
// ============================================================================

export const CUSTOS_FIXOS_BASE: { key: CustoFixoBaseKey; label: string }[] = [
  { key: 'aluguel', label: 'Aluguel' },
  { key: 'condominio', label: 'Condomínio' },
  { key: 'iptu', label: 'IPTU' },
  { key: 'pro_labore', label: 'Pró-Labore' },
  { key: 'energia', label: 'Energia' },
  { key: 'salarios', label: 'Salários' },
  { key: 'tarifas_bancarias', label: 'Tarifas Bancárias' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'contabilidade', label: 'Contabilidade' },
  { key: 'manutencao_limpeza', label: 'Manutenção e Limpeza' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'sistema_agenda_prontuario', label: 'Sistema de Agenda e Prontuário' },
];

/** Índice do array = Date.getDay() */
export const DIAS_SEMANA: { key: DiaSemanaKey; label: string }[] = [
  { key: 'dom', label: 'Domingo' },
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
];

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export type CustoHoraConfigBase = Omit<CustoHoraConfig, 'created_at' | 'updated_at' | 'updated_by'>;

/** O que a tela edita: a configuração sem tenant nem metadados de gravação. */
export type CustoHoraConfigInput = Omit<CustoHoraConfigBase, 'tenant_id'>;

export function extrairConfigInput(config: CustoHoraConfigBase): CustoHoraConfigInput {
  return {
    custos_fixos_base: config.custos_fixos_base,
    custos_fixos_personalizados: config.custos_fixos_personalizados,
    boletos_tec: config.boletos_tec,
    disponibilidade: config.disponibilidade,
    quantidade_salas: config.quantidade_salas,
    quantidade_profissionais: config.quantidade_profissionais,
    markup: config.markup,
    compartilhar_com_consultor: config.compartilhar_com_consultor,
    compartilhado_com_consultant_id: config.compartilhado_com_consultant_id,
  };
}

export function criarConfigPadrao(tenantId: string): CustoHoraConfigBase {
  const custosBase = Object.fromEntries(CUSTOS_FIXOS_BASE.map(({ key }) => [key, 0])) as Record<
    CustoFixoBaseKey,
    number
  >;
  const disponibilidade = Object.fromEntries(
    DIAS_SEMANA.map(({ key }): [DiaSemanaKey, DisponibilidadeDia] => [
      key,
      { ativo: false, periodos: [] },
    ])
  ) as Record<DiaSemanaKey, DisponibilidadeDia>;

  return {
    tenant_id: tenantId,
    custos_fixos_base: custosBase,
    custos_fixos_personalizados: [],
    boletos_tec: [],
    disponibilidade,
    quantidade_salas: 1,
    quantidade_profissionais: 1,
    markup: { imposto_pct: 0, debito_pct: 0, credito_pct: 0, comissao_pct: 0, margem_pct: 0 },
    compartilhar_com_consultor: false,
    compartilhado_com_consultant_id: null,
  };
}

// ============================================================================
// TEMPO (RN-03)
// ============================================================================

/** Minutos desde 00:00 para 'HH:MM' (24h, dois dígitos cada); null se inválido. */
export function parseHorario(hhmm: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const horas = Number(match[1]);
  const minutos = Number(match[2]);
  if (horas > 23 || minutos > 59) return null;
  return horas * 60 + minutos;
}

/** null = válido. Períodos encostados (08–12 + 12–14) são válidos. */
export function validarPeriodosDia(dia: DisponibilidadeDia): string | null {
  if (!dia.ativo) return null;
  if (dia.periodos.length === 0) return 'Dia ativo sem períodos';

  const intervalos: { inicio: number; fim: number }[] = [];
  for (const periodo of dia.periodos) {
    const inicio = parseHorario(periodo.inicio);
    const fim = parseHorario(periodo.fim);
    if (inicio === null || fim === null) return 'Horário inválido';
    if (fim <= inicio) return 'O fim deve ser posterior ao início';
    intervalos.push({ inicio, fim });
  }

  intervalos.sort((a, b) => a.inicio - b.inicio);
  for (let i = 1; i < intervalos.length; i++) {
    if (intervalos[i].inicio < intervalos[i - 1].fim) return 'Períodos sobrepostos';
  }
  return null;
}

/** Horas do dia; períodos inválidos não contam. 0 se inativo. */
export function calcularHorasDia(dia: DisponibilidadeDia): number {
  if (!dia.ativo) return 0;
  return dia.periodos.reduce((total, periodo) => {
    const inicio = parseHorario(periodo.inicio);
    const fim = parseHorario(periodo.fim);
    if (inicio === null || fim === null || fim <= inicio) return total;
    return total + (fim - inicio) / 60;
  }, 0);
}

export function contarOcorrenciasDiaSemanaNoMes(
  ano: number,
  mes: number
): Record<DiaSemanaKey, number> {
  const contagem = Object.fromEntries(DIAS_SEMANA.map(({ key }) => [key, 0])) as Record<
    DiaSemanaKey,
    number
  >;
  const diasNoMes = new Date(ano, mes, 0).getDate();
  for (let dia = 1; dia <= diasNoMes; dia++) {
    contagem[DIAS_SEMANA[new Date(ano, mes - 1, dia).getDay()].key] += 1;
  }
  return contagem;
}

export function calcularHorasMes(
  disponibilidade: Record<DiaSemanaKey, DisponibilidadeDia>,
  ano: number,
  mes: number
): number {
  const ocorrencias = contarOcorrenciasDiaSemanaNoMes(ano, mes);
  return DIAS_SEMANA.reduce((total, { key }) => {
    const dia = disponibilidade[key];
    return dia ? total + ocorrencias[key] * calcularHorasDia(dia) : total;
  }, 0);
}

// ============================================================================
// BOLETO TEC (RN-02)
// ============================================================================

function parseMes(yyyyMM: string): { ano: number; mes: number } {
  const [ano, mes] = yyyyMM.split('-').map(Number);
  return { ano, mes };
}

/** Diferença em meses de `de` até `ate` (negativa se `ate` for anterior). */
export function mesesEntre(deYYYYMM: string, ateYYYYMM: string): number {
  const de = parseMes(deYYYYMM);
  const ate = parseMes(ateYYYYMM);
  return (ate.ano - de.ano) * 12 + (ate.mes - de.mes);
}

export function calcularParcelasRestantes(boleto: BoletoTec, mesCalculo: string): number {
  const mesesDecorridos = Math.max(0, mesesEntre(boleto.mes_referencia, mesCalculo));
  return Math.max(0, boleto.total_parcelas - boleto.parcelas_pagas - mesesDecorridos);
}

/** Parcelas pagas até `mesCalculo`, contando o avanço automático (para exibição). */
export function calcularParcelasPagasNoMes(boleto: BoletoTec, mesCalculo: string): number {
  return boleto.total_parcelas - calcularParcelasRestantes(boleto, mesCalculo);
}

export function boletoCompoeCusto(boleto: BoletoTec, mesCalculo: string): boolean {
  return calcularParcelasRestantes(boleto, mesCalculo) > 0;
}

// ============================================================================
// CUSTOS (RN-01, RN-05, RN-07)
// ============================================================================

export interface CustoFixoMensal {
  base: number;
  personalizados: number;
  boletos: number;
  total: number;
}

function valorOuZero(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : 0;
}

export function calcularCustoFixoMensal(
  config: Pick<
    CustoHoraConfig,
    'custos_fixos_base' | 'custos_fixos_personalizados' | 'boletos_tec'
  >,
  mesCalculo: string
): CustoFixoMensal {
  const base = Object.values(config.custos_fixos_base ?? {}).reduce<number>(
    (sum, valor) => sum + valorOuZero(valor),
    0
  );
  const personalizados = (config.custos_fixos_personalizados ?? []).reduce(
    (sum, item) => sum + valorOuZero(item.valor),
    0
  );
  const boletos = (config.boletos_tec ?? [])
    .filter((boleto) => boletoCompoeCusto(boleto, mesCalculo))
    .reduce((sum, boleto) => sum + valorOuZero(boleto.valor_parcela), 0);

  return { base, personalizados, boletos, total: base + personalizados + boletos };
}

export function calcularCapacidadeSimultanea(salas: number, profissionais: number): number {
  return Math.min(salas, profissionais);
}

/** null quando não há horas disponíveis (divisão por zero). */
export function calcularCustoHora(
  custoFixoMensal: number,
  horasMes: number,
  capacidade: number
): number | null {
  const horasCapacidade = horasMes * capacidade;
  if (!Number.isFinite(horasCapacidade) || horasCapacidade <= 0) return null;
  return custoFixoMensal / horasCapacidade;
}

// ============================================================================
// MARKUP E FORMA DE PAGAMENTO (RN-19, RN-20, RN-21)
// ============================================================================

export const FORMAS_PAGAMENTO: { key: FormaPagamento; label: string }[] = [
  { key: 'pix_dinheiro', label: 'Pix/Dinheiro' },
  { key: 'debito', label: 'Débito' },
  { key: 'credito', label: 'Crédito' },
];

/** Valor desconhecido/legado → 'pix_dinheiro' (RN-25). */
export function parseFormaPagamento(valor: unknown): FormaPagamento {
  return FORMAS_PAGAMENTO.some(({ key }) => key === valor)
    ? (valor as FormaPagamento)
    : 'pix_dinheiro';
}

function numeroFinito(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

/**
 * RN-21: aceita o markup da v1.2 (`cartao_pct` único) ou o atual. Sem débito/
 * crédito válidos, ambos assumem `cartao_pct`; o resto inválido vira 0. Devolve
 * só os 5 campos atuais, então o próximo "Salvar" remove `cartao_pct`.
 */
export function normalizarParametrosMarkup(markup: unknown): ParametrosMarkup {
  const m = (markup ?? {}) as Record<string, unknown>;
  const cartao = numeroFinito(m.cartao_pct) ?? 0;
  return {
    imposto_pct: numeroFinito(m.imposto_pct) ?? 0,
    debito_pct: numeroFinito(m.debito_pct) ?? cartao,
    credito_pct: numeroFinito(m.credito_pct) ?? cartao,
    comissao_pct: numeroFinito(m.comissao_pct) ?? 0,
    margem_pct: numeroFinito(m.margem_pct) ?? 0,
  };
}

export function normalizarCustoHoraConfig<T extends { markup: unknown }>(
  config: T
): Omit<T, 'markup'> & { markup: ParametrosMarkup } {
  return { ...config, markup: normalizarParametrosMarkup(config.markup) };
}

/** Taxa de maquininha da forma: Pix/Dinheiro não paga taxa de cartão. */
export function taxaPagamentoPct(m: ParametrosMarkup, forma: FormaPagamento): number {
  if (forma === 'debito') return m.debito_pct;
  if (forma === 'credito') return m.credito_pct;
  return 0;
}

function somaMarkup(m: ParametrosMarkup, taxa: number): number {
  return m.imposto_pct + taxa + m.comissao_pct + m.margem_pct;
}

/** RN-20: a soma com a forma mais cara precisa ficar abaixo de 100%. */
export function validarParametrosMarkup(m: ParametrosMarkup): string | null {
  const valores = [m.imposto_pct, m.debito_pct, m.credito_pct, m.comissao_pct, m.margem_pct];
  if (valores.some((v) => !Number.isFinite(v))) return 'Informe percentuais válidos';
  if (valores.some((v) => v < 0)) return 'Percentuais não podem ser negativos';
  if (somaMarkupMaisCara(m) >= 100) return 'A soma dos percentuais deve ser menor que 100%';
  return null;
}

/** Soma exibida na aba: imposto + maior taxa de cartão + comissão + margem. */
export function somaMarkupMaisCara(m: ParametrosMarkup): number {
  return somaMarkup(m, Math.max(m.debito_pct, m.credito_pct));
}

/** RN-19; null se o markup for inválido. */
export function calcularDivisorPorFormaPagamento(
  m: ParametrosMarkup,
  forma: FormaPagamento
): number | null {
  if (validarParametrosMarkup(m) !== null) return null;
  return 1 - somaMarkup(m, taxaPagamentoPct(m, forma)) / 100;
}

export type ValoresPorForma = Record<FormaPagamento, number | null>;

export function calcularDivisoresMarkup(m: ParametrosMarkup): ValoresPorForma {
  return {
    pix_dinheiro: calcularDivisorPorFormaPagamento(m, 'pix_dinheiro'),
    debito: calcularDivisorPorFormaPagamento(m, 'debito'),
    credito: calcularDivisorPorFormaPagamento(m, 'credito'),
  };
}

/** Preço de cada forma = custo real ÷ divisor da forma. */
export function calcularPrecosPorForma(
  custoReal: number | null,
  divisores: ValoresPorForma
): ValoresPorForma {
  const preco = (divisor: number | null) =>
    custoReal !== null && divisor !== null ? custoReal / divisor : null;
  return {
    pix_dinheiro: preco(divisores.pix_dinheiro),
    debito: preco(divisores.debito),
    credito: preco(divisores.credito),
  };
}

// ============================================================================
// VALIDAÇÃO DO FORMULÁRIO (RF-06, RF-07, RF-08)
// ============================================================================

function isInteiro(n: number, min: number, max = Number.MAX_SAFE_INTEGER): boolean {
  return Number.isInteger(n) && n >= min && n <= max;
}

function validarCustoPersonalizado(
  item: CustoHoraConfigInput['custos_fixos_personalizados'][number]
): string | null {
  const nome = item.nome.trim();
  if (nome.length === 0 || nome.length > 60) return 'Informe um nome (até 60 caracteres)';
  if (item.valor < 0) return 'O valor não pode ser negativo';
  return null;
}

function validarBoleto(boleto: BoletoTec): string | null {
  if (boleto.descricao.trim() === '') return 'Informe a descrição';
  if (!Number.isFinite(boleto.valor_parcela) || boleto.valor_parcela <= 0) {
    return 'Informe o valor da parcela';
  }
  if (!isInteiro(boleto.total_parcelas, 1)) return 'Total de parcelas deve ser um inteiro ≥ 1';
  if (!isInteiro(boleto.parcelas_pagas, 0, boleto.total_parcelas)) {
    return 'Parcelas pagas deve estar entre 0 e o total';
  }
  return null;
}

function coletarErros<T>(
  itens: T[],
  chave: (item: T) => string,
  validar: (item: T) => string | null
): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const item of itens) {
    const erro = validar(item);
    if (erro) erros[chave(item)] = erro;
  }
  return erros;
}

export interface ErrosCustoHoraConfig {
  dias: Partial<Record<DiaSemanaKey, string>>;
  personalizados: Record<string, string>;
  boletos: Record<string, string>;
  capacidade: string | null;
  markup: string | null;
  base: string | null;
  total: number;
}

export function validarCustoHoraConfig(input: CustoHoraConfigInput): ErrosCustoHoraConfig {
  const dias = coletarErros(
    DIAS_SEMANA,
    ({ key }) => key,
    ({ key }) => validarPeriodosDia(input.disponibilidade[key])
  ) as Partial<Record<DiaSemanaKey, string>>;
  const personalizados = coletarErros(
    input.custos_fixos_personalizados,
    (item) => item.id,
    validarCustoPersonalizado
  );
  const boletos = coletarErros(input.boletos_tec, (boleto) => boleto.id, validarBoleto);
  const capacidadeValida =
    isInteiro(input.quantidade_salas, 1) && isInteiro(input.quantidade_profissionais, 1);
  const capacidade = capacidadeValida ? null : 'Salas e profissionais devem ser inteiros ≥ 1';
  const markup = validarParametrosMarkup(input.markup);
  const base = Object.values(input.custos_fixos_base).some((v) => v < 0)
    ? 'Os valores não podem ser negativos'
    : null;

  const total =
    Object.keys(dias).length +
    Object.keys(personalizados).length +
    Object.keys(boletos).length +
    [capacidade, markup, base].filter(Boolean).length;

  return { dias, personalizados, boletos, capacidade, markup, base, total };
}

// ============================================================================
// RESUMO (RF-09)
// ============================================================================

export interface ResumoCustoHora {
  mesReferencia: string;
  custoFixo: CustoFixoMensal;
  horasMes: number;
  capacidade: number;
  custoHora: number | null;
  divisores: ValoresPorForma;
}

export function calcularResumoCustoHora(
  config: CustoHoraConfigBase,
  mesCalculo: string
): ResumoCustoHora {
  const { ano, mes } = parseMes(mesCalculo);
  const custoFixo = calcularCustoFixoMensal(config, mesCalculo);
  const horasMes = calcularHorasMes(config.disponibilidade, ano, mes);
  const capacidade = calcularCapacidadeSimultanea(
    config.quantidade_salas,
    config.quantidade_profissionais
  );

  return {
    mesReferencia: mesCalculo,
    custoFixo,
    horasMes,
    capacidade,
    custoHora: calcularCustoHora(custoFixo.total, horasMes, capacidade),
    divisores: calcularDivisoresMarkup(config.markup),
  };
}

// ============================================================================
// MATERIAL (RN-09, RN-10)
// ============================================================================

export interface LoteParaCusto {
  codigo_produto: string;
  valor_unitario: unknown; // validado internamente
  quantidade_disponivel: number;
  quantidade_inicial: number;
  active?: boolean;
  brand?: string;
}

export interface CustoMedioProduto {
  custoMedio: number;
  criterio: 'estoque_atual' | 'historico';
}

function valorUnitarioValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0;
}

function mediaPonderada(
  lotes: LoteParaCusto[],
  peso: (lote: LoteParaCusto) => number
): number | null {
  let somaPesos = 0;
  let somaValores = 0;
  for (const lote of lotes) {
    const p = peso(lote);
    somaPesos += p;
    somaValores += p * (lote.valor_unitario as number);
  }
  return somaPesos > 0 ? somaValores / somaPesos : null;
}

/**
 * (a) média ponderada por quantidade_disponivel dos lotes ativos com saldo;
 * (b) senão, ponderada por quantidade_inicial de todos os lotes;
 * (c) senão, o produto fica fora do Map ("sem custo").
 */
export function calcularCustoMedioPorProduto(
  lotes: LoteParaCusto[]
): Map<string, CustoMedioProduto> {
  const porProduto = new Map<string, LoteParaCusto[]>();
  for (const lote of lotes) {
    if (!valorUnitarioValido(lote.valor_unitario)) continue;
    const grupo = porProduto.get(lote.codigo_produto) ?? [];
    grupo.push(lote);
    porProduto.set(lote.codigo_produto, grupo);
  }

  const resultado = new Map<string, CustoMedioProduto>();
  porProduto.forEach((grupo, codigo) => {
    const emEstoque = grupo.filter(
      (lote) => lote.active !== false && lote.quantidade_disponivel > 0
    );
    const atual = mediaPonderada(emEstoque, (lote) => lote.quantidade_disponivel);
    if (atual !== null) {
      resultado.set(codigo, { custoMedio: atual, criterio: 'estoque_atual' });
      return;
    }

    const comEntrada = grupo.filter((lote) => lote.quantidade_inicial > 0);
    const historico = mediaPonderada(comEntrada, (lote) => lote.quantidade_inicial);
    if (historico !== null) {
      resultado.set(codigo, { custoMedio: historico, criterio: 'historico' });
    }
  });

  return resultado;
}

export interface ItemCustoMaterial {
  codigo_produto: string;
  nome_produto: string;
  quantidade: number;
  custoUnitario: number | null;
  subtotal: number | null;
}

export interface CustoMaterialProtocolo {
  total: number; // soma só dos itens com custo
  incompleto: boolean;
  codigosSemCusto: string[];
  itens: ItemCustoMaterial[];
}

export function calcularCustoMaterialProtocolo(
  itens: ProtocoloItem[],
  custos: Map<string, CustoMedioProduto>
): CustoMaterialProtocolo {
  const codigosSemCusto: string[] = [];
  let total = 0;

  const itensCusto = itens.map((item) => {
    const custo = custos.get(item.codigo_produto);
    if (!custo) {
      codigosSemCusto.push(item.codigo_produto);
      return {
        codigo_produto: item.codigo_produto,
        nome_produto: item.nome_produto,
        quantidade: item.quantidade_sugerida,
        custoUnitario: null,
        subtotal: null,
      };
    }
    const subtotal = item.quantidade_sugerida * custo.custoMedio;
    total += subtotal;
    return {
      codigo_produto: item.codigo_produto,
      nome_produto: item.nome_produto,
      quantidade: item.quantidade_sugerida,
      custoUnitario: custo.custoMedio,
      subtotal,
    };
  });

  return { total, incompleto: codigosSemCusto.length > 0, codigosSemCusto, itens: itensCusto };
}

// ============================================================================
// PRECIFICAÇÃO FINAL (RN-11)
// ============================================================================

export interface PrecificacaoProtocolo {
  custoMaterial: CustoMaterialProtocolo;
  custoHoraAplicado: number | null;
  custoReal: number | null;
  precosSugeridos: ValoresPorForma;
  duracaoConsiderada: number;
  /** true quando o protocolo não tem duração e vale a hora cheia (D11). */
  duracaoPadrao: boolean;
}

/** D11: sem duração informada, o procedimento vale uma hora cheia. */
export const DURACAO_PADRAO_MINUTOS = 60;

function duracaoValida(minutos: unknown): minutos is number {
  return typeof minutos === 'number' && Number.isFinite(minutos) && minutos > 0;
}

/** null se não houver duração (> 0) ou custo/hora. */
export function calcularCustoHoraAplicado(
  custoHora: number | null,
  duracaoMinutos?: number | null
): number | null {
  if (custoHora === null || typeof duracaoMinutos !== 'number' || duracaoMinutos <= 0) {
    return null;
  }
  return (custoHora * duracaoMinutos) / 60;
}

export function calcularPrecificacaoProtocolo(params: {
  duracaoMinutos?: number;
  custoHora: number | null;
  divisores: ValoresPorForma;
  custoMaterial: CustoMaterialProtocolo;
}): PrecificacaoProtocolo {
  const { duracaoMinutos, custoHora, divisores, custoMaterial } = params;
  const duracaoPadrao = !duracaoValida(duracaoMinutos);
  const duracaoConsiderada = duracaoPadrao ? DURACAO_PADRAO_MINUTOS : duracaoMinutos;
  const custoHoraAplicado = calcularCustoHoraAplicado(custoHora, duracaoConsiderada);
  const custoReal = custoHoraAplicado !== null ? custoHoraAplicado + custoMaterial.total : null;

  return {
    custoMaterial,
    custoHoraAplicado,
    custoReal,
    precosSugeridos: calcularPrecosPorForma(custoReal, divisores),
    duracaoConsiderada,
    duracaoPadrao,
  };
}

/**
 * RN-15: duração do protocolo vinda do formulário. Vazio = sem duração
 * (`valor: null`); preenchido precisa ser inteiro entre 1 e 1440 minutos.
 */
export function parseDuracaoMinutos(texto: string): { valor: number | null } | { erro: string } {
  const limpo = texto.trim();
  if (limpo === '') return { valor: null };
  const n = Number(limpo);
  if (!Number.isInteger(n) || n < 1 || n > 1440) {
    return { erro: 'Informe uma duração entre 1 e 1440 minutos' };
  }
  return { valor: n };
}

// ============================================================================
// VISÃO DO CONSULTOR (RN-17 / D5)
// ============================================================================

export function calcularProdutosRennova(lotes: LoteParaCusto[]): Set<string> {
  const rennova = new Set<string>();
  for (const lote of lotes) {
    if (lote.brand && normalizeBrand(lote.brand) === 'Rennova') {
      rennova.add(lote.codigo_produto);
    }
  }
  return rennova;
}

export interface CustoMaterialConsultor {
  total: number;
  itensRennova: ItemCustoMaterial[];
  outrosMateriais: { subtotal: number; quantidadeItens: number; incompleto: boolean } | null;
  incompletoRennova: string[];
}

export function separarMaterialParaConsultor(
  material: CustoMaterialProtocolo,
  rennova: Set<string>
): CustoMaterialConsultor {
  const itensRennova = material.itens.filter((item) => rennova.has(item.codigo_produto));
  const outros = material.itens.filter((item) => !rennova.has(item.codigo_produto));

  return {
    total: material.total,
    itensRennova,
    outrosMateriais:
      outros.length > 0
        ? {
            subtotal: outros.reduce((sum, item) => sum + (item.subtotal ?? 0), 0),
            quantidadeItens: outros.length,
            incompleto: outros.some((item) => item.subtotal === null),
          }
        : null,
    incompletoRennova: itensRennova
      .filter((item) => item.subtotal === null)
      .map((item) => item.codigo_produto),
  };
}

// ============================================================================
// MÊS CORRENTE (RN-04)
// ============================================================================

export function mesCorrenteSaoPaulo(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(agora);
  const ano = partes.find((p) => p.type === 'year')?.value;
  const mes = partes.find((p) => p.type === 'month')?.value;
  return `${ano}-${mes}`;
}

export function formatarMesReferencia(yyyyMM: string): string {
  const { ano, mes } = parseMes(yyyyMM);
  return `${MESES[mes - 1]}/${ano}`;
}
