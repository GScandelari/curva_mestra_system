const Joi = require('joi');
const { AppError, ErrorCodes } = require('./errorHandler');

// Enhanced validation middleware with better error handling
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], { 
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
        type: detail.type
      }));

      throw new AppError(
        'Dados de entrada inválidos',
        400,
        ErrorCodes.VALIDATION_ERROR,
        details
      );
    }

    req[property] = value;
    next();
  };
};

// Validate multiple properties
const validateMultiple = (schemas) => {
  return (req, res, next) => {
    const errors = [];

    for (const [property, schema] of Object.entries(schemas)) {
      const { error, value } = schema.validate(req[property], { 
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false
      });

      if (error) {
        const details = error.details.map(detail => ({
          property,
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value,
          type: detail.type
        }));
        errors.push(...details);
      } else {
        req[property] = value;
      }
    }

    if (errors.length > 0) {
      throw new AppError(
        'Dados de entrada inválidos',
        400,
        ErrorCodes.VALIDATION_ERROR,
        errors
      );
    }

    next();
  };
};

// Validate request parameters
const validateParams = (schema) => validate(schema, 'params');
const validateQuery = (schema) => validate(schema, 'query');
const validateBody = (schema) => validate(schema, 'body');

// Common validation schemas
const commonSchemas = {
  uuid: Joi.string().uuid().required().messages({
    'string.guid': 'ID deve ser um UUID válido',
    'any.required': 'ID é obrigatório'
  }),
  
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      'number.base': 'Página deve ser um número',
      'number.integer': 'Página deve ser um número inteiro',
      'number.min': 'Página deve ser maior que zero'
    }),
    limit: Joi.number().integer().min(1).max(100).default(50).messages({
      'number.base': 'Limite deve ser um número',
      'number.integer': 'Limite deve ser um número inteiro',
      'number.min': 'Limite deve ser maior que zero',
      'number.max': 'Limite deve ser no máximo 100'
    }),
    sortBy: Joi.string().allow('').messages({
      'string.base': 'Campo de ordenação deve ser uma string'
    }),
    sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC').messages({
      'any.only': 'Ordem deve ser ASC ou DESC'
    })
  }),

  dateRange: Joi.object({
    startDate: Joi.date().iso().messages({
      'date.base': 'Data inicial deve ser uma data válida',
      'date.format': 'Data inicial deve estar no formato ISO'
    }),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).messages({
      'date.base': 'Data final deve ser uma data válida',
      'date.format': 'Data final deve estar no formato ISO',
      'date.min': 'Data final deve ser posterior à data inicial'
    })
  })
};

// Sanitization functions
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '');
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
};

// Sanitization middleware
const sanitize = (property = 'body') => {
  return (req, res, next) => {
    if (req[property]) {
      req[property] = sanitizeInput(req[property]);
    }
    next();
  };
};

// Rate limiting validation
const validateRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip + req.originalUrl;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old requests
    if (requests.has(key)) {
      const userRequests = requests.get(key).filter(time => time > windowStart);
      requests.set(key, userRequests);
    }

    const currentRequests = requests.get(key) || [];
    
    if (currentRequests.length >= maxRequests) {
      throw new AppError(
        'Muitas solicitações. Tente novamente mais tarde.',
        429,
        ErrorCodes.RATE_LIMIT_EXCEEDED
      );
    }

    currentRequests.push(now);
    requests.set(key, currentRequests);
    next();
  };
};

// File upload validation
const validateFileUpload = (options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB
    allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'],
    required = false
  } = options;

  return (req, res, next) => {
    if (!req.file && required) {
      throw new AppError(
        'Arquivo é obrigatório',
        400,
        ErrorCodes.MISSING_REQUIRED_FIELD
      );
    }

    if (req.file) {
      if (req.file.size > maxSize) {
        throw new AppError(
          `Arquivo muito grande. Tamanho máximo: ${maxSize / 1024 / 1024}MB`,
          400,
          ErrorCodes.FILE_UPLOAD_ERROR
        );
      }

      if (!allowedTypes.includes(req.file.mimetype)) {
        throw new AppError(
          `Tipo de arquivo não permitido. Tipos aceitos: ${allowedTypes.join(', ')}`,
          400,
          ErrorCodes.FILE_UPLOAD_ERROR
        );
      }
    }

    next();
  };
};

// Business logic validation
const validateBusinessRules = {
  // Validate stock availability
  stockAvailability: (requiredQuantity) => {
    return async (req, res, next) => {
      const { Product } = require('../models');
      const productId = req.params.id || req.body.productId;
      
      if (!productId) {
        return next();
      }

      try {
        const product = await Product.findByPk(productId);
        
        if (!product) {
          throw new AppError(
            'Produto não encontrado',
            404,
            ErrorCodes.PRODUCT_NOT_FOUND
          );
        }

        const quantity = requiredQuantity || req.body.quantity;
        
        if (product.currentStock < quantity) {
          throw new AppError(
            `Estoque insuficiente. Disponível: ${product.currentStock}, Solicitado: ${quantity}`,
            400,
            ErrorCodes.INSUFFICIENT_STOCK
          );
        }

        if (product.expirationDate && new Date(product.expirationDate) < new Date()) {
          throw new AppError(
            'Produto vencido não pode ser utilizado',
            400,
            ErrorCodes.PRODUCT_EXPIRED
          );
        }

        req.product = product;
        next();
      } catch (error) {
        next(error);
      }
    };
  },

  // Validate user permissions
  userPermissions: (requiredRole) => {
    return (req, res, next) => {
      if (!req.user) {
        throw new AppError(
          'Usuário não autenticado',
          401,
          ErrorCodes.INVALID_TOKEN
        );
      }

      const roleHierarchy = {
        'admin': 4,
        'manager': 3,
        'doctor': 2,
        'receptionist': 1
      };

      const userLevel = roleHierarchy[req.user.role] || 0;
      const requiredLevel = roleHierarchy[requiredRole] || 0;

      if (userLevel < requiredLevel) {
        throw new AppError(
          'Permissões insuficientes',
          403,
          ErrorCodes.INSUFFICIENT_PERMISSIONS
        );
      }

      next();
    };
  },

  // Validate request ownership
  requestOwnership: () => {
    return async (req, res, next) => {
      const { ProductRequest } = require('../models');
      const requestId = req.params.id;

      try {
        const request = await ProductRequest.findByPk(requestId);
        
        if (!request) {
          throw new AppError(
            'Solicitação não encontrada',
            404,
            ErrorCodes.REQUEST_NOT_FOUND
          );
        }

        // Admin and managers can access all requests
        if (['admin', 'manager'].includes(req.user.role)) {
          req.productRequest = request;
          return next();
        }

        // Users can only access their own requests
        if (request.requesterId !== req.user.id) {
          throw new AppError(
            'Acesso negado a esta solicitação',
            403,
            ErrorCodes.INSUFFICIENT_PERMISSIONS
          );
        }

        req.productRequest = request;
        next();
      } catch (error) {
        next(error);
      }
    };
  }
};

module.exports = {
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