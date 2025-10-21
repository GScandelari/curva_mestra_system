import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { useAnalytics } from '../../hooks/useAnalytics';

const ErrorReportingDashboard = () => {
  const [errorStats, setErrorStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(7);

  const { trackCustomEvent } = useAnalytics();

  const getErrorStats = httpsCallable(functions, 'getErrorStats');
  const resolveError = httpsCallable(functions, 'resolveError');

  useEffect(() => {
    loadErrorStats();
  }, [selectedPeriod]);

  const loadErrorStats = async () => {
    try {
      setLoading(true);
      const result = await getErrorStats({ days: selectedPeriod });
      setErrorStats(result.data);
      trackCustomEvent('error_stats_viewed', {
        period_days: selectedPeriod
      });
    } catch (err) {
      setError('Erro ao carregar estatísticas de erro');
      console.error('Erro ao carregar estatísticas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveError = async (errorId) => {
    try {
      const resolution = prompt('Descreva como o erro foi resolvido:');
      if (resolution) {
        await resolveError({ errorId, resolution });
        alert('Erro marcado como resolvido!');
        loadErrorStats(); // Recarregar dados
        trackCustomEvent('error_resolved', { error_id: errorId });
      }
    } catch (err) {
      alert('Erro ao resolver erro');
      console.error('Erro ao resolver erro:', err);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
          onClick={loadErrorStats}
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
          Dashboard de Relatórios de Erro
        </h2>
        
        {/* Filtro de Período */}
        <div className="flex space-x-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Período
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={1}>Último dia</option>
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </div>
        </div>
      </div>

      {errorStats && (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">T</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total de Erros
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {errorStats.totals.totalErrors}
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
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">C</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Críticos
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {errorStats.totals.criticalErrors}
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
                      <span className="text-white font-bold">H</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Altos
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {errorStats.totals.highErrors}
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
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">M</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Médios
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {errorStats.totals.mediumErrors}
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
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">L</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Baixos
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {errorStats.totals.lowErrors}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico de Tendência */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Tendência de Erros por Dia
            </h3>
            <div className="space-y-2">
              {errorStats.reports.map((report) => (
                <div key={report.date} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(report.date).toLocaleDateString('pt-BR')}
                    </span>
                    <div className="flex space-x-2">
                      {report.criticalErrors > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {report.criticalErrors} críticos
                        </span>
                      )}
                      {report.highErrors > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {report.highErrors} altos
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    Total: {report.totalErrors}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Ações Rápidas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => loadErrorStats()}
                className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Atualizar Dados
              </button>
              
              <button
                onClick={() => {
                  const csvData = errorStats.reports.map(r => 
                    `${r.date},${r.totalErrors},${r.criticalErrors},${r.highErrors},${r.mediumErrors},${r.lowErrors}`
                  ).join('\n');
                  const blob = new Blob([`Data,Total,Críticos,Altos,Médios,Baixos\n${csvData}`], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `error-report-${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  trackCustomEvent('error_report_exported', { format: 'csv' });
                }}
                className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exportar CSV
              </button>
              
              <button
                onClick={() => {
                  if (confirm('Isso irá gerar um relatório de teste. Continuar?')) {
                    // Simular erro de teste
                    throw new Error('Erro de teste para validar sistema de relatórios');
                  }
                }}
                className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Testar Sistema
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ErrorReportingDashboard;