/**
 * Validation Middleware for Firebase Functions
 */

import {HttpsError} from "firebase-functions/v2/https";

/**
 * Validation schema interface
 */
interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

interface ValidationSchema {
  [key: string]: ValidationRule;
}

/**
 * Validate data against schema
 */
export const validateSchema = (data: any, schema: ValidationSchema): void => {
  const errors: string[] = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`Campo '${field}' é obrigatório`);
      continue;
    }

    // Skip validation if field is not required and empty
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue;
    }

    // Type validation
    if (rules.type) {
      if (!validateType(value, rules.type)) {
        errors.push(`Campo '${field}' deve ser do tipo ${rules.type}`);
        continue;
      }
    }

    // String validations
    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`Campo '${field}' deve ter pelo menos ${rules.minLength} caracteres`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`Campo '${field}' deve ter no máximo ${rules.maxLength} caracteres`);
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`Campo '${field}' tem formato inválido`);
      }
    }

    // Number validations
    if (rules.type === 'number' && typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`Campo '${field}' deve ser maior ou igual a ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`Campo '${field}' deve ser menor ou igual a ${rules.max}`);
      }
    }

    // Array validations
    if (rules.type === 'array' && Array.isArray(value)) {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`Campo '${field}' deve ter pelo menos ${rules.minLength} itens`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`Campo '${field}' deve ter no máximo ${rules.maxLength} itens`);
      }
    }

    // Custom validation
    if (rules.custom) {
      const customResult = rules.custom(value);
      if (customResult !== true) {
        errors.push(typeof customResult === 'string' ? customResult : `Campo '${field}' é inválido`);
      }
    }
  }

  if (errors.length > 0) {
    throw new HttpsError('invalid-argument', `Dados inválidos: ${errors.join(', ')}`);
  }
};

/**
 * Validate type
 */
const validateType = (value: any, type: string): boolean => {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'date':
      return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
    default:
      return true;
  }
};

/**
 * Common validation schemas
 */
export const productSchema: ValidationSchema = {
  name: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100
  },
  category: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 50
  },
  invoiceNumber: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 50
  },
  supplier: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100
  },
  currentStock: {
    required: true,
    type: 'number',
    min: 0
  },
  minimumStock: {
    required: true,
    type: 'number',
    min: 0
  },
  unitPrice: {
    required: true,
    type: 'number',
    min: 0
  },
  expirationDate: {
    required: true,
    type: 'date'
  },
  description: {
    type: 'string',
    maxLength: 500
  }
};

export const patientSchema: ValidationSchema = {
  name: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100
  },
  email: {
    type: 'string',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 100
  },
  phone: {
    type: 'string',
    pattern: /^[\d\s\-\(\)\+]+$/,
    minLength: 10,
    maxLength: 20
  },
  birthDate: {
    type: 'date'
  },
  address: {
    type: 'string',
    maxLength: 200
  },
  notes: {
    type: 'string',
    maxLength: 500
  }
};

export const requestSchema: ValidationSchema = {
  products: {
    required: true,
    type: 'array',
    minLength: 1,
    custom: (products) => {
      if (!Array.isArray(products)) return 'Produtos deve ser uma lista';
      
      for (const product of products) {
        if (!product.productId || typeof product.productId !== 'string') {
          return 'Cada produto deve ter um productId válido';
        }
        if (!product.quantity || typeof product.quantity !== 'number' || product.quantity <= 0) {
          return 'Cada produto deve ter uma quantidade válida maior que zero';
        }
      }
      return true;
    }
  },
  patientId: {
    type: 'string'
  },
  notes: {
    type: 'string',
    maxLength: 500
  }
};

export const invoiceSchema: ValidationSchema = {
  number: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 50
  },
  supplier: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100
  },
  receiptDate: {
    required: true,
    type: 'date'
  },
  totalValue: {
    required: true,
    type: 'number',
    min: 0
  },
  notes: {
    type: 'string',
    maxLength: 500
  }
};

export const stockAdjustmentSchema: ValidationSchema = {
  productId: {
    required: true,
    type: 'string'
  },
  quantity: {
    required: true,
    type: 'number',
    min: 0
  },
  reason: {
    required: true,
    type: 'string',
    minLength: 3,
    maxLength: 200
  },
  type: {
    required: true,
    type: 'string',
    custom: (value) => ['ENTRY', 'EXIT', 'ADJUSTMENT'].includes(value) || 'Tipo deve ser ENTRY, EXIT ou ADJUSTMENT'
  }
};

/**
 * Sanitize input data
 */
export const sanitizeInput = (data: any): any => {
  if (typeof data === 'string') {
    return data.trim();
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeInput);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone format (Brazilian format)
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^(?:\+55\s?)?(?:\(\d{2}\)\s?|\d{2}\s?)(?:9\s?)?\d{4}[-\s]?\d{4}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate date format and range
 */
export const isValidDate = (date: string | Date, minDate?: Date, maxDate?: Date): boolean => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return false;
  }
  
  if (minDate && dateObj < minDate) {
    return false;
  }
  
  if (maxDate && dateObj > maxDate) {
    return false;
  }
  
  return true;
};