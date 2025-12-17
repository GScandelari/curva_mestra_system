/**
 * Report Service
 * Serviço centralizado para geração de relatórios
 */

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { InventoryItem } from "@/types";

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
  por_paciente: {
    codigo: string;
    nome: string;
    procedimentos: number;
    produtos_consumidos: number;
    valor_total: number;
  }[];
  gerado_em: Date;
}

export interface PatientConsumptionReport {
  paciente: {
    codigo: string;
    nome: string;
  };
  periodo?: {
    inicio: Date;
    fim: Date;
  };
  total_procedimentos: number;
  total_produtos: number;
  valor_total: number;
  procedimentos: {
    id: string;
    data: Date;
    produtos: {
      codigo: string;
      nome: string;
      quantidade: number;
      valor_unitario: number;
      valor_total: number;
    }[];
    valor_total: number;
  }[];
  gerado_em: Date;
}

// ============================================================================
// RELATÓRIO DE VALOR DO ESTOQUE
// ============================================================================

/**
 * Gera relatório de valor total do estoque
 */
export async function generateStockValueReport(
  tenantId: string
): Promise<StockValueReport> {
  try {
    const inventoryRef = collection(db, "tenants", tenantId, "inventory");
    const q = query(inventoryRef, where("active", "==", true));
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
    console.error("Erro ao gerar relatório de valor do estoque:", error);
    throw new Error("Falha ao gerar relatório");
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
    const inventoryRef = collection(db, "tenants", tenantId, "inventory");
    const q = query(inventoryRef, where("active", "==", true));
    const snapshot = await getDocs(q);

    const now = new Date();
    const limitDate = new Date();
    limitDate.setDate(now.getDate() + diasAntecedencia);

    const produtosVencendo: ExpirationReport["produtos_vencendo"] = [];
    let valorEmRisco = 0;

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
          const [dia, mes, ano] = data.dt_validade.split("/");
          dtValidade = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
        } else if (data.dt_validade.includes('-')) {
          // Formato YYYY-MM-DD (ISO)
          dtValidade = new Date(data.dt_validade);
        } else {
          console.warn(`[EXPIRATION REPORT] Formato de data desconhecido:`, data.dt_validade);
          return;
        }
      } else {
        // Pular este produto se não conseguir converter a data
        console.warn(`[EXPIRATION REPORT] Data de validade inválida para produto ${doc.id}:`, data.dt_validade);
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
          const dtValidadeStr = typeof data.dt_validade === 'string'
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
      gerado_em: new Date(),
    };
  } catch (error) {
    console.error("Erro ao gerar relatório de vencimento:", error);
    throw new Error("Falha ao gerar relatório");
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
    const solicitacoesRef = collection(db, "tenants", tenantId, "solicitacoes");

    // Buscar procedimentos CONCLUÍDOS (produtos foram consumidos)
    // Status "concluida" = produtos efetivamente consumidos do estoque
    const q = query(
      solicitacoesRef,
      where("status", "==", "concluida"),
      where("dt_procedimento", ">=", Timestamp.fromDate(dataInicio)),
      where("dt_procedimento", "<=", Timestamp.fromDate(dataFim)),
      orderBy("dt_procedimento", "desc")
    );

    const snapshot = await getDocs(q);

    let totalProcedimentos = snapshot.size;
    let totalProdutosConsumidos = 0;
    let valorTotalConsumido = 0;

    const produtosMap = new Map<string, any>();
    const pacientesMap = new Map<string, any>();

    snapshot.forEach((doc) => {
      const solicitacao = doc.data();
      const produtos = solicitacao.produtos_solicitados || [];

      produtos.forEach((produto: any) => {
        const quantidade = produto.quantidade || 0;
        const valorUnitario = produto.valor_unitario || 0;
        const valorTotal = quantidade * valorUnitario;

        totalProdutosConsumidos += quantidade;
        valorTotalConsumido += valorTotal;

        // Agrupar por produto
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

      // Agrupar por paciente
      const keyPaciente = solicitacao.paciente_codigo;
      if (!pacientesMap.has(keyPaciente)) {
        pacientesMap.set(keyPaciente, {
          codigo: solicitacao.paciente_codigo,
          nome: solicitacao.paciente_nome,
          procedimentos: 0,
          produtos_consumidos: 0,
          valor_total: 0,
        });
      }

      const paciente = pacientesMap.get(keyPaciente);
      paciente.procedimentos += 1;

      produtos.forEach((produto: any) => {
        paciente.produtos_consumidos += produto.quantidade || 0;
        paciente.valor_total +=
          (produto.quantidade || 0) * (produto.valor_unitario || 0);
      });
    });

    const porProduto = Array.from(produtosMap.values()).sort(
      (a, b) => b.valor_total - a.valor_total
    );

    const porPaciente = Array.from(pacientesMap.values()).sort(
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
      por_paciente: porPaciente,
      gerado_em: new Date(),
    };
  } catch (error) {
    console.error("Erro ao gerar relatório de consumo:", error);
    throw new Error("Falha ao gerar relatório");
  }
}

// ============================================================================
// RELATÓRIO DE CONSUMO POR PACIENTE
// ============================================================================

/**
 * Gera relatório detalhado de consumo de um paciente
 */
export async function generatePatientConsumptionReport(
  tenantId: string,
  pacienteCodigo: string,
  dataInicio?: Date,
  dataFim?: Date
): Promise<PatientConsumptionReport> {
  try {
    const solicitacoesRef = collection(db, "tenants", tenantId, "solicitacoes");

    let q = query(
      solicitacoesRef,
      where("paciente_codigo", "==", pacienteCodigo),
      where("status", "==", "aprovada"),
      orderBy("dt_procedimento", "desc")
    );

    // Adicionar filtro de período se fornecido
    if (dataInicio && dataFim) {
      q = query(
        solicitacoesRef,
        where("paciente_codigo", "==", pacienteCodigo),
        where("status", "==", "aprovada"),
        where("dt_procedimento", ">=", Timestamp.fromDate(dataInicio)),
        where("dt_procedimento", "<=", Timestamp.fromDate(dataFim)),
        orderBy("dt_procedimento", "desc")
      );
    }

    const snapshot = await getDocs(q);

    let totalProcedimentos = snapshot.size;
    let totalProdutos = 0;
    let valorTotal = 0;

    const procedimentos: PatientConsumptionReport["procedimentos"] = [];
    let pacienteNome = "";

    snapshot.forEach((doc) => {
      const solicitacao = doc.data();
      const produtos = solicitacao.produtos_solicitados || [];

      if (!pacienteNome) {
        pacienteNome = solicitacao.paciente_nome;
      }

      let valorProcedimento = 0;
      const produtosFormatados = produtos.map((produto: any) => {
        const quantidade = produto.quantidade || 0;
        const valorUnitario = produto.valor_unitario || 0;
        const valorTotalProduto = quantidade * valorUnitario;

        totalProdutos += quantidade;
        valorProcedimento += valorTotalProduto;

        return {
          codigo: produto.codigo_produto,
          nome: produto.nome_produto,
          quantidade,
          valor_unitario: valorUnitario,
          valor_total: valorTotalProduto,
        };
      });

      valorTotal += valorProcedimento;

      procedimentos.push({
        id: doc.id,
        data: (solicitacao.dt_procedimento as Timestamp).toDate(),
        produtos: produtosFormatados,
        valor_total: valorProcedimento,
      });
    });

    return {
      paciente: {
        codigo: pacienteCodigo,
        nome: pacienteNome,
      },
      periodo: dataInicio && dataFim ? {
        inicio: dataInicio,
        fim: dataFim,
      } : undefined,
      total_procedimentos: totalProcedimentos,
      total_produtos: totalProdutos,
      valor_total: valorTotal,
      procedimentos,
      gerado_em: new Date(),
    };
  } catch (error) {
    console.error("Erro ao gerar relatório do paciente:", error);
    throw new Error("Falha ao gerar relatório");
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");

    // Gerar arquivo e fazer download
    const dateStr = new Date().toISOString().split("T")[0];
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
    headers.join(","),
    ...data.map((row) =>
      headers.map((header) => {
        const value = row[header];
        // Escapar vírgulas e aspas
        if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}

/**
 * Formata valor em reais
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata número decimal no padrão brasileiro (vírgula ao invés de ponto)
 * Útil para exports de planilhas
 */
export function formatDecimalBR(value: number, decimals: number = 2): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
