// Frontend error handling utilities
import logger, { LogCategory, ErrorType } from './logger.js';

// Error codes mapping (should match backend)
export const ErrorCodes = {
  // Authentication errors
  INVALID_CREDENTIALS: 'AUTH_001',
  TOKEN_EXPIRED: 'AUTH_002',
  INSUFFICIENT_PERMISSIONS: 'AUTH_003',
  INVALID_TOKEN: 'AUTH_004',
  
  // Inventory errors
  PRODUCT_NOT_FOUND: 'INV_001',
  INSUFFICIENT_STOCK: 'INV_002',
  PRODUCT_EXPIRED: 'INV_003',
  INVALID_EXPIRATION_DATE: 'INV_004',
  DUPLICATE_PRODUCT: 'INV_005',
  
  // Request errors
  REQUEST_NOT_FOUND: 'REQ_001',
  REQUEST_ALREADY_PROCESSED: 'REQ_002',
  INVALID_REQUEST_STATUS: 'REQ_003',
  REQUEST_CANNOT_BE_MODIFIED: 'REQ_004',
  
  // Invoice errors
  DUPLICATE_INVOICE_NUMBER: 'INVOICE_001',
  INVALID_INVOICE_FORMAT: 'INVOICE_002',
  INVOICE_NOT_FOUND: 'INVOICE_003',
  
  // Patient errors
  PATIENT_NOT_FOUND: 'PAT_001',
  DUPLICATE_PATIENT_EMAIL: 'PAT_002',
  INVALID_PATIENT_DATA: 'PAT_003',
  
  // User errors
  USER_NOT_FOUND: 'USER_001',
  DUPLICATE_USERNAME: 'USER_002',
  DUPLICATE_EMAIL: 'USER_003',
  INVALID_USER_ROLE: 'USER_004',
  
  // Validation errors
  VALIDATION_ERROR: 'VAL_001',
  MISSING_REQUIRED_FIELD: 'VAL_002',
  INVALID_DATA_FORMAT: 'VAL_003',
  
  // Database errors
  DATABASE_CONNECTION_ERROR: 'DB_001',
  DATABASE_QUERY_ERROR: 'DB_002',
  DATABASE_CONSTRAINT_ERROR: 'DB_003',
  
  // System errors
  INTERNAL_SERVER_ERROR: 'SYS_001',
  SERVICE_UNAVAILABLE: 'SYS_002',
  RATE_LIMIT_EXCEEDED: 'SYS_003',
  FILE_UPLOAD_ERROR: 'SYS_004',
  
  // Network errors
  NETWORK_ERROR: 'NET_001',
  TIMEOUT_ERROR: 'NET_002',
  CONNECTION_ERROR: 'NET_003'
};

// Error severity levels
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Error types
export const ErrorTypes = {
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  BUSINESS: 'business',
  NETWORK: 'network',
  SYSTEM: 'system'
};

