/**
 * Firebase Auth Error Handler
 * Provides comprehensive error mapping and handling for Firebase Auth errors
 */

import logger, { LogCategory, ErrorType } from './logger.js';
import { ErrorCodes, ErrorSeverity, ErrorTypes, AppError } from './errorHandler.js';

// Comprehensive Firebase Auth error code mapping
export const FirebaseAuthErrorMap = {
  // Authentication errors
  'auth/invalid-email': {
    code: ErrorCodes.INVALID_CREDENTIALS,
    message: 'Endereço de email inválido',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.VALIDATION,
    userAction: 'Verifique se o email está correto'
  },
  'auth/user-disabled': {
    code: ErrorCodes.INSUFFICIENT_PERMISSIONS,
    message: 'Esta conta foi desativada',
    severity: ErrorSeverity.HIGH,
    type: ErrorTypes.AUTHORIZATION,
    userAction: 'Entre em contato com o administrador'
  },
  'auth/user-not-found': {
    code: ErrorCodes.INVALID_CREDENTIALS,
    message: 'Usuário não encontrado',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.AUTHENTICATION,
    userAction: 'Verifique se o email está correto ou crie uma nova conta'
  },
  'auth/wrong-password': {
    code: ErrorCodes.INVALID_CREDENTIALS,
    message: 'Senha incorreta',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.AUTHENTICATION,
    userAction: 'Verifique sua senha ou use "Esqueci minha senha"'
  },
  'auth/invalid-credential': {
    code: ErrorCodes.INVALID_CREDENTIALS,
    message: 'Credenciais inválidas',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.AUTHENTICATION,
    userAction: 'Verifique seu email e senha'
  },
  
  // Password related errors
  'auth/weak-password': {
    code: ErrorCodes.VALIDATION_ERROR,
    message: 'A senha deve ter pelo menos 6 caracteres',
    severity: ErrorSeverity.LOW,
    type: ErrorTypes.VALIDATION,
    userAction: 'Escolha uma senha mais forte'
  },
  'auth/requires-recent-login': {
    code: ErrorCodes.TOKEN_EXPIRED,
    message: 'Esta operação requer login recente',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.AUTHENTICATION,
    userAction: 'Faça login novamente para continuar'
  },
  
  // Rate limiting and security
  'auth/too-many-requests': {
    code: ErrorCodes.RATE_LIMIT_EXCEEDED,
    message: 'Muitas tentativas de login. Tente novamente em alguns minutos',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.AUTHENTICATION,
    userAction: 'Aguarde alguns minutos antes de tentar novamente'
  },
  'auth/operation-not-allowed': {
    code: ErrorCodes.INSUFFICIENT_PERMISSIONS,
    message: 'Operação não permitida',
    severity: ErrorSeverity.HIGH,
    type: ErrorTypes.AUTHORIZATION,
    userAction: 'Entre em contato com o suporte'
  },
  
  // Network and connectivity
  'auth/network-request-failed': {
    code: ErrorCodes.NETWORK_ERROR,
    message: 'Erro de conexão. Verifique sua internet',
    severity: ErrorSeverity.HIGH,
    type: ErrorTypes.NETWORK,
    userAction: 'Verifique sua conexão com a internet'
  },
  'auth/timeout': {
    code: ErrorCodes.TIMEOUT_ERROR,
    message: 'Tempo limite excedido',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.NETWORK,
    userAction: 'Tente novamente'
  },
  
  // Token and session errors
  'auth/id-token-expired': {
    code: ErrorCodes.TOKEN_EXPIRED,
    message: 'Sessão expirada',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.AUTHENTICATION,
    userAction: 'Faça login novamente'
  },
  'auth/id-token-revoked': {
    code: ErrorCodes.INVALID_TOKEN,
    message: 'Token de acesso revogado',
    severity: ErrorSeverity.HIGH,
    type: ErrorTypes.AUTHENTICATION,
    userAction: 'Faça login novamente'
  },
  'auth/invalid-id-token': {
    code: ErrorCodes.INVALID_TOKEN,
    message: 'Token de acesso inválido',
    severity: ErrorSeverity.HIGH,
    type: ErrorTypes.AUTHENTICATION,
    userAction: 'Faça login novamente'
  },
  
  // Email verification and password reset
  'auth/expired-action-code': {
    code: ErrorCodes.TOKEN_EXPIRED,
    message: 'Código de verificação expirado',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.VALIDATION,
    userAction: 'Solicite um novo código de verificação'
  },
  'auth/invalid-action-code': {
    code: ErrorCodes.VALIDATION_ERROR,
    message: 'Código de verificação inválido',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.VALIDATION,
    userAction: 'Verifique o código ou solicite um novo'
  },
  'auth/user-token-expired': {
    code: ErrorCodes.TOKEN_EXPIRED,
    message: 'Token do usuário expirado',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.AUTHENTICATION,
    userAction: 'Faça login novamente'
  },
  
  // Account management
  'auth/email-already-in-use': {
    code: ErrorCodes.DUPLICATE_EMAIL,
    message: 'Este email já está em uso',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.VALIDATION,
    userAction: 'Use um email diferente ou faça login'
  },
  'auth/account-exists-with-different-credential': {
    code: ErrorCodes.DUPLICATE_EMAIL,
    message: 'Já existe uma conta com este email',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.AUTHENTICATION,
    userAction: 'Faça login com suas credenciais originais'
  },
  
  // Configuration and internal errors
  'auth/app-deleted': {
    code: ErrorCodes.INTERNAL_SERVER_ERROR,
    message: 'Erro de configuração da aplicação',
    severity: ErrorSeverity.CRITICAL,
    type: ErrorTypes.SYSTEM,
    userAction: 'Entre em contato com o suporte'
  },
  'auth/app-not-authorized': {
    code: ErrorCodes.INSUFFICIENT_PERMISSIONS,
    message: 'Aplicação não autorizada',
    severity: ErrorSeverity.CRITICAL,
    type: ErrorTypes.SYSTEM,
    userAction: 'Entre em contato com o suporte'
  },
  'auth/argument-error': {
    code: ErrorCodes.VALIDATION_ERROR,
    message: 'Erro nos dados fornecidos',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.VALIDATION,
    userAction: 'Verifique os dados inseridos'
  },
  'auth/invalid-api-key': {
    code: ErrorCodes.INTERNAL_SERVER_ERROR,
    message: 'Erro de configuração do sistema',
    severity: ErrorSeverity.CRITICAL,
    type: ErrorTypes.SYSTEM,
    userAction: 'Entre em contato com o suporte'
  },
  'auth/invalid-user-token': {
    code: ErrorCodes.INVALID_TOKEN,
    message: 'Token de usuário inválido',
    severity: ErrorSeverity.HIGH,
    type: ErrorTypes.AUTHENTICATION,
    userAction: 'Faça login novamente'
  },
  'auth/invalid-tenant-id': {
    code: ErrorCodes.INTERNAL_SERVER_ERROR,
    message: 'Erro de configuração do sistema',
    severity: ErrorSeverity.CRITICAL,
    type: ErrorTypes.SYSTEM,
    userAction: 'Entre em contato com o suporte'
  },
  
  // Multi-factor authentication
  'auth/multi-factor-auth-required': {
    code: ErrorCodes.INSUFFICIENT_PERMISSIONS,
    message: 'Autenticação de dois fatores necessária',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.AUTHENTICATION,
    userAction: 'Complete a autenticação de dois fatores'
  },
  'auth/multi-factor-info-not-found': {
    code: ErrorCodes.VALIDATION_ERROR,
    message: 'Informações de autenticação não encontradas',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.VALIDATION,
    userAction: 'Configure a autenticação de dois fatores'
  },
  
  // Custom and unknown errors
  'auth/custom-token-mismatch': {
    code: ErrorCodes.INVALID_TOKEN,
    message: 'Token personalizado inválido',
    severity: ErrorSeverity.HIGH,
    type: ErrorTypes.AUTHENTICATION,
    userAction: 'Entre em contato com o suporte'
  },
  'auth/claims-too-large': {
    code: ErrorCodes.VALIDATION_ERROR,
    message: 'Dados de usuário muito grandes',
    severity: ErrorSeverity.MEDIUM,
    type: ErrorTypes.VALIDATION,
    userAction: 'Entre em contato com o suporte'
  }
};

