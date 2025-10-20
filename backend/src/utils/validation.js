const Joi = require('joi');

// Login validation schema
const loginSchema = Joi.object({
  username: Joi.string()
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Nome de usuário é obrigatório',
      'string.min': 'Nome de usuário deve ter pelo menos 3 caracteres',
      'string.max': 'Nome de usuário deve ter no máximo 50 caracteres'
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.empty': 'Senha é obrigatória',
      'string.min': 'Senha deve ter pelo menos 6 caracteres'
    })
});

// Refresh token validation schema
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'string.empty': 'Refresh token é obrigatório'
    })
});

// User creation validation schema
const createUserSchema = Joi.object({
  username: Joi.string()
    .min(3)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Nome de usuário é obrigatório',
      'string.min': 'Nome de usuário deve ter pelo menos 3 caracteres',
      'string.max': 'Nome de usuário deve ter no máximo 50 caracteres'
    }),
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.empty': 'Email é obrigatório',
      'string.email': 'Email deve ter um formato válido'
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.empty': 'Senha é obrigatória',
      'string.min': 'Senha deve ter pelo menos 6 caracteres'
    }),
  role: Joi.string()
    .valid('admin', 'doctor', 'receptionist', 'manager')
    .default('receptionist')
    .messages({
      'any.only': 'Role deve ser admin, doctor, receptionist ou manager'
    })
});

// Password change validation schema
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'string.empty': 'Senha atual é obrigatória'
    }),
  newPassword: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.empty': 'Nova senha é obrigatória',
      'string.min': 'Nova senha deve ter pelo menos 6 caracteres'
    })
});

