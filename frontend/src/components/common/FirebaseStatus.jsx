import React from 'react';
import { Wifi, WifiOff, Database, Users, Clock } from 'lucide-react';
import { useFirebaseCache } from '../../hooks/useFirebaseData';

/**
 * Firebase Status Component
 * 
 * Shows the current Firebase connection status, cache info, and active listeners
 */
const FirebaseStatus = ({ className = '' }) => {
  const { isOnline, cacheSize, activeListeners, clearCache } = useFirebaseCache();

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Status do Firebase</h3>
        <button
          onClick={clearCache}
          className="text-xs text-blue-600 hover:text-blue-800"
          title="Limpar cache offline"
        >
          Limpar Cache
        </button>
      </div>
      
      <div className="space-y-2">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500 mr-2" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500 mr-2" />
            )}
            <span className="text-sm text-gray-700">Conexão</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${
            isOnline 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Cache Size */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Database className="h-4 w-4 text-blue-500 mr-2" />
            <span className="text-sm text-gray-700">Cache</span>
          </div>
          <span className="text-xs text-gray-600">
            {cacheSize} {cacheSize === 1 ? 'item' : 'itens'}
          </span>
        </div>

        {/* Active Listeners */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Clock className="h-4 w-4 text-purple-500 mr-2" />
            <span className="text-sm text-gray-700">Tempo Real</span>
          </div>
          <span className="text-xs text-gray-600">
            {activeListeners} {activeListeners === 1 ? 'listener' : 'listeners'}
          </span>
        </div>
      </div>

      {/* Offline Notice */}
      {!isOnline && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          <div className="flex items-center">
            <WifiOff className="h-3 w-3 mr-1" />
            Modo offline ativo. Os dados podem estar desatualizados.
          </div>
        </div>
      )}
    </div>
  );
};

export default FirebaseStatus;