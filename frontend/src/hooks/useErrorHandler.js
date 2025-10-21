/**
 * React Hook for Unified Error Handling
 * Provides error handling capabilities to React components
 */

import { useCallback, useContext, useRef } from 'react';
import { ErrorHandler } from '../../../shared/utils/ErrorHandler.js';
import { AuthErrorStrategy } from '../../../shared/strategies/AuthErrorStrategy.js';
import { NetworkErrorStrategy } from '../../../shared/strategies/NetworkErrorStrategy.js';
import { ValidationErrorStrategy } from '../../../shared/strategies/ValidationErrorStrategy.js';
import { FallbackStrategy } from '../../../shared/strategies/FallbackStrategy.js';
import { ErrorType } from '../../../shared/types/errorTypes.js';
import logger, { LogCategory, ErrorType as LogErrorType } from '../utils/logger.js';
import { useAuth } from './useAuth.js';
import { useNotification } from './useNotification.js';

// Create singleton error handler instance
let errorHandlerInstance = null;

const getErrorHandler = () => {
  if (!errorHandlerInstance) {
    errorHandlerInstance = new ErrorHandler({
      logLevel: import.meta.env.PROD ? 'error' : 'debug',
      enableRetry: true,
      maxRetries: 3,
      enableFallback: true,
      enableCircuitBreaker: true
    });

    // Register recovery strategies
    errorHandlerInstance.registerStrategy(ErrorType.AUTHENTICATION, new AuthErrorStrategy());
    errorHandlerInstance.registerStrategy(ErrorType.NETWORK, new NetworkErrorStrategy());
    errorHandlerInstance.registerStrategy(ErrorType.VALIDATION, new ValidationErrorStrategy());
    
    // Register fallback strategy for all error types
    Object.values(ErrorType).forEach(type => {
      errorHandlerInstance.registerStrategy(type, new FallbackStrategy());
    });
  }
  
  return errorHandlerInstance;
};

