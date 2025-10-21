/**
 * Diagnostic Dashboard Component
 * Main interface for system health monitoring and diagnostics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Spinner } from '../common/Spinner';
import { Alert } from '../alerts/Alert';
import SystemHealthSummary from './SystemHealthSummary';
import ComponentHealthList from './ComponentHealthList';
import DiagnosticReport from './DiagnosticReport';
import ManualDiagnosticTools from './ManualDiagnosticTools';
import { useDiagnostics } from '../../hooks/useDiagnostics';
import { HealthStatus } from '../../../shared/types/diagnosticTypes';

const DiagnosticDashboard = () => {
  const {
    isRunning,
    lastReport,
    healthSummary,
    runDiagnostic,
    startMonitoring,
    stopMonitoring,
    isMonitoring,
    error
  } = useDiagnostics();

  const [selectedTab, setSelectedTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Auto-refresh functionality
  useEffect(() => {
    let interval;
    if (autoRefresh && !isMonitoring) {
      interval = setInterval(() => {
        runDiagnostic();
      }, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, isMonitoring, runDiagnostic]);

  const handleRunDiagnostic = useCallback(async () => {
    try {
      await runDiagnostic();
    } catch (error) {
      console.error('Failed to run diagnostic:', error);
    }
  }, [runDiagnostic]);

  const handleToggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
  }, [isMonitoring, startMonitoring, stopMonitoring]);

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

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: '📊' },
    { id: 'components', label: 'Componentes', icon: '🔧' },
    { id: 'report', label: 'Relatório Detalhado', icon: '📋' },
    { id: 'tools', label: 'Ferramentas', icon: '🛠️' }
  ];

  return (
    <div className="diagnostic-dashboard p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Sistema de Diagnóstico
          </h1>
          <p className="text-gray-600 mt-1">
            Monitoramento de saúde e diagnóstico automatizado
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {healthSummary && (
            <Badge variant={getStatusColor(healthSummary.overallStatus)}>
              {healthSummary.overallStatus.toUpperCase()}
            </Badge>
          )}
          
          <Button
            onClick={handleRunDiagnostic}
            disabled={isRunning}
            variant="primary"
            size="sm"
          >
            {isRunning ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Executando...
              </>
            ) : (
              '🔍 Executar Diagnóstico'
            )}
          </Button>
          
          <Button
            onClick={handleToggleMonitoring}
            variant={isMonitoring ? 'secondary' : 'outline'}
            size="sm"
          >
            {isMonitoring ? (
              <>
                ⏸️ Parar Monitoramento
              </>
            ) : (
              '▶️ Iniciar Monitoramento'
            )}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="error" className="mb-4">
          <strong>Erro no Diagnóstico:</strong> {error}
        </Alert>
      )}

      {/* Status Indicators */}
      <div className="flex items-center space-x-4 text-sm text-gray-600">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span>Monitoramento: {isMonitoring ? 'Ativo' : 'Inativo'}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="autoRefresh"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="autoRefresh">Atualização Automática</label>
        </div>
        
        {lastReport && (
          <span>
            Última verificação: {new Date(lastReport.timestamp).toLocaleString('pt-BR')}
          </span>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                selectedTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {selectedTab === 'overview' && (
          <SystemHealthSummary 
            summary={healthSummary}
            lastReport={lastReport}
            isLoading={isRunning}
          />
        )}
        
        {selectedTab === 'components' && (
          <ComponentHealthList 
            components={lastReport?.components || []}
            isLoading={isRunning}
          />
        )}
        
        {selectedTab === 'report' && (
          <DiagnosticReport 
            report={lastReport}
            isLoading={isRunning}
          />
        )}
        
        {selectedTab === 'tools' && (
          <ManualDiagnosticTools 
            onRunDiagnostic={handleRunDiagnostic}
            isRunning={isRunning}
          />
        )}
      </div>

      {/* Loading Overlay */}
      {isRunning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-sm">
            <div className="text-center">
              <Spinner size="lg" className="mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Executando Diagnóstico
              </h3>
              <p className="text-gray-600">
                Verificando a saúde do sistema...
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DiagnosticDashboard;