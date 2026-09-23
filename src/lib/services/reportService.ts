/**
 * Report Service
 * Serviço centralizado para geração de relatórios
 */

import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { InventoryItem } from '@/types';
import { getInventoryItem } from '@/lib/services/inventoryService';
import {
  getConsumptionRecords,
  getProductCostMetadata,
  groupConsumptionByProduct,
  buildLotHistory,
  calculateTicketMedioCusto,
  type ProductCostSummary,
  type LotHistoryEntry,
  type LotHistoryEvent,
} from '@/lib/services/costingService';

// ============================================================================
// TYPES
// ============================================================================

export interface StockValueReport {
  total_produtos: number;
  total_itens: number; // Soma de todas as quantidades
  valor_total: number;
  por_produto: {
    codigo: string;
    nome: string;
    quantidade_total: number;
    valor_unitario: number;
    valor_total: number;
    lotes: number; // Quantidade de lotes diferentes
  }[];
  gerado_em: Date;
}

export interface ExpirationReport {
  produtos_vencendo: {
    id: string;
    codigo: string;
    nome: string;
    lote: string;
    quantidade: number;
    dt_validade: string;
    dias_para_vencer: number;
    valor_total: number;
  }[];
  total_produtos: number;
  valor_em_risco: number;
  itens_ignorados: number; // Itens com dt_validade inválida/não interpretável, excluídos do relatório
  gerado_em: Date;
}

export interface ConsumptionReport {
  periodo: {
    inicio: Date;
    fim: Date;
  };
  total_procedimentos: number;
  total_produtos_consumidos: number;
  valor_total_consumido: number;
  por_produto: {
    codigo: string;
    nome: string;
    quantidade_consumida: number;
    valor_total: number;
    procedimentos: number; // Quantos procedimentos usaram este produto
  }[];
  gerado_em: Date;
}

export interface ProcedureCostReport {
  periodo: { inicio: Date; fim: Date };
  custo_total_periodo: number;
  ticket_medio_custo_geral: number;
  total_procedimentos_periodo: number;
  por_produto: ProductCostSummary[];
  gerado_em: Date;
}

export interface LotHistoryReport {
  inventory_item_id: string;
  codigo_produto: string;
  nome_produto: string;
  lote: string;
  quantidade_inicial: number;
  eventos: LotHistoryEntry[];
  gerado_em: Date;
}

// ============================================================================
// RELATÓRIO DE VALOR DO ESTOQUE
// ============================================================================

/**
 * Gera relatório de valor total do estoque
 */
export async function generateStockValueReport(tenantId: string): Promise<StockValueReport> {
  try {
    const inventoryRef = collection(db, 'tenants', tenantId, 'inventory');
    const q = query(inventoryRef, where('active', '==', true));
    const snapshot = await getDocs(q);

    let totalItens = 0;
    let valorTotal = 0;
    const produtosMap = new Map<string, any>();

    snapshot.forEach((doc) => {
      const data = doc.data() as InventoryItem;
      const quantidade = data.quantidade_disponivel || 0;
      const valorUnitario = data.valor_unitario || 0;
      const valorItem = quantidade * valorUnitario;

      totalItens += quantidade;
      valorTotal += valorItem;

      // Agrupar por código de produto
      const key = data.codigo_produto;
      if (!produtosMap.has(key)) {
        produtosMap.set(key, {
          codigo: data.codigo_produto,
          nome: data.nome_produto,
          quantidade_total: 0,
          valor_unitario: valorUnitario,
          valor_total: 0,
          lotes: 0,
        });
      }

      const produto = produtosMap.get(key);
      produto.quantidade_total += quantidade;
      produto.valor_total += valorItem;
      produto.lotes += 1;
    });

    const porProduto = Array.from(produtosMap.values()).sort(
      (a, b) => b.valor_total - a.valor_total
    );

    return {
      total_produtos: produtosMap.size,
      total_itens: totalItens,
      valor_total: valorTotal,
      por_produto: porProduto,
      gerado_em: new Date(),
    };
  } catch (error) {
    console.error('Erro ao gerar relatório de valor do estoque:', error);
    throw new Error('Falha ao gerar relatório');
  }
}

// ============================================================================
// RELATÓRIO DE PRODUTOS VENCENDO
// ============================================================================

/**
 * Gera relatório de produtos próximos ao vencimento
 */