export const useErrorHandler = () => {
  const { logout } = useAuth();
  const { showNotification, showError, showWarning } = useNotification();
  const errorHandler = useRef(getErrorHandler());
  const retryAttempts = useRef(new Map());

  const handleError = useCallback(async (error, context = {}) => {
    try {
      // Create error context
      const errorContext = {
        component: context.component || 'unknown',
        action: context.action || 'unknown',
        userId: context.userId,
        timestamp: new Date(),
        environment: import.meta.env.PROD ? 'production' : 'development',
        additionalData: context.additionalData,
        requestId: context.requestId,
        sessionId: context.sessionId
      };

      // Capture and process the error
      const processedError = errorHandler.current.captureError(error, errorContext);

      // Log the error
      logger.error('Error handled by useErrorHandler', {
        category: LogCategory.ERROR,
        errorType: LogErrorType.SYSTEM,
        processedError: {
          id: processedError.id,
          type: processedError.type,
          severity: processedError.severity,
          message: processedError.message,
          recoverable: processedError.recoverable
        },
        context: errorContext
      });

      // Get recovery strategy
      const strategy = errorHandler.current.getRecoveryStrategy(processedError);

      if (strategy && processedError.recoverable) {
        // Attempt recovery
        const recoveryResult = await errorHandler.current.executeRecovery(strategy, processedError);
        
        if (recoveryResult.success) {
          // Recovery successful
          logger.info('Error recovery successful', {
            category: LogCategory.ERROR,
            errorId: processedError.id,
            strategy: strategy.name,
            recoveryResult
          });

          // Handle successful recovery actions
          await handleRecoverySuccess(recoveryResult, processedError);
          return { recovered: true, result: recoveryResult };
        } else {
          // Recovery failed, handle fallback
          await handleRecoveryFailure(recoveryResult, processedError);
          return { recovered: false, result: recoveryResult };
        }
      } else {
        // No recovery strategy or not recoverable
        await handleUnrecoverableError(processedError);
        return { recovered: false, error: processedError };
      }
    } catch (handlingError) {
      // Error in error handling itself
      logger.critical('Error in error handling system', {
        category: LogCategory.ERROR,
        errorType: LogErrorType.SYSTEM,
        originalError: error.message,
        handlingError: handlingError.message
      });

      // Fallback to basic error display
      showError('Ocorreu um erro crítico no sistema. Recarregue a página.');
      return { recovered: false, critical: true };
    }
  }, [logout, showNotification, showError, showWarning]);

  const handleRecoverySuccess = useCallback(async (recoveryResult, processedError) => {
    const { data } = recoveryResult;

    if (data?.action) {
      switch (data.action) {
        case 'refresh_token':
          // Handle token refresh
          logger.info('Attempting token refresh', {
            category: LogCategory.AUTH,
            errorId: processedError.id
          });
          break;

        case 'retry_auth':
          showNotification(data.message || 'Tentando autenticar novamente...', 'info');
          break;

        case 'highlight_required_fields':
        case 'show_format_help':
        case 'focus_email_field':
        case 'show_password_requirements':
        case 'highlight_validation_errors':
          // Validation error handling - let the component handle the specific UI updates
          if (data.userMessage) {
            showWarning(data.userMessage);
          }
          break;

        case 'show_gentle_notification':
          if (data.userMessage) {
            showNotification(data.userMessage, 'warning');
          }
          break;

        default:
          if (data.userMessage) {
            showNotification(data.userMessage, 'info');
          }
      }
    }
  }, [showNotification, showWarning]);

  const handleRecoveryFailure = useCallback(async (recoveryResult, processedError) => {
    const { data, retryAfter } = recoveryResult;

    if (data?.action) {
      switch (data.action) {
        case 'redirect_to_login':
          showError('Sua sessão expirou. Redirecionando para login...');
          setTimeout(() => logout(), 2000);
          break;

        case 'show_login_form':
          showError(data.message || 'Credenciais inválidas. Faça login novamente.');
          break;

        case 'retry_operation':
          if (retryAfter) {
            showNotification(`Tentando novamente em ${Math.ceil(retryAfter / 1000)} segundos...`, 'info');
          }
          break;

        case 'show_error_with_options':
        case 'show_recoverable_error':
          showError(data.userMessage || processedError.userMessage);
          break;

        case 'show_critical_error_page':
          showError(data.userMessage || 'Erro crítico no sistema. Nossa equipe foi notificada.');
          break;

        default:
          showError(data.userMessage || processedError.userMessage || 'Ocorreu um erro inesperado.');
      }
    } else {
      showError(processedError.userMessage || 'Ocorreu um erro inesperado.');
    }
  }, [showError, showNotification, logout]);

  const handleUnrecoverableError = useCallback(async (processedError) => {
    // Handle unrecoverable errors based on type
    switch (processedError.type) {
      case ErrorType.AUTHENTICATION:
        showError('Erro de autenticação. Faça login novamente.');
        setTimeout(() => logout(), 2000);
        break;

      case ErrorType.AUTHORIZATION:
        showError('Você não tem permissão para realizar esta ação.');
        break;

      case ErrorType.VALIDATION:
        showWarning(processedError.userMessage || 'Verifique os dados inseridos.');
        break;

      case ErrorType.NETWORK:
        showError('Erro de conexão. Verifique sua internet e tente novamente.');
        break;

      default:
        showError(processedError.userMessage || 'Ocorreu um erro inesperado.');
    }
  }, [showError, showWarning, logout]);

  const retryOperation = useCallback(async (operation, context = {}, maxRetries = 3) => {
    const operationKey = `${context.component}_${context.action}`;
    let attempts = retryAttempts.current.get(operationKey) || 0;

    if (attempts >= maxRetries) {
      retryAttempts.current.delete(operationKey);
      throw new Error('Maximum retry attempts exceeded');
    }

    try {
      const result = await operation();
      retryAttempts.current.delete(operationKey); // Reset on success
      return result;
    } catch (error) {
      attempts++;
      retryAttempts.current.set(operationKey, attempts);

      const { recovered } = await handleError(error, context);
      
      if (!recovered) {
        throw error;
      }

      // If recovered, retry the operation
      const delay = Math.min(1000 * Math.pow(2, attempts - 1), 10000); // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return retryOperation(operation, context, maxRetries);
    }
  }, [handleError]);

  const clearRetryAttempts = useCallback((operationKey) => {
    if (operationKey) {
      retryAttempts.current.delete(operationKey);
    } else {
      retryAttempts.current.clear();
    }
  }, []);

  return {
    handleError,
    retryOperation,
    clearRetryAttempts,
    errorHandler: errorHandler.current
  };
};