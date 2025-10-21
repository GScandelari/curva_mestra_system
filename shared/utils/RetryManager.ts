/**
 * Retry Manager - Sistema de Retry com Exponential Backoff
 * Implementa mecanismos de retry configuráveis por tipo de erro
 */

import {
  ErrorType,
  ProcessedError,
  BackoffStrategy
} from '../types/errorTypes.js';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffStrategy: BackoffStrategy;
  jitter: boolean;
  retryCondition?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, delay: number) => void;
  onMaxRetriesExceeded?: (error: Error, totalAttempts: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  totalAttempts: number;
  totalTime: number;
  retryHistory: Array<{
    attempt: number;
    error: string;
    delay: number;
    timestamp: Date;
  }>;
}

export class RetryManager {
  private defaultConfigs: Map<ErrorType, RetryConfig> = new Map();
  private globalConfig: RetryConfig;

  constructor() {
    this.globalConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      jitter: true
    };

    this.initializeDefaultConfigs();
  }

  /**
   * Inicializa configurações padrão para cada tipo de erro
   */
  private initializeDefaultConfigs(): void {
    // Configuração para erros de autenticação
    this.defaultConfigs.set(ErrorType.AUTHENTICATION, {
      maxRetries: 2,
      baseDelay: 2000,
      maxDelay: 10000,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      jitter: true,
      retryCondition: (error) => {
        const code = (error as any).code;
        // Retry apenas para erros de rede em auth
        return code === 'auth/network-request-failed' || 
               code === 'auth/timeout';
      }
    });

    // Configuração para erros de rede
    this.defaultConfigs.set(ErrorType.NETWORK, {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 16000,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      jitter: true,
      retryCondition: (error) => {
        const message = error.message.toLowerCase();
        // Retry para a maioria dos erros de rede
        return message.includes('network') ||
               message.includes('timeout') ||
               message.includes('connection') ||
               message.includes('fetch') ||
               message.includes('cors');
      }
    });

    // Configuração para erros de banco de dados
    this.defaultConfigs.set(ErrorType.DATABASE, {
      maxRetries: 3,
      baseDelay: 2000,
      maxDelay: 20000,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      jitter: true,
      retryCondition: (error) => {
        const code = (error as any).code;
        const message = error.message.toLowerCase();
        // Retry para erros temporários de DB
        return code === 'unavailable' ||
               code === 'deadline-exceeded' ||
               message.includes('timeout') ||
               message.includes('connection');
      }
    });

    // Configuração para erros de validação (sem retry)
    this.defaultConfigs.set(ErrorType.VALIDATION, {
      maxRetries: 0,
      baseDelay: 0,
      maxDelay: 0,
      backoffStrategy: BackoffStrategy.FIXED,
      jitter: false,
      retryCondition: () => false // Nunca retry erros de validação
    });

    // Configuração para erros de autorização (sem retry)
    this.defaultConfigs.set(ErrorType.AUTHORIZATION, {
      maxRetries: 0,
      baseDelay: 0,
      maxDelay: 0,
      backoffStrategy: BackoffStrategy.FIXED,
      jitter: false,
      retryCondition: () => false // Nunca retry erros de autorização
    });

    // Configuração para erros de sistema
    this.defaultConfigs.set(ErrorType.SYSTEM, {
      maxRetries: 2,
      baseDelay: 5000,
      maxDelay: 30000,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      jitter: true,
      retryCondition: (error) => {
        const message = error.message.toLowerCase();
        // Retry apenas para erros temporários de sistema
        return message.includes('temporary') ||
               message.includes('unavailable') ||
               message.includes('overload');
      }
    });

    // Configuração para erros de configuração (sem retry)
    this.defaultConfigs.set(ErrorType.CONFIGURATION, {
      maxRetries: 0,
      baseDelay: 0,
      maxDelay: 0,
      backoffStrategy: BackoffStrategy.FIXED,
      jitter: false,
      retryCondition: () => false // Nunca retry erros de configuração
    });

    // Configuração para erros de lógica de negócio (sem retry)
    this.defaultConfigs.set(ErrorType.BUSINESS_LOGIC, {
      maxRetries: 0,
      baseDelay: 0,
      maxDelay: 0,
      backoffStrategy: BackoffStrategy.FIXED,
      jitter: false,
      retryCondition: () => false // Nunca retry erros de lógica de negócio
    });

    // Configuração para erros desconhecidos
    this.defaultConfigs.set(ErrorType.UNKNOWN, {
      maxRetries: 1,
      baseDelay: 3000,
      maxDelay: 10000,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      jitter: true,
      retryCondition: (error) => {
        // Retry conservador para erros desconhecidos
        const message = error.message.toLowerCase();
        return message.includes('network') ||
               message.includes('timeout') ||
               message.includes('temporary');
      }
    });
  }

  /**
   * Executa operação com retry automático
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    errorType?: ErrorType,
    customConfig?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const config = this.getRetryConfig(errorType, customConfig);
    const startTime = Date.now();
    const retryHistory: RetryResult<T>['retryHistory'] = [];
    
    let lastError: Error;
    let attempt = 0;

    while (attempt <= config.maxRetries) {
      try {
        const result = await operation();
        
        return {
          success: true,
          result,
          totalAttempts: attempt + 1,
          totalTime: Date.now() - startTime,
          retryHistory
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        // Se é a última tentativa, não faz retry
        if (attempt > config.maxRetries) {
          break;
        }

        // Verifica se deve fazer retry
        if (!this.shouldRetry(lastError, attempt, config)) {
          console.log('Retry condition not met, stopping retry', {
            error: lastError.message,
            attempt,
            errorType
          });
          break;
        }

        // Calcula delay
        const delay = this.calculateDelay(attempt - 1, config);
        
        // Adiciona ao histórico
        retryHistory.push({
          attempt,
          error: lastError.message,
          delay,
          timestamp: new Date()
        });

        // Callback de retry
        if (config.onRetry) {
          config.onRetry(lastError, attempt, delay);
        }

        console.log(`Retrying operation (attempt ${attempt}/${config.maxRetries}) in ${delay}ms`, {
          error: lastError.message,
          errorType,
          delay
        });

        // Aguarda delay
        await this.sleep(delay);
      }
    }

    // Callback de máximo de tentativas excedido
    if (config.onMaxRetriesExceeded) {
      config.onMaxRetriesExceeded(lastError, attempt);
    }

    return {
      success: false,
      error: lastError,
      totalAttempts: attempt,
      totalTime: Date.now() - startTime,
      retryHistory
    };
  }

  /**
   * Executa retry para ProcessedError
   */
  async retryProcessedError<T>(
    operation: () => Promise<T>,
    processedError: ProcessedError,
    customConfig?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    return this.executeWithRetry(operation, processedError.type, customConfig);
  }

  /**
   * Verifica se deve fazer retry
   */
  private shouldRetry(error: Error, attempt: number, config: RetryConfig): boolean {
    // Verifica condição customizada
    if (config.retryCondition) {
      return config.retryCondition(error, attempt);
    }

    // Lógica padrão de retry
    return this.isRetryableError(error);
  }

  /**
   * Verifica se um erro é retryable por padrão
   */
  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as any).code;

    // Erros não retryable
    const nonRetryablePatterns = [
      'permission',
      'forbidden',
      'unauthorized',
      'invalid',
      'validation',
      'not found',
      'bad request'
    ];

    for (const pattern of nonRetryablePatterns) {
      if (errorMessage.includes(pattern)) {
        return false;
      }
    }

    // Códigos não retryable
    const nonRetryableCodes = [
      'auth/invalid-credential',
      'auth/user-disabled',
      'auth/user-not-found',
      'auth/wrong-password',
      'permission-denied',
      'invalid-argument',
      'not-found'
    ];

    if (nonRetryableCodes.includes(errorCode)) {
      return false;
    }

    // Erros retryable
    const retryablePatterns = [
      'network',
      'timeout',
      'connection',
      'unavailable',
      'overload',
      'rate limit',
      'temporary'
    ];

    for (const pattern of retryablePatterns) {
      if (errorMessage.includes(pattern)) {
        return true;
      }
    }

    // Códigos retryable
    const retryableCodes = [
      'auth/network-request-failed',
      'auth/timeout',
      'unavailable',
      'deadline-exceeded',
      'resource-exhausted'
    ];

    return retryableCodes.includes(errorCode);
  }

  /**
   * Calcula delay baseado na estratégia de backoff
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay: number;

    switch (config.backoffStrategy) {
      case BackoffStrategy.FIXED:
        delay = config.baseDelay;
        break;

      case BackoffStrategy.LINEAR:
        delay = config.baseDelay * (attempt + 1);
        break;

      case BackoffStrategy.EXPONENTIAL:
      default:
        delay = config.baseDelay * Math.pow(2, attempt);
        break;
    }

    // Aplica limite máximo
    delay = Math.min(delay, config.maxDelay);

    // Aplica jitter se habilitado
    if (config.jitter) {
      const jitterAmount = delay * 0.1; // 10% de jitter
      const jitterOffset = (Math.random() - 0.5) * 2 * jitterAmount;
      delay = Math.max(0, delay + jitterOffset);
    }

    return Math.round(delay);
  }

  /**
   * Obtém configuração de retry para um tipo de erro
   */
  private getRetryConfig(
    errorType?: ErrorType, 
    customConfig?: Partial<RetryConfig>
  ): RetryConfig {
    let baseConfig = this.globalConfig;

    if (errorType && this.defaultConfigs.has(errorType)) {
      baseConfig = this.defaultConfigs.get(errorType)!;
    }

    return { ...baseConfig, ...customConfig };
  }

  /**
   * Registra configuração customizada para um tipo de erro
   */
  setRetryConfig(errorType: ErrorType, config: Partial<RetryConfig>): void {
    const existingConfig = this.defaultConfigs.get(errorType) || this.globalConfig;
    this.defaultConfigs.set(errorType, { ...existingConfig, ...config });
    
    console.log(`Retry configuration updated for ${errorType}`, config);
  }

  /**
   * Obtém configuração atual para um tipo de erro
   */
  getRetryConfigForType(errorType: ErrorType): RetryConfig {
    return this.getRetryConfig(errorType);
  }

  /**
   * Atualiza configuração global
   */
  setGlobalRetryConfig(config: Partial<RetryConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config };
    console.log('Global retry configuration updated', config);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cria uma função de retry para uma operação específica
   */
  createRetryFunction<T>(
    operation: () => Promise<T>,
    errorType?: ErrorType,
    config?: Partial<RetryConfig>
  ): () => Promise<T> {
    return async () => {
      const result = await this.executeWithRetry(operation, errorType, config);
      
      if (result.success) {
        return result.result!;
      } else {
        throw result.error;
      }
    };
  }

  /**
   * Obtém estatísticas de retry
   */
  getRetryStats(): {
    configuredErrorTypes: ErrorType[];
    globalConfig: RetryConfig;
    errorTypeConfigs: Array<{
      errorType: ErrorType;
      config: RetryConfig;
    }>;
  } {
    return {
      configuredErrorTypes: Array.from(this.defaultConfigs.keys()),
      globalConfig: { ...this.globalConfig },
      errorTypeConfigs: Array.from(this.defaultConfigs.entries()).map(([errorType, config]) => ({
        errorType,
        config: { ...config }
      }))
    };
  }

  /**
   * Reseta todas as configurações para padrão
   */
  resetToDefaults(): void {
    this.defaultConfigs.clear();
    this.globalConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffStrategy: BackoffStrategy.EXPONENTIAL,
      jitter: true
    };
    this.initializeDefaultConfigs();
    console.log('Retry configurations reset to defaults');
  }
}

// Singleton instance
export const retryManager = new RetryManager();