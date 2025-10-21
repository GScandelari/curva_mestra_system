import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import analyticsService from '../services/analyticsService';

/**
 * Hook para integração com Firebase Analytics
 */
export const useAnalytics = () => {
  const location = useLocation();
  const { user } = useAuth();

  // Configurar usuário quando autenticar
  useEffect(() => {
    if (user) {
      analyticsService.setUser(user.uid, {
        role: user.role,
        clinicId: user.clinicId
      });
    }
  }, [user]);

  // Rastrear mudanças de página
  useEffect(() => {
    const pageName = location.pathname;
    const pageTitle = document.title;
    
    analyticsService.trackPageView(pageName, pageTitle);
  }, [location]);

  return {
    // Eventos de autenticação
    trackLogin: analyticsService.trackLogin.bind(analyticsService),
    trackLogout: analyticsService.trackLogout.bind(analyticsService),
    trackSignUp: analyticsService.trackSignUp.bind(analyticsService),

    // Eventos de produtos
    trackProductView: analyticsService.trackProductView.bind(analyticsService),
    trackProductCreate: analyticsService.trackProductCreate.bind(analyticsService),
    trackProductUpdate: analyticsService.trackProductUpdate.bind(analyticsService),
    trackProductDelete: analyticsService.trackProductDelete.bind(analyticsService),

    // Eventos de solicitações
    trackRequestCreate: analyticsService.trackRequestCreate.bind(analyticsService),
    trackRequestUpdate: analyticsService.trackRequestUpdate.bind(analyticsService),

    // Eventos de pacientes
    trackPatientCreate: analyticsService.trackPatientCreate.bind(analyticsService),
    trackPatientView: analyticsService.trackPatientView.bind(analyticsService),

    // Eventos de notas fiscais
    trackInvoiceCreate: analyticsService.trackInvoiceCreate.bind(analyticsService),

    // Eventos de busca
    trackSearch: analyticsService.trackSearch.bind(analyticsService),

    // Eventos de erro
    trackError: analyticsService.trackError.bind(analyticsService),

    // Eventos de performance
    trackPerformance: analyticsService.trackPerformance.bind(analyticsService),

    // Eventos customizados
    trackCustomEvent: analyticsService.trackCustomEvent.bind(analyticsService),

    // Configurações
    setCustomProperties: analyticsService.setCustomProperties.bind(analyticsService),
    disable: analyticsService.disable.bind(analyticsService),
    enable: analyticsService.enable.bind(analyticsService)
  };
};

/**
 * Hook para rastreamento de performance
 */
export const usePerformanceTracking = () => {
  const trackTiming = (actionName, startTime) => {
    const duration = Date.now() - startTime;
    analyticsService.trackPerformance(actionName, duration);
  };

  const trackAsyncAction = async (actionName, asyncFunction) => {
    const startTime = Date.now();
    try {
      const result = await asyncFunction();
      trackTiming(actionName, startTime);
      return result;
    } catch (error) {
      trackTiming(`${actionName}_error`, startTime);
      analyticsService.trackError('async_action_error', error.message, actionName);
      throw error;
    }
  };

  return {
    trackTiming,
    trackAsyncAction
  };
};