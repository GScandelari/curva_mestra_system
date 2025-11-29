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
      const key = data.produto_codigo;
      if (!produtosMap.has(key)) {
        produtosMap.set(key, {
          codigo: data.produto_codigo,
          nome: data.produto_nome,
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
      const data = doc.data() as InventoryItem;

      // Converter dt_validade (string DD/MM/YYYY) para Date
      const [dia, mes, ano] = data.dt_validade.split("/");
      const dtValidade = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));

      // Verificar se está dentro do período
      if (dtValidade <= limitDate && dtValidade >= now) {
        const diasParaVencer = Math.ceil(
          (dtValidade.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        const quantidade = data.quantidade_disponivel || 0;
        const valorTotal = quantidade * (data.valor_unitario || 0);

        if (quantidade > 0) {
          produtosVencendo.push({
            id: doc.id,
            codigo: data.produto_codigo,
            nome: data.produto_nome,
            lote: data.lote,
            quantidade,
            dt_validade: data.dt_validade,
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
    const q = query(
      solicitacoesRef,
      where("status", "==", "aprovada"),
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
        const keyProduto = produto.produto_codigo;
        if (!produtosMap.has(keyProduto)) {
          produtosMap.set(keyProduto, {
            codigo: produto.produto_codigo,
            nome: produto.produto_nome,
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
          codigo: produto.produto_codigo,
          nome: produto.produto_nome,
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
