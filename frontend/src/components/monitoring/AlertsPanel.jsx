import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';

const AlertsPanel = ({ alerts, showHistory = false }) => {
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('timestamp');

  if (!alerts || alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {showHistory ? 'Histórico de Alertas' : 'Alertas Ativos'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            {showHistory ? 'Nenhum alerta no período selecionado' : 'Nenhum alerta ativo'}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityText = (severity) => {
    switch (severity) {
      case 'critical':
        return 'Crítico';
      case 'high':
        return 'Alto';
      case 'medium':
        return 'Médio';
      case 'low':
        return 'Baixo';
      default:
        return 'Desconhecido';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return (
          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'high':
        return (
          <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    if (filter === 'active') return !alert.resolved;
    if (filter === 'resolved') return alert.resolved;
    return alert.severity === filter;
  });

  const sortedAlerts = [...filteredAlerts].sort((a, b) => {
    switch (sortBy) {
      case 'timestamp':
        return new Date(b.timestamp) - new Date(a.timestamp);
      case 'severity':
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      case 'component':
        return a.component.localeCompare(b.component);
      default:
        return 0;
    }
  });

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffMs = now - alertTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    return `${diffDays}d atrás`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>
            {showHistory ? 'Histórico de Alertas' : 'Alertas Ativos'}
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({filteredAlerts.length})
            </span>
          </CardTitle>
          
          <div className="flex items-center space-x-4">
            {/* Filter */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1"
            >
              <option value="all">Todos</option>
              {!showHistory && <option value="active">Ativos</option>}
              {showHistory && <option value="resolved">Resolvidos</option>}
              <option value="critical">Críticos</option>
              <option value="high">Altos</option>
              <option value="medium">Médios</option>
              <option value="low">Baixos</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1"
            >
              <option value="timestamp">Data</option>
              <option value="severity">Severidade</option>
              <option value="component">Componente</option>
            </select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {sortedAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded-lg p-4 ${getSeverityColor(alert.severity)} ${alert.resolved ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getSeverityIcon(alert.severity)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-medium text-gray-900">
                        {alert.title}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                        {getSeverityText(alert.severity)}
                      </span>
                      {alert.resolved && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Resolvido
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-700 mt-1">
                      {alert.message}
                    </p>
                    
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-600">
                      <span>Componente: {alert.component}</span>
                      {alert.metric && (
                        <span>Métrica: {alert.metric}</span>
                      )}
                      {alert.currentValue !== undefined && alert.threshold !== undefined && (
                        <span>
                          Valor: {alert.currentValue} (limite: {alert.threshold})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs text-gray-500">
                    {formatTimeAgo(alert.timestamp)}
                  </div>
                  {alert.resolved && alert.resolvedAt && (
                    <div className="text-xs text-green-600 mt-1">
                      Resolvido {formatTimeAgo(alert.resolvedAt)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AlertsPanel;