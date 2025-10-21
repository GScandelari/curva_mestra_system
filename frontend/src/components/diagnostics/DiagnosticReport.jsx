/**
 * Diagnostic Report Component
 * Displays detailed diagnostic report with recommendations
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { HealthStatus } from '../../../shared/types/diagnosticTypes';

const DiagnosticReport = ({ report, isLoading }) => {
  const [expandedSection, setExpandedSection] = useState('summary');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-gray-500">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-medium mb-2">Nenhum relatório disponível</h3>
            <p>Execute um diagnóstico para gerar um relatório detalhado</p>
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

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const exportReport = () => {
    const reportData = {
      id: report.id,
      timestamp: report.timestamp,
      overallHealth: report.overallHealth,
      summary: report.summary,
      executionTime: report.executionTime,
      components: report.components?.map(c => ({
        name: c.name,
        status: c.status,
        responseTime: c.responseTime,
        errorRate: c.errorRate,
        issuesCount: c.issues?.length || 0
      })),
      criticalIssues: report.criticalIssues?.length || 0,
      recommendations: report.recommendations?.length || 0
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostic-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sections = [
    { id: 'summary', label: 'Resumo', icon: '📊' },
    { id: 'recommendations', label: 'Recomendações', icon: '💡' },
    { id: 'issues', label: 'Problemas Críticos', icon: '🚨' },
    { id: 'components', label: 'Componentes', icon: '🔧' },
    { id: 'raw', label: 'Dados Brutos', icon: '📄' }
  ];

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <span>📋</span>
                <span>Relatório de Diagnóstico</span>
                <Badge variant={getStatusColor(report.overallHealth)}>
                  {report.overallHealth.toUpperCase()}
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                ID: {report.id} • Gerado em {new Date(report.timestamp).toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="flex space-x-2">
              <Button size="sm" variant="outline" onClick={exportReport}>
                📥 Exportar
              </Button>
              <Button size="sm" variant="outline">
                🖨️ Imprimir
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Tempo de Execução:</span>
              <span className="ml-2 font-medium">{report.executionTime}ms</span>
            </div>
            <div>
              <span className="text-gray-600">Componentes Verificados:</span>
              <span className="ml-2 font-medium">{report.components?.length || 0}</span>
            </div>
            <div>
              <span className="text-gray-600">Problemas Críticos:</span>
              <span className={`ml-2 font-medium ${report.criticalIssues?.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {report.criticalIssues?.length || 0}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setExpandedSection(section.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                expandedSection === section.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{section.icon}</span>
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Section Content */}
      <div className="section-content">
        {/* Summary */}
        {expandedSection === 'summary' && (
          <Card>
            <CardHeader>
              <CardTitle>Resumo Executivo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-lg text-gray-900">
                  {report.summary}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Status dos Componentes</h4>
                    <div className="space-y-2">
                      {report.components?.reduce((acc, component) => {
                        acc[component.status] = (acc[component.status] || 0) + 1;
                        return acc;
                      }, {}) && Object.entries(
                        report.components.reduce((acc, component) => {
                          acc[component.status] = (acc[component.status] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <Badge variant={getStatusColor(status)} size="sm">
                            {status.toUpperCase()}
                          </Badge>
                          <span className="text-sm font-medium">{count} componentes</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Métricas de Performance</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tempo Médio de Resposta:</span>
                        <span className="font-medium">
                          {report.components?.length > 0 
                            ? Math.round(report.components.reduce((sum, c) => sum + (c.responseTime || 0), 0) / report.components.length)
                            : 0}ms
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Taxa de Erro Média:</span>
                        <span className="font-medium">
                          {report.components?.length > 0 
                            ? Math.round((report.components.reduce((sum, c) => sum + (c.errorRate || 0), 0) / report.components.length) * 100)
                            : 0}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Componentes com Problemas:</span>
                        <span className="font-medium">
                          {report.components?.filter(c => c.issues && c.issues.length > 0).length || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {expandedSection === 'recommendations' && (
          <div className="space-y-4">
            {report.recommendations && report.recommendations.length > 0 ? (
              report.recommendations.map((recommendation, index) => (
                <Card key={recommendation.id || index}>
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <Badge variant={getPriorityColor(recommendation.priority)}>
                          {recommendation.priority.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {recommendation.title}
                        </h3>
                        <p className="text-gray-600 mb-3">
                          {recommendation.description}
                        </p>
                        <div className="bg-blue-50 p-3 rounded-lg mb-3">
                          <h4 className="font-medium text-blue-900 mb-1">Ação Recomendada:</h4>
                          <p className="text-blue-800 text-sm">{recommendation.action}</p>
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <span>Componente: {recommendation.component}</span>
                          <span>Impacto Estimado: {recommendation.estimatedImpact}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-gray-500">
                    <div className="text-4xl mb-4">✅</div>
                    <h3 className="text-lg font-medium mb-2">Nenhuma recomendação</h3>
                    <p>O sistema está funcionando adequadamente</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Critical Issues */}
        {expandedSection === 'issues' && (
          <div className="space-y-4">
            {report.criticalIssues && report.criticalIssues.length > 0 ? (
              report.criticalIssues.map((issue, index) => (
                <Card key={issue.id || index} className="border-l-4 border-l-red-500">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="error" size="sm">
                            {issue.severity.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {issue.component}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(issue.timestamp).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {issue.message}
                        </h3>
                        {issue.recommendation && (
                          <div className="bg-yellow-50 p-3 rounded-lg">
                            <h4 className="font-medium text-yellow-900 mb-1">Recomendação:</h4>
                            <p className="text-yellow-800 text-sm">{issue.recommendation}</p>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <Badge variant={issue.resolved ? 'success' : 'error'} size="sm">
                          {issue.resolved ? 'Resolvido' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-gray-500">
                    <div className="text-4xl mb-4">✅</div>
                    <h3 className="text-lg font-medium mb-2">Nenhum problema crítico</h3>
                    <p>Todos os componentes estão funcionando adequadamente</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Components Summary */}
        {expandedSection === 'components' && (
          <Card>
            <CardHeader>
              <CardTitle>Resumo dos Componentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Componente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tempo de Resposta
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Taxa de Erro
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Problemas
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {report.components?.map((component, index) => (
                      <tr key={component.name || index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {component.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={getStatusColor(component.status)} size="sm">
                            {component.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {component.responseTime ? `${Math.round(component.responseTime)}ms` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {component.errorRate !== undefined ? `${Math.round(component.errorRate * 100)}%` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {component.issues?.length || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Raw Data */}
        {expandedSection === 'raw' && (
          <Card>
            <CardHeader>
              <CardTitle>Dados Brutos do Relatório</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                {JSON.stringify(report, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DiagnosticReport;