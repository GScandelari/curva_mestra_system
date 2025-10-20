const { AuditService } = require('../services');

// Error codes enum
const ErrorCodes = {
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
  FILE_UPLOAD_ERROR: 'SYS_004'
};

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, errorCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error response formatter
const formatErrorResponse = (error, req) => {
  const response = {
    success: false,
    error: {
      code: error.errorCode || ErrorCodes.INTERNAL_SERVER_ERROR,
      message: error.message || 'Erro interno do servidor',
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method
    }
  };

  // Add details if available
  if (error.details) {
    response.error.details = error.details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
  }

  return response;
};

// Log error for audit
const logError = async (error, req, res) => {
  try {
    const errorLog = {
      level: 'error',
      message: error.message,
      errorCode: error.errorCode,
      statusCode: error.statusCode || 500,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id || null,
      timestamp: new Date(),
      stack: error.stack
    };

    // Log to audit service
    if (AuditService && typeof AuditService.logError === 'function') {
      await AuditService.logError(errorLog);
    }

    // Log to console
    console.error('Error occurred:', errorLog);
  } catch (logError) {
    console.error('Failed to log error:', logError);
  }
};

// Handle different types of errors
const handleCastErrorDB = (err) => {
  const message = `Recurso inválido: ${err.path} = ${err.value}`;
  return new AppError(message, 400, ErrorCodes.INVALID_DATA_FORMAT);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0];
  const message = `Valor duplicado: ${value}. Use outro valor.`;
  return new AppError(message, 400, ErrorCodes.DATABASE_CONSTRAINT_ERROR);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Dados inválidos: ${errors.join('. ')}`;
  return new AppError(message, 400, ErrorCodes.VALIDATION_ERROR, errors);
};

const handleJWTError = () =>
  new AppError('Token inválido. Faça login novamente.', 401, ErrorCodes.INVALID_TOKEN);

const handleJWTExpiredError = () =>
  new AppError('Token expirado. Faça login novamente.', 401, ErrorCodes.TOKEN_EXPIRED);

const handleSequelizeValidationError = (err) => {
  const errors = err.errors?.map(error => ({
    field: error.path,
    message: error.message,
    value: error.value
  })) || [];
  
  return new AppError(
    'Erro de validação dos dados',
    400,
    ErrorCodes.VALIDATION_ERROR,
    errors
  );
};

const handleSequelizeUniqueConstraintError = (err) => {
  const field = err.errors?.[0]?.path || 'campo';
  const value = err.errors?.[0]?.value || 'valor';
  
  let errorCode = ErrorCodes.DATABASE_CONSTRAINT_ERROR;
  let message = `Valor duplicado para ${field}: ${value}`;
  
  // Specific handling for common unique constraints
  if (field === 'email') {
    errorCode = ErrorCodes.DUPLICATE_EMAIL;
    message = 'Este email já está em uso';
  } else if (field === 'username') {
    errorCode = ErrorCodes.DUPLICATE_USERNAME;
    message = 'Este nome de usuário já está em uso';
  } else if (field === 'number' && err.table === 'invoices') {
    errorCode = ErrorCodes.DUPLICATE_INVOICE_NUMBER;
    message = 'Este número de nota fiscal já existe';
  }
  
  return new AppError(message, 400, errorCode);
};

const handleSequelizeForeignKeyConstraintError = (err) => {
  const message = 'Referência inválida. Verifique se todos os dados relacionados existem.';
  return new AppError(message, 400, ErrorCodes.DATABASE_CONSTRAINT_ERROR);
};

const handleSequelizeConnectionError = (err) => {
  const message = 'Erro de conexão com o banco de dados';
  return new AppError(message, 503, ErrorCodes.DATABASE_CONNECTION_ERROR);
};

// Main error handling middleware
const globalErrorHandler = async (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  await logError(error, req, res);

  // Handle specific error types
  if (err.name === 'CastError') error = handleCastErrorDB(error);
  if (err.code === 11000) error = handleDuplicateFieldsDB(error);
  if (err.name === 'ValidationError') error = handleValidationErrorDB(error);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
  
  // Sequelize specific errors
  if (err.name === 'SequelizeValidationError') error = handleSequelizeValidationError(error);
  if (err.name === 'SequelizeUniqueConstraintError') error = handleSequelizeUniqueConstraintError(error);
  if (err.name === 'SequelizeForeignKeyConstraintError') error = handleSequelizeForeignKeyConstraintError(error);
  if (err.name === 'SequelizeConnectionError') error = handleSequelizeConnectionError(error);

  // Default to 500 server error
  if (!error.statusCode) {
    error.statusCode = 500;
    error.errorCode = ErrorCodes.INTERNAL_SERVER_ERROR;
    error.message = 'Algo deu errado!';
  }

  // Send error response
  const errorResponse = formatErrorResponse(error, req);
  res.status(error.statusCode).json(errorResponse);
};

// Async error wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = {
  AppError,
  ErrorCodes,
  globalErrorHandler,
  catchAsync,
  formatErrorResponse
};