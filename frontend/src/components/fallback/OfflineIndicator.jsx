/**
 * Offline Indicator - Indicador de Modo Offline
 * Mostra status de conexão e modo offline
 */

import React, { useState, useEffect } from 'react';

const OfflineIndicator = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    // Detecta mudanças na conexão
    const handleOnline = () => {
      setIsOffline(false);
      setShowIndicator(true);
      
      // Esconde indicador após 3 segundos quando volta online
      setTimeout(() => setShowIndicator(false), 3000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowIndicator(true);
    };

    // Detecta mudanças no modo offline customizado
    const handleOfflineModeChanged = (event) => {
      setIsOffline(event.detail.offline);
      setShowIndicator(true);
      
      // Se voltou online, esconde após 3 segundos
      if (!event.detail.offline) {
        setTimeout(() => setShowIndicator(false), 3000);
      }
    };

    // Adiciona listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offlineModeChanged', handleOfflineModeChanged);

    // Verifica estado inicial
    setIsOffline(!navigator.onLine);
    setShowIndicator(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offlineModeChanged', handleOfflineModeChanged);
    };
  }, []);

  if (!showIndicator) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg transition-all duration-300 ${
      isOffline 
        ? 'bg-orange-500 text-white' 
        : 'bg-green-500 text-white'
    }`}>
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${
          isOffline ? 'bg-orange-200' : 'bg-green-200'
        }`} />
        <span className="text-sm font-medium">
          {isOffline ? 'Modo Offline' : 'Conexão Restaurada'}
        </span>
        {isOffline && (
          <div className="text-xs opacity-90">
            Usando dados locais
          </div>
        )}
      </div>
    </div>
  );
};

export default OfflineIndicator;