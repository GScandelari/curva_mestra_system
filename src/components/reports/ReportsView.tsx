'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileBarChart,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Download,
  Eye,
  X,
  ArrowLeft,
  Receipt,
  History,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { ReadOnlyBanner } from '@/components/consultant/ReadOnlyBanner';
import { useToast } from '@/hooks/use-toast';
import {
  generateStockValueReport,
  generateExpirationReport,
  generateConsumptionReport,
  generateProcedureCostReport,
  generateLotHistoryReport,
  exportToExcel,
  formatCurrency,
  formatDecimalBR,
  type StockValueReport,
  type ExpirationReport,
  type ConsumptionReport,
  type ProcedureCostReport,
  type LotHistoryReport,
} from '@/lib/services/reportService';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

interface ReportsViewProps {
  tenantId: string;
  readOnly?: boolean;
  backUrl?: string;
  isAdmin?: boolean;
}

interface InventoryOption {
  id: string;
  codigo_produto: string;
  nome_produto: string;
  lote: string;
}

export function ReportsView({ tenantId, readOnly, backUrl, isAdmin }: ReportsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activeReport, setActiveReport] = useState<string | null>(null);

  const [stockReport, setStockReport] = useState<StockValueReport | null>(null);

  const [expirationReport, setExpirationReport] = useState<ExpirationReport | null>(null);
  const [expirationDays, setExpirationDays] = useState(30);

  const [consumptionReport, setConsumptionReport] = useState<ConsumptionReport | null>(null);
  const [consumptionStartDate, setConsumptionStartDate] = useState('');
  const [consumptionEndDate, setConsumptionEndDate] = useState('');

  const [procedureCostReport, setProcedureCostReport] = useState<ProcedureCostReport | null>(null);
  const [procedureCostStartDate, setProcedureCostStartDate] = useState('');
  const [procedureCostEndDate, setProcedureCostEndDate] = useState('');
  const [expandedProduto, setExpandedProduto] = useState<string | null>(null);

  const [lotHistoryReport, setLotHistoryReport] = useState<LotHistoryReport | null>(null);
  const [lotHistoryInventory, setLotHistoryInventory] = useState<InventoryOption[]>([]);
  const [lotHistoryProdutoCodigo, setLotHistoryProdutoCodigo] = useState('');
  const [lotHistoryInventoryItemId, setLotHistoryInventoryItemId] = useState('');
  const [lotHistoryAutoLoadDone, setLotHistoryAutoLoadDone] = useState(false);

  useEffect(() => {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(today.getMonth() - 1);
    setConsumptionStartDate(lastMonth.toISOString().split('T')[0]);
    setConsumptionEndDate(today.toISOString().split('T')[0]);
    setProcedureCostStartDate(lastMonth.toISOString().split('T')[0]);
    setProcedureCostEndDate(today.toISOString().split('T')[0]);
  }, []);

  // Lista de produtos/lotes para os selects em cascata do Histórico do Lote
  // (UC-51, Fluxo 7a) — carregada uma única vez, só quando isAdmin.
  useEffect(() => {
    if (!isAdmin || !tenantId) return;

    const inventoryRef = collection(db, 'tenants', tenantId, 'inventory');
    const q = query(inventoryRef, where('active', '==', true), orderBy('nome_produto', 'asc'));

    getDocs(q)
      .then((snapshot) => {
        const items: InventoryOption[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            codigo_produto: data.codigo_produto,
            nome_produto: data.nome_produto,
            lote: data.lote,
          };
        });
        setLotHistoryInventory(items);
      })
      .catch((error) => {
        console.error('Erro ao carregar produtos para histórico do lote:', error);
      });
  }, [isAdmin, tenantId]);

  // Ponto de entrada a partir do detalhe do item de inventário (RF-06): se a
  // URL trouxer ?report=lot-history&inventoryItemId=..., pré-seleciona o
  // produto/lote correspondentes e dispara a geração automaticamente.
  useEffect(() => {
    if (lotHistoryAutoLoadDone || lotHistoryInventory.length === 0) return;

    const report = searchParams.get('report');
    const inventoryItemId = searchParams.get('inventoryItemId');
    if (report !== 'lot-history' || !inventoryItemId) return;

    const matched = lotHistoryInventory.find((i) => i.id === inventoryItemId);
    if (!matched) return;

    setLotHistoryProdutoCodigo(matched.codigo_produto);
    setLotHistoryInventoryItemId(matched.id);
    setLotHistoryAutoLoadDone(true);
    handleGenerateLotHistoryReport(matched.id);
    // handleGenerateLotHistoryReport é recriada a cada render (não é uma ref
    // estável) e não deve disparar este efeito novamente -- só
    // lotHistoryInventory/searchParams/lotHistoryAutoLoadDone determinam
    // quando isso deve rodar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotHistoryInventory, searchParams, lotHistoryAutoLoadDone]);

  async function handleGenerateStockReport() {
    try {
      setLoading(true);
      setActiveReport('stock');
      const report = await generateStockValueReport(tenantId);
      setStockReport(report);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: 'Erro ao gerar relatório',
        description: 'Não foi possível gerar o relatório. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateExpirationReport() {
    try {
      setLoading(true);
      setActiveReport('expiration');
      const report = await generateExpirationReport(tenantId, expirationDays);
      setExpirationReport(report);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: 'Erro ao gerar relatório',
        description: 'Não foi possível gerar o relatório. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateConsumptionReport() {
    if (!consumptionStartDate || !consumptionEndDate) {
      toast({
        title: 'Selecione o período',
        description: 'Informe a data inicial e final para gerar o relatório de consumo.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setLoading(true);
      setActiveReport('consumption');
      const report = await generateConsumptionReport(
        tenantId,
        new Date(consumptionStartDate),
        new Date(consumptionEndDate)
      );
      setConsumptionReport(report);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: 'Erro ao gerar relatório',
        description: 'Não foi possível gerar o relatório. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateProcedureCostReport() {
    if (!procedureCostStartDate || !procedureCostEndDate) {
      toast({
        title: 'Selecione o período',
        description: 'Informe a data inicial e final para gerar o relatório de custo.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setLoading(true);
      setActiveReport('procedure-cost');
      setExpandedProduto(null);
      const report = await generateProcedureCostReport(
        tenantId,
        new Date(procedureCostStartDate),
        new Date(procedureCostEndDate)
      );
      setProcedureCostReport(report);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: 'Erro ao gerar relatório',
        description: 'Não foi possível gerar o relatório. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateLotHistoryReport(overrideInventoryItemId?: string) {
    const inventoryItemId = overrideInventoryItemId ?? lotHistoryInventoryItemId;
    if (!inventoryItemId) {
      toast({
        title: 'Selecione um lote',
        description: 'Informe o produto e o lote para consultar o histórico.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setLoading(true);
      setActiveReport('lot-history');
      const report = await generateLotHistoryReport(tenantId, inventoryItemId);
      setLotHistoryReport(report);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: 'Erro ao gerar relatório',
        description: 'Não foi possível gerar o relatório. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function handleExportStockReport() {
    if (!stockReport) return;
    const data = stockReport.por_produto.map((item) => ({
      Código: item.codigo,
      Nome: item.nome,
      'Quantidade Total': item.quantidade_total,
      'Valor Unitário': formatDecimalBR(item.valor_unitario, 2),
      'Valor Total': formatDecimalBR(item.valor_total, 2),
      Lotes: item.lotes,
    }));
    exportToExcel(data, 'relatorio_valor_estoque');
  }

  function handleExportExpirationReport() {
    if (!expirationReport) return;
    const data = expirationReport.produtos_vencendo.map((item) => ({
      Código: item.codigo,
      Nome: item.nome,
      Lote: item.lote,
      Quantidade: item.quantidade,
      Validade: item.dt_validade,
      'Dias para Vencer': item.dias_para_vencer,
      'Valor Total': formatDecimalBR(item.valor_total, 2),
    }));
    exportToExcel(data, 'relatorio_produtos_vencendo');
  }

  function handleExportConsumptionReport() {
    if (!consumptionReport) return;
    const data = consumptionReport.por_produto.map((item) => ({
      Código: item.codigo,
      Nome: item.nome,
      'Quantidade Consumida': item.quantidade_consumida,
      'Valor Total': formatDecimalBR(item.valor_total, 2),
      Procedimentos: item.procedimentos,
    }));
    exportToExcel(data, 'relatorio_consumo_produtos');
  }

  function handleExportProcedureCostReport() {
    if (!procedureCostReport) return;
    const data = procedureCostReport.por_produto.map((item) => ({
      Código: item.codigo_produto,
      Nome: item.nome_produto,
      Categoria: item.categoria,
      'Qtd. Consumida': item.quantidade_consumida,
      'Lotes Distintos': item.lotes_distintos,
      'Custo Total': formatDecimalBR(item.custo_total, 2),
      'Custo Unitário Médio': formatDecimalBR(item.custo_unitario_medio, 2),
      'Ticket Médio de Custo': formatDecimalBR(item.ticket_medio_custo, 2),
    }));
    exportToExcel(data, 'relatorio_custo_por_procedimento');
  }

  function handleExportLotHistoryReport() {
    if (!lotHistoryReport) return;
    const data = lotHistoryReport.eventos.map((evento) => ({
      Data: evento.dt_procedimento.toLocaleDateString('pt-BR'),
      Procedimento: evento.identificador_procedimento,
      'Quantidade Consumida': evento.quantidade_consumida,
      'Saldo Após Evento': evento.saldo_apos_evento,
    }));
    exportToExcel(data, `historico_lote_${lotHistoryReport.lote}`);
  }

  const produtosParaHistorico = Array.from(
    new Map(lotHistoryInventory.map((i) => [i.codigo_produto, i.nome_produto])).entries()
  );
  const lotesParaHistorico = lotHistoryInventory.filter(
    (i) => i.codigo_produto === lotHistoryProdutoCodigo
  );

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {backUrl && (
          <Button variant="ghost" onClick={() => router.push(backUrl)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        )}

        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileBarChart className="h-8 w-8 text-sky-600" />
            Relatórios
          </h1>
          <p className="text-muted-foreground mt-1">
            Gere relatórios detalhados sobre estoque, vencimento e consumo
          </p>
        </div>

        {readOnly && <ReadOnlyBanner />}

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <Button onClick={handleGenerateStockReport} disabled={loading} className="w-full">
              {loading && activeReport === 'stock' ? 'Gerando...' : 'Gerar Relatório'}
            </Button>
          </div>

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
            <Button onClick={handleGenerateExpirationReport} disabled={loading} className="w-full">
              {loading && activeReport === 'expiration' ? 'Gerando...' : 'Gerar Relatório'}
            </Button>
          </div>

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
            <Button onClick={handleGenerateConsumptionReport} disabled={loading} className="w-full">
              {loading && activeReport === 'consumption' ? 'Gerando...' : 'Gerar Relatório'}
            </Button>
          </div>

          {isAdmin && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-indigo-100 rounded-lg">
                  <Receipt className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Custo por Procedimento</h3>
                  <p className="text-sm text-gray-600">Custo real de material por produto</p>
                </div>
              </div>
              <div className="space-y-2 mb-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Data Início</label>
                  <Input
                    type="date"
                    value={procedureCostStartDate}
                    onChange={(e) => setProcedureCostStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Data Fim</label>
                  <Input
                    type="date"
                    value={procedureCostEndDate}
                    onChange={(e) => setProcedureCostEndDate(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={handleGenerateProcedureCostReport}
                disabled={loading}
                className="w-full"
              >
                {loading && activeReport === 'procedure-cost' ? 'Gerando...' : 'Gerar Relatório'}
              </Button>
            </div>
          )}

          {isAdmin && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-teal-100 rounded-lg">
                  <History className="w-6 h-6 text-teal-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Histórico do Lote</h3>
                  <p className="text-sm text-gray-600">Consumo cronológico de um lote</p>
                </div>
              </div>
              <div className="space-y-2 mb-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Produto</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={lotHistoryProdutoCodigo}
                    onChange={(e) => {
                      setLotHistoryProdutoCodigo(e.target.value);
                      setLotHistoryInventoryItemId('');
                    }}
                  >
                    <option value="">Selecione o produto</option>
                    {produtosParaHistorico.map(([codigo, nome]) => (
                      <option key={codigo} value={codigo}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Lote</label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={lotHistoryInventoryItemId}
                    onChange={(e) => setLotHistoryInventoryItemId(e.target.value)}
                    disabled={!lotHistoryProdutoCodigo}
                  >
                    <option value="">Selecione o lote</option>
                    {lotesParaHistorico.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.lote}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                onClick={() => handleGenerateLotHistoryReport()}
                disabled={loading}
                className="w-full"
              >
                {loading && activeReport === 'lot-history' ? 'Gerando...' : 'Gerar Relatório'}
              </Button>
            </div>
          )}
        </div>

        {/* Stock Report Result */}
        {stockReport && activeReport === 'stock' && (
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Código
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Produto
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Qtd Total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Lotes
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Valor Unit.
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Valor Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stockReport.por_produto.map((produto, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm text-gray-900">{produto.codigo}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{produto.nome}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {produto.quantidade_total}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">
                        {produto.lotes}
                      </td>
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

        {/* Expiration Report Result */}
        {expirationReport && activeReport === 'expiration' && (
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
                <p className="text-2xl font-bold text-orange-900">
                  {expirationReport.total_produtos}
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-red-600 font-medium">Valor em Risco</p>
                <p className="text-2xl font-bold text-red-900">
                  {formatCurrency(expirationReport.valor_em_risco)}
                </p>
              </div>
            </div>

            {expirationReport.itens_ignorados > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                {expirationReport.itens_ignorados}{' '}
                {expirationReport.itens_ignorados === 1
                  ? 'item foi ignorado'
                  : 'itens foram ignorados'}{' '}
                por ter data de validade inválida ou não reconhecida. O &quot;Valor em Risco&quot;
                acima pode estar subestimado.
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Produto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Lote
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Quantidade
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Validade
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Dias
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {expirationReport.produtos_vencendo.map((produto) => (
                    <tr
                      key={produto.id}
                      className={produto.dias_para_vencer <= 7 ? 'bg-red-50' : ''}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900">{produto.nome}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{produto.lote}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {produto.quantidade}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{produto.dt_validade}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span
                          className={`font-medium ${
                            produto.dias_para_vencer <= 7
                              ? 'text-red-600'
                              : produto.dias_para_vencer <= 15
                                ? 'text-orange-600'
                                : 'text-green-600'
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

        {/* Consumption Report Result */}
        {consumptionReport && activeReport === 'consumption' && (
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
                <p className="text-2xl font-bold text-blue-900">
                  {consumptionReport.total_procedimentos}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600 font-medium">Produtos Consumidos</p>
                <p className="text-2xl font-bold text-green-900">
                  {consumptionReport.total_produtos_consumidos}
                </p>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Produto
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Qtd Consumida
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Procedimentos
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Valor Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {consumptionReport.por_produto.map((produto, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm text-gray-900">{produto.nome}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900">
                        {produto.quantidade_consumida}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">
                        {produto.procedimentos}
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

        {/* Procedure Cost Report Result */}
        {procedureCostReport && activeReport === 'procedure-cost' && (
          <div className="bg-white rounded-lg shadow-sm border-2 border-indigo-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold">Relatório de Custo por Procedimento</h2>
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">
                  <Eye className="w-3 h-3 mr-1" />
                  Preview
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setProcedureCostReport(null)} variant="ghost" size="sm">
                  <X className="w-4 h-4 mr-2" />
                  Fechar
                </Button>
                <Button onClick={handleExportProcedureCostReport} variant="default" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Excel
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-indigo-50 rounded-lg">
                <p className="text-sm text-indigo-600 font-medium">Custo Total do Período</p>
                <p className="text-2xl font-bold text-indigo-900">
                  {formatCurrency(procedureCostReport.custo_total_periodo)}
                </p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">Ticket Médio de Custo Geral</p>
                <p className="text-2xl font-bold text-blue-900">
                  {formatCurrency(procedureCostReport.ticket_medio_custo_geral)}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-purple-600 font-medium">Total de Procedimentos</p>
                <p className="text-2xl font-bold text-purple-900">
                  {procedureCostReport.total_procedimentos_periodo}
                </p>
              </div>
            </div>

            {procedureCostReport.por_produto.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Nenhuma solicitação concluída no período informado
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Código
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Produto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Categoria
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Qtd. Consumida
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Lotes Distintos
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Custo Total
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Custo Unitário Médio
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Ticket Médio de Custo
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {procedureCostReport.por_produto.map((produto) => (
                      <Fragment key={produto.codigo_produto}>
                        <tr
                          className={
                            produto.lotes_distintos > 1 ? 'cursor-pointer hover:bg-gray-50' : ''
                          }
                          onClick={() =>
                            produto.lotes_distintos > 1 &&
                            setExpandedProduto(
                              expandedProduto === produto.codigo_produto
                                ? null
                                : produto.codigo_produto
                            )
                          }
                        >
                          <td className="px-4 py-3 text-sm text-gray-400">
                            {produto.lotes_distintos > 1 &&
                              (expandedProduto === produto.codigo_produto ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              ))}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">
                            {produto.codigo_produto}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {produto.nome_produto}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{produto.categoria}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {produto.quantidade_consumida}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-600">
                            {produto.lotes_distintos}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                            {formatCurrency(produto.custo_total)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {formatCurrency(produto.custo_unitario_medio)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900">
                            {formatCurrency(produto.ticket_medio_custo)}
                          </td>
                        </tr>
                        {expandedProduto === produto.codigo_produto && (
                          <tr key={`${produto.codigo_produto}-detalhe`}>
                            <td colSpan={9} className="px-4 py-3 bg-gray-50">
                              <table className="min-w-full">
                                <thead>
                                  <tr>
                                    <th className="px-2 py-1 text-left text-xs text-gray-500">
                                      Lote
                                    </th>
                                    <th className="px-2 py-1 text-right text-xs text-gray-500">
                                      Quantidade
                                    </th>
                                    <th className="px-2 py-1 text-right text-xs text-gray-500">
                                      Valor Unitário
                                    </th>
                                    <th className="px-2 py-1 text-left text-xs text-gray-500">
                                      Data de Entrada
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {produto.lotes_detalhe.map((lote) => (
                                    <tr key={lote.inventory_item_id}>
                                      <td className="px-2 py-1 text-sm font-mono">{lote.lote}</td>
                                      <td className="px-2 py-1 text-sm text-right">
                                        {lote.quantidade}
                                      </td>
                                      <td className="px-2 py-1 text-sm text-right">
                                        {formatCurrency(lote.valor_unitario)}
                                      </td>
                                      <td className="px-2 py-1 text-sm">
                                        {lote.dt_entrada
                                          ? lote.dt_entrada.toLocaleDateString('pt-BR')
                                          : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Lot History Report Result */}
        {lotHistoryReport && activeReport === 'lot-history' && (
          <div className="bg-white rounded-lg shadow-sm border-2 border-teal-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold">
                  Histórico do Lote — {lotHistoryReport.nome_produto} ({lotHistoryReport.lote})
                </h2>
                <Badge variant="secondary" className="bg-teal-100 text-teal-700">
                  <Eye className="w-3 h-3 mr-1" />
                  Preview
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setLotHistoryReport(null)} variant="ghost" size="sm">
                  <X className="w-4 h-4 mr-2" />
                  Fechar
                </Button>
                <Button onClick={handleExportLotHistoryReport} variant="default" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Excel
                </Button>
              </div>
            </div>

            {lotHistoryReport.eventos.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Nenhum procedimento concluído consumiu este lote
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Data
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Procedimento
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Quantidade Consumida
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Saldo Após Evento
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {lotHistoryReport.eventos.map((evento, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {evento.dt_procedimento.toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {evento.identificador_procedimento}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {evento.quantidade_consumida}
                        </td>
                        <td
                          className={`px-4 py-3 text-sm text-right font-medium ${
                            evento.saldo_apos_evento < 0 ? 'text-red-600' : 'text-gray-900'
                          }`}
                        >
                          {evento.saldo_apos_evento}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
