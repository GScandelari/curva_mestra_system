import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { useAnalytics } from '../../hooks/useAnalytics';

const CostMonitoringDashboard = () => {
  const [costData, setCostData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [thresholds, setThresholds] = useState({
    daily: 5.00,
    weekly: 30.00,
    monthly: 100.00
  });

  const { trackCustomEvent } = useAnalytics();

  const getCostReport = httpsCallable(functions, 'getCostReport');
  const setCostThresholds = httpsCallable(functions, 'setCostThresholds');

  useEffect(() => {
    loadCostData();
  }, [dateRange]);

  const loadCostData = async () => {
    try {
      setLoading(true);
      const result = await getCostReport({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      setCostData(result.data);
      trackCustomEvent('cost_report_viewed', {
        date_range: `${dateRange.startDate}_to_${dateRange.endDate}`
      });
    } catch (err) {
      setError('Erro ao carregar dados de custo');
      console.error('Erro ao carregar dados de custo:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleThresholdUpdate = async () => {
    try {
      await setCostThresholds(thresholds);
      alert('Limites de custo atualizados com sucesso!');
      trackCustomEvent('cost_thresholds_updated', thresholds);
    } catch (err) {
      alert('Erro ao atualizar limites de custo');
      console.error('Erro ao atualizar limites:', err);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-800">{error}</div>
        <button
          onClick={loadCostData}
          className="mt-2 text-red-600 hover:text-red-800 underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Dashboard de Monitoramento de Custos
        </h2>
        
        {/* Filtros de Data */}
        <div className="flex space-x-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Data Inicial
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Data Final
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {costData && (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">$</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Custo Total
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(costData.totals.totalCost)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">R</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Leituras Firestore
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatNumber(costData.totals.totalReads)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">W</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Escritas Firestore
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatNumber(costData.totals.totalWrites)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">F</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Chamadas Functions
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatNumber(costData.totals.totalFunctionCalls)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Projeções */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Projeções de Custo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(costData.projections.weekly)}
                </div>
                <div className="text-sm text-gray-500">Semanal</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(costData.projections.monthly)}
                </div>
                <div className="text-sm text-gray-500">Mensal</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(costData.projections.yearly)}
                </div>
                <div className="text-sm text-gray-500">Anual</div>
              </div>
            </div>
          </div>

          {/* Configuração de Limites */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Configurar Limites de Custo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Limite Diário (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={thresholds.daily}
                  onChange={(e) => setThresholds(prev => ({ ...prev, daily: parseFloat(e.target.value) }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Limite Semanal (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={thresholds.weekly}
                  onChange={(e) => setThresholds(prev => ({ ...prev, weekly: parseFloat(e.target.value) }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Limite Mensal (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={thresholds.monthly}
                  onChange={(e) => setThresholds(prev => ({ ...prev, monthly: parseFloat(e.target.value) }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleThresholdUpdate}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Atualizar Limites
              </button>
            </div>
          </div>

          {/* Histórico Detalhado */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Histórico Detalhado
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Custo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Leituras
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Escritas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Functions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {costData.metrics.map((metric) => (
                    <tr key={metric.date}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(metric.date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(metric.estimatedCost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(metric.firestoreReads)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(metric.firestoreWrites)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(metric.functionsInvocations)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CostMonitoringDashboard;