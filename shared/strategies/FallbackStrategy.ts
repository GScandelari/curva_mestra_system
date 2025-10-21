/**
 * Fallback Error Recovery Strategy
 * Handles errors that don't have specific strategies or when other strategies fail
 */

import {
  ErrorType,
  ErrorSeverity,
  ProcessedError,
  RecoveryStrategy,
  RecoveryResult,
  BackoffStrategy
} from '../types/errorTypes.js';

export class FallbackStrategy implements RecoveryStrategy {
  name = 'FallbackStrategy';
  maxRetries = 1;
  backoffStrategy = BackoffStrategy.FIXED;

  canHandle(error: ProcessedError): boolean {
    // Fallback strategy can handle any error
    return true;
  }

  async execute(error: ProcessedError): Promise<RecoveryResult> {
    // Handle based on error severity
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        return this.handleCriticalError(error);
      
      case ErrorSeverity.HIGH:
        return this.handleHighSeverityError(error);
      
      case ErrorSeverity.MEDIUM:
        return this.handleMediumSeverityError(error);
      
      case ErrorSeverity.LOW:
        return this.handleLowSeverityError(error);
      
      default:
        return this.handleUnknownSeverityError(error);
    }
  }

  private async handleCriticalError(error: ProcessedError): Promise<RecoveryResult> {
    // Critical errors require immediate attention and system-level fallbacks
    return {
      success: false,
      message: 'Critical error - system fallback required',
      fallbackRequired: true,
      data: {
        action: 'show_critical_error_page',
        userMessage: 'Ocorreu um erro crítico no sistema. Nossa equipe foi notificada.',
        severity: 'critical',
        requiresSupport: true,
        fallbackOptions: [
          'refresh_page',
          'contact_support',
          'try_safe_mode'
        ]
      }
    };
  }

  private async handleHighSeverityError(error: ProcessedError): Promise<RecoveryResult> {
    // High severity errors may have limited recovery options
    return {
      success: false,
      message: 'High severity error - limited recovery options',
      fallbackRequired: true,
      data: {
        action: 'show_error_with_options',
        userMessage: 'Ocorreu um erro no sistema. Tente uma das opções abaixo.',
        severity: 'high',
        fallbackOptions: [
          'retry_operation',
          'refresh_page',
          'go_back',
          'contact_support'
        ]
      }
    };
  }

  private async handleMediumSeverityError(error: ProcessedError): Promise<RecoveryResult> {
    // Medium severity errors can often be recovered with user action
    return {
      success: true,
      message: 'Medium severity error - user action required',
      data: {
        action: 'show_recoverable_error',
        userMessage: 'Não foi possível completar a operação. Tente novamente.',
        severity: 'medium',
        recoverable: true,
        fallbackOptions: [
          'retry_operation',
          'try_alternative_method',
          'go_back'
        ]
      }
    };
  }

  private async handleLowSeverityError(error: ProcessedError): Promise<RecoveryResult> {
    // Low severity errors can usually be handled gracefully
    return {
      success: true,
      message: 'Low severity error - graceful handling',
      data: {
        action: 'show_gentle_notification',
        userMessage: 'Algo não funcionou como esperado, mas você pode continuar.',
        severity: 'low',
        recoverable: true,
        dismissible: true,
        fallbackOptions: [
          'continue_anyway',
          'retry_operation'
        ]
      }
    };
  }

  private async handleUnknownSeverityError(error: ProcessedError): Promise<RecoveryResult> {
    // Unknown severity - treat as medium severity with extra caution
    return {
      success: false,
      message: 'Unknown severity error - cautious handling',
      fallbackRequired: true,
      data: {
        action: 'show_generic_error',
        userMessage: 'Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.',
        severity: 'unknown',
        fallbackOptions: [
          'retry_operation',
          'refresh_page',
          'contact_support'
        ]
      }
    };
  }

  /**
   * Get appropriate fallback actions based on error type
   */
  static getFallbackActions(error: ProcessedError): string[] {
    const baseActions = ['retry_operation', 'refresh_page', 'go_back'];

    switch (error.type) {
      case ErrorType.AUTHENTICATION:
        return ['login_again', 'refresh_token', 'contact_support'];
      
      case ErrorType.AUTHORIZATION:
        return ['contact_admin', 'check_permissions', 'go_back'];
      
      case ErrorType.VALIDATION:
        return ['fix_validation_errors', 'reset_form', 'get_help'];
      
      case ErrorType.NETWORK:
        return ['check_connection', 'retry_operation', 'work_offline'];
      
      case ErrorType.DATABASE:
        return ['retry_operation', 'refresh_page', 'contact_support'];
      
      case ErrorType.BUSINESS_LOGIC:
        return ['review_data', 'try_alternative', 'contact_support'];
      
      case ErrorType.CONFIGURATION:
        return ['contact_admin', 'check_settings', 'use_defaults'];
      
      case ErrorType.SYSTEM:
        return ['retry_operation', 'refresh_page', 'contact_support'];
      
      default:
        return baseActions;
    }
  }

  /**
   * Get user-friendly error messages based on context
   */
  static getUserMessage(error: ProcessedError): string {
    const contextMessages = {
      login: 'Não foi possível fazer login. Verifique suas credenciais.',
      save: 'Não foi possível salvar os dados. Tente novamente.',
      load: 'Não foi possível carregar os dados. Atualize a página.',
      delete: 'Não foi possível excluir o item. Tente novamente.',
      update: 'Não foi possível atualizar os dados. Verifique as informações.',
      create: 'Não foi possível criar o item. Verifique os dados inseridos.',
      search: 'Não foi possível realizar a busca. Tente novamente.',
      upload: 'Não foi possível fazer upload do arquivo. Verifique o formato.',
      download: 'Não foi possível baixar o arquivo. Tente novamente.'
    };

    const action = error.context.action.toLowerCase();
    
    for (const [key, message] of Object.entries(contextMessages)) {
      if (action.includes(key)) {
        return message;
      }
    }

    return error.userMessage || 'Ocorreu um erro inesperado. Tente novamente.';
  }
}