const logger = require('../utils/logger');

/**
 * Request logging middleware
 * Logs HTTP requests with structured data
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request start
  logger.debug('Request started', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    
    // Log request completion
    logger.logRequest(req, res, responseTime);
    
    // Call original end method
    originalEnd.apply(this, args);
  };

  next();
};

module.exports = requestLogger;