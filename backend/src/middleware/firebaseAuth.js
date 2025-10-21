const firebaseConfig = require('../config/firebase');
const logger = require('../utils/logger');

/**
 * Firebase Authentication Middleware
 * 
 * This middleware replaces the JWT-based authentication with Firebase Auth
 */
class FirebaseAuthMiddleware {
  /**
   * Authenticate Firebase ID token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  static async authenticate(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_001',
            message: 'Token de acesso não fornecido',
            details: 'Authorization header deve conter Bearer token'
          }
        });
      }

      const idToken = authHeader.split('Bearer ')[1];
      
      if (!idToken) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_002',
            message: 'Token de acesso inválido',
            details: 'Token não encontrado no header Authorization'
          }
        });
      }

      // Verify Firebase ID token
      const decodedToken = await firebaseConfig.verifyIdToken(idToken);
      
      // Add user information to request object
      req.user = {
        id: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name || decodedToken.email,
        role: decodedToken.role || 'receptionist',
        permissions: decodedToken.permissions || [],
        clinicId: decodedToken.clinicId || 'default-clinic',
        emailVerified: decodedToken.email_verified,
        firebaseUser: decodedToken
      };

      // Log authentication success
      logger.logAuth('login_success', req.user.id, {
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      next();
    } catch (error) {
      logger.logAuth('login_failed', null, {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Handle specific Firebase Auth errors
      let errorResponse = {
        success: false,
        error: {
          code: 'AUTH_003',
          message: 'Token de acesso inválido',
          details: 'Falha na verificação do token'
        }
      };

      if (error.code === 'auth/id-token-expired') {
        errorResponse.error.code = 'AUTH_004';
        errorResponse.error.message = 'Token de acesso expirado';
        errorResponse.error.details = 'Faça login novamente';
      } else if (error.code === 'auth/id-token-revoked') {
        errorResponse.error.code = 'AUTH_005';
        errorResponse.error.message = 'Token de acesso revogado';
        errorResponse.error.details = 'Faça login novamente';
      } else if (error.code === 'auth/invalid-id-token') {
        errorResponse.error.code = 'AUTH_006';
        errorResponse.error.message = 'Token de acesso malformado';
        errorResponse.error.details = 'Token inválido fornecido';
      }

      return res.status(401).json(errorResponse);
    }
  }

  /**
   * Check if user has required role
   * @param {string|Array} requiredRoles - Required role(s)
   */
  static requireRole(requiredRoles) {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_007',
            message: 'Usuário não autenticado',
            details: 'Middleware de autenticação deve ser executado primeiro'
          }
        });
      }

      if (!roles.includes(req.user.role)) {
        logger.logAuth('authorization_failed', req.user.id, {
          requiredRoles: roles,
          userRole: req.user.role,
          resource: req.path
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'AUTH_008',
            message: 'Acesso negado',
            details: `Requer uma das seguintes funções: ${roles.join(', ')}`
          }
        });
      }

      next();
    };
  }

  /**
   * Check if user has required permission
   * @param {string|Array} requiredPermissions - Required permission(s)
   */
  static requirePermission(requiredPermissions) {
    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_007',
            message: 'Usuário não autenticado',
            details: 'Middleware de autenticação deve ser executado primeiro'
          }
        });
      }

      // Admin has all permissions
      if (req.user.role === 'admin') {
        return next();
      }

      const userPermissions = req.user.permissions || [];
      const hasPermission = permissions.some(permission => 
        userPermissions.includes(permission)
      );

      if (!hasPermission) {
        logger.logAuth('authorization_failed', req.user.id, {
          requiredPermissions: permissions,
          userPermissions: userPermissions,
          resource: req.path
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'AUTH_009',
            message: 'Permissão insuficiente',
            details: `Requer uma das seguintes permissões: ${permissions.join(', ')}`
          }
        });
      }

      next();
    };
  }

  /**
   * Check if user belongs to the same clinic
   * @param {string} clinicIdParam - Parameter name containing clinic ID
   */
  static requireSameClinic(clinicIdParam = 'clinicId') {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_007',
            message: 'Usuário não autenticado'
          }
        });
      }

      const requestedClinicId = req.params[clinicIdParam] || req.body[clinicIdParam] || req.query[clinicIdParam];
      
      if (!requestedClinicId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'AUTH_010',
            message: 'ID da clínica não fornecido',
            details: `Parâmetro ${clinicIdParam} é obrigatório`
          }
        });
      }

      if (req.user.clinicId !== requestedClinicId) {
        logger.logAuth('clinic_access_denied', req.user.id, {
          userClinicId: req.user.clinicId,
          requestedClinicId: requestedClinicId,
          resource: req.path
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'AUTH_011',
            message: 'Acesso negado à clínica',
            details: 'Usuário não pertence à clínica solicitada'
          }
        });
      }

      next();
    };
  }

  /**
   * Optional authentication - doesn't fail if no token provided
   */
  static async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
      }

      const idToken = authHeader.split('Bearer ')[1];
      
      if (!idToken) {
        return next();
      }

      // Verify Firebase ID token
      const decodedToken = await firebaseConfig.verifyIdToken(idToken);
      
      // Add user information to request object
      req.user = {
        id: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name || decodedToken.email,
        role: decodedToken.role || 'receptionist',
        permissions: decodedToken.permissions || [],
        clinicId: decodedToken.clinicId || 'default-clinic',
        emailVerified: decodedToken.email_verified,
        firebaseUser: decodedToken
      };

      next();
    } catch (error) {
      // In optional auth, we don't fail on token errors
      next();
    }
  }
}

module.exports = FirebaseAuthMiddleware;