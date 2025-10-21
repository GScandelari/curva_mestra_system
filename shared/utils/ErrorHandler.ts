/**
 * Unified Error Handler - Central Error Processing System
 * Handles error capture, classification, and recovery coordination
 */

import {
  ErrorType,
  ErrorSeverity,
  ErrorContext,
  ProcessedError,
  RecoveryStrategy,
  RecoveryResult,
  ErrorHandlerConfig
} from '../types/errorTypes.js';

export class ErrorHandler {
  private strategies: Map<ErrorType, RecoveryStrategy[]> = new Map();
  private config: ErrorHandlerConfig;
  private errorCount: Map<string, number> = new Map();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      logLevel: 'error',
      enableRetry: true,
      maxRetries: 3,
      enableFallback: true,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
      ...config
    };

    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default recovery strategies
   */
  private initializeDefaultStrategies(): void {
    // Default strategies will be registered by specific strategy classes
    this.strategies.set(ErrorType.AUTHENTICATION, []);
    this.strategies.set(ErrorType.AUTHORIZATION, []);
    this.strategies.set(ErrorType.VALIDATION, []);
    this.strategies.set(ErrorType.NETWORK, []);
    this.strategies.set(ErrorType.DATABASE, []);
    this.strategies.set(ErrorType.BUSINESS_LOGIC, []);
    this.strategies.set(ErrorType.CONFIGURATION, []);
    this.strategies.set(ErrorType.SYSTEM, []);
    this.strategies.set(ErrorType.UNKNOWN, []);
  }

  /**
   * Capture and classify an error
   */
  captureError(error: Error, context: ErrorContext): ProcessedError {
    const errorId = this.generateErrorId();
    const processedError: ProcessedError = {
      id: errorId,
      type: this.classifyError(error, context),
      severity: this.determineSeverity(error, context),
      message: this.sanitizeMessage(error.message),
      originalError: error,
      context: this.sanitizeContext(context),
      recoverable: this.isRecoverable(error, context),
      retryable: this.isRetryable(error, context),
      userMessage: this.generateUserMessage(error, context),
      technicalDetails: this.extractTechnicalDetails(error, context)
    };

    // Log the error
    this.logError(processedError);

    return processedError;
  }

  /**
   * Get appropriate recovery strategy for an error
   */
  getRecoveryStrategy(error: ProcessedError): RecoveryStrategy | null {
    const strategies = this.strategies.get(error.type) || [];
    
    for (const strategy of strategies) {
      if (strategy.canHandle(error)) {
        return strategy;
      }
    }

    return null;
  }

  /**
   * Execute recovery for an error
   */
  async executeRecovery(strategy: RecoveryStrategy, error: ProcessedError): Promise<RecoveryResult> {
    const errorKey = `${error.type}_${error.context.component}_${error.context.action}`;
    const currentRetries = this.errorCount.get(errorKey) || 0;

    if (currentRetries >= strategy.maxRetries) {
      return {
        success: false,
        message: 'Maximum retry attempts exceeded',
        fallbackRequired: true
      };
    }

    try {
      // Increment retry count
      this.errorCount.set(errorKey, currentRetries + 1);

      // Execute recovery strategy
      const result = await strategy.execute(error);

      if (result.success) {
        // Reset error count on success
        this.errorCount.delete(errorKey);
      }

      return result;
    } catch (recoveryError) {
      const errorMessage = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
      this.logError({
        ...error,
        message: `Recovery strategy failed: ${errorMessage}`,
        technicalDetails: {
          ...error.technicalDetails,
          recoveryError: errorMessage,
          strategyName: strategy.name
        }
      });

      return {
        success: false,
        message: 'Recovery strategy execution failed',
        fallbackRequired: true
      };
    }
  }

  /**
   * Register a recovery strategy
   */
  registerStrategy(errorType: ErrorType, strategy: RecoveryStrategy): void {
    const strategies = this.strategies.get(errorType) || [];
    strategies.push(strategy);
    this.strategies.set(errorType, strategies);
  }

  /**
   * Classify error type based on error characteristics
   */
  private classifyError(error: Error, context: ErrorContext): ErrorType {
    // Check error message and properties for classification
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // Authentication errors
    if (errorMessage.includes('auth') || 
        errorMessage.includes('login') || 
        errorMessage.includes('credential') ||
        errorMessage.includes('token') ||
        errorName.includes('auth')) {
      return ErrorType.AUTHENTICATION;
    }

    // Authorization errors
    if (errorMessage.includes('permission') || 
        errorMessage.includes('forbidden') || 
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('access denied')) {
      return ErrorType.AUTHORIZATION;
    }

    // Validation errors
    if (errorMessage.includes('validation') || 
        errorMessage.includes('invalid') || 
        errorMessage.includes('required') ||
        errorName.includes('validation')) {
      return ErrorType.VALIDATION;
    }

    // Network errors
    if (errorMessage.includes('network') || 
        errorMessage.includes('connection') || 
        errorMessage.includes('timeout') ||
        errorMessage.includes('fetch') ||
        errorName.includes('network')) {
      return ErrorType.NETWORK;
    }

    // Database errors
    if (errorMessage.includes('database') || 
        errorMessage.includes('query') || 
        errorMessage.includes('constraint') ||
        errorName.includes('sequelize') ||
        errorName.includes('mongo')) {
      return ErrorType.DATABASE;
    }

    // Configuration errors
    if (errorMessage.includes('config') || 
        errorMessage.includes('environment') || 
        errorMessage.includes('missing') ||
        context.component.includes('config')) {
      return ErrorType.CONFIGURATION;
    }

    // Business logic errors (based on context)
    if (context.component.includes('service') || 
        context.component.includes('business') ||
        context.action.includes('process') ||
        context.action.includes('calculate')) {
      return ErrorType.BUSINESS_LOGIC;
    }

    // System errors
    if (errorMessage.includes('system') || 
        errorMessage.includes('internal') || 
        errorName.includes('system')) {
      return ErrorType.SYSTEM;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error, context: ErrorContext): ErrorSeverity {
    const errorMessage = error.message.toLowerCase();

    // Critical errors
    if (errorMessage.includes('critical') || 
        errorMessage.includes('fatal') || 
        errorMessage.includes('crash') ||
        context.component === 'auth' && context.action === 'login') {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors
    if (errorMessage.includes('permission') || 
        errorMessage.includes('unauthorized') || 
        errorMessage.includes('database') ||
        context.component.includes('payment') ||
        context.component.includes('security')) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors
    if (errorMessage.includes('validation') || 
        errorMessage.includes('not found') || 
        errorMessage.includes('timeout')) {
      return ErrorSeverity.MEDIUM;
    }

    // Default to low severity
    return ErrorSeverity.LOW;
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverable(error: Error, context: ErrorContext): boolean {
    const errorMessage = error.message.toLowerCase();

    // Non-recoverable errors
    if (errorMessage.includes('permission') || 
        errorMessage.includes('forbidden') || 
        errorMessage.includes('unauthorized') ||
        errorMessage.includes('invalid credential')) {
      return false;
    }

    // Recoverable errors
    if (errorMessage.includes('network') || 
        errorMessage.includes('timeout') || 
        errorMessage.includes('connection') ||
        errorMessage.includes('service unavailable')) {
      return true;
    }

    return false;
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: Error, context: ErrorContext): boolean {
    const errorMessage = error.message.toLowerCase();

    // Retryable errors
    if (errorMessage.includes('network') || 
        errorMessage.includes('timeout') || 
        errorMessage.includes('connection') ||
        errorMessage.includes('service unavailable') ||
        errorMessage.includes('rate limit')) {
      return true;
    }

    return false;
  }

  /**
   * Generate user-friendly error message
   */
  private generateUserMessage(error: Error, context: ErrorContext): string {
    const errorType = this.classifyError(error, context);

    const userMessages = {
      [ErrorType.AUTHENTICATION]: 'Erro de autenticação. Verifique suas credenciais.',
      [ErrorType.AUTHORIZATION]: 'Você não tem permissão para realizar esta ação.',
      [ErrorType.VALIDATION]: 'Dados inválidos. Verifique os campos preenchidos.',
      [ErrorType.NETWORK]: 'Erro de conexão. Verifique sua internet.',
      [ErrorType.DATABASE]: 'Erro no sistema. Tente novamente em alguns instantes.',
      [ErrorType.BUSINESS_LOGIC]: 'Não foi possível processar a solicitação.',
      [ErrorType.CONFIGURATION]: 'Erro de configuração do sistema.',
      [ErrorType.SYSTEM]: 'Erro interno do sistema. Tente novamente.',
      [ErrorType.UNKNOWN]: 'Ocorreu um erro inesperado. Tente novamente.'
    };

    return userMessages[errorType] || userMessages[ErrorType.UNKNOWN];
  }

  /**
   * Extract technical details from error
   */
  private extractTechnicalDetails(error: Error, context: ErrorContext): Record<string, any> {
    return {
      errorName: error.name,
      errorStack: error.stack,
      errorCode: (error as any).code,
      statusCode: (error as any).statusCode,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined
    };
  }

  /**
   * Sanitize error message
   */
  private sanitizeMessage(message: string): string {
    if (!message) return 'Unknown error';

    // Remove sensitive information patterns
    return message
      .replace(/password[=:]\s*[^\s&]+/gi, 'password=***')
      .replace(/token[=:]\s*[^\s&]+/gi, 'token=***')
      .replace(/key[=:]\s*[^\s&]+/gi, 'key=***')
      .replace(/secret[=:]\s*[^\s&]+/gi, 'secret=***');
  }

  /**
   * Sanitize error context
   */
  private sanitizeContext(context: ErrorContext): ErrorContext {
    const sanitized = { ...context };
    
    if (sanitized.additionalData) {
      sanitized.additionalData = this.sanitizeObject(sanitized.additionalData);
    }

    return sanitized;
  }

  /**
   * Sanitize object recursively
   */
  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'authorization'];
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        result[key] = '***';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.sanitizeObject(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log error (placeholder - will be implemented by platform-specific loggers)
   */
  private logError(error: ProcessedError): void {
    // This will be overridden by platform-specific implementations
    console.error('Error captured:', {
      id: error.id,
      type: error.type,
      severity: error.severity,
      message: error.message,
      context: error.context
    });
  }
}