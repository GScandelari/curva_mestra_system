import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { useCache } from '../../services/cacheService';

const OptimizationDashboard = () => {
  const { user } = useAuth();
  const { getCacheStats, clearAllCaches } = useCache();
  
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('performance');
  const [performanceData, setPerformanceData] = useState(null);
  const [costData, setCostData] = useState(null);
  const [cacheStats, setCacheStats] = useState(null);
  const [indexOptimizations, setIndexOptimizations] = useState(null);

  useEffect(() => {
    loadOptimizationData();
    loadCacheStats();
  }, []);

  const loadOptimizationData = async () => {
    setLoading(true);
    try {
      // Carregar dados de performance
      const analyzePerformance = httpsCallable(functions, 'analyzeQueryPerformance');
      const performanceResult = await analyzePerformance({ 
        clinicId: user.clinicId,
        timeRange: 24 
      });
      setPerformanceData(performanceResult.data);

      // Carregar dados de custo
      const calculateCost = httpsCallable(functions, 'calculateCostEstimate');
      const costResult = await calculateCost({ 
        clinicId: user.clinicId,
        period: 'week' 
      });
      setCostData(costResult.data);

      // Carregar otimizações de índices
      const optimizeIndexes = httpsCallable(functions, 'optimizeIndexes');
      const indexResult = await optimizeIndexes({ clinicId: user.clinicId });
      setIndexOptimizations(indexResult.data);

    } catch (error) {
      console.error('Erro ao carregar dados de otimização:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCacheStats = () => {
    const stats = getCacheStats();
    setCacheStats(stats);
  };

  const handleClearCache = () => {
    clearAllCaches();
    loadCacheStats();
    alert('Cache limpo com sucesso!');
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

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard de Otimização</h1>
        <p className="text-gray-600 mt-2">
          Monitore performance, custos e otimizações do sistema Firebase
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'performance', name: 'Performance', icon: '⚡' },
            { id: 'costs', name: 'Custos', icon: '💰' },
            { id: 'cache', name: 'Cache', icon: '🚀' },
            { id: 'indexes', name: 'Índices', icon: '🔍' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Performance Tab */}
      {activeTab === 'performance' && performanceData && (
        <div className="space-y-6">
          {/* Performance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm font-medium">Q</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total de Consultas</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatNumber(performanceData.summary.totalQueries)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-sm font-medium">⏱</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Tempo Médio</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {Math.round(performanceData.summary.averageExecutionTime)}ms
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-yellow-600 text-sm font-medium">⚠</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Consultas Lentas</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {performanceData.summary.slowQueries}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 text-sm font-medium">📊</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Período</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {performanceData.summary.timeRange}h
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Slow Queries */}
          {performanceData.slowQueries && performanceData.slowQueries.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Consultas Mais Lentas</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Consulta
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Coleção
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tempo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Resultados
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {performanceData.slowQueries.map((query, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {query.queryName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {query.collection}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            query.executionTime > 3000 
                              ? 'bg-red-100 text-red-800'
                              : query.executionTime > 1000
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {query.executionTime}ms
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatNumber(query.resultCount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {performanceData.recommendations && performanceData.recommendations.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recomendações de Otimização</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {performanceData.recommendations.map((rec, index) => (
                    <div key={index} className={`p-4 rounded-lg border-l-4 ${
                      rec.priority === 'high' 
                        ? 'bg-red-50 border-red-400'
                        : rec.priority === 'medium'
                        ? 'bg-yellow-50 border-yellow-400'
                        : 'bg-blue-50 border-blue-400'
                    }`}>
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            rec.priority === 'high' 
                              ? 'bg-red-100 text-red-800'
                              : rec.priority === 'medium'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {rec.priority.toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-gray-900">
                            {rec.type === 'index' ? '🔍 Índices' : 
                             rec.type === 'cache' ? '🚀 Cache' : 
                             rec.type === 'pagination' ? '📄 Paginação' : '⚡ Consulta'}
                          </h4>
                          <p className="text-sm text-gray-700 mt-1">{rec.description}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            <strong>Impacto:</strong> {rec.impact}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            <strong>Implementação:</strong> {rec.implementation}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Costs Tab */}
      {activeTab === 'costs' && costData && (
        <div className="space-y-6">
          {/* Cost Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm font-medium">🔥</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Firestore</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(costData.costs.firestore.total)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-sm font-medium">⚡</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Functions</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(costData.costs.functions.total)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 text-sm font-medium">💰</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Estimado</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(costData.costs.totalEstimated)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Usage Details */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Detalhes de Uso ({costData.period})</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Firestore</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Reads:</span>
                      <span className="text-sm font-medium">
                        {formatNumber(costData.usage.firestoreReads)} ({formatCurrency(costData.costs.firestore.reads)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Writes:</span>
                      <span className="text-sm font-medium">
                        {formatNumber(costData.usage.firestoreWrites)} ({formatCurrency(costData.costs.firestore.writes)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Storage:</span>
                      <span className="text-sm font-medium">
                        {(costData.usage.storageUsage / 1024).toFixed(2)} GB ({formatCurrency(costData.costs.firestore.storage)})
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Functions</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Invocações:</span>
                      <span className="text-sm font-medium">
                        {formatNumber(costData.usage.functionInvocations)} ({formatCurrency(costData.costs.functions.invocations)})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Compute:</span>
                      <span className="text-sm font-medium">
                        {(costData.usage.functionExecutionTime / 1000).toFixed(1)}s ({formatCurrency(costData.costs.functions.compute)})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cost Optimizations */}
          {costData.optimizations && costData.optimizations.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Oportunidades de Economia</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {costData.optimizations.map((opt, index) => (
                    <div key={index} className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900">{opt.description}</h4>
                          <p className="text-sm text-gray-600 mt-1">{opt.implementation}</p>
                        </div>
                        <div className="ml-4 text-right">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Economia: {opt.potentialSavings}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cache Tab */}
      {activeTab === 'cache' && cacheStats && (
        <div className="space-y-6">
          {/* Cache Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {Object.entries(cacheStats).map(([service, stats]) => (
              <div key={service} className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 capitalize">{service}</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.hitRate}</p>
                    <p className="text-xs text-gray-500">Taxa de Acerto</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">{stats.cacheSize}/{stats.maxSize}</p>
                    <p className="text-xs text-gray-500">Entradas</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Hits: {stats.hits}</span>
                    <span>Misses: {stats.misses}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Cache Actions */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Ações de Cache</h3>
            </div>
            <div className="p-6">
              <div className="flex space-x-4">
                <button
                  onClick={handleClearCache}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Limpar Todo Cache
                </button>
                <button
                  onClick={loadCacheStats}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Atualizar Estatísticas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Indexes Tab */}
      {activeTab === 'indexes' && indexOptimizations && (
        <div className="space-y-6">
          {/* Index Recommendations */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Índices Recomendados</h3>
            </div>
            <div className="p-6">
              {indexOptimizations.recommendedIndexes && indexOptimizations.recommendedIndexes.length > 0 ? (
                <div className="space-y-4">
                  {indexOptimizations.recommendedIndexes.map((index, i) => (
                    <div key={i} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="text-sm font-medium text-gray-900">
                        Coleção: {index.collectionGroup}
                      </h4>
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">Campos:</p>
                        <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                          {index.fields.map((field, j) => (
                            <li key={j}>
                              {field.fieldPath} ({field.order})
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Nenhuma otimização de índice necessária no momento.</p>
              )}
            </div>
          </div>

          {/* Potential Impact */}
          {indexOptimizations.potentialImpact && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Impacto Potencial</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-gray-900">
                      {indexOptimizations.potentialImpact.affectedQueries}
                    </p>
                    <p className="text-sm text-gray-500">Consultas Afetadas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-gray-900">
                      {indexOptimizations.potentialImpact.currentAverageTime}ms
                    </p>
                    <p className="text-sm text-gray-500">Tempo Atual</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-green-600">
                      {indexOptimizations.potentialImpact.estimatedNewTime}ms
                    </p>
                    <p className="text-sm text-gray-500">Tempo Estimado</p>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">
                    Melhoria Estimada: {indexOptimizations.potentialImpact.estimatedImprovement}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={loadOptimizationData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Carregando...' : 'Atualizar Dados'}
        </button>
      </div>
    </div>
  );
};

export default OptimizationDashboard;