// Custom error class
export class AppError extends Error {
  constructor(message, code = null, type = ErrorTypes.SYSTEM, severity = ErrorSeverity.MEDIUM, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.type = type;
    this.severity = severity;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// Error message translations
const errorMessages = {
  [ErrorCodes.INVALID_CREDENTIALS]: 'Credenciais inválidas. Verifique seu usuário e senha.',
  [ErrorCodes.TOKEN_EXPIRED]: 'Sua sessão expirou. Faça login novamente.',
  [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 'Você não tem permissão para realizar esta ação.',
  [ErrorCodes.INVALID_TOKEN]: 'Token inválido. Faça login novamente.',
  
  [ErrorCodes.PRODUCT_NOT_FOUND]: 'Produto não encontrado.',
  [ErrorCodes.INSUFFICIENT_STOCK]: 'Estoque insuficiente para esta operação.',
  [ErrorCodes.PRODUCT_EXPIRED]: 'Este produto está vencido e não pode ser utilizado.',
  [ErrorCodes.INVALID_EXPIRATION_DATE]: 'Data de validade inválida.',
  [ErrorCodes.DUPLICATE_PRODUCT]: 'Este produto já existe no sistema.',
  
  [ErrorCodes.REQUEST_NOT_FOUND]: 'Solicitação não encontrada.',
  [ErrorCodes.REQUEST_ALREADY_PROCESSED]: 'Esta solicitação já foi processada.',
  [ErrorCodes.INVALID_REQUEST_STATUS]: 'Status da solicitação inválido.',
  [ErrorCodes.REQUEST_CANNOT_BE_MODIFIED]: 'Esta solicitação não pode ser modificada.',
  
  [ErrorCodes.DUPLICATE_INVOICE_NUMBER]: 'Este número de nota fiscal já existe.',
  [ErrorCodes.INVALID_INVOICE_FORMAT]: 'Formato de nota fiscal inválido.',
  [ErrorCodes.INVOICE_NOT_FOUND]: 'Nota fiscal não encontrada.',
  
  [ErrorCodes.PATIENT_NOT_FOUND]: 'Paciente não encontrado.',
  [ErrorCodes.DUPLICATE_PATIENT_EMAIL]: 'Este email já está cadastrado para outro paciente.',
  [ErrorCodes.INVALID_PATIENT_DATA]: 'Dados do paciente inválidos.',
  
  [ErrorCodes.USER_NOT_FOUND]: 'Usuário não encontrado.',
  [ErrorCodes.DUPLICATE_USERNAME]: 'Este nome de usuário já está em uso.',
  [ErrorCodes.DUPLICATE_EMAIL]: 'Este email já está em uso.',
  [ErrorCodes.INVALID_USER_ROLE]: 'Perfil de usuário inválido.',
  
  [ErrorCodes.VALIDATION_ERROR]: 'Dados inválidos. Verifique os campos preenchidos.',
  [ErrorCodes.MISSING_REQUIRED_FIELD]: 'Campos obrigatórios não preenchidos.',
  [ErrorCodes.INVALID_DATA_FORMAT]: 'Formato de dados inválido.',
  
  [ErrorCodes.DATABASE_CONNECTION_ERROR]: 'Erro de conexão com o banco de dados.',
  [ErrorCodes.DATABASE_QUERY_ERROR]: 'Erro ao processar dados.',
  [ErrorCodes.DATABASE_CONSTRAINT_ERROR]: 'Erro de integridade dos dados.',
  
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 'Erro interno do servidor. Tente novamente.',
  [ErrorCodes.SERVICE_UNAVAILABLE]: 'Serviço temporariamente indisponível.',
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Muitas solicitações. Aguarde um momento.',
  [ErrorCodes.FILE_UPLOAD_ERROR]: 'Erro no upload do arquivo.',
  
  [ErrorCodes.NETWORK_ERROR]: 'Erro de conexão. Verifique sua internet.',
  [ErrorCodes.TIMEOUT_ERROR]: 'Tempo limite excedido. Tente novamente.',
  [ErrorCodes.CONNECTION_ERROR]: 'Não foi possível conectar ao servidor.'
};

// Get user-friendly error message
export const getErrorMessage = (error) => {
  if (error?.response?.data?.error?.code) {
    return errorMessages[error.response.data.error.code] || error.response.data.error.message;
  }
  
  if (error?.code) {
    return errorMessages[error.code] || error.message;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return 'Ocorreu um erro inesperado. Tente novamente.';
};

// Parse API error response

// Enhanced debug logging for API errors using centralized logger
const debugApiError = (error, context = {}) => {
  try {
    const errorContext = {
      category: LogCategory.API,
      errorType: ErrorType.UNKNOWN,
      api: {
        status: error?.response?.status,
        data: error?.response?.data,
        code: error?.code,
        type: error?.constructor?.name
      },
      ...context
    };

    // Determine error type based on error characteristics
    if (error?.code?.startsWith('auth/')) {
      errorContext.errorType = ErrorType.AUTHENTICATION;
    } else if (error?.response?.status === 401) {
      errorContext.errorType = ErrorType.AUTHENTICATION;
    } else if (error?.response?.status === 403) {
      errorContext.errorType = ErrorType.PERMISSION;
    } else if (error?.response?.status === 400) {
      errorContext.errorType = ErrorType.VALIDATION;
    } else if (!error?.response) {
      errorContext.errorType = ErrorType.NETWORK;
    } else if (error?.response?.status >= 500) {
      errorContext.errorType = ErrorType.SYSTEM;
    }

    // Log using centralized logger
    logger.error(`API Error: ${error?.message || 'Unknown API error'}`, errorContext);
    
  } catch (debugError) {
    logger.warn('Error in debugApiError function', {
      category: LogCategory.ERROR,
      error: debugError.message
    });
  }
};

export const parseApiError = (error) => {
  try {
    // Enhanced debug logging with centralized logger
    debugApiError(error, { function: 'parseApiError' });
    
    // Handle Firebase Auth errors specifically with enhanced error handler
    if (error.code && error.code.startsWith('auth/')) {
      // Import Firebase error handler dynamically to avoid circular dependency
      const { parseFirebaseAuthError } = await import('./firebaseErrorHandler.js');
      return parseFirebaseAuthError(error, { source: 'parseApiError' });
    }
    
    // Network errors (no response received)
    if (!error.response) {
      let networkError;
      
      if (error.code === 'ECONNABORTED') {
        networkError = new AppError(
          'Tempo limite excedido',
          ErrorCodes.TIMEOUT_ERROR,
          ErrorTypes.NETWORK,
          ErrorSeverity.MEDIUM
        );
      } else {
        networkError = new AppError(
          'Erro de conexão',
          ErrorCodes.NETWORK_ERROR,
          ErrorTypes.NETWORK,
          ErrorSeverity.HIGH
        );
      }
      
      logger.error('Network error detected', {
        category: LogCategory.API,
        errorType: ErrorType.NETWORK,
        networkCode: error.code,
        appError: networkError
      });
      
      return networkError;
    }
  } catch (debugError) {
    logger.warn('Error in parseApiError debug section', {
      category: LogCategory.ERROR,
      error: debugError.message,
      stack: debugError.stack
    });
  }

  const { status, data } = error.response;
  
  // Parse structured error response
  if (data?.error) {
    const { code, message, details } = data.error;
    
    let type = ErrorTypes.SYSTEM;
    let severity = ErrorSeverity.MEDIUM;
    
    // Determine error type and severity
    if (status === 401) {
      type = ErrorTypes.AUTHENTICATION;
      severity = ErrorSeverity.HIGH;
    } else if (status === 403) {
      type = ErrorTypes.AUTHORIZATION;
      severity = ErrorSeverity.HIGH;
    } else if (status === 400) {
      type = ErrorTypes.VALIDATION;
      severity = ErrorSeverity.LOW;
    } else if (status >= 500) {
      type = ErrorTypes.SYSTEM;
      severity = ErrorSeverity.CRITICAL;
    } else if (status === 404) {
      type = ErrorTypes.BUSINESS;
      severity = ErrorSeverity.MEDIUM;
    }
    
    return new AppError(message, code, type, severity, details);
  }
  
  // Fallback for non-structured errors
  let message = 'Erro desconhecido';
  let code = ErrorCodes.INTERNAL_SERVER_ERROR;
  
  if (status === 401) {
    message = 'Não autorizado';
    code = ErrorCodes.INVALID_CREDENTIALS;
  } else if (status === 403) {
    message = 'Acesso negado';
    code = ErrorCodes.INSUFFICIENT_PERMISSIONS;
  } else if (status === 404) {
    message = 'Recurso não encontrado';
    code = ErrorCodes.INVALID_DATA_FORMAT;
  } else if (status >= 500) {
    message = 'Erro interno do servidor';
    code = ErrorCodes.INTERNAL_SERVER_ERROR;
  }
  
  return new AppError(message, code, ErrorTypes.SYSTEM, ErrorSeverity.MEDIUM);
};

// Format validation errors for display
export const formatValidationErrors = (details) => {
  if (!details || !Array.isArray(details)) {
    return [];
  }
  
  return details.map(detail => ({
    field: detail.field,
    message: detail.message,
    value: detail.value
  }));
};

// Check if error should trigger logout
export const shouldLogout = (error) => {
  const logoutCodes = [
    ErrorCodes.TOKEN_EXPIRED,
    ErrorCodes.INVALID_TOKEN
  ];
  
  return logoutCodes.includes(error?.code);
};

// Check if error should be retried
export const shouldRetry = (error, retryCount = 0, maxRetries = 3) => {
  if (retryCount >= maxRetries) {
    return false;
  }
  
  const retryableCodes = [
    ErrorCodes.NETWORK_ERROR,
    ErrorCodes.TIMEOUT_ERROR,
    ErrorCodes.CONNECTION_ERROR,
    ErrorCodes.SERVICE_UNAVAILABLE,
    ErrorCodes.INTERNAL_SERVER_ERROR
  ];
  
  return retryableCodes.includes(error?.code);
};

// Get retry delay (exponential backoff)
export const getRetryDelay = (retryCount) => {
  return Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds
};

// Enhanced error logging using centralized logger
export const logError = (error, context = {}) => {
  try {
    const errorContext = {
      category: LogCategory.ERROR,
      errorType: ErrorType.UNKNOWN,
      appError: {
        message: error?.message || 'Unknown error',
        code: error?.code || 'UNKNOWN',
        type: error?.type || 'UNKNOWN',
        severity: error?.severity || 'MEDIUM',
        details: error?.details || null,
        timestamp: error?.timestamp || new Date().toISOString(),
        stack: error?.stack || null
      },
      ...context
    };

    // Determine error type based on error characteristics
    if (error?.type) {
      switch (error.type) {
        case ErrorTypes.AUTHENTICATION:
          errorContext.errorType = ErrorType.AUTHENTICATION;
          break;
        case ErrorTypes.AUTHORIZATION:
          errorContext.errorType = ErrorType.PERMISSION;
          break;
        case ErrorTypes.VALIDATION:
          errorContext.errorType = ErrorType.VALIDATION;
          break;
        case ErrorTypes.NETWORK:
          errorContext.errorType = ErrorType.NETWORK;
          break;
        case ErrorTypes.SYSTEM:
          errorContext.errorType = ErrorType.SYSTEM;
          break;
        case ErrorTypes.BUSINESS:
          errorContext.errorType = ErrorType.BUSINESS_LOGIC;
          break;
      }
    }

    // Use appropriate log level based on severity
    const logLevel = error?.severity === ErrorSeverity.CRITICAL ? 'critical' :
                     error?.severity === ErrorSeverity.HIGH ? 'error' :
                     error?.severity === ErrorSeverity.MEDIUM ? 'warn' : 'info';

    return logger[logLevel](error?.message || 'Application error occurred', errorContext);
    
  } catch (logError) {
    logger.warn('Error in logError function', {
      category: LogCategory.ERROR,
      error: logError.message
    });
    return {
      message: 'Error in logging system',
      timestamp: new Date().toISOString()
    };
  }
};

// Error boundary helper with enhanced logging
export const handleErrorBoundary = (error, errorInfo) => {
  const appError = new AppError(
    error.message,
    ErrorCodes.INTERNAL_SERVER_ERROR,
    ErrorTypes.SYSTEM,
    ErrorSeverity.CRITICAL,
    { componentStack: errorInfo.componentStack }
  );
  
  // Log with React-specific context
  logger.critical('React Error Boundary triggered', {
    category: LogCategory.UI,
    errorType: ErrorType.SYSTEM,
    react: {
      componentStack: errorInfo.componentStack,
      errorBoundary: true
    },
    appError: {
      message: appError.message,
      code: appError.code,
      type: appError.type,
      severity: appError.severity
    }
  });
  
  return appError;
};