import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import SystemHealthOverview from './SystemHealthOverview';
import ComponentMetricsGrid from './ComponentMetricsGrid';
import AlertsPanel from './AlertsPanel';
import MetricsTrendsChart from './MetricsTrendsChart';
import { useMonitoring } from '../../hooks/useMonitoring';

const MonitoringDashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('last_hour');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { 
    dashboardData, 
    loading, 
    error, 
    refreshData,
    healthScore 
  } = useMonitoring(selectedPeriod, autoRefresh);

  const periods = [
    { value: 'last_hour', label: 'Última Hora' },
    { value: 'last_day', label: 'Último Dia' },
    { value: 'last_week', label: 'Última Semana' },
    { value: 'last_month', label: 'Último Mês' }
  ];

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Carregando dados de monitoramento...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Erro ao carregar dados</h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button 
          onClick={refreshData}
          className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard de Monitoramento
          </h1>
          <p className="text-gray-600">
            Monitoramento em tempo real da saúde do sistema
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Period Selector */}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {periods.map(period => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>

          {/* Auto Refresh Toggle */}
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span>Atualização Automática</span>
          </label>

          {/* Manual Refresh */}
          <button
            onClick={refreshData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* System Health Overview */}
      <SystemHealthOverview 
        systemMetrics={dashboardData?.systemOverview}
        healthScore={healthScore}
      />

      {/* Active Alerts */}
      {dashboardData?.activeAlerts?.length > 0 && (
        <AlertsPanel alerts={dashboardData.activeAlerts} />
      )}

      {/* Component Metrics Grid */}
      <ComponentMetricsGrid 
        components={dashboardData?.systemOverview?.components || []}
        period={selectedPeriod}
      />

      {/* Trends Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tendência de Erros</CardTitle>
          </CardHeader>
          <CardContent>
            <MetricsTrendsChart 
              data={dashboardData?.errorTrends || []}
              type="errors"
              period={selectedPeriod}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tendência de Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <MetricsTrendsChart 
              data={dashboardData?.performanceTrends || []}
              type="performance"
              period={selectedPeriod}
            />
          </CardContent>
        </Card>
      </div>

      {/* Alert History */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertsPanel 
            alerts={dashboardData?.alertHistory || []} 
            showHistory={true}
          />
        </CardContent>
      </Card>

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500">
        Última atualização: {dashboardData?.timestamp ? 
          new Date(dashboardData.timestamp).toLocaleString('pt-BR') : 
          'Nunca'
        }
      </div>
    </div>
  );
};

export default MonitoringDashboard;