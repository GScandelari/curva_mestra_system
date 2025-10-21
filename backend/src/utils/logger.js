const fs = require('fs');
const path = require('path');
const os = require('os');

// Log levels with numeric values for comparison
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
};

// Log categories for better organization
const LogCategory = {
  AUTH: 'auth',
  API: 'api',
  DATABASE: 'database',
  SECURITY: 'security',
  SYSTEM: 'system',
  BUSINESS: 'business',
  PERFORMANCE: 'performance',
  ERROR: 'error'
};

// Error types for classification
const ErrorType = {
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  VALIDATION: 'validation',
  DATABASE: 'database',
  NETWORK: 'network',
  CONFIGURATION: 'configuration',
  BUSINESS_LOGIC: 'business_logic',
  SYSTEM: 'system',
  UNKNOWN: 'unknown'
};

/**
 * Enhanced Structured Logger for Backend
 * Provides centralized logging with context capture and sanitization
 */
class Logger {
  constructor() {
    this.logLevel = this.getLogLevel();
    this.logFile = process.env.LOG_FILE || path.join(__dirname, '../logs/app.log');
    this.errorLogFile = process.env.ERROR_LOG_FILE || path.join(__dirname, '../logs/error.log');
    this.maxFileSize = this.parseSize(process.env.LOG_MAX_SIZE || '10m');
    this.maxFiles = parseInt(process.env.LOG_MAX_FILES) || 5;
    this.isProduction = process.env.NODE_ENV === 'production';
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.sessionId = this.generateSessionId();
    
    // Ensure log directory exists
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Setup process event handlers
    this.setupProcessHandlers();
  }

  /**
   * Get current log level from environment
   */
  getLogLevel() {
    const envLevel = (process.env.LOG_LEVEL || 'info').toUpperCase();
    return LogLevel[envLevel] || LogLevel.INFO;
  }

  /**
   * Generate unique session ID for this process
   */
  generateSessionId() {
    return `backend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup process event handlers for logging
   */
  setupProcessHandlers() {
    // Unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.critical('Unhandled promise rejection', {
        category: LogCategory.ERROR,
        errorType: ErrorType.SYSTEM,
        reason: reason?.toString(),
        stack: reason?.stack
      });
    });

    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.critical('Uncaught exception', {
        category: LogCategory.ERROR,
        errorType: ErrorType.SYSTEM,
        error: error.message,
        stack: error.stack
      });
      
      // Give time for log to be written before exiting
      setTimeout(() => process.exit(1), 1000);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      this.info('Received SIGTERM, shutting down gracefully', {
        category: LogCategory.SYSTEM
      });
    });

    process.on('SIGINT', () => {
      this.info('Received SIGINT, shutting down gracefully', {
        category: LogCategory.SYSTEM
      });
    });
  }

  /**
   * Parse size string to bytes
   * @param {string} sizeStr Size string (e.g., '10m', '1g')
   * @returns {number} Size in bytes
   */
  parseSize(sizeStr) {
    const units = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024
    };

    const match = sizeStr.toLowerCase().match(/^(\d+)([bkmg]?)$/);
    if (!match) return 10 * 1024 * 1024; // Default 10MB

    const [, size, unit] = match;
    return parseInt(size) * (units[unit] || 1);
  }

  /**
   * Create structured log entry
   * @param {number} level Log level (numeric)
   * @param {string} message Log message
   * @param {Object} context Additional context
   * @returns {Object} Structured log entry
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
        nodeVersion: process.version,
        platform: process.platform,
        hostname: os.hostname(),
        pid: process.pid,
        memory: this.getMemoryUsage(),
        uptime: Math.round(process.uptime())
      }
    };

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
      .replace(/secret[=:]\s*[^\s&]+/gi, 'secret=***')
      .replace(/authorization:\s*[^\s&]+/gi, 'authorization: ***');
  }

  /**
   * Sanitize context object to remove sensitive data
   */
  sanitizeContext(context) {
    if (!context || typeof context !== 'object') {
      return context;
    }

    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'authorization', 'cookie'];

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

    return sanitizeObject({ ...context });
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024) // MB
    };
  }

  /**
   * Write log entry to file and console
   * @param {Object} logEntry Structured log entry
   */
  writeLog(logEntry) {
    const logLine = JSON.stringify(logEntry) + '\n';

    // Write to console in development or for errors/critical
    if (this.isDevelopment || logEntry.level === 'ERROR' || logEntry.level === 'CRITICAL') {
      const coloredOutput = this.colorizeOutput(logEntry);
      console.log(coloredOutput);
    }

    // Write to appropriate log file
    try {
      // Write to main log file
      this.rotateLogFile(this.logFile);
      fs.appendFileSync(this.logFile, logLine);

      // Write errors and critical to separate error log
      if (logEntry.level === 'ERROR' || logEntry.level === 'CRITICAL') {
        this.rotateLogFile(this.errorLogFile);
        fs.appendFileSync(this.errorLogFile, logLine);
      }
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Colorize console output for better readability
   * @param {Object} logEntry Log entry
   * @returns {string} Colorized output
   */
  colorizeOutput(logEntry) {
    const colors = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[37m'  // White
    };

    const reset = '\x1b[0m';
    const color = colors[logEntry.level] || colors.INFO;

    return `${color}[${logEntry.timestamp}] ${logEntry.level}: ${logEntry.message}${reset}`;
  }

  /**
   * Rotate log file if it exceeds maximum size
   * @param {string} logFile Path to log file to rotate
   */
  rotateLogFile(logFile) {
    try {
      if (!fs.existsSync(logFile)) {
        return;
      }

      const stats = fs.statSync(logFile);
      if (stats.size < this.maxFileSize) {
        return;
      }

      // Rotate existing files
      for (let i = this.maxFiles - 1; i > 0; i--) {
        const oldFile = `${logFile}.${i}`;
        const newFile = `${logFile}.${i + 1}`;

        if (fs.existsSync(oldFile)) {
          if (i === this.maxFiles - 1) {
            fs.unlinkSync(oldFile); // Delete oldest file
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // Move current log file
      fs.renameSync(logFile, `${logFile}.1`);
    } catch (error) {
      console.error('Failed to rotate log file:', error.message);
    }
  }

  /**
   * Main logging method
   * @param {number} level Log level
   * @param {string} message Log message
   * @param {Object} context Additional context
   */
  log(level, message, context = {}) {
    if (level < this.logLevel) {
      return;
    }

    const logEntry = this.createLogEntry(level, message, context);
    this.writeLog(logEntry);
    return logEntry;
  }

  /**
   * Debug level logging
   * @param {string} message Debug message
   * @param {Object} context Additional context
   */
  debug(message, context = {}) {
    return this.log(LogLevel.DEBUG, message, { ...context, category: context.category || LogCategory.SYSTEM });
  }

  /**
   * Info level logging
   * @param {string} message Info message
   * @param {Object} context Additional context
   */
  info(message, context = {}) {
    return this.log(LogLevel.INFO, message, { ...context, category: context.category || LogCategory.SYSTEM });
  }

  /**
   * Warning level logging
   * @param {string} message Warning message
   * @param {Object} context Additional context
   */
  warn(message, context = {}) {
    return this.log(LogLevel.WARN, message, { ...context, category: context.category || LogCategory.SYSTEM });
  }

  /**
   * Error level logging
   * @param {string} message Error message
   * @param {Object} context Additional context
   */
  error(message, context = {}) {
    return this.log(LogLevel.ERROR, message, { ...context, category: context.category || LogCategory.ERROR });
  }

  /**
   * Critical level logging
   * @param {string} message Critical message
   * @param {Object} context Additional context
   */
  critical(message, context = {}) {
    return this.log(LogLevel.CRITICAL, message, { ...context, category: context.category || LogCategory.ERROR });
  }

  /**
   * Log HTTP request
   * @param {Object} req Express request object
   * @param {Object} res Express response object
   * @param {number} responseTime Response time in milliseconds
   */
  logRequest(req, res, responseTime) {
    const context = {
      category: LogCategory.API,
      api: {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        userId: req.user?.id,
        contentLength: res.get('Content-Length')
      }
    };

    const level = res.statusCode >= 500 ? LogLevel.ERROR : 
                  res.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${responseTime}ms`;

    return this.log(level, message, context);
  }

  /**
   * Log database operation
   * @param {string} operation Database operation
   * @param {string} table Table name
   * @param {Object} context Additional context
   */
  logDatabase(operation, table, context = {}) {
    const message = `Database ${operation} on ${table}`;
    return this.info(message, {
      ...context,
      category: LogCategory.DATABASE,
      database: {
        operation,
        table,
        ...context.database
      }
    });
  }

  /**
   * Log authentication event
   * @param {string} event Authentication event
   * @param {string} userId User ID
   * @param {Object} context Additional context
   */
  logAuth(event, userId, context = {}) {
    const level = event.includes('failed') || event.includes('blocked') ? LogLevel.WARN : LogLevel.INFO;
    const message = `Authentication ${event}`;
    
    return this.log(level, message, {
      ...context,
      category: LogCategory.AUTH,
      auth: {
        event,
        userId,
        ...context.auth
      }
    });
  }

  /**
   * Log security event
   * @param {string} event Security event
   * @param {Object} context Additional context
   */
  logSecurity(event, context = {}) {
    const message = `Security event: ${event}`;
    return this.warn(message, {
      ...context,
      category: LogCategory.SECURITY,
      security: {
        event,
        ...context.security
      }
    });
  }

  /**
   * Log business logic event
   * @param {string} event Business event
   * @param {Object} context Additional context
   */
  logBusiness(event, context = {}) {
    const message = `Business event: ${event}`;
    return this.info(message, {
      ...context,
      category: LogCategory.BUSINESS,
      business: {
        event,
        ...context.business
      }
    });
  }

  /**
   * Log performance metric
   * @param {string} metric Performance metric name
   * @param {number} value Metric value
   * @param {Object} context Additional context
   */
  logPerformance(metric, value, context = {}) {
    const message = `Performance: ${metric} = ${value}`;
    return this.info(message, {
      ...context,
      category: LogCategory.PERFORMANCE,
      performance: {
        metric,
        value,
        ...context.performance
      }
    });
  }

  /**
   * Log application startup
   * @param {Object} config Application configuration
   */
  logStartup(config = {}) {
    const context = {
      category: LogCategory.SYSTEM,
      startup: {
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV,
        ...config
      }
    };

    return this.info('Application started', context);
  }

  /**
   * Log application shutdown
   * @param {string} reason Shutdown reason
   */
  logShutdown(reason = 'Unknown') {
    const context = {
      category: LogCategory.SYSTEM,
      shutdown: {
        reason,
        uptime: Math.round(process.uptime())
      }
    };

    return this.info('Application shutting down', context);
  }

  /**
   * Log error with full context
   * @param {Error} error Error object
   * @param {Object} context Additional context
   */
  logError(error, context = {}) {
    const errorContext = {
      ...context,
      category: LogCategory.ERROR,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        ...context.error
      }
    };

    return this.error(error.message, errorContext);
  }

  /**
   * Create child logger with additional context
   * @param {Object} additionalContext Context to add to all logs
   */
  child(additionalContext) {
    const childLogger = Object.create(this);
    childLogger.log = (level, message, context = {}) => {
      return this.log(level, message, { ...additionalContext, ...context });
    };
    return childLogger;
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;
module.exports.Logger = Logger;
module.exports.LogLevel = LogLevel;
module.exports.LogCategory = LogCategory;
module.exports.ErrorType = ErrorType;