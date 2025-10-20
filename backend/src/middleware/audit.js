const { AuditLog } = require('../models');

/**
 * Extract IP address from request
 */
const getClientIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         'unknown';
};

/**
 * Create audit log entry
 */
const createAuditLog = async (logData) => {
  try {
    await AuditLog.create(logData);
  } catch (error) {
    // Log audit failures to console but don't break the application
    console.error('Failed to create audit log:', error);
  }
};

/**
 * Audit middleware for automatic logging of critical operations
 */
const auditMiddleware = (action, resource) => {
  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json;
    const startTime = Date.now();
    
    // Override res.json to capture response
    res.json = function(data) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Determine if operation was successful
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      // Prepare audit log data
      const auditData = {
        userId: req.user?.id || null,
        action,
        resource,
        resourceId: req.params.id || req.body?.id || null,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null,
        success,
        metadata: {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          duration,
          requestSize: JSON.stringify(req.body || {}).length,
          responseSize: JSON.stringify(data || {}).length
        }
      };

      // Add request body as new values for CREATE/UPDATE operations
      if (['CREATE', 'UPDATE'].includes(action) && req.body) {
        auditData.newValues = req.body;
      }

      // Add error message if operation failed
      if (!success && data?.error) {
        auditData.errorMessage = data.error;
      }

      // Create audit log asynchronously
      createAuditLog(auditData);
      
      // Call original res.json
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Manual audit logging function for complex operations
 */
const logAudit = async (options) => {
  const {
    userId,
    action,
    resource,
    resourceId,
    oldValues,
    newValues,
    success = true,
    errorMessage,
    metadata,
    req
  } = options;

  const auditData = {
    userId,
    action,
    resource,
    resourceId,
    oldValues,
    newValues,
    success,
    errorMessage,
    metadata
  };

  // Add request context if provided
  if (req) {
    auditData.ipAddress = getClientIP(req);
    auditData.userAgent = req.headers['user-agent'] || null;
  }

  await createAuditLog(auditData);
};

/**
 * Audit middleware for authentication events
 */
const auditAuth = (action) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      const auditData = {
        userId: req.user?.id || req.body?.username || null,
        action,
        resource: 'AUTH',
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null,
        success,
        metadata: {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          username: req.body?.username
        }
      };

      if (!success && data?.error) {
        auditData.errorMessage = data.error;
      }

      createAuditLog(auditData);
      
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Middleware to capture old values before update/delete operations
 */
const captureOldValues = (model, resourceName) => {
  return async (req, res, next) => {
    if (['PUT', 'PATCH', 'DELETE'].includes(req.method) && req.params.id) {
      try {
        const record = await model.findByPk(req.params.id);
        if (record) {
          req.oldValues = record.toJSON();
          req.resourceName = resourceName;
        }
      } catch (error) {
        console.error('Failed to capture old values:', error);
      }
    }
    next();
  };
};

/**
 * Enhanced audit middleware that captures old values
 */
const auditWithOldValues = (action, resource) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    const startTime = Date.now();
    
    res.json = function(data) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const success = res.statusCode >= 200 && res.statusCode < 400;
      
      const auditData = {
        userId: req.user?.id || null,
        action,
        resource,
        resourceId: req.params.id || req.body?.id || null,
        oldValues: req.oldValues || null,
        newValues: req.body || null,
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null,
        success,
        metadata: {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          duration
        }
      };

      if (!success && data?.error) {
        auditData.errorMessage = data.error;
      }

      createAuditLog(auditData);
      
      return originalJson.call(this, data);
    };

    next();
  };
};

module.exports = {
  auditMiddleware,
  auditAuth,
  logAudit,
  captureOldValues,
  auditWithOldValues,
  createAuditLog
};