/**
 * Parse Firebase Auth error and return structured AppError
 * @param {Error} error - Firebase Auth error
 * @param {Object} context - Additional context
 * @returns {AppError} Structured application error
 */
export const parseFirebaseAuthError = (error, context = {}) => {
  try {
    // Log the original Firebase error
    logger.debug('Parsing Firebase Auth error', {
      category: LogCategory.AUTH,
      errorType: ErrorType.AUTHENTICATION,
      firebaseError: {
        code: error.code,
        message: error.message,
        stack: error.stack
      },
      context
    });

    // Check if it's a Firebase Auth error
    if (!error.code || !error.code.startsWith('auth/')) {
      // Not a Firebase Auth error, return generic error
      const genericError = new AppError(
        error.message || 'Erro de autenticação desconhecido',
        ErrorCodes.INTERNAL_SERVER_ERROR,
        ErrorTypes.AUTHENTICATION,
        ErrorSeverity.MEDIUM,
        { originalError: error.message }
      );

      logger.warn('Non-Firebase Auth error in parseFirebaseAuthError', {
        category: LogCategory.AUTH,
        errorType: ErrorType.AUTHENTICATION,
        error: error.message,
        context
      });

      return genericError;
    }

    // Get error mapping
    const errorMapping = FirebaseAuthErrorMap[error.code];
    
    if (errorMapping) {
      // Create structured error with mapping
      const appError = new AppError(
        errorMapping.message,
        errorMapping.code,
        errorMapping.type,
        errorMapping.severity,
        {
          firebaseCode: error.code,
          userAction: errorMapping.userAction,
          originalMessage: error.message,
          context
        }
      );

      // Log with appropriate level based on severity
      const logLevel = errorMapping.severity === ErrorSeverity.CRITICAL ? 'critical' :
                       errorMapping.severity === ErrorSeverity.HIGH ? 'error' :
                       errorMapping.severity === ErrorSeverity.MEDIUM ? 'warn' : 'info';

      logger[logLevel]('Firebase Auth error mapped', {
        category: LogCategory.AUTH,
        errorType: ErrorType.AUTHENTICATION,
        firebaseCode: error.code,
        appErrorCode: errorMapping.code,
        severity: errorMapping.severity,
        userAction: errorMapping.userAction,
        context
      });

      return appError;
    } else {
      // Unknown Firebase Auth error
      const unknownError = new AppError(
        error.message || 'Erro de autenticação desconhecido',
        ErrorCodes.INTERNAL_SERVER_ERROR,
        ErrorTypes.AUTHENTICATION,
        ErrorSeverity.MEDIUM,
        {
          firebaseCode: error.code,
          originalMessage: error.message,
          context
        }
      );

      logger.warn('Unknown Firebase Auth error code', {
        category: LogCategory.AUTH,
        errorType: ErrorType.AUTHENTICATION,
        firebaseCode: error.code,
        message: error.message,
        context
      });

      return unknownError;
    }
  } catch (parseError) {
    // Error in parsing itself
    logger.error('Error in parseFirebaseAuthError function', {
      category: LogCategory.ERROR,
      errorType: ErrorType.SYSTEM,
      parseError: parseError.message,
      originalError: error?.message,
      context
    });

    return new AppError(
      'Erro interno no sistema de autenticação',
      ErrorCodes.INTERNAL_SERVER_ERROR,
      ErrorTypes.SYSTEM,
      ErrorSeverity.CRITICAL,
      { parseError: parseError.message }
    );
  }
};

