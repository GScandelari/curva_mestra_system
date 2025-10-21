import { getPerformance, trace } from 'firebase/performance';
import app from '../config/firebase';

// Verificar se performance está disponível
let performanceAvailable = false;
try {
  // Tentar importar performance
  import('firebase/performance').then(() => {
    performanceAvailable = true;
  });
} catch (error) {
  console.warn('Firebase Performance não disponível:', error);
}

class PerformanceService {
  constructor() {
    this.performance = null;
    this.isEnabled = false;
    this.traces = new Map();
    this.initializePerformance();
  }

  async initializePerformance() {
    try {
      // Verificar se está em produção e se performance está disponível
      if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined' && performanceAvailable) {
        const { getPerformance } = await import('firebase/performance');
        this.performance = getPerformance(app);
        this.isEnabled = true;
        console.log('Firebase Performance Monitoring inicializado');
        
        // Configurar traces automáticos
        this.setupAutomaticTraces();
      }
    } catch (error) {
      console.warn('Firebase Performance Monitoring não disponível:', error);
      this.isEnabled = false;
    }
  }

  async setupAutomaticTraces() {
    if (!this.isEnabled) return;

    try {
      const { trace } = await import('firebase/performance');
      
      // Trace para carregamento inicial da página
      const pageLoadTrace = trace(this.performance, 'page_load');
      pageLoadTrace.start();
    
      window.addEventListener('load', () => {
        pageLoadTrace.stop();
      });

      // Trace para navegação entre páginas
      this.setupNavigationTracing();
    } catch (error) {
      console.error('Erro ao configurar traces automáticos:', error);
    }
  }

  async setupNavigationTracing() {
    try {
      const { trace } = await import('firebase/performance');
      
      // Interceptar mudanças de rota (React Router)
      let currentTrace = null;
      
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      const startNavigationTrace = (url) => {
        if (currentTrace) {
          currentTrace.stop();
        }
        currentTrace = trace(this.performance, `navigation_${this.getRouteFromUrl(url)}`);
        currentTrace.start();
      };
    
      history.pushState = function(...args) {
        startNavigationTrace(args[2] || window.location.href);
        return originalPushState.apply(this, args);
      };
      
      history.replaceState = function(...args) {
        startNavigationTrace(args[2] || window.location.href);
        return originalReplaceState.apply(this, args);
      };
      
      // Parar trace quando a página carregar
      window.addEventListener('load', () => {
        if (currentTrace) {
          currentTrace.stop();
          currentTrace = null;
        }
      });
    } catch (error) {
      console.error('Erro ao configurar navigation tracing:', error);
    }
  }

  getRouteFromUrl(url) {
    try {
      const pathname = new URL(url, window.location.origin).pathname;
      return pathname.replace(/\//g, '_').replace(/^_/, '') || 'home';
    } catch {
      return 'unknown';
    }
  }

  // Criar trace customizado
  async startTrace(traceName) {
    if (!this.isEnabled) return null;

    try {
      const { trace } = await import('firebase/performance');
      const customTrace = trace(this.performance, traceName);
      customTrace.start();
      this.traces.set(traceName, customTrace);
      return customTrace;
    } catch (error) {
      console.error('Erro ao iniciar trace:', error);
      return null;
    }
  }

  // Parar trace customizado
  stopTrace(traceName, attributes = {}) {
    if (!this.isEnabled) return;

    try {
      const customTrace = this.traces.get(traceName);
      if (customTrace) {
        // Adicionar atributos customizados
        Object.entries(attributes).forEach(([key, value]) => {
          customTrace.putAttribute(key, String(value));
        });
        
        customTrace.stop();
        this.traces.delete(traceName);
      }
    } catch (error) {
      console.error('Erro ao parar trace:', error);
    }
  }

  // Medir tempo de execução de função
  async measureFunction(functionName, asyncFunction, attributes = {}) {
    const traceName = `function_${functionName}`;
    this.startTrace(traceName);
    
    try {
      const result = await asyncFunction();
      this.stopTrace(traceName, { ...attributes, status: 'success' });
      return result;
    } catch (error) {
      this.stopTrace(traceName, { ...attributes, status: 'error', error: error.message });
      throw error;
    }
  }

  // Traces específicos para operações do sistema
  startDatabaseOperation(operation, collection) {
    return this.startTrace(`db_${operation}_${collection}`);
  }

  stopDatabaseOperation(operation, collection, recordCount = 0, success = true) {
    this.stopTrace(`db_${operation}_${collection}`, {
      record_count: recordCount,
      success: success
    });
  }

  startApiCall(endpoint) {
    return this.startTrace(`api_${endpoint.replace(/\//g, '_')}`);
  }

  stopApiCall(endpoint, statusCode, responseSize = 0) {
    this.stopTrace(`api_${endpoint.replace(/\//g, '_')}`, {
      status_code: statusCode,
      response_size: responseSize
    });
  }

  // Medir performance de componentes React
  measureComponentRender(componentName) {
    if (!this.isEnabled) return { start: () => {}, stop: () => {} };

    const traceName = `component_${componentName}`;
    let renderTrace = null;

    return {
      start: () => {
        renderTrace = this.startTrace(traceName);
      },
      stop: () => {
        if (renderTrace) {
          this.stopTrace(traceName);
        }
      }
    };
  }

  // Medir carregamento de recursos
  async measureResourceLoad(resourceName, resourceType) {
    const traceName = `resource_${resourceType}_${resourceName}`;
    return await this.startTrace(traceName);
  }

  // Configurar métricas customizadas
  async recordMetric(metricName, value, attributes = {}) {
    if (!this.isEnabled) return;

    try {
      const { trace } = await import('firebase/performance');
      // Firebase Performance não suporta métricas customizadas diretamente
      // Usar trace com atributos para simular métricas
      const metricTrace = trace(this.performance, `metric_${metricName}`);
      metricTrace.start();
      
      Object.entries(attributes).forEach(([key, attr]) => {
        metricTrace.putAttribute(key, String(attr));
      });
      
      metricTrace.putAttribute('value', String(value));
      metricTrace.stop();
    } catch (error) {
      console.error('Erro ao registrar métrica:', error);
    }
  }

  // Monitorar Web Vitals
  setupWebVitalsMonitoring() {
    if (!this.isEnabled) return;

    // Importar web-vitals dinamicamente se disponível
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS((metric) => {
        this.recordMetric('cls', metric.value, {
          rating: metric.rating,
          entries: metric.entries.length
        });
      });

      getFID((metric) => {
        this.recordMetric('fid', metric.value, {
          rating: metric.rating,
          entries: metric.entries.length
        });
      });

      getFCP((metric) => {
        this.recordMetric('fcp', metric.value, {
          rating: metric.rating,
          entries: metric.entries.length
        });
      });

      getLCP((metric) => {
        this.recordMetric('lcp', metric.value, {
          rating: metric.rating,
          entries: metric.entries.length
        });
      });

      getTTFB((metric) => {
        this.recordMetric('ttfb', metric.value, {
          rating: metric.rating,
          entries: metric.entries.length
        });
      });
    }).catch(() => {
      console.warn('web-vitals não disponível');
    });
  }

  // Desabilitar performance monitoring
  disable() {
    this.isEnabled = false;
    console.log('Firebase Performance Monitoring desabilitado');
  }

  // Habilitar performance monitoring
  enable() {
    if (this.performance) {
      this.isEnabled = true;
      console.log('Firebase Performance Monitoring habilitado');
    }
  }
}

export default new PerformanceService();