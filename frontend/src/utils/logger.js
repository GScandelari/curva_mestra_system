/**
 * Centralized Logging System for Frontend
 * Provides structured logging with different severity levels and context capture
 */

// Log levels with numeric values for comparison
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
};

// Log categories for better organization
export const LogCategory = {
  AUTH: 'auth',
  API: 'api',
  UI: 'ui',
  PERFORMANCE: 'performance',
  SECURITY: 'security',
  SYSTEM: 'system',
  USER_ACTION: 'user_action',
  ERROR: 'error'
};

// Error types for classification
export const ErrorType = {
  AUTHENTICATION: 'authentication',
  NETWORK: 'network',
  VALIDATION: 'validation',
  PERMISSION: 'permission',
  CONFIGURATION: 'configuration',
  BUSINESS_LOGIC: 'business_logic',
  SYSTEM: 'system',
  UNKNOWN: 'unknown'
};

class Logger {
  constructor() {
    this.logLevel = this.getLogLevel();
    this.isProduction = import.meta.env.PROD;
    this.isDevelopment = import.meta.env.DEV;
    this.maxStoredLogs = 100;
    this.sessionId = this.generateSessionId();
    
    // Initialize storage
    this.initializeStorage();
    
    // Setup global error handlers
    this.setupGlobalErrorHandlers();
  }

  /**
   * Get current log level from environment or localStorage
   */
  getLogLevel() {
    // Check localStorage for debug override
    const debugLevel = localStorage.getItem('debug_log_level');
    if (debugLevel && Object.keys(LogLevel).includes(debugLevel)) {
      return LogLevel[debugLevel];
    }
    
    // Default levels based on environment
    return this.isProduction ? LogLevel.WARN : LogLevel.DEBUG;
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize local storage for logs
   */
  initializeStorage() {
    try {
      if (!localStorage.getItem('app_logs')) {
        localStorage.setItem('app_logs', JSON.stringify([]));
      }
    } catch (error) {
      console.warn('Could not initialize log storage:', error);
    }
  }

  /**
   * Setup global error handlers
   */
  setupGlobalErrorHandlers() {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.error('Unhandled promise rejection', {
        category: LogCategory.ERROR,
        errorType: ErrorType.SYSTEM,
        error: event.reason,
        promise: event.promise
      });
    });

    // Global JavaScript errors
    window.addEventListener('error', (event) => {
      this.error('Global JavaScript error', {
        category: LogCategory.ERROR,
        errorType: ErrorType.SYSTEM,
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    });
  }

  /**
   * Create structured log entry
   */
  createLogEntry(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: this.getLevelName(level),
      message: this.sanitizeMessage(message),
      sessionId: this.sessionId,
      context: this.sanitizeContext(context),
      environment: {
        isDevelopment: this.isDevelopment,
        isProduction: this.isProduction,
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer
      }
    };

    // Add user context if available
    const userContext = this.getUserContext();
    if (userContext) {
      logEntry.user = userContext;
    }

    // Add performance context
    logEntry.performance = this.getPerformanceContext();

    return logEntry;
  }

  /**
   * Get level name from numeric value
   */
  getLevelName(level) {
    const levelNames = {
      [LogLevel.DEBUG]: 'DEBUG',
      [LogLevel.INFO]: 'INFO',
      [LogLevel.WARN]: 'WARN',
      [LogLevel.ERROR]: 'ERROR',
      [LogLevel.CRITICAL]: 'CRITICAL'
    };
    return levelNames[level] || 'UNKNOWN';
  }

  /**
   * Sanitize log message to remove sensitive data
   */
  sanitizeMessage(message) {
    if (typeof message !== 'string') {
      return String(message);
    }

    // Remove potential sensitive patterns
    return message
      .replace(/password[=:]\s*[^\s&]+/gi, 'password=***')
      .replace(/token[=:]\s*[^\s&]+/gi, 'token=***')
      .replace(/key[=:]\s*[^\s&]+/gi, 'key=***')
      .replace(/secret[=:]\s*[^\s&]+/gi, 'secret=***');
  }