/**
 * Check if error should trigger logout
 * @param {Error|AppError} error - Error to check
 * @returns {boolean} Whether to logout
 */
export const shouldLogoutOnFirebaseError = (error) => {
  const logoutTriggeringCodes = [
    'auth/id-token-expired',
    'auth/id-token-revoked',
    'auth/invalid-id-token',
    'auth/user-token-expired',
    'auth/invalid-user-token',
    'auth/user-disabled'
  ];

  // Check Firebase code
  if (error.details?.firebaseCode) {
    return logoutTriggeringCodes.includes(error.details.firebaseCode);
  }

  // Check app error code
  const logoutAppCodes = [
    ErrorCodes.TOKEN_EXPIRED,
    ErrorCodes.INVALID_TOKEN,
    ErrorCodes.INSUFFICIENT_PERMISSIONS
  ];

  return logoutAppCodes.includes(error.code);
};

/**
 * Check if Firebase error should be retried
 * @param {Error|AppError} error - Error to check
 * @param {number} retryCount - Current retry count
 * @param {number} maxRetries - Maximum retries allowed
 * @returns {boolean} Whether to retry
 */
export const shouldRetryFirebaseError = (error, retryCount = 0, maxRetries = 3) => {
  if (retryCount >= maxRetries) {
    return false;
  }

  const retryableCodes = [
    'auth/network-request-failed',
    'auth/timeout',
    'auth/too-many-requests' // With exponential backoff
  ];

  // Check Firebase code
  if (error.details?.firebaseCode) {
    return retryableCodes.includes(error.details.firebaseCode);
  }

  // Check app error code
  const retryableAppCodes = [
    ErrorCodes.NETWORK_ERROR,
    ErrorCodes.TIMEOUT_ERROR,
    ErrorCodes.RATE_LIMIT_EXCEEDED
  ];

  return retryableAppCodes.includes(error.code);
};

