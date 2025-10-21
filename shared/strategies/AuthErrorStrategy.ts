/**
 * Authentication Error Recovery Strategy
 * Handles authentication-related errors with appropriate recovery mechanisms
 */

import {
  ErrorType,
  ProcessedError,
  RecoveryStrategy,
  RecoveryResult,
  BackoffStrategy
} from '../types/errorTypes.js';

export class AuthErrorStrategy implements RecoveryStrategy {
  name = 'AuthErrorStrategy';
  maxRetries = 2; // Limited retries for auth errors
  backoffStrategy = BackoffStrategy.EXPONENTIAL;

  canHandle(error: ProcessedError): boolean {
    return error.type === ErrorType.AUTHENTICATION;
  }

  async execute(error: ProcessedError): Promise<RecoveryResult> {
    const errorMessage = error.originalError.message.toLowerCase();
    const errorCode = (error.originalError as any).code;

    // Handle Firebase Auth specific errors
    if (errorCode && errorCode.startsWith('auth/')) {
      return this.handleFirebaseAuthError(error, errorCode);
    }

    // Handle generic authentication errors
    if (errorMessage.includes('token expired') || errorMessage.includes('session expired')) {
      return this.handleTokenExpired(error);
    }

    if (errorMessage.includes('invalid credential') || errorMessage.includes('unauthorized')) {
      return this.handleInvalidCredentials(error);
    }

    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return this.handleNetworkAuthError(error);
    }

    // Default fallback
    return {
      success: false,
      message: 'Authentication error requires manual intervention',
      fallbackRequired: true
    };
  }

  private async handleFirebaseAuthError(error: ProcessedError, firebaseCode: string): Promise<RecoveryResult> {
    switch (firebaseCode) {
      case 'auth/network-request-failed':
        return {
          success: false,
          message: 'Network error during authentication',
          retryAfter: 2000,
          fallbackRequired: false
        };

      case 'auth/too-many-requests':
        return {
          success: false,
          message: 'Too many authentication attempts',
          retryAfter: 60000, // Wait 1 minute
          fallbackRequired: false
        };

      case 'auth/user-token-expired':
      case 'auth/id-token-expired':
        return this.handleTokenExpired(error);

      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return {
          success: false,
          message: 'Invalid credentials provided',
          fallbackRequired: true
        };

      case 'auth/user-disabled':
        return {
          success: false,
          message: 'User account is disabled',
          fallbackRequired: true
        };

      default:
        return {
          success: false,
          message: `Unhandled Firebase auth error: ${firebaseCode}`,
          fallbackRequired: true
        };
    }
  }

  private async handleTokenExpired(error: ProcessedError): Promise<RecoveryResult> {
    try {
      // Attempt to refresh token if refresh mechanism is available
      if (typeof window !== 'undefined' && window.localStorage) {
        const refreshToken = localStorage.getItem('refreshToken');
        
        if (refreshToken) {
          // This would typically call a refresh token service
          // For now, we'll indicate that a refresh should be attempted
          return {
            success: false,
            message: 'Token expired - refresh required',
            fallbackRequired: true,
            data: { action: 'refresh_token' }
          };
        }
      }

      // No refresh token available - require re-login
      return {
        success: false,
        message: 'Session expired - login required',
        fallbackRequired: true,
        data: { action: 'redirect_to_login' }
      };
    } catch (refreshError) {
      return {
        success: false,
        message: 'Failed to refresh authentication',
        fallbackRequired: true,
        data: { action: 'redirect_to_login' }
      };
    }
  }

  private async handleInvalidCredentials(error: ProcessedError): Promise<RecoveryResult> {
    // Invalid credentials cannot be automatically recovered
    return {
      success: false,
      message: 'Invalid credentials - user intervention required',
      fallbackRequired: true,
      data: { 
        action: 'show_login_form',
        message: 'Credenciais inválidas. Verifique seu usuário e senha.'
      }
    };
  }

  private async handleNetworkAuthError(error: ProcessedError): Promise<RecoveryResult> {
    // Network errors during authentication can be retried
    return {
      success: false,
      message: 'Network error during authentication',
      retryAfter: 3000,
      fallbackRequired: false,
      data: { 
        action: 'retry_auth',
        message: 'Erro de conexão durante autenticação. Tentando novamente...'
      }
    };
  }
}