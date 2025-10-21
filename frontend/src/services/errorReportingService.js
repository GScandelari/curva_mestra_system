import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

class ErrorReportingService {
  constructor() {
    this.reportError = httpsCallable(functions, 'reportError');
    this.resolveError = httpsCallable(functions, 'resolveError');
    this.getErrorStats = httpsCallable(functions, 'getErrorStats');
    this.isEnabled = true;
    
    // Configurar captura global de erros
    this.setupGlobalErrorHandling();
  }

  setupGlobalErrorHandling() {
    // Capturar erros JavaScript não tratados
    window.addEventListener('error', (event) => {
      this.captureError({
        errorType: 'javascript_error',
        errorMessage: event.message,
        stackTrace: event.error?.stack,
        url: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno,
        severity: 'high'
      });
    });

    // Capturar promises rejeitadas não tratadas
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        errorType: 'unhandled_promise_rejection',
        errorMessage: event.reason?.message || String(event.reason),
        stackTrace: event.reason?.stack,
        severity: 'high'
      });
    });

    // Capturar erros de recursos (imagens, scripts, etc.)
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.captureError({
          errorType: 'resource_error',
          errorMessage: `Failed to load resource: ${event.target.src || event.target.href}`,
          url: event.target.src || event.target.href,
          severity: 'medium'
        });
      }
    }, true);
  }

  /**
   * Capturar e reportar erro
   */
  async captureError(errorData) {
    if (!this.isEnabled) return;

    try {
      const errorReport = {
        ...errorData,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        metadata: {
          ...errorData.metadata,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform
        }
      };

      await this.reportError(errorReport);
      
      // Log local para desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.error('Error reported:', errorReport);
      }
    } catch (error) {
      console.error('Falha ao reportar erro:', error);
    }
  }

  /**
   * Reportar erro de API
   */
  async reportApiError(endpoint, error, requestData = null) {
    await this.captureError({
      errorType: 'api_error',
      errorMessage: error.message,
      stackTrace: error.stack,
      severity: 'high',
      metadata: {
        endpoint,
        requestData,
        statusCode: error.code || error.status
      }
    });
  }

  /**
   * Reportar erro de autenticação
   */
  async reportAuthError(error, context = '') {
    await this.captureError({
      errorType: 'auth_error',
      errorMessage: error.message,
      stackTrace: error.stack,
      severity: 'high',
      metadata: {
        context,
        errorCode: error.code
      }
    });
  }

  /**
   * Reportar erro de validação
   */
  async reportValidationError(field, value, rule, message) {
    await this.captureError({
      errorType: 'validation_error',
      errorMessage: message,
      severity: 'medium',
      metadata: {
        field,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        rule
      }
    });
  }

  /**
   * Reportar erro de componente React
   */
  async reportComponentError(componentName, error, errorInfo) {
    await this.captureError({
      errorType: 'react_component_error',
      errorMessage: error.message,
      stackTrace: error.stack,
      severity: 'high',
      metadata: {
        componentName,
        componentStack: errorInfo.componentStack
      }
    });
  }

  /**
   * Reportar erro de performance
   */
  async reportPerformanceError(operation, duration, threshold) {
    await this.captureError({
      errorType: 'performance_error',
      errorMessage: `Operation ${operation} took ${duration}ms (threshold: ${threshold}ms)`,
      severity: 'medium',
      metadata: {
        operation,
        duration,
        threshold,
        exceedBy: duration - threshold
      }
    });
  }

  /**
   * Reportar erro customizado
   */
  async reportCustomError(errorType, message, severity = 'medium', metadata = {}) {
    await this.captureError({
      errorType,
      errorMessage: message,
      severity,
      metadata
    });
  }

  /**
   * Marcar erro como resolvido (apenas admins)
   */
  async markErrorAsResolved(errorId, resolution) {
    try {
      const result = await this.resolveError({ errorId, resolution });
      return result.data;
    } catch (error) {
      console.error('Erro ao resolver erro:', error);
      throw error;
    }
  }

  /**
   * Buscar estatísticas de erros (apenas admins)
   */
  async getErrorStatistics(days = 7) {
    try {
      const result = await this.getErrorStats({ days });
      return result.data;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  }

  /**
   * Configurar contexto do usuário
   */
  setUserContext(userId, userRole, clinicId) {
    this.userContext = {
      userId,
      userRole,
      clinicId
    };
  }

  /**
   * Adicionar breadcrumb (rastro de ações do usuário)
   */
  addBreadcrumb(message, category = 'user_action', data = {}) {
    if (!this.breadcrumbs) {
      this.breadcrumbs = [];
    }

    this.breadcrumbs.push({
      timestamp: new Date().toISOString(),
      message,
      category,
      data
    });

    // Manter apenas os últimos 50 breadcrumbs
    if (this.breadcrumbs.length > 50) {
      this.breadcrumbs = this.breadcrumbs.slice(-50);
    }
  }

  /**
   * Capturar erro com breadcrumbs
   */
  async captureErrorWithBreadcrumbs(errorData) {
    await this.captureError({
      ...errorData,
      metadata: {
        ...errorData.metadata,
        breadcrumbs: this.breadcrumbs || [],
        userContext: this.userContext
      }
    });
  }

  /**
   * Desabilitar relatório de erros
   */
  disable() {
    this.isEnabled = false;
    console.log('Error reporting desabilitado');
  }

  /**
   * Habilitar relatório de erros
   */
  enable() {
    this.isEnabled = true;
    console.log('Error reporting habilitado');
  }

  /**
   * Testar sistema de relatório de erros
   */
  async testErrorReporting() {
    if (process.env.NODE_ENV === 'development') {
      await this.captureError({
        errorType: 'test_error',
        errorMessage: 'Este é um erro de teste',
        severity: 'low',
        metadata: {
          test: true,
          timestamp: new Date().toISOString()
        }
      });
      console.log('Erro de teste enviado');
    }
  }
}

export default new ErrorReportingService();