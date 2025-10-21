"use strict";
/**
 * Authentication and Authorization Middleware for Firebase Functions
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
exports.logError = exports.validateInput = exports.rateLimit = exports.validateClinic = exports.authorize = exports.sameClinic = exports.hasRole = exports.verifyAuth = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
/**
 * Verify Firebase Auth token and extract user claims
 */
const verifyAuth = (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }
    return request;
};
exports.verifyAuth = verifyAuth;
/**
 * Check if user has required role
 */
const hasRole = (request, allowedRoles) => {
    const userRole = request.auth.token.role;
    return allowedRoles.includes(userRole);
};
exports.hasRole = hasRole;
/**
 * Check if user belongs to the same clinic
 */
const sameClinic = (request, clinicId) => {
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
exports.sameClinic = sameClinic;
/**
 * Authorization middleware factory
 */
const authorize = (allowedRoles) => {
    return (request) => {
        const authRequest = (0, exports.verifyAuth)(request);
        if (!(0, exports.hasRole)(authRequest, allowedRoles)) {
            throw new https_1.HttpsError('permission-denied', `Acesso negado. Roles permitidos: ${allowedRoles.join(', ')}`);
        }
        return authRequest;
    };
};
exports.authorize = authorize;
/**
 * Clinic validation middleware
 */
const validateClinic = (request, requiredClinicId) => {
    if (!(0, exports.sameClinic)(request, requiredClinicId)) {
        throw new https_1.HttpsError('permission-denied', 'Usuário não tem acesso a esta clínica');
    }
};
exports.validateClinic = validateClinic;
const rateLimitStore = new Map();
/**
 * Simple rate limiting middleware
 */
const rateLimit = (config) => {
    return (request) => {
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
            throw new https_1.HttpsError('resource-exhausted', 'Muitas solicitações. Tente novamente em alguns minutos.');
        }
        current.count++;
        rateLimitStore.set(key, current);
    };
};
exports.rateLimit = rateLimit;
/**
 * Input validation helper
 */
const validateInput = (data, requiredFields) => {
    const missingFields = requiredFields.filter(field => {
        const value = data[field];
        return value === undefined || value === null || value === '';
    });
    if (missingFields.length > 0) {
        throw new https_1.HttpsError('invalid-argument', `Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
    }
};
exports.validateInput = validateInput;
/**
 * Error logging helper
 */
const logError = (operation, error, context = {}) => {
    logger.error(`Error in ${operation}`, Object.assign({ error: error.message || error, stack: error.stack }, context));
};
exports.logError = logError;
//# sourceMappingURL=auth.js.map