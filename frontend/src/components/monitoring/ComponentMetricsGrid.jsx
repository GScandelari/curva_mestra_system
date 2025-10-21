import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';

const ComponentMetricsGrid = ({ components, period }) => {
  if (!components || components.length === 0) {
    return (
      <Card>
        <CardContent>
          <div className="text-center text-gray-500">
            Nenhum componente encontrado
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'unhealthy':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'healthy':
        return 'Saudável';
      case 'degraded':
        return 'Degradado';
      case 'unhealthy':
        return 'Não Saudável';
      default:
        return 'Desconhecido';
    }
  };

  const formatResponseTime = (time) => {
    if (time < 1000) return `${Math.round(time)}ms`;
    return `${(time / 1000).toFixed(1)}s`;
  };

  const formatPercentage = (value) => {
    return `${value.toFixed(1)}%`;
  };

  const getComponentIcon = (component) => {
    switch (component.toLowerCase()) {
      case 'frontend':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
          </svg>
        );
      case 'backend':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" />
            <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V9a1 1 0 00-1-1h-1v-1z" />
          </svg>
        );
      case 'firebase':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
          </svg>
        );
      case 'auth':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Métricas por Componente
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {components.map((component, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="text-gray-600">
                    {getComponentIcon(component.component)}
                  </div>
                  <span className="capitalize">{component.component}</span>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(component.status)}`}>
                  {getStatusText(component.status)}
                </span>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Error Rate */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Taxa de Erro</span>
                <span className={`font-medium ${component.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatPercentage(component.errorRate)}
                </span>
              </div>

              {/* Response Time */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tempo de Resposta</span>
                <span className={`font-medium ${component.responseTime > 2000 ? 'text-red-600' : component.responseTime > 1000 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {formatResponseTime(component.responseTime)}
                </span>
              </div>

              {/* Availability */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Disponibilidade</span>
                <span className={`font-medium ${component.availability < 95 ? 'text-red-600' : component.availability < 99 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {formatPercentage(component.availability)}
                </span>
              </div>

              {/* Throughput */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Throughput</span>
                <span className="font-medium text-gray-900">
                  {component.throughput.toFixed(1)} req/s
                </span>
              </div>

              {/* Last Updated */}
              <div className="pt-2 border-t border-gray-200">
                <span className="text-xs text-gray-500">
                  Atualizado: {new Date(component.lastUpdated).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ComponentMetricsGrid;