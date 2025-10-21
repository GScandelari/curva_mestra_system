import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';

const SystemHealthOverview = ({ systemMetrics, healthScore }) => {
  if (!systemMetrics) {
    return (
      <Card>
        <CardContent>
          <div className="text-center text-gray-500">
            Carregando dados de saúde do sistema...
          </div>
        </CardContent>
      </Card>
    );
  }

  const getHealthColor = (score) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 70) return 'text-yellow-600 bg-yellow-100';
    if (score >= 50) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getHealthStatus = (score) => {
    if (score >= 90) return 'Excelente';
    if (score >= 70) return 'Bom';
    if (score >= 50) return 'Degradado';
    return 'Crítico';
  };

  const formatResponseTime = (time) => {
    if (time < 1000) return `${Math.round(time)}ms`;
    return `${(time / 1000).toFixed(1)}s`;
  };

  const formatAvailability = (availability) => {
    return `${availability.toFixed(2)}%`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Overall Health Score */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Saúde Geral</p>
              <div className="flex items-center mt-2">
                <span className={`text-2xl font-bold ${getHealthColor(healthScore).split(' ')[0]}`}>
                  {Math.round(healthScore)}%
                </span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getHealthColor(healthScore)}`}>
                  {getHealthStatus(healthScore)}
                </span>
              </div>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getHealthColor(healthScore).split(' ')[1]}`}>
              <svg className={`w-6 h-6 ${getHealthColor(healthScore).split(' ')[0]}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Errors */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Erros</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {systemMetrics.totalErrors}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Average Response Time */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tempo de Resposta</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatResponseTime(systemMetrics.averageResponseTime)}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Availability */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Disponibilidade</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatAvailability(systemMetrics.systemAvailability)}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemHealthOverview;