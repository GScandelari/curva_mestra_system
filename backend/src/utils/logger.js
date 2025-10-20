const fs = require('fs');
const path = require('path');

/**
 * Structured Logger for Production Environment
 * Provides different log levels and structured output
 */
class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.logFile = process.env.LOG_FILE || path.join(__dirname, '../logs/app.log');
    this.maxFileSize = this.parseSize(process.env.LOG_MAX_SIZE || '10m');
    this.maxFiles = parseInt(process.env.LOG_MAX_FILES) || 5;
    this.isProduction = process.env.NODE_ENV === 'production';
    
    // Ensure log directory exists
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Log levels with numeric values for comparison
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };

    this.currentLevel = this.levels[this.logLevel] || this.levels.info;
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
   * @param {string} level Log level
   * @param {string} message Log message
   * @param {Object} meta Additional metadata
   * @returns {Object} Structured log entry
   */
  createLogEntry(level, message, meta = {}) {
    return {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      pid: process.pid,
      hostname: require('os').hostname(),
      ...meta
    };
  }

  /**
   * Write log entry to file and console
   * @param {Object} logEntry Structured log entry
   */
  writeLog(logEntry) {
    const logLine = JSON.stringify(logEntry) + '\n';

    // Write to console in development or for errors
    if (!this.isProduction || logEntry.level === 'ERROR') {
      const coloredOutput = this.colorizeOutput(logEntry);
      console.log(coloredOutput);
    }

    // Write to file
    try {
      // Check file size and rotate if necessary
      this.rotateLogFile();
      fs.appendFileSync(this.logFile, logLine);
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
   */
  rotateLogFile() {
    try {
      if (!fs.existsSync(this.logFile)) {
        return;
      }

      const stats = fs.statSync(this.logFile);
      if (stats.size < this.maxFileSize) {
        return;
      }

      // Rotate existing files
      for (let i = this.maxFiles - 1; i > 0; i--) {
        const oldFile = `${this.logFile}.${i}`;
        const newFile = `${this.logFile}.${i + 1}`;

        if (fs.existsSync(oldFile)) {
          if (i === this.maxFiles - 1) {
            fs.unlinkSync(oldFile); // Delete oldest file
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // Move current log file
      fs.renameSync(this.logFile, `${this.logFile}.1`);
    } catch (error) {
      console.error('Failed to rotate log file:', error.message);
    }
  }

  /**
   * Log error message
   * @param {string} message Error message
   * @param {Object} meta Additional metadata
   */
  error(message, meta = {}) {
    if (this.currentLevel >= this.levels.error) {
      const logEntry = this.createLogEntry('error', message, meta);
      this.writeLog(logEntry);
    }
  }

  /**
   * Log warning message
   * @param {string} message Warning message
   * @param {Object} meta Additional metadata
   */
  warn(message, meta = {}) {
    if (this.currentLevel >= this.levels.warn) {
      const logEntry = this.createLogEntry('warn', message, meta);
      this.writeLog(logEntry);
    }
  }

  /**
   * Log info message
   * @param {string} message Info message
   * @param {Object} meta Additional metadata
   */
  info(message, meta = {}) {
    if (this.currentLevel >= this.levels.info) {
      const logEntry = this.createLogEntry('info', message, meta);
      this.writeLog(logEntry);
    }
  }

  /**
   * Log debug message
   * @param {string} message Debug message
   * @param {Object} meta Additional metadata
   */
  debug(message, meta = {}) {
    if (this.currentLevel >= this.levels.debug) {
      const logEntry = this.createLogEntry('debug', message, meta);
      this.writeLog(logEntry);
    }
  }

  /**
   * Log HTTP request
   * @param {Object} req Express request object
   * @param {Object} res Express response object
   * @param {number} responseTime Response time in milliseconds
   */
  logRequest(req, res, responseTime) {
    const meta = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id
    };

    const level = res.statusCode >= 400 ? 'warn' : 'info';
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${responseTime}ms`;

    this[level](message, meta);
  }

  /**
   * Log database operation
   * @param {string} operation Database operation
   * @param {string} table Table name
   * @param {Object} meta Additional metadata
   */
  logDatabase(operation, table, meta = {}) {
    const logMeta = {
      operation,
      table,
      ...meta
    };

    this.info(`Database ${operation} on ${table}`, logMeta);
  }

  /**
   * Log authentication event
   * @param {string} event Authentication event
   * @param {string} userId User ID
   * @param {Object} meta Additional metadata
   */
  logAuth(event, userId, meta = {}) {
    const logMeta = {
      event,
      userId,
      ...meta
    };

    const level = event.includes('failed') || event.includes('blocked') ? 'warn' : 'info';
    this[level](`Authentication ${event}`, logMeta);
  }

  /**
   * Log security event
   * @param {string} event Security event
   * @param {Object} meta Additional metadata
   */
  logSecurity(event, meta = {}) {
    const logMeta = {
      event,
      ...meta
    };

    this.warn(`Security event: ${event}`, logMeta);
  }

  /**
   * Log application startup
   * @param {Object} config Application configuration
   */
  logStartup(config = {}) {
    const meta = {
      nodeVersion: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV,
      ...config
    };

    this.info('Application started', meta);
  }

  /**
   * Log application shutdown
   * @param {string} reason Shutdown reason
   */
  logShutdown(reason = 'Unknown') {
    const meta = {
      reason,
      uptime: process.uptime()
    };

    this.info('Application shutting down', meta);
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;