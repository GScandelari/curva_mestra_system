/**
 * Authentication and Authorization Middleware for Firebase Functions
 */

import {HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

/**
 * Custom Claims Interface
 */
export interface CustomClaims {
  role: 'admin' | 'doctor' | 'receptionist' | 'manager';
  clinicId: string;
  permissions: string[];
  admin?: boolean;
}

/**
 * Authenticated Request Interface
 */
export interface AuthenticatedRequest {
  auth: {
    uid: string;
    token: CustomClaims & {
      email?: string;
      name?: string;
    };
  };
  data: any;
}

/**
 * Verify Firebase Auth token and extract user claims
 */
export const verifyAuth = (request: any): AuthenticatedRequest => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
  }

  return request as AuthenticatedRequest;
};

/**
 * Check if user has required role
 */
export const hasRole = (request: AuthenticatedRequest, allowedRoles: string[]): boolean => {
  const userRole = request.auth.token.role;
  return allowedRoles.includes(userRole);
};

/**
 * Check if user belongs to the same clinic
 */
export const sameClinic = (request: AuthenticatedRequest, clinicId?: string): boolean => {
  const userClinicId = request.auth.token.clinicId;
  
  if (!userClinicId) {
    return false;
  }

  // If no specific clinic ID provided, just check if user has a clinic
  if (!clinicId) {
    return true;
  }

  return userClinicId === clinicId;
};

/**
 * Authorization middleware factory
 */
export const authorize = (allowedRoles: string[]) => {
  return (request: any) => {
    const authRequest = verifyAuth(request);
    
    if (!hasRole(authRequest, allowedRoles)) {
      throw new HttpsError(
        'permission-denied', 
        `Acesso negado. Roles permitidos: ${allowedRoles.join(', ')}`
      );
    }

    return authRequest;
  };
};

/**
 * Clinic validation middleware
 */
export const validateClinic = (request: AuthenticatedRequest, requiredClinicId?: string): void => {
  if (!sameClinic(request, requiredClinicId)) {
    throw new HttpsError(
      'permission-denied', 
      'Usuário não tem acesso a esta clínica'
    );
  }
};

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Simple rate limiting middleware
 */
export const rateLimit = (config: RateLimitConfig) => {
  return (request: AuthenticatedRequest): void => {
    const key = `${request.auth.uid}:${Date.now() - (Date.now() % config.windowMs)}`;
    const now = Date.now();
    
    // Clean old entries
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
    
    const current = rateLimitStore.get(key) || { count: 0, resetTime: now + config.windowMs };
    
    if (current.count >= config.maxRequests) {
      logger.warn('Rate limit exceeded', {
        uid: request.auth.uid,
        key,
        count: current.count,
        maxRequests: config.maxRequests
      });
      
      throw new HttpsError(
        'resource-exhausted', 
        'Muitas solicitações. Tente novamente em alguns minutos.'
      );
    }
    
    current.count++;
    rateLimitStore.set(key, current);
  };
};

/**
 * Input validation helper
 */
export const validateInput = (data: any, requiredFields: string[]): void => {
  const missingFields = requiredFields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  if (missingFields.length > 0) {
    throw new HttpsError(
      'invalid-argument', 
      `Campos obrigatórios ausentes: ${missingFields.join(', ')}`
    );
  }
};

/**
 * Error logging helper
 */
export const logError = (operation: string, error: any, context: any = {}): void => {
  logger.error(`Error in ${operation}`, {
    error: error.message || error,
    stack: error.stack,
    ...context
  });
};