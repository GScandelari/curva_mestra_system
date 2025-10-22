/**
 * Unified Error Handler Middleware for Express Backend
 * Integrates with the shared error handling system
 */

const { ErrorHandler } = require('../../../shared/utils/ErrorHandler.js');
const { AuthErrorStrategy } = require('../../../shared/strategies/AuthErrorStrategy.js');
const { NetworkErrorStrategy } = require('../../../shared/strategies/NetworkErrorStrategy.js');
const { ValidationErrorStrategy } = require('../../../shared/strategies/ValidationErrorStrategy.js');
const { FallbackStrategy } = require('../../../shared/strategies/FallbackStrategy.js');
const { ErrorType, ErrorSeverity } = require('../../../shared/types/errorTypes.js');
const logger = require('../utils/logger.js');

// Initialize unified error handler
const errorHandler = new ErrorHandler({
  logLevel: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
  enableRetry: true,
  maxRetries: 3,
  enableFallback: true,
  enableCircuitBreaker: true
});

// Register recovery strategies
errorHandler.registerStrategy(ErrorType.AUTHENTICATION, new AuthErrorStrategy());
errorHandler.registerStrategy(ErrorType.NETWORK, new NetworkErrorStrategy());
errorHandler.registerStrategy(ErrorType.VALIDATION, new ValidationErrorStrategy());

// Register fallback strategy for all error types
Object.values(ErrorType).forEach(type => {
  errorHandler.registerStrategy(type, new FallbackStrategy());
});

/**
 * Enhanced error processing for backend
 */
class BackendErrorHandler extends ErrorHandler {
  constructor(config) {
    super(config);
  }

  /**
   * Override logError to use backend logger
   */
  logError(processedError) {
    const logLevel = this.getLogLevel(processedError.severity);
    
    logger[logLevel](`Backend error: ${processedError.message}`, {
      category: logger.LogCategory.ERROR,
      errorType: this.mapErrorType(processedError.type),
      processedError: {
        id: processedError.id,
        type: processedError.type,
        severity: processedError.severity,
        message: processedError.message,
        recoverable: processedError.recoverable,
        retryable: processedError.retryable
      },
      context: processedError.context,
      technicalDetails: processedError.technicalDetails
    });
  }

  /**
   * Map unified error types to logger error types
   */
  mapErrorType(errorType) {
    const mapping = {
      [ErrorType.AUTHENTICATION]: logger.ErrorType.AUTHENTICATION,
      [ErrorType.AUTHORIZATION]: logger.ErrorType.AUTHORIZATION,
      [ErrorType.VALIDATION]: logger.ErrorType.VALIDATION,
      [ErrorType.NETWORK]: logger.ErrorType.NETWORK,
      [ErrorType.DATABASE]: logger.ErrorType.DATABASE,
      [ErrorType.BUSINESS_LOGIC]: logger.ErrorType.BUSINESS_LOGIC,
      [ErrorType.CONFIGURATION]: logger.ErrorType.CONFIGURATION,
      [ErrorType.SYSTEM]: logger.ErrorType.SYSTEM,
      [ErrorType.UNKNOWN]: logger.ErrorType.UNKNOWN
    };

    return mapping[errorType] || logger.ErrorType.UNKNOWN;
  }

  /**
   * Get appropriate log level based on severity
   */
  getLogLevel(severity) {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'critical';
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'error';
    }
  }
}

// Create backend error handler instance
const backendErrorHandler = new BackendErrorHandler({
  logLevel: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
  enableRetry: true,
  maxRetries: 3,
  enableFallback: true,
  enableCircuitBreaker: true
});

// Register strategies for backend error handler
backendErrorHandler.registerStrategy(ErrorType.AUTHENTICATION, new AuthErrorStrategy());
backendErrorHandler.registerStrategy(ErrorType.NETWORK, new NetworkErrorStrategy());
backendErrorHandler.registerStrategy(ErrorType.VALIDATION, new ValidationErrorStrategy());
Object.values(ErrorType).forEach(type => {
  backendErrorHandler.registerStrategy(type, new FallbackStrategy());
});

/**
 * Express middleware for unified error handling
 */