  /**
   * Sanitize context object to remove sensitive data
   */
  sanitizeContext(context) {
    if (!context || typeof context !== 'object') {
      return context;
    }

    const sanitized = { ...context };
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'authorization'];

    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const result = Array.isArray(obj) ? [] : {};
      
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
          result[key] = '***';
        } else if (typeof value === 'object' && value !== null) {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Get user context for logging
   */
  getUserContext() {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      if (user) {
        return {
          id: user.id,
          email: user.email ? user.email.replace(/(.{2}).*(@.*)/, '$1***$2') : null,
          role: user.role,
          isAdmin: user.isAdmin
        };
      }
    } catch (error) {
      // Ignore errors in user context extraction
    }
    return null;
  }

  /**
   * Get performance context
   */
  getPerformanceContext() {
    try {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        loadTime: navigation ? Math.round(navigation.loadEventEnd - navigation.fetchStart) : null,
        domContentLoaded: navigation ? Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart) : null,
        memoryUsage: performance.memory ? {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
        } : null
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Store log entry
   */
  storeLog(logEntry) {
    try {
      const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
      logs.push(logEntry);

      // Keep only the most recent logs
      if (logs.length > this.maxStoredLogs) {
        logs.splice(0, logs.length - this.maxStoredLogs);
      }

      localStorage.setItem('app_logs', JSON.stringify(logs));
    } catch (error) {
      console.warn('Could not store log entry:', error);
    }
  }

  /**
   * Output log to console with appropriate styling
   */
  outputToConsole(logEntry) {
    if (this.isProduction && logEntry.level !== 'ERROR' && logEntry.level !== 'CRITICAL') {
      return;
    }

    const styles = {
      DEBUG: 'color: #888; font-weight: normal;',
      INFO: 'color: #2196F3; font-weight: normal;',
      WARN: 'color: #FF9800; font-weight: bold;',
      ERROR: 'color: #F44336; font-weight: bold;',
      CRITICAL: 'color: #FFFFFF; background-color: #F44336; font-weight: bold; padding: 2px 4px;'
    };

    const style = styles[logEntry.level] || styles.INFO;
    const prefix = `[${logEntry.timestamp}] ${logEntry.level}:`;

    console.groupCollapsed(`%c${prefix} ${logEntry.message}`, style);
    console.log('Context:', logEntry.context);
    console.log('Environment:', logEntry.environment);
    if (logEntry.user) {
      console.log('User:', logEntry.user);
    }
    if (logEntry.performance) {
      console.log('Performance:', logEntry.performance);
    }
    console.groupEnd();
  }

  /**
   * Send log to external service (placeholder for future implementation)
   */
  async sendToExternalService(logEntry) {
    // Only send ERROR and CRITICAL logs to external service in production
    if (!this.isProduction || (logEntry.level !== 'ERROR' && logEntry.level !== 'CRITICAL')) {
      return;
    }

    try {
      // TODO: Implement external logging service integration
      // Example: Sentry, LogRocket, or custom logging endpoint
      
      // For now, we'll just prepare the data structure
      const externalLogData = {
        timestamp: logEntry.timestamp,
        level: logEntry.level,
        message: logEntry.message,
        sessionId: logEntry.sessionId,
        context: logEntry.context,
        user: logEntry.user,
        environment: {
          url: logEntry.environment.url,
          userAgent: logEntry.environment.userAgent
        }
      };

      // Placeholder for external service call
      // await fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(externalLogData)
      // });
      
    } catch (error) {
      console.warn('Failed to send log to external service:', error);
    }
  }

  /**
   * Main logging method
   */
  log(level, message, context = {}) {
    if (level < this.logLevel) {
      return;
    }

    const logEntry = this.createLogEntry(level, message, context);
    
    // Store locally
    this.storeLog(logEntry);
    
    // Output to console
    this.outputToConsole(logEntry);
    
    // Send to external service
    this.sendToExternalService(logEntry);

    return logEntry;
  }

  /**
   * Debug level logging
   */
  debug(message, context = {}) {
    return this.log(LogLevel.DEBUG, message, { ...context, category: context.category || LogCategory.SYSTEM });
  }

  /**
   * Info level logging
   */
  info(message, context = {}) {
    return this.log(LogLevel.INFO, message, { ...context, category: context.category || LogCategory.SYSTEM });
  }

  /**
   * Warning level logging
   */
  warn(message, context = {}) {
    return this.log(LogLevel.WARN, message, { ...context, category: context.category || LogCategory.SYSTEM });
  }

  /**
   * Error level logging
   */
  error(message, context = {}) {
    return this.log(LogLevel.ERROR, message, { ...context, category: context.category || LogCategory.ERROR });
  }

  /**
   * Critical level logging
   */
  critical(message, context = {}) {
    return this.log(LogLevel.CRITICAL, message, { ...context, category: context.category || LogCategory.ERROR });
  }

  /**
   * Log API calls
   */
  logApiCall(method, url, status, responseTime, context = {}) {
    const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    const message = `API ${method} ${url} - ${status} (${responseTime}ms)`;
    
    return this.log(level, message, {
      ...context,
      category: LogCategory.API,
      api: {
        method,
        url,
        status,
        responseTime
      }
    });
  }

  /**
   * Log authentication events
   */
  logAuth(event, context = {}) {
    const level = event.includes('failed') || event.includes('error') ? LogLevel.ERROR : LogLevel.INFO;
    const message = `Authentication: ${event}`;
    
    return this.log(level, message, {
      ...context,
      category: LogCategory.AUTH
    });
  }

  /**
   * Log user actions
   */
  logUserAction(action, context = {}) {
    return this.log(LogLevel.INFO, `User action: ${action}`, {
      ...context,
      category: LogCategory.USER_ACTION
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(metric, value, context = {}) {
    return this.log(LogLevel.INFO, `Performance: ${metric} = ${value}`, {
      ...context,
      category: LogCategory.PERFORMANCE,
      performance: {
        metric,
        value
      }
    });
  }

  /**
   * Get stored logs
   */
  getLogs(filter = {}) {
    try {
      const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
      
      if (!filter || Object.keys(filter).length === 0) {
        return logs;
      }

      return logs.filter(log => {
        if (filter.level && log.level !== filter.level) return false;
        if (filter.category && log.context?.category !== filter.category) return false;
        if (filter.since && new Date(log.timestamp) < new Date(filter.since)) return false;
        if (filter.until && new Date(log.timestamp) > new Date(filter.until)) return false;
        return true;
      });
    } catch (error) {
      console.warn('Could not retrieve logs:', error);
      return [];
    }
  }

  /**
   * Clear stored logs
   */
  clearLogs() {
    try {
      localStorage.setItem('app_logs', JSON.stringify([]));
      this.info('Logs cleared', { category: LogCategory.SYSTEM });
    } catch (error) {
      console.warn('Could not clear logs:', error);
    }
  }

  /**
   * Export logs for debugging
   */
  exportLogs() {
    const logs = this.getLogs();
    const exportData = {
      exportedAt: new Date().toISOString(),
      sessionId: this.sessionId,
      totalLogs: logs.length,
      logs
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `app-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.info('Logs exported', { category: LogCategory.SYSTEM });
  }

  /**
   * Set debug mode
   */
  setDebugMode(enabled) {
    if (enabled) {
      localStorage.setItem('debug_log_level', 'DEBUG');
      this.logLevel = LogLevel.DEBUG;
    } else {
      localStorage.removeItem('debug_log_level');
      this.logLevel = this.isProduction ? LogLevel.WARN : LogLevel.INFO;
    }
    
    this.info(`Debug mode ${enabled ? 'enabled' : 'disabled'}`, { category: LogCategory.SYSTEM });
  }
}

// Create singleton instance
const logger = new Logger();

// Export logger instance and utilities
export default logger;
export { Logger };

// Global debug utilities
if (typeof window !== 'undefined') {
  window.logger = logger;
  window.debugSYS001 = {
    enabled: !logger.isProduction,
    setDebugMode: (enabled) => logger.setDebugMode(enabled),
    getLogs: (filter) => logger.getLogs(filter),
    clearLogs: () => logger.clearLogs(),
    exportLogs: () => logger.exportLogs()
  };
}