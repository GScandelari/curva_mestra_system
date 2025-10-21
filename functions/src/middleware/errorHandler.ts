/**
 * Error Handling Middleware for Firebase Functions
 */

import {HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

/**
 * Standard error codes mapping
 */
export const ERROR_CODES = {
  // Authentication errors
  UNAUTHENTICATED: 'unauthenticated',
  PERMISSION_DENIED: 'permission-denied',
  
  // Validation errors
  INVALID_ARGUMENT: 'invalid-argument',
  FAILED_PRECONDITION: 'failed-precondition',
  
  // Resource errors
  NOT_FOUND: 'not-found',
  ALREADY_EXISTS: 'already-exists',
  RESOURCE_EXHAUSTED: 'resource-exhausted',
  
  // System errors
  INTERNAL: 'internal',
  UNAVAILABLE: 'unavailable',
  DEADLINE_EXCEEDED: 'deadline-exceeded'
} as const;

/**
 * Standard error messages in Portuguese
 */
export const ERROR_MESSAGES = {
  [ERROR_CODES.UNAUTHENTICATED]: 'Usuário não autenticado',
  [ERROR_CODES.PERMISSION_DENIED]: 'Acesso negado',
  [ERROR_CODES.INVALID_ARGUMENT]: 'Dados inválidos',
  [ERROR_CODES.FAILED_PRECONDITION]: 'Operação não permitida no estado atual',
  [ERROR_CODES.NOT_FOUND]: 'Recurso não encontrado',
  [ERROR_CODES.ALREADY_EXISTS]: 'Recurso já existe',
  [ERROR_CODES.RESOURCE_EXHAUSTED]: 'Limite de recursos excedido',
  [ERROR_CODES.INTERNAL]: 'Erro interno do servidor',
  [ERROR_CODES.UNAVAILABLE]: 'Serviço temporariamente indisponível',
  [ERROR_CODES.DEADLINE_EXCEEDED]: 'Tempo limite excedido'
} as const;

/**
 * Custom application errors
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string = ERROR_CODES.INTERNAL,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Business logic errors
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, ERROR_CODES.INVALID_ARGUMENT, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} não encontrado`, ERROR_CODES.NOT_FOUND, 404);
  }
}

export class AlreadyExistsError extends AppError {
  constructor(resource: string) {
    super(`${resource} já existe`, ERROR_CODES.ALREADY_EXISTS, 409);
  }
}

export class PermissionError extends AppError {
  constructor(message: string = 'Acesso negado') {
    super(message, ERROR_CODES.PERMISSION_DENIED, 403);
  }
}

export class InsufficientStockError extends AppError {
  constructor(productName: string, available: number, requested: number) {
    super(
      `Estoque insuficiente para ${productName}. Disponível: ${available}, Solicitado: ${requested}`,
      ERROR_CODES.FAILED_PRECONDITION,
      400
    );
  }
}

/**
 * Error handler wrapper for Firebase Functions
 */
export const handleErrors = (fn: Function) => {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      return handleError(error, args[0]); // args[0] is typically the request object
    }
  };
};

/**
 * Central error handler
 */
export const handleError = (error: any, context?: any): never => {
  // Log error details
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    code: error.code,
    context: {
      userId: context?.auth?.uid,
      functionName: context?.rawRequest?.url,
      timestamp: new Date().toISOString()
    }
  };

  // Log based on error type
  if (error instanceof AppError && error.isOperational) {
    logger.warn('Operational error', errorInfo);
  } else {
    logger.error('System error', errorInfo);
  }

  // Convert to HttpsError for Firebase Functions
  if (error instanceof HttpsError) {
    throw error;
  }

  if (error instanceof AppError) {
    throw new HttpsError(error.code as any, error.message);
  }

  // Handle common database errors
  if (error.code === 'permission-denied') {
    throw new HttpsError('permission-denied', 'Acesso negado aos dados');
  }

  if (error.code === 'not-found') {
    throw new HttpsError('not-found', 'Recurso não encontrado');
  }

  if (error.code === 'already-exists') {
    throw new HttpsError('already-exists', 'Recurso já existe');
  }

  if (error.code === 'unavailable') {
    throw new HttpsError('unavailable', 'Serviço temporariamente indisponível');
  }

  if (error.code === 'deadline-exceeded') {
    throw new HttpsError('deadline-exceeded', 'Operação demorou muito para ser concluída');
  }

  // Handle validation errors
  if (error.message && error.message.includes('invalid-argument')) {
    throw new HttpsError('invalid-argument', error.message);
  }

  // Handle authentication errors
  if (error.message && error.message.includes('unauthenticated')) {
    throw new HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  // Default to internal error
  throw new HttpsError('internal', 'Erro interno do servidor');
};

/**
 * Async wrapper with error handling
 */
export const asyncHandler = (fn: Function) => {
  return async (request: any) => {
    try {
      return await fn(request);
    } catch (error) {
      handleError(error, request);
    }
  };
};

/**
 * Validation error helper
 */
export const throwValidationError = (message: string): never => {
  throw new ValidationError(message);
};

/**
 * Not found error helper
 */
export const throwNotFoundError = (resource: string): never => {
  throw new NotFoundError(resource);
};

/**
 * Already exists error helper
 */
export const throwAlreadyExistsError = (resource: string): never => {
  throw new AlreadyExistsError(resource);
};

/**
 * Permission error helper
 */
export const throwPermissionError = (message?: string): never => {
  throw new PermissionError(message);
};

/**
 * Insufficient stock error helper
 */
export const throwInsufficientStockError = (productName: string, available: number, requested: number): never => {
  throw new InsufficientStockError(productName, available, requested);
};

/**
 * Retry mechanism for transient errors
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry on operational errors
      if (error instanceof AppError && error.isOperational) {
        throw error;
      }

      // Don't retry on client errors
      if (error instanceof HttpsError && 
          ['invalid-argument', 'permission-denied', 'not-found', 'already-exists'].includes(error.code)) {
        throw error;
      }

      if (attempt === maxRetries) {
        break;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
      
      logger.warn(`Retrying operation (attempt ${attempt + 1}/${maxRetries})`, {
        error: error.message,
        attempt
      });
    }
  }

  throw lastError;
};