const unifiedErrorMiddleware = async (err, req, res, next) => {
  try {
    // Create error context
    const errorContext = {
      component: 'backend-api',
      action: `${req.method} ${req.path}`,
      userId: req.user?.id,
      timestamp: new Date(),
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      additionalData: {
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        body: req.body,
        query: req.query,
        params: req.params
      },
      requestId: req.id || req.headers['x-request-id'],
      sessionId: req.sessionID
    };

    // Process error through unified handler
    const processedError = backendErrorHandler.captureError(err, errorContext);

    // Attempt recovery if possible
    let recoveryResult = null;
    const strategy = backendErrorHandler.getRecoveryStrategy(processedError);
    
    if (strategy && processedError.recoverable) {
      try {
        recoveryResult = await backendErrorHandler.executeRecovery(strategy, processedError);
        
        if (recoveryResult.success) {
          logger.info('Backend error recovery successful', {
            category: logger.LogCategory.ERROR,
            errorId: processedError.id,
            strategy: strategy.name,
            recoveryResult
          });

          // Handle successful recovery
          return handleRecoverySuccess(req, res, recoveryResult, processedError);
        }
      } catch (recoveryError) {
        logger.error('Backend error recovery failed', {
          category: logger.LogCategory.ERROR,
          errorId: processedError.id,
          recoveryError: recoveryError.message
        });
      }
    }

    // Format error response
    const errorResponse = formatErrorResponse(processedError, req, recoveryResult);
    
    // Determine HTTP status code
    const statusCode = getHttpStatusCode(processedError);
    
    // Send error response
    res.status(statusCode).json(errorResponse);

  } catch (handlingError) {
    // Critical error in error handling system
    logger.critical('Critical error in unified error handler', {
      category: logger.LogCategory.ERROR,
      errorType: logger.ErrorType.SYSTEM,
      originalError: err.message,
      handlingError: handlingError.message,
      stack: handlingError.stack
    });

    // Fallback to basic error response
    res.status(500).json({
      success: false,
      error: {
        code: 'CRITICAL_ERROR',
        message: process.env.NODE_ENV === 'production' 
          ? 'Erro interno do servidor' 
          : 'Critical error in error handling system',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Handle successful error recovery
 */
const handleRecoverySuccess = (req, res, recoveryResult, processedError) => {
  const { data } = recoveryResult;

  if (data?.action) {
    switch (data.action) {
      case 'retry_operation':
        // Indicate that client should retry
        return res.status(202).json({
          success: false,
          error: {
            code: 'RETRY_REQUIRED',
            message: 'Operation should be retried',
            retryAfter: data.retryAfter || 1000
          },
          recovery: {
            success: true,
            action: 'retry',
            message: recoveryResult.message
          }
        });

      case 'continue_anyway':
        // Allow operation to continue with warning
        return res.status(200).json({
          success: true,
          warning: {
            message: data.userMessage || 'Operation completed with warnings',
            code: processedError.type
          },
          recovery: {
            success: true,
            action: 'continue',
            message: recoveryResult.message
          }
        });

      default:
        // Generic successful recovery
        return res.status(200).json({
          success: true,
          recovery: {
            success: true,
            action: data.action,
            message: recoveryResult.message,
            data: data
          }
        });
    }
  }

  // Default successful recovery response
  return res.status(200).json({
    success: true,
    recovery: {
      success: true,
      message: recoveryResult.message
    }
  });
};

/**
 * Format error response for API
 */
const formatErrorResponse = (processedError, req, recoveryResult = null) => {
  const response = {
    success: false,
    error: {
      id: processedError.id,
      code: mapErrorTypeToCode(processedError.type),
      message: processedError.userMessage || processedError.message,
      type: processedError.type,
      severity: processedError.severity,
      timestamp: processedError.context.timestamp.toISOString(),
      path: req.originalUrl,
      method: req.method
    }
  };

  // Add recovery information if available
  if (recoveryResult) {
    response.recovery = {
      attempted: true,
      success: recoveryResult.success,
      message: recoveryResult.message,
      retryAfter: recoveryResult.retryAfter,
      fallbackRequired: recoveryResult.fallbackRequired
    };

    if (recoveryResult.data) {
      response.recovery.data = recoveryResult.data;
    }
  }

  // Add technical details in development
  if (process.env.NODE_ENV !== 'production') {
    response.debug = {
      originalError: processedError.originalError.message,
      stack: processedError.originalError.stack,
      technicalDetails: processedError.technicalDetails
    };
  }

  return response;
};

/**
 * Map error types to HTTP status codes
 */
const getHttpStatusCode = (processedError) => {
  const statusMapping = {
    [ErrorType.AUTHENTICATION]: 401,
    [ErrorType.AUTHORIZATION]: 403,
    [ErrorType.VALIDATION]: 400,
    [ErrorType.NETWORK]: 503,
    [ErrorType.DATABASE]: 503,
    [ErrorType.BUSINESS_LOGIC]: 422,
    [ErrorType.CONFIGURATION]: 503,
    [ErrorType.SYSTEM]: 500,
    [ErrorType.UNKNOWN]: 500
  };

  return statusMapping[processedError.type] || 500;
};

/**
 * Map error types to error codes
 */
const mapErrorTypeToCode = (errorType) => {
  const codeMapping = {
    [ErrorType.AUTHENTICATION]: 'AUTH_ERROR',
    [ErrorType.AUTHORIZATION]: 'PERMISSION_DENIED',
    [ErrorType.VALIDATION]: 'VALIDATION_ERROR',
    [ErrorType.NETWORK]: 'NETWORK_ERROR',
    [ErrorType.DATABASE]: 'DATABASE_ERROR',
    [ErrorType.BUSINESS_LOGIC]: 'BUSINESS_ERROR',
    [ErrorType.CONFIGURATION]: 'CONFIG_ERROR',
    [ErrorType.SYSTEM]: 'SYSTEM_ERROR',
    [ErrorType.UNKNOWN]: 'UNKNOWN_ERROR'
  };

  return codeMapping[errorType] || 'UNKNOWN_ERROR';
};

/**
 * Async wrapper with unified error handling
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create error context for service calls
 */
const createServiceErrorContext = (serviceName, operation, additionalData = {}) => {
  return {
    component: `${serviceName}-service`,
    action: operation,
    timestamp: new Date(),
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    additionalData
  };
};

/**
 * Handle service errors with unified error handler
 */
const handleServiceError = async (error, context) => {
  const processedError = backendErrorHandler.captureError(error, context);
  
  // Try recovery
  const strategy = backendErrorHandler.getRecoveryStrategy(processedError);
  if (strategy && processedError.recoverable) {
    const recoveryResult = await backendErrorHandler.executeRecovery(strategy, processedError);
    if (recoveryResult.success) {
      return { recovered: true, result: recoveryResult };
    }
  }

  throw processedError;
};

module.exports = {
  unifiedErrorMiddleware,
  asyncHandler,
  createServiceErrorContext,
  handleServiceError,
  backendErrorHandler,
  formatErrorResponse,
  getHttpStatusCode
};