/**
 * Validation middleware factory
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Request property to validate (body, params, query)
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], { 
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Dados de entrada inválidos',
        details: errors
      });
    }

    req[property] = value;
    next();
  };
};

// Product validation schemas
const createProductSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Nome do produto é obrigatório',
      'string.max': 'Nome do produto deve ter no máximo 100 caracteres'
    }),
  description: Joi.string()
    .allow('')
    .max(1000)
    .messages({
      'string.max': 'Descrição deve ter no máximo 1000 caracteres'
    }),
  category: Joi.string()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Categoria é obrigatória',
      'string.max': 'Categoria deve ter no máximo 50 caracteres'
    }),
  unit: Joi.string()
    .min(1)
    .max(20)
    .default('unidade')
    .messages({
      'string.empty': 'Unidade é obrigatória',
      'string.max': 'Unidade deve ter no máximo 20 caracteres'
    }),
  minimumStock: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      'number.base': 'Estoque mínimo deve ser um número',
      'number.integer': 'Estoque mínimo deve ser um número inteiro',
      'number.min': 'Estoque mínimo não pode ser negativo'
    }),
  quantity: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      'number.base': 'Quantidade deve ser um número',
      'number.integer': 'Quantidade deve ser um número inteiro',
      'number.min': 'Quantidade deve ser maior que zero',
      'any.required': 'Quantidade é obrigatória'
    }),
  expirationDate: Joi.date()
    .min('now')
    .required()
    .messages({
      'date.base': 'Data de validade deve ser uma data válida',
      'date.min': 'Data de validade não pode ser no passado',
      'any.required': 'Data de validade é obrigatória'
    }),
  invoiceNumber: Joi.string()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Número da nota fiscal é obrigatório',
      'string.max': 'Número da nota fiscal deve ter no máximo 50 caracteres',
      'any.required': 'Número da nota fiscal é obrigatório'
    })
});

const updateProductSchema = Joi.object({
  name: Joi.string()
    .min(1)
    .max(100)
    .messages({
      'string.empty': 'Nome do produto não pode estar vazio',
      'string.max': 'Nome do produto deve ter no máximo 100 caracteres'
    }),
  description: Joi.string()
    .allow('')
    .max(1000)
    .messages({
      'string.max': 'Descrição deve ter no máximo 1000 caracteres'
    }),
  category: Joi.string()
    .min(1)
    .max(50)
    .messages({
      'string.empty': 'Categoria não pode estar vazia',
      'string.max': 'Categoria deve ter no máximo 50 caracteres'
    }),
  unit: Joi.string()
    .min(1)
    .max(20)
    .messages({
      'string.empty': 'Unidade não pode estar vazia',
      'string.max': 'Unidade deve ter no máximo 20 caracteres'
    }),
  minimumStock: Joi.number()
    .integer()
    .min(0)
    .messages({
      'number.base': 'Estoque mínimo deve ser um número',
      'number.integer': 'Estoque mínimo deve ser um número inteiro',
      'number.min': 'Estoque mínimo não pode ser negativo'
    }),
  expirationDate: Joi.date()
    .min('now')
    .messages({
      'date.base': 'Data de validade deve ser uma data válida',
      'date.min': 'Data de validade não pode ser no passado'
    })
});

const adjustStockSchema = Joi.object({
  quantity: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      'number.base': 'Quantidade deve ser um número',
      'number.integer': 'Quantidade deve ser um número inteiro',
      'number.min': 'Quantidade deve ser maior que zero',
      'any.required': 'Quantidade é obrigatória'
    }),
  movementType: Joi.string()
    .valid('entry', 'exit', 'adjustment')
    .required()
    .messages({
      'any.only': 'Tipo de movimentação deve ser entry, exit ou adjustment',
      'any.required': 'Tipo de movimentação é obrigatório'
    }),
  notes: Joi.string()
    .max(500)
    .allow('')
    .messages({
      'string.max': 'Observações devem ter no máximo 500 caracteres'
    }),
  patientId: Joi.string()
    .uuid()
    .allow(null)
    .messages({
      'string.guid': 'ID do paciente deve ser um UUID válido'
    })
});

// Invoice validation schemas
const createInvoiceSchema = Joi.object({
  number: Joi.string()
    .min(1)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Número da nota fiscal é obrigatório',
      'string.max': 'Número da nota fiscal deve ter no máximo 50 caracteres',
      'any.required': 'Número da nota fiscal é obrigatório'
    }),
  supplier: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Fornecedor é obrigatório',
      'string.max': 'Nome do fornecedor deve ter no máximo 100 caracteres',
      'any.required': 'Fornecedor é obrigatório'
    }),
  issueDate: Joi.date()
    .required()
    .messages({
      'date.base': 'Data de emissão deve ser uma data válida',
      'any.required': 'Data de emissão é obrigatória'
    }),
  receiptDate: Joi.date()
    .min(Joi.ref('issueDate'))
    .required()
    .messages({
      'date.base': 'Data de recebimento deve ser uma data válida',
      'date.min': 'Data de recebimento deve ser posterior à data de emissão',
      'any.required': 'Data de recebimento é obrigatória'
    }),
  totalValue: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      'number.base': 'Valor total deve ser um número',
      'number.positive': 'Valor total deve ser maior que zero',
      'any.required': 'Valor total é obrigatório'
    })
});

const updateInvoiceSchema = Joi.object({
  number: Joi.string()
    .min(1)
    .max(50)
    .messages({
      'string.empty': 'Número da nota fiscal não pode estar vazio',
      'string.max': 'Número da nota fiscal deve ter no máximo 50 caracteres'
    }),
  supplier: Joi.string()
    .min(1)
    .max(100)
    .messages({
      'string.empty': 'Fornecedor não pode estar vazio',
      'string.max': 'Nome do fornecedor deve ter no máximo 100 caracteres'
    }),
  issueDate: Joi.date()
    .messages({
      'date.base': 'Data de emissão deve ser uma data válida'
    }),
  receiptDate: Joi.date()
    .when('issueDate', {
      is: Joi.exist(),
      then: Joi.date().min(Joi.ref('issueDate')),
      otherwise: Joi.date()
    })
    .messages({
      'date.base': 'Data de recebimento deve ser uma data válida',
      'date.min': 'Data de recebimento deve ser posterior à data de emissão'
    }),
  totalValue: Joi.number()
    .positive()
    .precision(2)
    .messages({
      'number.base': 'Valor total deve ser um número',
      'number.positive': 'Valor total deve ser maior que zero'
    })
});

// Request validation schemas
const createRequestSchema = Joi.object({
  products: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string()
          .uuid()
          .required()
          .messages({
            'string.guid': 'ID do produto deve ser um UUID válido',
            'any.required': 'ID do produto é obrigatório'
          }),
        quantity: Joi.number()
          .integer()
          .min(1)
          .required()
          .messages({
            'number.base': 'Quantidade deve ser um número',
            'number.integer': 'Quantidade deve ser um número inteiro',
            'number.min': 'Quantidade deve ser maior que zero',
            'any.required': 'Quantidade é obrigatória'
          }),
        reason: Joi.string()
          .max(255)
          .allow('')
          .messages({
            'string.max': 'Motivo deve ter no máximo 255 caracteres'
          })
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'Pelo menos um produto deve ser solicitado',
      'any.required': 'Lista de produtos é obrigatória'
    }),
  patientId: Joi.string()
    .uuid()
    .allow(null)
    .messages({
      'string.guid': 'ID do paciente deve ser um UUID válido'
    }),
  notes: Joi.string()
    .max(1000)
    .allow('')
    .messages({
      'string.max': 'Observações devem ter no máximo 1000 caracteres'
    })
});

const rejectRequestSchema = Joi.object({
  reason: Joi.string()
    .min(1)
    .max(500)
    .required()
    .messages({
      'string.empty': 'Motivo da rejeição é obrigatório',
      'string.max': 'Motivo deve ter no máximo 500 caracteres',
      'any.required': 'Motivo da rejeição é obrigatório'
    })
});

// Patient validation schemas
const createPatientSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Nome do paciente é obrigatório',
      'string.min': 'Nome deve ter pelo menos 2 caracteres',
      'string.max': 'Nome deve ter no máximo 100 caracteres',
      'any.required': 'Nome do paciente é obrigatório'
    }),
  email: Joi.string()
    .email()
    .allow(null, '')
    .messages({
      'string.email': 'Email deve ter um formato válido'
    }),
  phone: Joi.string()
    .pattern(/^[\d\s\-\+\(\)]+$/)
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Telefone deve conter apenas números, espaços e símbolos válidos'
    }),
  birthDate: Joi.date()
    .max('now')
    .allow(null)
    .messages({
      'date.base': 'Data de nascimento deve ser uma data válida',
      'date.max': 'Data de nascimento não pode ser no futuro'
    }),
  address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    zipCode: Joi.string().required(),
    state: Joi.string().allow(''),
    country: Joi.string().allow('')
  })
    .allow(null)
    .messages({
      'object.base': 'Endereço deve ser um objeto válido'
    }),
  medicalHistory: Joi.string()
    .max(2000)
    .allow(null, '')
    .messages({
      'string.max': 'Histórico médico deve ter no máximo 2000 caracteres'
    })
});

const updatePatientSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(100)
    .messages({
      'string.empty': 'Nome do paciente não pode estar vazio',
      'string.min': 'Nome deve ter pelo menos 2 caracteres',
      'string.max': 'Nome deve ter no máximo 100 caracteres'
    }),
  email: Joi.string()
    .email()
    .allow(null, '')
    .messages({
      'string.email': 'Email deve ter um formato válido'
    }),
  phone: Joi.string()
    .pattern(/^[\d\s\-\+\(\)]+$/)
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Telefone deve conter apenas números, espaços e símbolos válidos'
    }),
  birthDate: Joi.date()
    .max('now')
    .allow(null)
    .messages({
      'date.base': 'Data de nascimento deve ser uma data válida',
      'date.max': 'Data de nascimento não pode ser no futuro'
    }),
  address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    zipCode: Joi.string().required(),
    state: Joi.string().allow(''),
    country: Joi.string().allow('')
  })
    .allow(null)
    .messages({
      'object.base': 'Endereço deve ser um objeto válido'
    }),
  medicalHistory: Joi.string()
    .max(2000)
    .allow(null, '')
    .messages({
      'string.max': 'Histórico médico deve ter no máximo 2000 caracteres'
    }),
  isActive: Joi.boolean()
    .messages({
      'boolean.base': 'Status ativo deve ser verdadeiro ou falso'
    })
});

const productAssociationSchema = Joi.object({
  procedure: Joi.string()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Procedimento é obrigatório',
      'string.max': 'Procedimento deve ter no máximo 100 caracteres',
      'any.required': 'Procedimento é obrigatório'
    }),
  doctorId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'ID do médico deve ser um UUID válido',
      'any.required': 'ID do médico é obrigatório'
    }),
  products: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string()
          .uuid()
          .required()
          .messages({
            'string.guid': 'ID do produto deve ser um UUID válido',
            'any.required': 'ID do produto é obrigatório'
          }),
        quantity: Joi.number()
          .integer()
          .min(1)
          .required()
          .messages({
            'number.base': 'Quantidade deve ser um número',
            'number.integer': 'Quantidade deve ser um número inteiro',
            'number.min': 'Quantidade deve ser maior que zero',
            'any.required': 'Quantidade é obrigatória'
          }),
        batchNumber: Joi.string()
          .max(50)
          .allow(null, '')
          .messages({
            'string.max': 'Número do lote deve ter no máximo 50 caracteres'
          })
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'Pelo menos um produto deve ser associado',
      'any.required': 'Lista de produtos é obrigatória'
    }),
  notes: Joi.string()
    .max(1000)
    .allow(null, '')
    .messages({
      'string.max': 'Observações devem ter no máximo 1000 caracteres'
    }),
  treatmentDate: Joi.date()
    .max('now')
    .allow(null)
    .messages({
      'date.base': 'Data do tratamento deve ser uma data válida',
      'date.max': 'Data do tratamento não pode ser no futuro'
    })
});

// Custom validation function for requests
const validateRequest = (data) => {
  const { error, value } = createRequestSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    return {
      isValid: false,
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    };
  }

  return {
    isValid: true,
    data: value
  };
};

// Audit query validation schema
const auditQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.base': 'Página deve ser um número',
      'number.integer': 'Página deve ser um número inteiro',
      'number.min': 'Página deve ser maior que zero'
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(50)
    .messages({
      'number.base': 'Limite deve ser um número',
      'number.integer': 'Limite deve ser um número inteiro',
      'number.min': 'Limite deve ser maior que zero',
      'number.max': 'Limite deve ser no máximo 100'
    }),
  userId: Joi.string()
    .uuid()
    .allow(null)
    .messages({
      'string.guid': 'ID do usuário deve ser um UUID válido'
    }),
  action: Joi.alternatives()
    .try(
      Joi.string(),
      Joi.array().items(Joi.string())
    )
    .messages({
      'alternatives.types': 'Ação deve ser uma string ou array de strings'
    }),
  resource: Joi.alternatives()
    .try(
      Joi.string(),
      Joi.array().items(Joi.string())
    )
    .messages({
      'alternatives.types': 'Recurso deve ser uma string ou array de strings'
    }),
  resourceId: Joi.string()
    .uuid()
    .allow(null)
    .messages({
      'string.guid': 'ID do recurso deve ser um UUID válido'
    }),
  success: Joi.boolean()
    .messages({
      'boolean.base': 'Sucesso deve ser verdadeiro ou falso'
    }),
  startDate: Joi.date()
    .messages({
      'date.base': 'Data inicial deve ser uma data válida'
    }),
  endDate: Joi.date()
    .min(Joi.ref('startDate'))
    .messages({
      'date.base': 'Data final deve ser uma data válida',
      'date.min': 'Data final deve ser posterior à data inicial'
    }),
  sortBy: Joi.string()
    .valid('timestamp', 'action', 'resource', 'userId', 'success')
    .default('timestamp')
    .messages({
      'any.only': 'Ordenação deve ser por timestamp, action, resource, userId ou success'
    }),
  sortOrder: Joi.string()
    .valid('ASC', 'DESC', 'asc', 'desc')
    .default('DESC')
    .messages({
      'any.only': 'Ordem deve ser ASC ou DESC'
    })
});

// Custom validation function for audit queries
const validateAuditQuery = (data) => {
  const { error, value } = auditQuerySchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    return {
      error,
      value: null
    };
  }

  return {
    error: null,
    value
  };
};

// Stock movement query validation schema
const validateStockMovementQuery = (query) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    productId: Joi.string().uuid(),
    userId: Joi.string().uuid(),
    patientId: Joi.string().uuid(),
    requestId: Joi.string().uuid(),
    movementType: Joi.alternatives().try(
      Joi.string().valid('entry', 'exit', 'adjustment'),
      Joi.array().items(Joi.string().valid('entry', 'exit', 'adjustment'))
    ),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
    sortBy: Joi.string().valid('date', 'quantity', 'movementType').default('date'),
    sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC')
  });

  return schema.validate(query, { allowUnknown: false, stripUnknown: true });
};

module.exports = {
  loginSchema,
  refreshTokenSchema,
  createUserSchema,
  changePasswordSchema,
  createProductSchema,
  updateProductSchema,
  adjustStockSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  createRequestSchema,
  rejectRequestSchema,
  createPatientSchema,
  updatePatientSchema,
  productAssociationSchema,
  validateRequest,
  validateAuditQuery,
  validateStockMovementQuery,
  validate,
  validatePatient: validate(createPatientSchema),
  validatePatientUpdate: validate(updatePatientSchema),
  validateProductAssociation: validate(productAssociationSchema)
};