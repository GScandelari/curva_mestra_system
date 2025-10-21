"use strict";
/**
 * Error Handling Middleware for Firebase Functions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRetry = exports.throwInsufficientStockError = exports.throwPermissionError = exports.throwAlreadyExistsError = exports.throwNotFoundError = exports.throwValidationError = exports.asyncHandler = exports.handleError = exports.handleErrors = exports.InsufficientStockError = exports.PermissionError = exports.AlreadyExistsError = exports.NotFoundError = exports.ValidationError = exports.AppError = exports.ERROR_MESSAGES = exports.ERROR_CODES = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
/**
 * Standard error codes mapping
 */
exports.ERROR_CODES = {
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
};
/**
 * Standard error messages in Portuguese
 */
exports.ERROR_MESSAGES = {
    [exports.ERROR_CODES.UNAUTHENTICATED]: 'Usuário não autenticado',
    [exports.ERROR_CODES.PERMISSION_DENIED]: 'Acesso negado',
    [exports.ERROR_CODES.INVALID_ARGUMENT]: 'Dados inválidos',
    [exports.ERROR_CODES.FAILED_PRECONDITION]: 'Operação não permitida no estado atual',
    [exports.ERROR_CODES.NOT_FOUND]: 'Recurso não encontrado',
    [exports.ERROR_CODES.ALREADY_EXISTS]: 'Recurso já existe',
    [exports.ERROR_CODES.RESOURCE_EXHAUSTED]: 'Limite de recursos excedido',
    [exports.ERROR_CODES.INTERNAL]: 'Erro interno do servidor',
    [exports.ERROR_CODES.UNAVAILABLE]: 'Serviço temporariamente indisponível',
    [exports.ERROR_CODES.DEADLINE_EXCEEDED]: 'Tempo limite excedido'
};
/**
 * Custom application errors
 */
class AppError extends Error {
    constructor(message, code = exports.ERROR_CODES.INTERNAL, statusCode = 500, isOperational = true) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
/**
 * Business logic errors
 */
class ValidationError extends AppError {
    constructor(message) {
        super(message, exports.ERROR_CODES.INVALID_ARGUMENT, 400);
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends AppError {
    constructor(resource) {
        super(`${resource} não encontrado`, exports.ERROR_CODES.NOT_FOUND, 404);
    }
}
exports.NotFoundError = NotFoundError;
class AlreadyExistsError extends AppError {
    constructor(resource) {
        super(`${resource} já existe`, exports.ERROR_CODES.ALREADY_EXISTS, 409);
    }
}
exports.AlreadyExistsError = AlreadyExistsError;
class PermissionError extends AppError {
    constructor(message = 'Acesso negado') {
        super(message, exports.ERROR_CODES.PERMISSION_DENIED, 403);
    }
}
exports.PermissionError = PermissionError;
class InsufficientStockError extends AppError {
    constructor(productName, available, requested) {
        super(`Estoque insuficiente para ${productName}. Disponível: ${available}, Solicitado: ${requested}`, exports.ERROR_CODES.FAILED_PRECONDITION, 400);
    }
}
exports.InsufficientStockError = InsufficientStockError;
/**
 * Error handler wrapper for Firebase Functions
 */
const handleErrors = (fn) => {
    return async (...args) => {
        try {
            return await fn(...args);
        }
        catch (error) {
            return (0, exports.handleError)(error, args[0]); // args[0] is typically the request object
        }
    };
};
exports.handleErrors = handleErrors;
/**
 * Central error handler
 */
const handleError = (error, context) => {
    var _a, _b;
    // Log error details
    const errorInfo = {
        message: error.message,
        stack: error.stack,
        code: error.code,
        context: {
            userId: (_a = context === null || context === void 0 ? void 0 : context.auth) === null || _a === void 0 ? void 0 : _a.uid,
            functionName: (_b = context === null || context === void 0 ? void 0 : context.rawRequest) === null || _b === void 0 ? void 0 : _b.url,
            timestamp: new Date().toISOString()
        }
    };
    // Log based on error type
    if (error instanceof AppError && error.isOperational) {
        logger.warn('Operational error', errorInfo);
    }
    else {
        logger.error('System error', errorInfo);
    }
    // Convert to HttpsError for Firebase Functions
    if (error instanceof https_1.HttpsError) {
        throw error;
    }
    if (error instanceof AppError) {
        throw new https_1.HttpsError(error.code, error.message);
    }
    // Handle common database errors
    if (error.code === 'permission-denied') {
        throw new https_1.HttpsError('permission-denied', 'Acesso negado aos dados');
    }
    if (error.code === 'not-found') {
        throw new https_1.HttpsError('not-found', 'Recurso não encontrado');
    }
    if (error.code === 'already-exists') {
        throw new https_1.HttpsError('already-exists', 'Recurso já existe');
    }
    if (error.code === 'unavailable') {
        throw new https_1.HttpsError('unavailable', 'Serviço temporariamente indisponível');
    }
    if (error.code === 'deadline-exceeded') {
        throw new https_1.HttpsError('deadline-exceeded', 'Operação demorou muito para ser concluída');
    }
    // Handle validation errors
    if (error.message && error.message.includes('invalid-argument')) {
        throw new https_1.HttpsError('invalid-argument', error.message);
    }
    // Handle authentication errors
    if (error.message && error.message.includes('unauthenticated')) {
        throw new https_1.HttpsError('unauthenticated', 'Usuário não autenticado');
    }
    // Default to internal error
    throw new https_1.HttpsError('internal', 'Erro interno do servidor');
};
exports.handleError = handleError;
/**
 * Async wrapper with error handling
 */
const asyncHandler = (fn) => {
    return async (request) => {
        try {
            return await fn(request);
        }
        catch (error) {
            (0, exports.handleError)(error, request);
        }
    };
};
exports.asyncHandler = asyncHandler;
/**
 * Validation error helper
 */
const throwValidationError = (message) => {
    throw new ValidationError(message);
};
exports.throwValidationError = throwValidationError;
/**
 * Not found error helper
 */
const throwNotFoundError = (resource) => {
    throw new NotFoundError(resource);
};
exports.throwNotFoundError = throwNotFoundError;
/**
 * Already exists error helper
 */
const throwAlreadyExistsError = (resource) => {
    throw new AlreadyExistsError(resource);
};
exports.throwAlreadyExistsError = throwAlreadyExistsError;
/**
 * Permission error helper
 */
const throwPermissionError = (message) => {
    throw new PermissionError(message);
};
exports.throwPermissionError = throwPermissionError;
/**
 * Insufficient stock error helper
 */
const throwInsufficientStockError = (productName, available, requested) => {
    throw new InsufficientStockError(productName, available, requested);
};
exports.throwInsufficientStockError = throwInsufficientStockError;
/**
 * Retry mechanism for transient errors
 */
const withRetry = async (operation, maxRetries = 3, delay = 1000) => {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            // Don't retry on operational errors
            if (error instanceof AppError && error.isOperational) {
                throw error;
            }
            // Don't retry on client errors
            if (error instanceof https_1.HttpsError &&
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
exports.withRetry = withRetry;
//# sourceMappingURL=errorHandler.js.map