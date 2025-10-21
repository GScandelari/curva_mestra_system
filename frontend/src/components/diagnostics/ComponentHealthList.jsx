/**
 * Component Health List
 * Displays detailed health status for each system component
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { HealthStatus } from '../../../shared/types/diagnosticTypes';

const ComponentHealthList = ({ components = [], isLoading }) => {
  const [expandedComponent, setExpandedComponent] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded mb-2 w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-20"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!components || components.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-gray-500">
            <div className="text-4xl mb-4">🔧</div>
            <h3 className="text-lg font-medium mb-2">Nenhum componente encontrado</h3>
            <p>Execute um diagnóstico para ver o status dos componentes</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case HealthStatus.HEALTHY:
        return 'success';
      case HealthStatus.DEGRADED:
        return 'warning';
      case HealthStatus.UNHEALTHY:
        return 'error';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case HealthStatus.HEALTHY:
        return '✅';
      case HealthStatus.DEGRADED:
        return '⚠️';
      case HealthStatus.UNHEALTHY:
        return '❌';
      default:
        return '❓';
    }
  };

  const getComponentIcon = (componentName) => {
    const name = componentName.toLowerCase();
    if (name.includes('firebase')) return '🔥';
    if (name.includes('api') || name.includes('backend')) return '🌐';
    if (name.includes('database') || name.includes('db')) return '🗄️';
    if (name.includes('auth')) return '🔐';
    if (name.includes('config')) return '⚙️';
    if (name.includes('performance')) return '⚡';
    return '🔧';
  };

  // Filter and sort components
  const filteredComponents = components
    .filter(component => {
      if (filterStatus === 'all') return true;
      return component.status === filterStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status':
          const statusOrder = { healthy: 0, degraded: 1, unhealthy: 2, unknown: 3 };
          return statusOrder[a.status] - statusOrder[b.status];
        case 'responseTime':
          return (b.responseTime || 0) - (a.responseTime || 0);
        case 'issues':
          return (b.issues?.length || 0) - (a.issues?.length || 0);
        default:
          return 0;
      }
    });

  const toggleExpanded = (componentName) => {
    setExpandedComponent(expandedComponent === componentName ? null : componentName);
  };

  const formatResponseTime = (time) => {
    if (!time) return 'N/A';
    return `${Math.round(time)}ms`;
  };

  const formatErrorRate = (rate) => {
    if (rate === undefined || rate === null) return 'N/A';
    return `${Math.round(rate * 100)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">Filtrar por Status:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 text-sm"
                >
                  <option value="all">Todos</option>
                  <option value="healthy">Saudáveis</option>
                  <option value="degraded">Degradados</option>
                  <option value="unhealthy">Problemáticos</option>
                  <option value="unknown">Desconhecidos</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">Ordenar por:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 text-sm"
                >
                  <option value="name">Nome</option>
                  <option value="status">Status</option>
                  <option value="responseTime">Tempo de Resposta</option>
                  <option value="issues">Número de Problemas</option>
                </select>
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              {filteredComponents.length} de {components.length} componentes
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Components List */}
      <div className="space-y-4">
        {filteredComponents.map((component) => (
          <Card key={component.name} className="overflow-hidden">
            <CardContent className="p-0">
              {/* Component Header */}
              <div 
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpanded(component.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">
                      {getComponentIcon(component.name)}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {component.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Última verificação: {new Date(component.lastChecked).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right text-sm text-gray-600">
                      <div>Tempo: {formatResponseTime(component.responseTime)}</div>
                      <div>Erros: {formatErrorRate(component.errorRate)}</div>
                    </div>
                    
                    <Badge variant={getStatusColor(component.status)}>
                      {getStatusIcon(component.status)} {component.status.toUpperCase()}
                    </Badge>
                    
                    <div className="text-gray-400">
                      {expandedComponent === component.name ? '▼' : '▶'}
                    </div>
                  </div>
                </div>
                
                {/* Issues Summary */}
                {component.issues && component.issues.length > 0 && (
                  <div className="mt-3 flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Problemas:</span>
                    <div className="flex space-x-2">
                      {component.issues.slice(0, 3).map((issue, index) => (
                        <Badge 
                          key={index} 
                          variant={issue.severity === 'critical' ? 'error' : 'warning'}
                          size="sm"
                        >
                          {issue.severity}
                        </Badge>
                      ))}
                      {component.issues.length > 3 && (
                        <span className="text-sm text-gray-500">
                          +{component.issues.length - 3} mais
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Expanded Details */}
              {expandedComponent === component.name && (
                <div className="border-t border-gray-200 bg-gray-50">
                  <div className="p-6 space-y-6">
                    {/* Component Details */}
                    {component.details && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Detalhes</h4>
                        <p className="text-sm text-gray-600">{component.details}</p>
                      </div>
                    )}

                    {/* Metrics */}
                    {component.metrics && Object.keys(component.metrics).length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Métricas</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {Object.entries(component.metrics).map(([key, value]) => (
                            <div key={key} className="bg-white p-3 rounded border">
                              <div className="text-xs text-gray-500 uppercase tracking-wide">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </div>
                              <div className="text-sm font-medium text-gray-900 mt-1">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Issues */}
                    {component.issues && component.issues.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">
                          Problemas ({component.issues.length})
                        </h4>
                        <div className="space-y-3">
                          {component.issues.map((issue, index) => (
                            <div 
                              key={issue.id || index} 
                              className="bg-white p-4 rounded border-l-4 border-l-red-400"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <Badge 
                                      variant={issue.severity === 'critical' ? 'error' : 'warning'}
                                      size="sm"
                                    >
                                      {issue.severity}
                                    </Badge>
                                    <span className="text-xs text-gray-500">
                                      {new Date(issue.timestamp).toLocaleString('pt-BR')}
                                    </span>
                                  </div>
                                  <p className="text-sm font-medium text-gray-900 mb-1">
                                    {issue.message}
                                  </p>
                                  {issue.recommendation && (
                                    <p className="text-sm text-gray-600">
                                      <strong>Recomendação:</strong> {issue.recommendation}
                                    </p>
                                  )}
                                </div>
                                <div className="ml-4">
                                  <Badge variant={issue.resolved ? 'success' : 'secondary'} size="sm">
                                    {issue.resolved ? 'Resolvido' : 'Pendente'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-3 pt-4 border-t border-gray-200">
                      <Button size="sm" variant="outline">
                        🔍 Verificar Novamente
                      </Button>
                      <Button size="sm" variant="outline">
                        📋 Ver Logs
                      </Button>
                      <Button size="sm" variant="outline">
                        🛠️ Executar Correção
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredComponents.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-gray-500">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-medium mb-2">Nenhum componente encontrado</h3>
              <p>Tente ajustar os filtros ou execute um novo diagnóstico</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ComponentHealthList;