export async function generateExpirationReport(
  tenantId: string,
  diasAntecedencia: number = 30
): Promise<ExpirationReport> {
  try {
    const inventoryRef = collection(db, 'tenants', tenantId, 'inventory');
    const q = query(inventoryRef, where('active', '==', true));
    const snapshot = await getDocs(q);

    const now = new Date();
    const limitDate = new Date();
    limitDate.setDate(now.getDate() + diasAntecedencia);

    const produtosVencendo: ExpirationReport['produtos_vencendo'] = [];
    let valorEmRisco = 0;
    let itensIgnorados = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();

      // Converter dt_validade para Date (pode ser Timestamp, Date ou string)
      let dtValidade: Date;
      if (data.dt_validade instanceof Timestamp) {
        dtValidade = data.dt_validade.toDate();
      } else if (data.dt_validade instanceof Date) {
        dtValidade = data.dt_validade;
      } else if (typeof data.dt_validade === 'string') {
        // Detectar formato da data e converter
        if (data.dt_validade.includes('/')) {
          // Formato DD/MM/YYYY
          const [dia, mes, ano] = data.dt_validade.split('/');
          dtValidade = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
        } else if (data.dt_validade.includes('-')) {
          // Formato YYYY-MM-DD (ISO)
          dtValidade = new Date(data.dt_validade);
        } else {
          console.warn(`[EXPIRATION REPORT] Formato de data desconhecido:`, data.dt_validade);
          itensIgnorados++;
          return;
        }
      } else {
        // Pular este produto se não conseguir converter a data
        console.warn(
          `[EXPIRATION REPORT] Data de validade inválida para produto ${doc.id}:`,
          data.dt_validade
        );
        itensIgnorados++;
        return;
      }

      // Datas ISO/DD-MM-YYYY sintaticamente aceitas pelo construtor Date, mas
      // com valores inválidos (ex: "2025-13-45"), viram Invalid Date -- sem isso,
      // o item seria descartado silenciosamente na comparação NaN <= limitDate.
      if (isNaN(dtValidade.getTime())) {
        console.warn(
          `[EXPIRATION REPORT] Data de validade inválida para produto ${doc.id}:`,
          data.dt_validade
        );
        itensIgnorados++;
        return;
      }

      const diasParaVencer = Math.ceil(
        (dtValidade.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const quantidade = data.quantidade_disponivel || 0;

      // Verificar se está dentro do período
      // Range: produtos vencidos até produtos que vencem nos próximos X dias
      // Exemplo: se hoje é 15/12/2025 e X=30, pega produtos vencidos + produtos que vencem até 14/01/2026
      if (dtValidade <= limitDate) {
        const valorTotal = quantidade * (data.valor_unitario || 0);

        if (quantidade > 0) {
          // Formatar data de volta para string DD/MM/YYYY
          const dtValidadeStr =
            typeof data.dt_validade === 'string'
              ? data.dt_validade
              : dtValidade.toLocaleDateString('pt-BR');

          produtosVencendo.push({
            id: doc.id,
            codigo: data.codigo_produto,
            nome: data.nome_produto,
            lote: data.lote,
            quantidade,
            dt_validade: dtValidadeStr,
            dias_para_vencer: diasParaVencer,
            valor_total: valorTotal,
          });

          valorEmRisco += valorTotal;
        }
      }
    });

    // Ordenar por dias para vencer (mais urgente primeiro)
    produtosVencendo.sort((a, b) => a.dias_para_vencer - b.dias_para_vencer);

    return {
      produtos_vencendo: produtosVencendo,
      total_produtos: produtosVencendo.length,
      valor_em_risco: valorEmRisco,
      itens_ignorados: itensIgnorados,
      gerado_em: new Date(),
    };
  } catch (error) {
    console.error('Erro ao gerar relatório de vencimento:', error);
    throw new Error('Falha ao gerar relatório');
  }
}

// ============================================================================
// RELATÓRIO DE CONSUMO POR PERÍODO
// ============================================================================

/**
 * Gera relatório de consumo por período
 */
export async function generateConsumptionReport(
  tenantId: string,
  dataInicio: Date,
  dataFim: Date
): Promise<ConsumptionReport> {
  try {
    const solicitacoesRef = collection(db, 'tenants', tenantId, 'solicitacoes');

    // Buscar procedimentos CONCLUÍDOS (produtos foram consumidos)
    // Status "concluida" = produtos efetivamente consumidos do estoque
    const q = query(
      solicitacoesRef,
      where('status', '==', 'concluida'),
      where('dt_procedimento', '>=', Timestamp.fromDate(dataInicio)),
      where('dt_procedimento', '<=', Timestamp.fromDate(dataFim)),
      orderBy('dt_procedimento', 'desc')
    );

    const snapshot = await getDocs(q);

    let totalProcedimentos = snapshot.size;
    let totalProdutosConsumidos = 0;
    let valorTotalConsumido = 0;

    const produtosMap = new Map<string, any>();

    snapshot.forEach((doc) => {
      const solicitacao = doc.data();
      const produtos = solicitacao.produtos_solicitados || [];

      produtos.forEach((produto: any) => {
        const quantidade = produto.quantidade || 0;
        const valorUnitario = produto.valor_unitario || 0;
        const valorTotal = quantidade * valorUnitario;

        totalProdutosConsumidos += quantidade;
        valorTotalConsumido += valorTotal;

        const keyProduto = produto.codigo_produto;
        if (!produtosMap.has(keyProduto)) {
          produtosMap.set(keyProduto, {
            codigo: produto.codigo_produto,
            nome: produto.nome_produto,
            quantidade_consumida: 0,
            valor_total: 0,
            procedimentos: 0,
          });
        }

        const prod = produtosMap.get(keyProduto);
        prod.quantidade_consumida += quantidade;
        prod.valor_total += valorTotal;
        prod.procedimentos += 1;
      });
    });

    const porProduto = Array.from(produtosMap.values()).sort(
      (a, b) => b.valor_total - a.valor_total
    );

    return {
      periodo: {
        inicio: dataInicio,
        fim: dataFim,
      },
      total_procedimentos: totalProcedimentos,
      total_produtos_consumidos: totalProdutosConsumidos,
      valor_total_consumido: valorTotalConsumido,
      por_produto: porProduto,
      gerado_em: new Date(),
    };
  } catch (error) {
    console.error('Erro ao gerar relatório de consumo:', error);
    throw new Error('Falha ao gerar relatório');
  }
}

