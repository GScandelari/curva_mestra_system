/**
 * Fallback Data Indicator - Indicador de Dados de Fallback
 * Mostra quando dados são provenientes de cache ou fallback
 */

import React from 'react';

const FallbackDataIndicator = ({ 
  source, 
  message, 
  timestamp, 
  onRefresh,
  className = '' 
}) => {
  if (!source || source === 'api') return null;

  const getIndicatorConfig = () => {
    switch (source) {
      case 'cache':
        return {
          color: 'blue',
          icon: '💾',
          title: 'Dados do Cache',
          description: message || 'Dados podem estar desatualizados'
        };
      case 'offline':
        return {
          color: 'orange',
          icon: '📱',
          title: 'Dados Offline',
          description: message || 'Dados offline (podem estar muito desatualizados)'
        };
      case 'fallback':
        return {
          color: 'gray',
          icon: '🔄',
          title: 'Dados de Fallback',
          description: message || 'Dados de fallback padrão'
        };
      default:
        return {
          color: 'gray',
          icon: '⚠️',
          title: 'Dados Alternativos',
          description: message || 'Dados de fonte alternativa'
        };
    }
  };

  const config = getIndicatorConfig();
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-800'
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    return `${diffDays} dias atrás`;
  };

  return (
    <div className={`border rounded-lg p-3 mb-4 ${colorClasses[config.color]} ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2">
          <span className="text-lg">{config.icon}</span>
          <div>
            <h4 className="text-sm font-medium">{config.title}</h4>
            <p className="text-xs mt-1 opacity-90">{config.description}</p>
            {timestamp && (
              <p className="text-xs mt-1 opacity-75">
                Atualizado: {formatTimestamp(timestamp)}
              </p>
            )}
          </div>
        </div>
        
        {onRefresh && (
          <button
            onClick={onRefresh}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              config.color === 'blue' 
                ? 'border-blue-300 hover:bg-blue-100' 
                : config.color === 'orange'
                ? 'border-orange-300 hover:bg-orange-100'
                : 'border-gray-300 hover:bg-gray-100'
            }`}
          >
            Atualizar
          </button>
        )}
      </div>
    </div>
  );
};

export default FallbackDataIndicator;