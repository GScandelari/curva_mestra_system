/**
 * Unified Error Handler for Firebase Functions
 * Integrates with the shared error handling system
 */

import { HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { ErrorHandler } from '../../../shared/utils/ErrorHandler.js';
import { AuthErrorStrategy } from '../../../shared/strategies/AuthErrorStrategy.js';
import { NetworkErrorStrategy } from '../../../shared/strategies/NetworkErrorStrategy.js';
import { ValidationErrorStrategy } from '../../../shared/strategies/ValidationErrorStrategy.js';
import { FallbackStrategy } from '../../../shared/strategies/FallbackStrategy.js';
import { ErrorType, ErrorSeverity, ErrorContext, ProcessedError } from '../../../shared/types/errorTypes.js';

/**
 * Firebase Functions Error Handler
 */
class FirebaseFunctionsErrorHandler extends ErrorHandler {
  constructor(config?: any) {
    super(config);
  }

  /**
   * Override logError to use Firebase Functions logger
   */
  logError(processedError: ProcessedError): void {
    const logData = {
      errorId: processedError.id,
      type: processedError.type,
      severity: processedError.severity,
      message: processedError.message,
      recoverable: processedError.recoverable,
      retryable: processedError.retryable,
      context: processedError.context,
      technicalDetails: processedError.technicalDetails
    };

    switch (processedError.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error('Critical Firebase Functions error', logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error('High severity Firebase Functions error', logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('Medium severity Firebase Functions error', logData);
        break;
      case ErrorSeverity.LOW:
        logger.info('Low severity Firebase Functions error', logData);
        break;
      default:
        logger.error('Firebase Functions error', logData);
    }
  }
}

// Create Firebase Functions error handler instance
const firebaseFunctionsErrorHandler = new FirebaseFunctionsErrorHandler({
  logLevel: 'error',
  enableRetry: true,
  maxRetries: 3,
  enableFallback: true,
  enableCircuitBreaker: true
});

// Register recovery strategies
firebaseFunctionsErrorHandler.registerStrategy(ErrorType.AUTHENTICATION, new AuthErrorStrategy());
firebaseFunctionsErrorHandler.registerStrategy(ErrorType.NETWORK, new NetworkErrorStrategy());
firebaseFunctionsErrorHandler.registerStrategy(ErrorType.VALIDATION, new ValidationErrorStrategy());

// Register fallback strategy for all error types
Object.values(ErrorType).forEach(type => {
  firebaseFunctionsErrorHandler.registerStrategy(type, new FallbackStrategy());
});

/**
 * Wrapper for Firebase Functions with unified error handling
 */
export const withUnifiedErrorHandling = (handler: Function) => {
  return async (request: any) => {
    try {
      return await handler(request);
    } catch (error) {
      return handleFirebaseFunctionError(error as Error, request);
    }
  };
};

/**
 * Handle Firebase Function errors with unified error handler
 */
const handleFirebaseFunctionError = async (error: Error, request: any): Promise<never> => {
  try {
    // Create error context
    const errorContext: ErrorContext = {
      component: 'firebase-function',
      action: request.rawRequest?.url || 'unknown',
      userId: request.auth?.uid,
      timestamp: new Date(),
      environment: 'production',
      additionalData: {
        functionName: process.env.FUNCTION_NAME,
        region: process.env.FUNCTION_REGION,
        requestData: request.data,
        headers: request.rawRequest?.headers
      },
      requestId: request.rawRequest?.headers['x-request-id'],
      sessionId: request.rawRequest?.headers['x-session-id']
    };

    // Process error through unified handler
    const processedError = firebaseFunctionsErrorHandler.captureError(error, errorContext);

    // Attempt recovery if possible
    let recoveryResult = null;
    const strategy = firebaseFunctionsErrorHandler.getRecoveryStrategy(processedError);
    
    if (strategy && processedError.recoverable) {
      try {
        recoveryResult = await firebaseFunctionsErrorHandler.executeRecovery(strategy, processedError);
        
        if (recoveryResult.success) {
          logger.info('Firebase Functions error recovery successful', {
            errorId: processedError.id,
            strategy: strategy.name,
            recoveryResult
          });

          // Handle successful recovery
          return handleRecoverySuccess(recoveryResult, processedError);
        }
      } catch (recoveryError) {
        logger.error('Firebase Functions error recovery failed', {
          errorId: processedError.id,
          recoveryError: (recoveryError as Error).message
        });
      }
    }

    // Convert to HttpsError for Firebase Functions
    throw convertToHttpsError(processedError, recoveryResult);

  } catch (handlingError) {
    // Critical error in error handling system
    logger.error('Critical error in Firebase Functions unified error handler', {
      originalError: error.message,
      handlingError: (handlingError as Error).message,
      stack: (handlingError as Error).stack
    });

    // Fallback to basic HttpsError
    throw new HttpsError('internal', 'Erro interno do servidor');
  }
};

/**
 * Handle successful error recovery
 */
const handleRecoverySuccess = (recoveryResult: any, processedError: ProcessedError): never => {
  const { data } = recoveryResult;

  if (data?.action) {
    switch (data.action) {
      case 'retry_operation':
        // Indicate that client should retry
        throw new HttpsError('unavailable', 'Operação deve ser repetida', {
          recovery: {
            success: true,
            action: 'retry',
            retryAfter: data.retryAfter || 1000,
            message: recoveryResult.message
          }
        });

      case 'continue_anyway':
        // This shouldn't throw an error, but Firebase Functions require throwing
        // The client will need to handle this case
        throw new HttpsError('ok' as any, 'Operação completada com avisos', {
          recovery: {
            success: true,
            action: 'continue',
            message: recoveryResult.message,
            data: data
          }
        });

      default:
        // Generic successful recovery
        throw new HttpsError('ok' as any, 'Erro recuperado com sucesso', {
          recovery: {
            success: true,
            action: data.action,
            message: recoveryResult.message,
            data: data
          }
        });
    }
  }

  // Default successful recovery
  throw new HttpsError('ok' as any, 'Erro recuperado com sucesso', {
    recovery: {
      success: true,
      message: recoveryResult.message
    }
  });
};

/**
 * Convert ProcessedError to HttpsError
 */
const convertToHttpsError = (processedError: ProcessedError, recoveryResult: any = null): HttpsError => {
  const code = mapErrorTypeToHttpsErrorCode(processedError.type);
  const message = processedError.userMessage || processedError.message;
  
  const details: any = {
    errorId: processedError.id,
    type: processedError.type,
    severity: processedError.severity,
    timestamp: processedError.context.timestamp.toISOString(),
    recoverable: processedError.recoverable,
    retryable: processedError.retryable
  };

  // Add recovery information if available
  if (recoveryResult) {
    details.recovery = {
      attempted: true,
      success: recoveryResult.success,
      message: recoveryResult.message,
      retryAfter: recoveryResult.retryAfter,
      fallbackRequired: recoveryResult.fallbackRequired
    };

    if (recoveryResult.data) {
      details.recovery.data = recoveryResult.data;
    }
  }

  return new HttpsError(code, message, details);
};

/**
 * Map error types to Firebase HttpsError codes
 */
const mapErrorTypeToHttpsErrorCode = (errorType: ErrorType): string => {
  const codeMapping = {
    [ErrorType.AUTHENTICATION]: 'unauthenticated',
    [ErrorType.AUTHORIZATION]: 'permission-denied',
    [ErrorType.VALIDATION]: 'invalid-argument',
    [ErrorType.NETWORK]: 'unavailable',
    [ErrorType.DATABASE]: 'unavailable',
    [ErrorType.BUSINESS_LOGIC]: 'failed-precondition',
    [ErrorType.CONFIGURATION]: 'unavailable',
    [ErrorType.SYSTEM]: 'internal',
    [ErrorType.UNKNOWN]: 'internal'
  };

  return codeMapping[errorType] || 'internal';
};

/**
 * Create error context for Firebase Functions
 */
export const createFunctionErrorContext = (
  functionName: string, 
  operation: string, 
  request: any, 
  additionalData: any = {}
): ErrorContext => {
  return {
    component: `firebase-function-${functionName}`,
    action: operation,
    userId: request.auth?.uid,
    timestamp: new Date(),
    environment: 'production',
    additionalData: {
      functionName,
      region: process.env.FUNCTION_REGION,
      requestData: request.data,
      ...additionalData
    },
    requestId: request.rawRequest?.headers['x-request-id'],
    sessionId: request.rawRequest?.headers['x-session-id']
  };
};

/**
 * Handle service errors in Firebase Functions
 */
export const handleFunctionServiceError = async (
  error: Error, 
  context: ErrorContext
): Promise<never> => {
  const processedError = firebaseFunctionsErrorHandler.captureError(error, context);
  
  // Try recovery
  const strategy = firebaseFunctionsErrorHandler.getRecoveryStrategy(processedError);
  if (strategy && processedError.recoverable) {
    const recoveryResult = await firebaseFunctionsErrorHandler.executeRecovery(strategy, processedError);
    if (recoveryResult.success) {
      return handleRecoverySuccess(recoveryResult, processedError);
    }
  }

  throw convertToHttpsError(processedError);
};

/**
 * Async wrapper with unified error handling for Firebase Functions
 */
export const asyncFunctionHandler = (fn: Function) => {
  return async (request: any) => {
    try {
      return await fn(request);
    } catch (error) {
      return handleFirebaseFunctionError(error as Error, request);
    }
  };
};

export {
  firebaseFunctionsErrorHandler,
  convertToHttpsError,
  mapErrorTypeToHttpsErrorCode
};