// Middleware index file
// This file will be used to export all custom middleware

const auth = require('./auth');
const audit = require('./audit');
const { globalErrorHandler, AppError, ErrorCodes, catchAsync } = require('./errorHandler');
const { 
  validate, 
  validateMultiple, 
  validateParams, 
  validateQuery, 
  validateBody,
  sanitize,
  validateRateLimit,
  validateFileUpload,
  validateBusinessRules,
  commonSchemas
} = require('./validation');

module.exports = {
  auth,
  audit,
  globalErrorHandler,
  AppError,
  ErrorCodes,
  catchAsync,
  validate,
  validateMultiple,
  validateParams,
  validateQuery,
  validateBody,
  sanitize,
  validateRateLimit,
  validateFileUpload,
  validateBusinessRules,
  commonSchemas
};