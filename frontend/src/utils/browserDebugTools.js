/**
 * Ferramentas de Debug para Navegador
 * Utilitários de debug que podem ser executados no console do navegador
 */

class BrowserDebugTools {
  constructor() {
    this.debugMode = localStorage.getItem('debug_mode') === 'true';
    this.logs = [];
    this.maxLogs = 1000;
    
    // Expor ferramentas globalmente para acesso via console
    if (typeof window !== 'undefined') {
      window.debugTools = this;
      window.dt = this; // Alias curto
    }
  }

  // Ativar/desativar modo debug
  enableDebug() {
    this.debugMode = true;
    localStorage.setItem('debug_mode', 'true');
    console.log('🔧 Modo debug ativado');
    this.showDebugInfo();
  }

  disableDebug() {
    this.debugMode = false;
    localStorage.setItem('debug_mode', 'false');
    console.log('🔧 Modo debug desativado');
  }

  // Logging personalizado
  log(message, level = 'info', data = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    this.logs.push(logEntry);
    
    // Manter apenas os últimos logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    if (this.debugMode) {
      const style = this.getLogStyle(level);
      console.log(`%c[DEBUG] ${message}`, style, data);
    }

    return logEntry;
  }

  getLogStyle(level) {
    const styles = {
      error: 'color: #ff4444; font-weight: bold;',
      warn: 'color: #ffaa00; font-weight: bold;',
      info: 'color: #4444ff;',
      success: 'color: #44ff44; font-weight: bold;'
    };
    return styles[level] || styles.info;
  }

  // Informações do sistema
  showSystemInfo() {
    const info = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      },
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      },
      location: {
        href: window.location.href,
        protocol: window.location.protocol,
        host: window.location.host
      }
    };

    console.table(info);
    return info;
  }

  // Debug de localStorage
  showLocalStorage() {
    const storage = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      storage[key] = localStorage.getItem(key);
    }
    
    console.log('📦 LocalStorage:', storage);
    return storage;
  }

  // Debug de sessionStorage
  showSessionStorage() {
    const storage = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      storage[key] = sessionStorage.getItem(key);
    }
    
    console.log('📦 SessionStorage:', storage);
    return storage;
  }

  // Debug de cookies
  showCookies() {
    const cookies = {};
    document.cookie.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name) {
        cookies[name] = value;
      }
    });
    
    console.log('🍪 Cookies:', cookies);
    return cookies;
  }

  // Debug de performance
  showPerformanceMetrics() {
    if (!window.performance) {
      console.warn('Performance API não disponível');
      return null;
    }

    const navigation = performance.getEntriesByType('navigation')[0];
    const metrics = {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      domInteractive: navigation.domInteractive - navigation.navigationStart,
      firstPaint: null,
      firstContentfulPaint: null
    };

    // Paint metrics (se disponível)
    const paintEntries = performance.getEntriesByType('paint');
    paintEntries.forEach(entry => {
      if (entry.name === 'first-paint') {
        metrics.firstPaint = entry.startTime;
      } else if (entry.name === 'first-contentful-paint') {
        metrics.firstContentfulPaint = entry.startTime;
      }
    });

    console.log('⚡ Performance Metrics:', metrics);
    return metrics;
  }

  // Debug de erros JavaScript
  captureErrors() {
    const originalError = window.onerror;
    const originalUnhandledRejection = window.onunhandledrejection;

    window.onerror = (message, source, lineno, colno, error) => {
      this.log(`JavaScript Error: ${message}`, 'error', {
        source,
        lineno,
        colno,
        error: error?.stack
      });

      if (originalError) {
        originalError.call(window, message, source, lineno, colno, error);
      }
    };

    window.onunhandledrejection = (event) => {
      this.log(`Unhandled Promise Rejection: ${event.reason}`, 'error', {
        reason: event.reason,
        promise: event.promise
      });

      if (originalUnhandledRejection) {
        originalUnhandledRejection.call(window, event);
      }
    };

    console.log('🚨 Captura de erros ativada');
  }

  // Debug de requisições de rede
  interceptNetworkRequests() {
    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    // Interceptar fetch
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const url = args[0];
      
      try {
        const response = await originalFetch.apply(window, args);
        const endTime = performance.now();
        
        this.log(`Fetch Request: ${url}`, 'info', {
          method: args[1]?.method || 'GET',
          status: response.status,
          duration: endTime - startTime,
          headers: Object.fromEntries(response.headers.entries())
        });
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        
        this.log(`Fetch Error: ${url}`, 'error', {
          method: args[1]?.method || 'GET',
          duration: endTime - startTime,
          error: error.message
        });
        
        throw error;
      }
    };

    // Interceptar XMLHttpRequest
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      this._debugInfo = { method, url, startTime: performance.now() };
      return originalXHROpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function(...args) {
      const xhr = this;
      
      xhr.addEventListener('loadend', () => {
        const endTime = performance.now();
        const duration = endTime - xhr._debugInfo.startTime;
        
        window.debugTools.log(`XHR Request: ${xhr._debugInfo.url}`, 'info', {
          method: xhr._debugInfo.method,
          status: xhr.status,
          duration,
          responseType: xhr.responseType
        });
      });

      return originalXHRSend.call(this, ...args);
    };

    console.log('🌐 Interceptação de rede ativada');
  }

  // Debug de componentes React (se disponível)
  findReactComponents() {
    const reactFiber = document.querySelector('#root')?._reactInternalFiber ||
                      document.querySelector('#root')?._reactInternalInstance;
    
    if (!reactFiber) {
      console.warn('React não detectado ou versão não suportada');
      return null;
    }

    const components = [];
    
    function traverseFiber(fiber) {
      if (fiber.type && fiber.type.name) {
        components.push({
          name: fiber.type.name,
          props: fiber.memoizedProps,
          state: fiber.memoizedState
        });
      }
      
      if (fiber.child) traverseFiber(fiber.child);
      if (fiber.sibling) traverseFiber(fiber.sibling);
    }

    traverseFiber(reactFiber);
    console.log('⚛️ Componentes React encontrados:', components);
    return components;
  }

  // Exportar logs para análise
  exportLogs() {
    const logsData = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      logs: this.logs
    };

    const blob = new Blob([JSON.stringify(logsData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('📥 Logs exportados');
  }

  // Limpar logs
  clearLogs() {
    this.logs = [];
    console.log('🗑️ Logs limpos');
  }

  // Mostrar informações de debug
  showDebugInfo() {
    console.log(`
🔧 FERRAMENTAS DE DEBUG ATIVADAS

Comandos disponíveis:
- debugTools.showSystemInfo() - Informações do sistema
- debugTools.showLocalStorage() - Debug localStorage
- debugTools.showSessionStorage() - Debug sessionStorage
- debugTools.showCookies() - Debug cookies
- debugTools.showPerformanceMetrics() - Métricas de performance
- debugTools.captureErrors() - Capturar erros JavaScript
- debugTools.interceptNetworkRequests() - Interceptar requisições
- debugTools.findReactComponents() - Encontrar componentes React
- debugTools.exportLogs() - Exportar logs
- debugTools.clearLogs() - Limpar logs
- debugTools.disableDebug() - Desativar debug

Alias curto: dt (ex: dt.showSystemInfo())
    `);
  }

  // Executar diagnóstico completo
  runFullDiagnostic() {
    console.log('🔍 Executando diagnóstico completo...');
    
    const diagnostic = {
      timestamp: new Date().toISOString(),
      system: this.showSystemInfo(),
      localStorage: this.showLocalStorage(),
      sessionStorage: this.showSessionStorage(),
      cookies: this.showCookies(),
      performance: this.showPerformanceMetrics(),
      reactComponents: this.findReactComponents(),
      logs: this.logs.slice(-50) // Últimos 50 logs
    };

    console.log('📊 Diagnóstico completo:', diagnostic);
    return diagnostic;
  }
}

// Inicializar ferramentas de debug
const browserDebugTools = new BrowserDebugTools();

// Auto-ativar em desenvolvimento
if (process.env.NODE_ENV === 'development') {
  browserDebugTools.enableDebug();
}

export default browserDebugTools;