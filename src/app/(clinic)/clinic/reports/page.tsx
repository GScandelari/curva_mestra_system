"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileBarChart,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Download,
  Calendar,
  Eye,
  X,
} from "lucide-react";
import {
  generateStockValueReport,
  generateExpirationReport,
  generateConsumptionReport,
  exportToExcel,
  formatCurrency,
  formatDecimalBR,
  type StockValueReport,
  type ExpirationReport,
  type ConsumptionReport,
} from "@/lib/services/reportService";

export default function ReportsPage() {
  const { claims } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeReport, setActiveReport] = useState<string | null>(null);

  // Relatório de Valor do Estoque
  const [stockReport, setStockReport] = useState<StockValueReport | null>(null);

  // Relatório de Vencimento
  const [expirationReport, setExpirationReport] = useState<ExpirationReport | null>(null);
  const [expirationDays, setExpirationDays] = useState(30);

  // Relatório de Consumo
  const [consumptionReport, setConsumptionReport] = useState<ConsumptionReport | null>(null);
  const [consumptionStartDate, setConsumptionStartDate] = useState("");
  const [consumptionEndDate, setConsumptionEndDate] = useState("");

  const tenantId = claims?.tenant_id;

  // Definir período padrão (último mês)
  useEffect(() => {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(today.getMonth() - 1);

    setConsumptionStartDate(lastMonth.toISOString().split("T")[0]);
    setConsumptionEndDate(today.toISOString().split("T")[0]);
  }, []);

  async function handleGenerateStockReport() {
    if (!tenantId) return;

    try {
      setLoading(true);
      setActiveReport("stock");
      const report = await generateStockValueReport(tenantId);
      setStockReport(report);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      alert("Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateExpirationReport() {
    if (!tenantId) return;

    try {
      setLoading(true);
      setActiveReport("expiration");
      const report = await generateExpirationReport(tenantId, expirationDays);
      setExpirationReport(report);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      alert("Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateConsumptionReport() {
    if (!tenantId || !consumptionStartDate || !consumptionEndDate) {
      alert("Selecione o período");
      return;
    }

    try {
      setLoading(true);
      setActiveReport("consumption");
      const report = await generateConsumptionReport(
        tenantId,
        new Date(consumptionStartDate),
        new Date(consumptionEndDate)
      );
      setConsumptionReport(report);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      alert("Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  }

  function handleExportStockReport() {
    if (!stockReport) return;
    const data = stockReport.por_produto.map((item) => ({
      "Código": item.codigo,
      "Nome": item.nome,
      "Quantidade Total": item.quantidade_total,
      "Valor Unitário": formatDecimalBR(item.valor_unitario, 2),
      "Valor Total": formatDecimalBR(item.valor_total, 2),
      "Lotes": item.lotes,
    }));
    exportToExcel(data, "relatorio_valor_estoque");
  }

  function handleExportExpirationReport() {
    if (!expirationReport) return;
    const data = expirationReport.produtos_vencendo.map((item) => ({
      "Código": item.codigo,
      "Nome": item.nome,
      "Lote": item.lote,
      "Quantidade": item.quantidade,
      "Validade": item.dt_validade,
      "Dias para Vencer": item.dias_para_vencer,
      "Valor Total": formatDecimalBR(item.valor_total, 2),
    }));
    exportToExcel(data, "relatorio_produtos_vencendo");
  }

  function handleExportConsumptionReport() {
    if (!consumptionReport) return;
    const data = consumptionReport.por_produto.map((item) => ({
      "Código": item.codigo,
      "Nome": item.nome,
      "Quantidade Consumida": item.quantidade_consumida,
      "Valor Total": formatDecimalBR(item.valor_total, 2),
      "Procedimentos": item.procedimentos,
    }));
    exportToExcel(data, "relatorio_consumo_produtos");
  }

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground mt-1">
            Gere relatórios detalhados sobre estoque, vencimento e consumo
          </p>
        </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Valor do Estoque */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Valor do Estoque</h3>
              <p className="text-sm text-gray-600">Valor total em estoque</p>
            </div>
          </div>
          <Button
            onClick={handleGenerateStockReport}
            disabled={loading}
            className="w-full"
          >
            {loading && activeReport === "stock" ? "Gerando..." : "Gerar Relatório"}
          </Button>
        </div>

        {/* Produtos Vencendo */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Produtos Vencendo</h3>
              <p className="text-sm text-gray-600">Próximos ao vencimento</p>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-sm text-gray-600 mb-1">Antecedência (dias)</label>
            <Input
              type="number"
              value={expirationDays}
              onChange={(e) => setExpirationDays(parseInt(e.target.value) || 30)}
              min="1"
              max="365"
            />
          </div>
          <Button
            onClick={handleGenerateExpirationReport}
            disabled={loading}
            className="w-full"
          >
            {loading && activeReport === "expiration" ? "Gerando..." : "Gerar Relatório"}
          </Button>
        </div>

        {/* Consumo por Período */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Consumo</h3>
              <p className="text-sm text-gray-600">Por período</p>
            </div>
          </div>
          <div className="space-y-2 mb-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Data Início</label>
              <Input
                type="date"
                value={consumptionStartDate}
                onChange={(e) => setConsumptionStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Data Fim</label>
              <Input
                type="date"
                value={consumptionEndDate}
                onChange={(e) => setConsumptionEndDate(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleGenerateConsumptionReport}
            disabled={loading}
            className="w-full"
          >
            {loading && activeReport === "consumption" ? "Gerando..." : "Gerar Relatório"}
          </Button>
        </div>
      </div>

      {/* Report Results */}
      {stockReport && activeReport === "stock" && (
        <div className="bg-white rounded-lg shadow-sm border-2 border-blue-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">Relatório de Valor do Estoque</h2>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                <Eye className="w-3 h-3 mr-1" />
                Preview
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setStockReport(null)} variant="ghost" size="sm">
                <X className="w-4 h-4 mr-2" />
                Fechar
              </Button>
              <Button onClick={handleExportStockReport} variant="default" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">Total de Produtos</p>
              <p className="text-2xl font-bold text-blue-900">{stockReport.total_produtos}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600 font-medium">Total de Itens</p>
              <p className="text-2xl font-bold text-green-900">{stockReport.total_itens}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Valor Total</p>
              <p className="text-2xl font-bold text-purple-900">
                {formatCurrency(stockReport.valor_total)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qtd Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lotes</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Unit.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stockReport.por_produto.map((produto, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm text-gray-900">{produto.codigo}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{produto.nome}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{produto.quantidade_total}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{produto.lotes}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {formatCurrency(produto.valor_unitario)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(produto.valor_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {expirationReport && activeReport === "expiration" && (
        <div className="bg-white rounded-lg shadow-sm border-2 border-orange-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">Produtos Próximos ao Vencimento</h2>
              <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                <Eye className="w-3 h-3 mr-1" />
                Preview
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setExpirationReport(null)} variant="ghost" size="sm">
                <X className="w-4 h-4 mr-2" />
                Fechar
              </Button>
              <Button onClick={handleExportExpirationReport} variant="default" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-600 font-medium">Produtos em Risco</p>
              <p className="text-2xl font-bold text-orange-900">{expirationReport.total_produtos}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-600 font-medium">Valor em Risco</p>
              <p className="text-2xl font-bold text-red-900">
                {formatCurrency(expirationReport.valor_em_risco)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lote</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validade</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Dias</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expirationReport.produtos_vencendo.map((produto) => (
                  <tr key={produto.id} className={produto.dias_para_vencer <= 7 ? "bg-red-50" : ""}>
                    <td className="px-4 py-3 text-sm text-gray-900">{produto.nome}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{produto.lote}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{produto.quantidade}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{produto.dt_validade}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span
                        className={`font-medium ${
                          produto.dias_para_vencer <= 7
                            ? "text-red-600"
                            : produto.dias_para_vencer <= 15
                            ? "text-orange-600"
                            : "text-green-600"
                        }`}
                      >
                        {produto.dias_para_vencer}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(produto.valor_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {consumptionReport && activeReport === "consumption" && (
        <div className="bg-white rounded-lg shadow-sm border-2 border-green-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">Relatório de Consumo</h2>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                <Eye className="w-3 h-3 mr-1" />
                Preview
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setConsumptionReport(null)} variant="ghost" size="sm">
                <X className="w-4 h-4 mr-2" />
                Fechar
              </Button>
              <Button onClick={handleExportConsumptionReport} variant="default" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar Excel
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">Total Procedimentos</p>
              <p className="text-2xl font-bold text-blue-900">{consumptionReport.total_procedimentos}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600 font-medium">Produtos Consumidos</p>
              <p className="text-2xl font-bold text-green-900">{consumptionReport.total_produtos_consumidos}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Valor Total</p>
              <p className="text-2xl font-bold text-purple-900">
                {formatCurrency(consumptionReport.valor_total_consumido)}
              </p>
            </div>
          </div>

          <h3 className="font-bold text-lg mb-3">Por Produto</h3>
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qtd Consumida</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Procedimentos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {consumptionReport.por_produto.map((produto, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm text-gray-900">{produto.nome}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{produto.quantidade_consumida}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{produto.procedimentos}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(produto.valor_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="font-bold text-lg mb-3">Por Paciente</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paciente</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Procedimentos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Produtos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {consumptionReport.por_paciente.map((paciente, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm text-gray-900">{paciente.nome}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{paciente.procedimentos}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{paciente.produtos_consumidos}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(paciente.valor_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
