/**
 * System Health Summary Component
 * Displays overall system health status and key metrics
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';
import { Badge } from '../common/Badge';
import { HealthStatus } from '../../../shared/types/diagnosticTypes';

const SystemHealthSummary = ({ summary, lastReport, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary && !lastReport) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-gray-500">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-medium mb-2">Nenhum diagnóstico executado</h3>
            <p>Execute um diagnóstico para ver o status do sistema</p>
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

  const formatUptime = (uptime) => {
    if (!uptime) return 'N/A';
    
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Status Geral do Sistema</span>
            {summary && (
              <Badge variant={getStatusColor(summary.overallStatus)} size="lg">
                {getStatusIcon(summary.overallStatus)} {summary.overallStatus.toUpperCase()}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lastReport && (
            <div className="text-gray-600">
              <p className="mb-2">{lastReport.summary}</p>
              <div className="text-sm">
                <span>Tempo de execução: {lastReport.executionTime}ms</span>
                <span className="mx-2">•</span>
                <span>Última atualização: {new Date(lastReport.timestamp).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Components */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Componentes</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.totalComponents}</p>
                </div>
                <div className="text-3xl">🔧</div>
              </div>
            </CardContent>
          </Card>

          {/* Healthy Components */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Componentes Saudáveis</p>
                  <p className="text-2xl font-bold text-green-600">{summary.healthyComponents}</p>
                </div>
                <div className="text-3xl">✅</div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Percentual</span>
                  <span>{Math.round((summary.healthyComponents / summary.totalComponents) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${(summary.healthyComponents / summary.totalComponents) * 100}%` }}
                  ></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Degraded Components */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Componentes Degradados</p>
                  <p className="text-2xl font-bold text-yellow-600">{summary.degradedComponents}</p>
                </div>
                <div className="text-3xl">⚠️</div>
              </div>
              {summary.degradedComponents > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Percentual</span>
                    <span>{Math.round((summary.degradedComponents / summary.totalComponents) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full" 
                      style={{ width: `${(summary.degradedComponents / summary.totalComponents) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Unhealthy Components */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Componentes Problemáticos</p>
                  <p className="text-2xl font-bold text-red-600">{summary.unhealthyComponents}</p>
                </div>
                <div className="text-3xl">❌</div>
              </div>
              {summary.unhealthyComponents > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Percentual</span>
                    <span>{Math.round((summary.unhealthyComponents / summary.totalComponents) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-red-500 h-2 rounded-full" 
                      style={{ width: `${(summary.unhealthyComponents / summary.totalComponents) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Critical Issues */}
      {lastReport && lastReport.criticalIssues && lastReport.criticalIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center">
              <span className="mr-2">🚨</span>
              Problemas Críticos ({lastReport.criticalIssues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lastReport.criticalIssues.slice(0, 5).map((issue, index) => (
                <div key={issue.id || index} className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                  <div className="text-red-500 mt-0.5">⚠️</div>
                  <div className="flex-1">
                    <p className="font-medium text-red-800">{issue.message}</p>
                    <div className="text-sm text-red-600 mt-1">
                      <span>Componente: {issue.component}</span>
                      <span className="mx-2">•</span>
                      <span>Severidade: {issue.severity}</span>
                      {issue.recommendation && (
                        <>
                          <span className="mx-2">•</span>
                          <span>Recomendação: {issue.recommendation}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {lastReport.criticalIssues.length > 5 && (
                <p className="text-sm text-gray-500 text-center">
                  E mais {lastReport.criticalIssues.length - 5} problemas críticos...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Tempo de Atividade:</span>
                <span className="font-medium">{formatUptime(summary?.uptime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Última Atualização:</span>
                <span className="font-medium">
                  {summary?.lastUpdate ? new Date(summary.lastUpdate).toLocaleString('pt-BR') : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Problemas Críticos:</span>
                <span className={`font-medium ${summary?.criticalIssues > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {summary?.criticalIssues || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <button className="w-full text-left p-2 rounded hover:bg-gray-50 text-sm">
                📊 Ver Relatório Completo
              </button>
              <button className="w-full text-left p-2 rounded hover:bg-gray-50 text-sm">
                🔧 Verificar Componentes
              </button>
              <button className="w-full text-left p-2 rounded hover:bg-gray-50 text-sm">
                🛠️ Ferramentas de Diagnóstico
              </button>
              <button className="w-full text-left p-2 rounded hover:bg-gray-50 text-sm">
                📋 Exportar Relatório
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SystemHealthSummary;