// ============================================================================
// RELATÓRIO DE CUSTO POR PROCEDIMENTO (UC-51)
// ============================================================================

/**
 * Gera relatório de custo por procedimento/produto, com custo médio
 * ponderado quando múltiplos lotes do mesmo produto foram consumidos
 * (RN-01/RN-02/RN-03 do UC-51)
 */
export async function generateProcedureCostReport(
  tenantId: string,
  dataInicio: Date,
  dataFim: Date
): Promise<ProcedureCostReport> {
  try {
    const records = await getConsumptionRecords(tenantId, dataInicio, dataFim);
    const codigosDistintos = Array.from(new Set(records.map((r) => r.codigo_produto)));
    const metadataByCodigo = await getProductCostMetadata(tenantId, codigosDistintos);

    const porProduto = groupConsumptionByProduct(records, metadataByCodigo).sort(
      (a, b) => b.custo_total - a.custo_total
    );

    const custoTotalPeriodo = porProduto.reduce((sum, p) => sum + p.custo_total, 0);
    const totalProcedimentosPeriodo = new Set(records.map((r) => r.solicitacao_id)).size;

    return {
      periodo: { inicio: dataInicio, fim: dataFim },
      custo_total_periodo: custoTotalPeriodo,
      ticket_medio_custo_geral: calculateTicketMedioCusto(
        custoTotalPeriodo,
        totalProcedimentosPeriodo
      ),
      total_procedimentos_periodo: totalProcedimentosPeriodo,
      por_produto: porProduto,
      gerado_em: new Date(),
    };
  } catch (error) {
    console.error('Erro ao gerar relatório de custo por procedimento:', error);
    throw new Error('Falha ao gerar relatório');
  }
}

// ============================================================================
// HISTÓRICO DO LOTE (UC-51)
// ============================================================================

/**
 * Gera o histórico cronológico de consumo de um lote específico
 * (inventory_item_id), com saldo remanescente após cada evento (RN-05)
 */
export async function generateLotHistoryReport(
  tenantId: string,
  inventoryItemId: string
): Promise<LotHistoryReport> {
  try {
    const item = await getInventoryItem(tenantId, inventoryItemId);
    if (!item) {
      throw new Error('Item de inventário não encontrado');
    }

    const allRecords = await getConsumptionRecords(tenantId);
    const relevantRecords = allRecords.filter((r) => r.inventory_item_id === inventoryItemId);

    const eventos: LotHistoryEvent[] = relevantRecords.map((r) => ({
      solicitacao_id: r.solicitacao_id,
      identificador_procedimento:
        r.solicitacao_descricao || `SOL-${r.solicitacao_id.slice(0, 8).toUpperCase()}`,
      dt_procedimento: r.dt_procedimento,
      quantidade_consumida: r.quantidade,
    }));

    return {
      inventory_item_id: inventoryItemId,
      codigo_produto: item.codigo_produto,
      nome_produto: item.nome_produto,
      lote: item.lote,
      quantidade_inicial: item.quantidade_inicial,
      eventos: buildLotHistory(eventos, item.quantidade_inicial),
      gerado_em: new Date(),
    };
  } catch (error) {
    console.error('Erro ao gerar histórico do lote:', error);
    throw new Error('Falha ao gerar relatório');
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Exporta relatório para Excel (XLSX)
 */
export function exportToExcel(data: any[], filename: string): void {
  if (data.length === 0) return;

  // Importar xlsx dinamicamente (client-side only)
  import('xlsx').then((XLSX) => {
    // Criar worksheet a partir dos dados
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Criar workbook e adicionar worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');

    // Gerar arquivo e fazer download
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `${filename}_${dateStr}.xlsx`);
  });
}

/**
 * @deprecated Use exportToExcel instead
 * Exporta relatório para CSV
 */
export function exportToCSV(data: any[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Escapar vírgulas e aspas
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

/**
 * Formata valor em reais
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata número decimal no padrão brasileiro (vírgula ao invés de ponto)
 * Útil para exports de planilhas
 */
export function formatDecimalBR(value: number, decimals: number = 2): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
