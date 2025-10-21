import { getAnalytics, logEvent, setUserProperties, setUserId } from 'firebase/analytics';
import app from '../config/firebase';

// Verificar se analytics está disponível
let analyticsAvailable = false;
try {
  // Tentar importar analytics
  import('firebase/analytics').then(() => {
    analyticsAvailable = true;
  });
} catch (error) {
  console.warn('Firebase Analytics não disponível:', error);
}

class AnalyticsService {
  constructor() {
    this.analytics = null;
    this.isEnabled = false;
    this.initializeAnalytics();
  }

  async initializeAnalytics() {
    try {
      // Verificar se está em produção e se analytics está disponível
      if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined' && analyticsAvailable) {
        const { getAnalytics } = await import('firebase/analytics');
        this.analytics = getAnalytics(app);
        this.isEnabled = true;
        console.log('Firebase Analytics inicializado');
      }
    } catch (error) {
      console.warn('Firebase Analytics não disponível:', error);
      this.isEnabled = false;
    }
  }

  // Configurar usuário para analytics
  setUser(userId, userProperties = {}) {
    if (!this.isEnabled) return;

    try {
      setUserId(this.analytics, userId);
      setUserProperties(this.analytics, {
        role: userProperties.role || 'unknown',
        clinic_id: userProperties.clinicId || 'unknown',
        ...userProperties
      });
    } catch (error) {
      console.error('Erro ao configurar usuário no Analytics:', error);
    }
  }

  // Eventos de autenticação
  trackLogin(method = 'email') {
    this.logEvent('login', { method });
  }

  trackLogout() {
    this.logEvent('logout');
  }

  trackSignUp(method = 'email') {
    this.logEvent('sign_up', { method });
  }

  // Eventos de produtos
  trackProductView(productId, productName, category) {
    this.logEvent('view_item', {
      item_id: productId,
      item_name: productName,
      item_category: category
    });
  }

  trackProductCreate(productId, productName, category) {
    this.logEvent('add_to_inventory', {
      item_id: productId,
      item_name: productName,
      item_category: category
    });
  }

  trackProductUpdate(productId, productName, updateType) {
    this.logEvent('update_inventory', {
      item_id: productId,
      item_name: productName,
      update_type: updateType
    });
  }

  trackProductDelete(productId, productName) {
    this.logEvent('remove_from_inventory', {
      item_id: productId,
      item_name: productName
    });
  }

  // Eventos de solicitações
  trackRequestCreate(requestId, requestType) {
    this.logEvent('create_request', {
      request_id: requestId,
      request_type: requestType
    });
  }

  trackRequestUpdate(requestId, status, previousStatus) {
    this.logEvent('update_request', {
      request_id: requestId,
      new_status: status,
      previous_status: previousStatus
    });
  }

  // Eventos de pacientes
  trackPatientCreate(patientId) {
    this.logEvent('create_patient', {
      patient_id: patientId
    });
  }

  trackPatientView(patientId) {
    this.logEvent('view_patient', {
      patient_id: patientId
    });
  }

  // Eventos de notas fiscais
  trackInvoiceCreate(invoiceId, invoiceNumber, totalValue) {
    this.logEvent('create_invoice', {
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      value: totalValue
    });
  }

  // Eventos de navegação
  trackPageView(pageName, pageTitle) {
    this.logEvent('page_view', {
      page_title: pageTitle,
      page_location: window.location.href,
      page_name: pageName
    });
  }

  // Eventos de busca
  trackSearch(searchTerm, searchCategory) {
    this.logEvent('search', {
      search_term: searchTerm,
      search_category: searchCategory
    });
  }

  // Eventos de erro
  trackError(errorType, errorMessage, errorLocation) {
    this.logEvent('exception', {
      description: errorMessage,
      fatal: false,
      error_type: errorType,
      error_location: errorLocation
    });
  }

  // Eventos de performance
  trackPerformance(actionName, duration) {
    this.logEvent('timing_complete', {
      name: actionName,
      value: duration
    });
  }

  // Eventos customizados
  trackCustomEvent(eventName, parameters = {}) {
    this.logEvent(eventName, parameters);
  }

  // Método base para log de eventos
  logEvent(eventName, parameters = {}) {
    if (!this.isEnabled) return;

    try {
      // Adicionar timestamp e informações de contexto
      const eventData = {
        ...parameters,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        screen_resolution: `${screen.width}x${screen.height}`
      };

      logEvent(this.analytics, eventName, eventData);
      
      // Log para desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.log('Analytics Event:', eventName, eventData);
      }
    } catch (error) {
      console.error('Erro ao registrar evento no Analytics:', error);
    }
  }

  // Configurar propriedades customizadas
  setCustomProperties(properties) {
    if (!this.isEnabled) return;

    try {
      setUserProperties(this.analytics, properties);
    } catch (error) {
      console.error('Erro ao configurar propriedades customizadas:', error);
    }
  }

  // Desabilitar analytics (LGPD/GDPR)
  disable() {
    this.isEnabled = false;
    console.log('Firebase Analytics desabilitado');
  }

  // Habilitar analytics
  enable() {
    if (this.analytics) {
      this.isEnabled = true;
      console.log('Firebase Analytics habilitado');
    }
  }
}

export default new AnalyticsService();