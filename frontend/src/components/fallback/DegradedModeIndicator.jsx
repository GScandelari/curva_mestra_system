/**
 * Degraded Mode Indicator - Indicador de Modo Degradado
 * Mostra quando o sistema está operando em modo degradado
 */

import React, { useState, useEffect } from 'react';

const DegradedModeIndicator = () => {
  const [isDegraded, setIsDegraded] = useState(false);
  const [degradationMessage, setDegradationMessage] = useState('');
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    // Escuta eventos de degradação
    const handleDegradationChanged = (event) => {
      const { degraded, message } = event.detail;
      setIsDegraded(degraded);
      setDegradationMessage(message || 'Sistema operando em modo limitado');
      setShowIndicator(degraded);
    };

    // Escuta notificações de degradação
    const handleShowNotification = (event) => {
      const { type, message } = event.detail;
      
      if (type === 'degradation' || type === 'info') {
        setIsDegraded(true);
        setDegradationMessage(message);
        setShowIndicator(true);
        
        // Auto-hide após 10 segundos para notificações info
        if (type === 'info') {
          setTimeout(() => {
            setShowIndicator(false);
            setIsDegraded(false);
          }, 10000);
        }
      }
    };

    window.addEventListener('degradationChanged', handleDegradationChanged);
    window.addEventListener('showNotification', handleShowNotification);

    return () => {
      window.removeEventListener('degradationChanged', handleDegradationChanged);
      window.removeEventListener('showNotification', handleShowNotification);
    };
  }, []);

  const handleDismiss = () => {
    setShowIndicator(false);
    setIsDegraded(false);
  };

  if (!showIndicator || !isDegraded) return null;

  return (
    <div className="fixed top-16 right-4 z-40 max-w-sm bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg">
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-yellow-800">
              Modo Degradado
            </h3>
            <p className="mt-1 text-sm text-yellow-700">
              {degradationMessage}
            </p>
            <div className="mt-2 text-xs text-yellow-600">
              Algumas funcionalidades podem estar limitadas
            </div>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={handleDismiss}
              className="inline-flex text-yellow-400 hover:text-yellow-600 focus:outline-none focus:text-yellow-600"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DegradedModeIndicator;