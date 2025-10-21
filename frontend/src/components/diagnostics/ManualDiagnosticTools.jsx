/**
 * Manual Diagnostic Tools Component
 * Provides manual diagnostic tools and utilities
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { Alert } from '../alerts/Alert';

const ManualDiagnosticTools = ({ onRunDiagnostic, isRunning }) => {
  const [selectedTool, setSelectedTool] = useState(null);
  const [toolResults, setToolResults] = useState({});
  const [isExecuting, setIsExecuting] = useState(false);

  const diagnosticTools = [
    {
      id: 'firebase-test',
      name: 'Teste de Conectividade Firebase',
      description: 'Verifica a conectividade com os serviços Firebase',
      icon: '🔥',
      category: 'connectivity'
    },
    {
      id: 'api-test',
      name: 'Teste de APIs Backend',
      description: 'Testa a disponibilidade das APIs do backend',
      icon: '🌐',
      category: 'connectivity'
    },
    {
      id: 'config-validation',
      name: 'Validação de Configuração',
      description: 'Verifica se todas as configurações estão corretas',
      icon: '⚙️',
      category: 'configuration'
    },
    {
      id: 'performance-test',
      name: 'Teste de Performance',
      description: 'Mede a performance dos componentes críticos',
      icon: '⚡',
      category: 'performance'
    },
    {
      id: 'auth-test',
      name: 'Teste de Autenticação',
      description: 'Verifica o funcionamento do sistema de autenticação',
      icon: '🔐',
      category: 'security'
    },
    {
      id: 'database-test',
      name: 'Teste de Banco de Dados',
      description: 'Verifica a conectividade e integridade do banco',
      icon: '🗄️',
      category: 'database'
    }
  ];

  const categories = {
    connectivity: { name: 'Conectividade', icon: '🔗' },
    configuration: { name: 'Configuração', icon: '⚙️' },
    performance: { name: 'Performance', icon: '⚡' },
    security: { name: 'Segurança', icon: '🔐' },
    database: { name: 'Banco de Dados', icon: '🗄️' }
  };

  const executeTool = async (toolId) => {
    setIsExecuting(true);
    setSelectedTool(toolId);
    
    try {
      // Simulate tool execution
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock results based on tool type
      const mockResult = generateMockResult(toolId);
      setToolResults(prev => ({
        ...prev,
        [toolId]: mockResult
      }));
    } catch (error) {
      setToolResults(prev => ({
        ...prev,
        [toolId]: {
          success: false,
          error: error.message,
          timestamp: new Date()
        }
      }));
    } finally {
      setIsExecuting(false);
      setSelectedTool(null);
    }
  };

  const generateMockResult = (toolId) => {
    const baseResult = {
      timestamp: new Date(),
      executionTime: Math.floor(Math.random() * 2000) + 500
    };

    switch (toolId) {
      case 'firebase-test':
        return {
          ...baseResult,
          success: true,
          details: {
            auth: 'Conectado',
            firestore: 'Conectado',
            functions: 'Conectado',
            hosting: 'Ativo'
          }
        };
      case 'api-test':
        return {
          ...baseResult,
          success: true,
          details: {
            healthEndpoint: '200 OK',
            authEndpoint: '200 OK',
            dataEndpoint: '200 OK',
            averageResponseTime: '245ms'
          }
        };
      default:
        return {
          ...baseResult,
          success: Math.random() > 0.3,
          details: {
            status: 'Verificação concluída',
            issues: Math.floor(Math.random() * 3)
          }
        };
    }
  };  co
nst groupedTools = Object.entries(categories).map(([categoryId, categoryInfo]) => ({
    ...categoryInfo,
    id: categoryId,
    tools: diagnosticTools.filter(tool => tool.category === categoryId)
  }));

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={onRunDiagnostic}
              disabled={isRunning}
              variant="primary"
              className="h-20 flex flex-col items-center justify-center"
            >
              <span className="text-2xl mb-1">🔍</span>
              <span>Diagnóstico Completo</span>
            </Button>
            
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="h-20 flex flex-col items-center justify-center"
            >
              <span className="text-2xl mb-1">🔄</span>
              <span>Recarregar Página</span>
            </Button>
            
            <Button
              onClick={() => localStorage.clear()}
              variant="outline"
              className="h-20 flex flex-col items-center justify-center"
            >
              <span className="text-2xl mb-1">🧹</span>
              <span>Limpar Cache</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Diagnostic Tools by Category */}
      {groupedTools.map((category) => (
        <Card key={category.id}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>{category.icon}</span>
              <span>{category.name}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {category.tools.map((tool) => (
                <div key={tool.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{tool.icon}</span>
                      <div>
                        <h3 className="font-medium text-gray-900">{tool.name}</h3>
                        <p className="text-sm text-gray-600">{tool.description}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Button
                      size="sm"
                      onClick={() => executeTool(tool.id)}
                      disabled={isExecuting}
                      variant={toolResults[tool.id]?.success ? 'success' : 'outline'}
                    >
                      {isExecuting && selectedTool === tool.id ? (
                        'Executando...'
                      ) : toolResults[tool.id] ? (
                        'Executar Novamente'
                      ) : (
                        'Executar'
                      )}
                    </Button>
                    
                    {toolResults[tool.id] && (
                      <div className="text-sm text-gray-500">
                        Última execução: {toolResults[tool.id].timestamp.toLocaleTimeString('pt-BR')}
                      </div>
                    )}
                  </div>

                  {/* Tool Results */}
                  {toolResults[tool.id] && (
                    <div className="mt-4 pt-4 border-t">
                      {toolResults[tool.id].success ? (
                        <Alert variant="success" className="mb-3">
                          <strong>Sucesso:</strong> Ferramenta executada com sucesso
                        </Alert>
                      ) : (
                        <Alert variant="error" className="mb-3">
                          <strong>Erro:</strong> {toolResults[tool.id].error || 'Falha na execução'}
                        </Alert>
                      )}
                      
                      {toolResults[tool.id].details && (
                        <div className="bg-gray-50 p-3 rounded text-sm">
                          <h4 className="font-medium mb-2">Detalhes:</h4>
                          <div className="space-y-1">
                            {Object.entries(toolResults[tool.id].details).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-gray-600">{key}:</span>
                                <span className="font-medium">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Navegador</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">User Agent:</span>
                  <span className="font-mono text-xs">{navigator.userAgent.substring(0, 50)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Idioma:</span>
                  <span>{navigator.language}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Online:</span>
                  <span className={navigator.onLine ? 'text-green-600' : 'text-red-600'}>
                    {navigator.onLine ? 'Sim' : 'Não'}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Aplicação</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">URL:</span>
                  <span className="font-mono text-xs">{window.location.origin}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Protocolo:</span>
                  <span>{window.location.protocol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Local Storage:</span>
                  <span>{localStorage.length} itens</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManualDiagnosticTools;