import { 
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  onAuthStateChanged,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';
import { parseFirebaseAuthError, validateFirebaseAuthSecurity } from '../utils/firebaseErrorHandler.js';
import logger, { LogCategory, ErrorType } from '../utils/logger.js';

/**
 * Firebase Authentication Service
 * 
 * This service replaces the JWT-based authentication with Firebase Auth
 */
class FirebaseAuthService {
  constructor() {
    this.currentUser = null;
    this.authStateListeners = [];
    
    // Initialize auth state listener
    this.initializeAuthStateListener();
  }

  /**
   * Initialize authentication state listener
   */
  initializeAuthStateListener() {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Get fresh token with custom claims
          const idTokenResult = await user.getIdTokenResult();
          
          this.currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified,
            photoURL: user.photoURL,
            // Custom claims from Firebase Auth
            role: idTokenResult.claims.role || 'receptionist',
            permissions: idTokenResult.claims.permissions || [],
            clinicId: idTokenResult.claims.clinicId || null,
            isAdmin: idTokenResult.claims.admin || false,
            // Token information
            token: idTokenResult.token,
            tokenExpiration: new Date(idTokenResult.expirationTime)
          };

          logger.debug('Auth state changed - user authenticated', {
            category: LogCategory.AUTH,
            userId: user.uid,
            email: user.email?.replace(/(.{2}).*(@.*)/, '$1***$2'),
            role: idTokenResult.claims.role || 'receptionist',
            isAdmin: idTokenResult.claims.admin || false,
            emailVerified: user.emailVerified,
            tokenExpiration: idTokenResult.expirationTime
          });
        } catch (error) {
          // Use enhanced Firebase error handling for token errors
          const parsedError = parseFirebaseAuthError(error, {
            operation: 'getIdToken',
            userId: user.uid,
            email: user.email?.replace(/(.{2}).*(@.*)/, '$1***$2')
          });

          logger.error('Error getting user token in auth state listener', {
            category: LogCategory.AUTH,
            errorType: ErrorType.AUTHENTICATION,
            userId: user.uid,
            email: user.email?.replace(/(.{2}).*(@.*)/, '$1***$2'),
            firebaseCode: error.code,
            appErrorCode: parsedError.code
          });

          this.currentUser = null;
        }
      } else {
        const previousUser = this.currentUser;
        this.currentUser = null;
        
        if (previousUser) {
          logger.info('Auth state changed - user logged out', {
            category: LogCategory.AUTH,
            previousUserId: previousUser.uid,
            previousEmail: previousUser.email?.replace(/(.{2}).*(@.*)/, '$1***$2')
          });
        } else {
          logger.debug('Auth state changed - no user', {
            category: LogCategory.AUTH
          });
        }
      }

      // Notify all listeners
      this.authStateListeners.forEach(listener => {
        try {
          listener(this.currentUser);
        } catch (listenerError) {
          logger.error('Error in auth state listener callback', {
            category: LogCategory.AUTH,
            errorType: ErrorType.SYSTEM,
            error: listenerError.message,
            userId: this.currentUser?.uid
          });
        }
      });
    });
  }

  /**
   * Add auth state change listener
   * @param {Function} callback - Callback function
   */
  onAuthStateChange(callback) {
    this.authStateListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.authStateListeners.indexOf(callback);
      if (index > -1) {
        this.authStateListeners.splice(index, 1);
      }
    };
  }

  /**
   * Login with email and password
   * @param {Object} credentials - Login credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   */
  async login(credentials) {
    const startTime = Date.now();
    
    try {
      const { email, password } = credentials;
      
      // Security validation
      const securityValidation = validateFirebaseAuthSecurity({ email, operation: 'login' });
      if (!securityValidation.isValid) {
        logger.warn('Login attempt failed security validation', {
          category: LogCategory.SECURITY,
          errorType: ErrorType.AUTHENTICATION,
          securityIssues: securityValidation.securityIssues,
          email: email?.replace(/(.{2}).*(@.*)/, '$1***$2') // Mask email
        });
        
        return {
          success: false,
          error: 'Dados de login inválidos'
        };
      }

      // Log login attempt
      logger.info('Login attempt started', {
        category: LogCategory.AUTH,
        email: email?.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email
        securityWarnings: securityValidation.warnings
      });
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Get ID token with custom claims
      const idTokenResult = await user.getIdTokenResult();

      const loginDuration = Date.now() - startTime;
      
      // Log successful login
      logger.info('Login successful', {
        category: LogCategory.AUTH,
        userId: user.uid,
        email: email?.replace(/(.{2}).*(@.*)/, '$1***$2'),
        role: idTokenResult.claims.role || 'receptionist',
        isAdmin: idTokenResult.claims.admin || false,
        loginDuration,
        emailVerified: user.emailVerified
      });

      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified,
          role: idTokenResult.claims.role || 'receptionist',
          permissions: idTokenResult.claims.permissions || [],
          clinicId: idTokenResult.claims.clinicId || null,
          isAdmin: idTokenResult.claims.admin || false
        },
        token: idTokenResult.token
      };
    } catch (error) {
      const loginDuration = Date.now() - startTime;
      
      // Use enhanced Firebase error handling
      const parsedError = parseFirebaseAuthError(error, {
        operation: 'login',
        email: credentials.email?.replace(/(.{2}).*(@.*)/, '$1***$2'),
        loginDuration
      });

      // Log failed login with appropriate level
      logger.error('Login failed', {
        category: LogCategory.AUTH,
        errorType: ErrorType.AUTHENTICATION,
        email: credentials.email?.replace(/(.{2}).*(@.*)/, '$1***$2'),
        firebaseCode: error.code,
        appErrorCode: parsedError.code,
        loginDuration,
        userAction: parsedError.details?.userAction
      });

      return {
        success: false,
        error: parsedError.message,
        code: parsedError.code,
        userAction: parsedError.details?.userAction
      };
    }
  }

  /**
   * Logout current user
   */
  async logout() {
    const userId = this.currentUser?.uid;
    const userEmail = this.currentUser?.email;
    
    try {
      logger.info('Logout started', {
        category: LogCategory.AUTH,
        userId,
        email: userEmail?.replace(/(.{2}).*(@.*)/, '$1***$2')
      });

      await signOut(auth);
      this.currentUser = null;
      
      logger.info('Logout successful', {
        category: LogCategory.AUTH,
        userId,
        email: userEmail?.replace(/(.{2}).*(@.*)/, '$1***$2')
      });

      return { success: true };
    } catch (error) {
      // Use enhanced Firebase error handling
      const parsedError = parseFirebaseAuthError(error, {
        operation: 'logout',
        userId,
        email: userEmail?.replace(/(.{2}).*(@.*)/, '$1***$2')
      });

      logger.error('Logout failed', {
        category: LogCategory.AUTH,
        errorType: ErrorType.AUTHENTICATION,
        userId,
        email: userEmail?.replace(/(.{2}).*(@.*)/, '$1***$2'),
        firebaseCode: error.code,
        appErrorCode: parsedError.code
      });

      return {
        success: false,
        error: parsedError.message,
        code: parsedError.code
      };
    }
  }

  /**
   * Send password reset email
   * @param {string} email - User email
   */
  async forgotPassword(email) {
    try {
      // Security validation
      const securityValidation = validateFirebaseAuthSecurity({ email, operation: 'forgotPassword' });
      if (!securityValidation.isValid) {
        logger.warn('Forgot password attempt failed security validation', {
          category: LogCategory.SECURITY,
          errorType: ErrorType.AUTHENTICATION,
          securityIssues: securityValidation.securityIssues,
          email: email?.replace(/(.{2}).*(@.*)/, '$1***$2')
        });
        
        return {
          success: false,
          error: 'Email inválido'
        };
      }

      logger.info('Password reset requested', {
        category: LogCategory.AUTH,
        email: email?.replace(/(.{2}).*(@.*)/, '$1***$2'),
        securityWarnings: securityValidation.warnings
      });

      await sendPasswordResetEmail(auth, email);
      
      logger.info('Password reset email sent successfully', {
        category: LogCategory.AUTH,
        email: email?.replace(/(.{2}).*(@.*)/, '$1***$2')
      });

      return {
        success: true,
        message: 'Email de recuperação enviado com sucesso'
      };
    } catch (error) {
      // Use enhanced Firebase error handling
      const parsedError = parseFirebaseAuthError(error, {
        operation: 'forgotPassword',
        email: email?.replace(/(.{2}).*(@.*)/, '$1***$2')
      });

      logger.error('Password reset failed', {
        category: LogCategory.AUTH,
        errorType: ErrorType.AUTHENTICATION,
        email: email?.replace(/(.{2}).*(@.*)/, '$1***$2'),
        firebaseCode: error.code,
        appErrorCode: parsedError.code,
        userAction: parsedError.details?.userAction
      });

      return {
        success: false,
        error: parsedError.message,
        code: parsedError.code,
        userAction: parsedError.details?.userAction
      };
    }
  }

  /**
   * Reset password with token
   * @param {string} oobCode - Password reset code
   * @param {string} newPassword - New password
   */
  async resetPassword(oobCode, newPassword) {
    try {
      // Security validation for password
      const securityValidation = validateFirebaseAuthSecurity({ 
        operation: 'resetPassword',
        passwordLength: newPassword?.length 
      });
      
      if (!securityValidation.isValid) {
        logger.warn('Password reset attempt failed security validation', {
          category: LogCategory.SECURITY,
          errorType: ErrorType.AUTHENTICATION,
          securityIssues: securityValidation.securityIssues
        });
        
        return {
          success: false,
          error: 'Dados inválidos'
        };
      }

      logger.info('Password reset confirmation started', {
        category: LogCategory.AUTH,
        hasCode: !!oobCode,
        passwordLength: newPassword?.length,
        securityWarnings: securityValidation.warnings
      });

      await confirmPasswordReset(auth, oobCode, newPassword);
      
      logger.info('Password reset completed successfully', {
        category: LogCategory.AUTH
      });

      return {
        success: true,
        message: 'Senha alterada com sucesso'
      };
    } catch (error) {
      // Use enhanced Firebase error handling
      const parsedError = parseFirebaseAuthError(error, {
        operation: 'resetPassword',
        hasCode: !!oobCode,
        passwordLength: newPassword?.length
      });

      logger.error('Password reset failed', {
        category: LogCategory.AUTH,
        errorType: ErrorType.AUTHENTICATION,
        firebaseCode: error.code,
        appErrorCode: parsedError.code,
        userAction: parsedError.details?.userAction
      });

      return {
        success: false,
        error: parsedError.message,
        code: parsedError.code,
        userAction: parsedError.details?.userAction
      };
    }
  }

  /**
   * Update user profile
   * @param {Object} profileData - Profile data to update
   */
  async updateProfile(profileData) {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { displayName, email } = profileData;
      
      // Update profile using Firebase Functions
      const updateUserProfile = httpsCallable(functions, 'updateUserProfile');
      const result = await updateUserProfile({ displayName, email });

      return {
        success: true,
        message: 'Perfil atualizado com sucesso',
        data: result.data
      };
    } catch (error) {
      console.error('Update profile error:', error);
      return {
        success: false,
        error: error.message || 'Erro ao atualizar perfil'
      };
    }
  }

  /**
   * Change user password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   */
  async changePassword(currentPassword, newPassword) {
    try {
      const user = auth.currentUser;
      if (!user) {
        const noUserError = new Error('Usuário não autenticado');
        noUserError.code = 'auth/user-not-found';
        throw noUserError;
      }

      // Security validation
      const securityValidation = validateFirebaseAuthSecurity({ 
        operation: 'changePassword',
        userId: user.uid,
        passwordLength: newPassword?.length 
      });
      
      if (!securityValidation.isValid) {
        logger.warn('Change password attempt failed security validation', {
          category: LogCategory.SECURITY,
          errorType: ErrorType.AUTHENTICATION,
          userId: user.uid,
          securityIssues: securityValidation.securityIssues
        });
        
        return {
          success: false,
          error: 'Dados inválidos'
        };
      }

      logger.info('Password change started', {
        category: LogCategory.AUTH,
        userId: user.uid,
        email: user.email?.replace(/(.{2}).*(@.*)/, '$1***$2'),
        passwordLength: newPassword?.length,
        securityWarnings: securityValidation.warnings
      });

      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      logger.info('Password changed successfully', {
        category: LogCategory.AUTH,
        userId: user.uid,
        email: user.email?.replace(/(.{2}).*(@.*)/, '$1***$2')
      });

      return {
        success: true,
        message: 'Senha alterada com sucesso'
      };
    } catch (error) {
      // Use enhanced Firebase error handling
      const parsedError = parseFirebaseAuthError(error, {
        operation: 'changePassword',
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email?.replace(/(.{2}).*(@.*)/, '$1***$2'),
        passwordLength: newPassword?.length
      });

      logger.error('Password change failed', {
        category: LogCategory.AUTH,
        errorType: ErrorType.AUTHENTICATION,
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email?.replace(/(.{2}).*(@.*)/, '$1***$2'),
        firebaseCode: error.code,
        appErrorCode: parsedError.code,
        userAction: parsedError.details?.userAction
      });

      return {
        success: false,
        error: parsedError.message,
        code: parsedError.code,
        userAction: parsedError.details?.userAction
      };
    }
  }

  /**
   * Get current user profile from Firebase Functions
   */
  async getUserProfile() {
    try {
      const getUserProfile = httpsCallable(functions, 'getUserProfile');
      const result = await getUserProfile();
      
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error('Get user profile error:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar perfil'
      };
    }
  }

  /**
   * Initialize clinic (for new users)
   * @param {string} clinicName - Clinic name
   * @param {Object} clinicData - Additional clinic data
   */
  async initializeClinic(clinicName, clinicData = {}) {
    try {
      const initializeClinic = httpsCallable(functions, 'initializeClinic');
      const result = await initializeClinic({ clinicName, clinicData });
      
      // Refresh user token to get new custom claims
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error('Initialize clinic error:', error);
      return {
        success: false,
        error: error.message || 'Erro ao criar clínica'
      };
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.currentUser;
  }

  /**
   * Check if user has specific role
   * @param {string} role - Role to check
   */
  hasRole(role) {
    return this.currentUser?.role === role;
  }

  /**
   * Check if user has specific permission
   * @param {string} permission - Permission to check
   */
  hasPermission(permission) {
    if (!this.currentUser) return false;
    
    // Admin has all permissions
    if (this.currentUser.isAdmin) return true;
    
    return this.currentUser.permissions?.includes(permission) || false;
  }

  /**
   * Get current user's ID token
   */
  async getIdToken(forceRefresh = false) {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      return await user.getIdToken(forceRefresh);
    } catch (error) {
      console.error('Error getting ID token:', error);
      throw error;
    }
  }

  /**
   * Set authentication token for API requests
   * This method is kept for compatibility with existing code
   * @param {string} token - Firebase ID token
   */
  setAuthToken(token) {
    // This is handled automatically by Firebase Auth
    // Kept for compatibility with existing authService interface
    console.log('setAuthToken called - handled automatically by Firebase Auth');
  }
}

// Create singleton instance
const firebaseAuthService = new FirebaseAuthService();

export default firebaseAuthService;