/**
 * Get retry delay for Firebase errors (exponential backoff)
 * @param {Error|AppError} error - Error object
 * @param {number} retryCount - Current retry count
 * @returns {number} Delay in milliseconds
 */
export const getFirebaseRetryDelay = (error, retryCount) => {
  // Special handling for rate limiting
  if (error.details?.firebaseCode === 'auth/too-many-requests' || 
      error.code === ErrorCodes.RATE_LIMIT_EXCEEDED) {
    // Longer delay for rate limiting
    return Math.min(5000 * Math.pow(2, retryCount), 60000); // Max 1 minute
  }

  // Standard exponential backoff
  return Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds
};

/**
 * Enhanced security validation for Firebase Auth operations
 * @param {Object} context - Operation context
 * @returns {Object} Security validation result
 */
export const validateFirebaseAuthSecurity = (context = {}) => {
  const securityIssues = [];
  const warnings = [];

  try {
    // Check for suspicious patterns
    if (context.email) {
      // Check for common attack patterns in email
      const suspiciousPatterns = [
        /script/i,
        /javascript/i,
        /onload/i,
        /onerror/i,
        /<.*>/,
        /\.\./
      ];

      if (suspiciousPatterns.some(pattern => pattern.test(context.email))) {
        securityIssues.push('Suspicious email format detected');
      }
    }

    // Check for rapid successive attempts
    const lastAttempt = localStorage.getItem('last_auth_attempt');
    const now = Date.now();
    
    if (lastAttempt && (now - parseInt(lastAttempt)) < 1000) {
      warnings.push('Rapid authentication attempts detected');
    }
    
    localStorage.setItem('last_auth_attempt', now.toString());

    // Log security validation
    if (securityIssues.length > 0 || warnings.length > 0) {
      logger.warn('Firebase Auth security validation issues', {
        category: LogCategory.SECURITY,
        errorType: ErrorType.AUTHENTICATION,
        securityIssues,
        warnings,
        context: {
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });
    }

    return {
      isValid: securityIssues.length === 0,
      securityIssues,
      warnings
    };
  } catch (error) {
    logger.error('Error in Firebase Auth security validation', {
      category: LogCategory.SECURITY,
      errorType: ErrorType.SYSTEM,
      error: error.message
    });

    return {
      isValid: true, // Fail open for security validation errors
      securityIssues: [],
      warnings: ['Security validation error']
    };
  }
};

export default {
  parseFirebaseAuthError,
  shouldLogoutOnFirebaseError,
  shouldRetryFirebaseError,
  getFirebaseRetryDelay,
  validateFirebaseAuthSecurity,
  FirebaseAuthErrorMap
};