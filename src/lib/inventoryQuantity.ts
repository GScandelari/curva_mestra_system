/**
 * Cálculo puro de quantidade/valor de entrada no inventário (fragmentação).
 * Sem import de Firebase: usado pelo client, pelas rotas de confirmação de NF-e
 * (Admin SDK) e espelhado nas Cloud Functions.
 */

export interface CalcInventarioParams {
  quantidadeInformada: number; // embalagens (se fragmentável) ou unidades
  fragmentavel: boolean;
  unidadesPorEmbalagem?: number;
  valorInformado: number; // por embalagem (se fragmentável) ou por unidade
}

export interface CalcInventarioResult {
  quantidade_inicial: number; // sempre em unidades
  valor_unitario: number; // sempre por unidade
}

/**
 * Calcula quantidade_inicial e valor_unitario para entrada de inventário.
 * Para produtos fragmentáveis, converte embalagens → unidades e distribui o valor.
 * Para não fragmentáveis, retorna os valores informados sem alteração.
 */
export function calcularQuantidadeInventario(params: CalcInventarioParams): CalcInventarioResult {
  const { quantidadeInformada, fragmentavel, unidadesPorEmbalagem, valorInformado } = params;

  if (!fragmentavel || !unidadesPorEmbalagem) {
    return {
      quantidade_inicial: quantidadeInformada,
      valor_unitario: valorInformado,
    };
  }

  return {
    quantidade_inicial: quantidadeInformada * unidadesPorEmbalagem,
    valor_unitario: valorInformado / unidadesPorEmbalagem,
  };
}
