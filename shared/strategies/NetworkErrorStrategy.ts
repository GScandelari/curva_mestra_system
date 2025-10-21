/**
 * Network Error Recovery Strategy
 * Handles network-related errors with circuit breaker pattern and retry logic
 */

import {
  ErrorType,
  ProcessedError,
  RecoveryStrategy,
  RecoveryResult,
  BackoffStrategy,
  CircuitBreaker,
  CircuitBreakerState
} from '../types/errorTypes.js';

export class NetworkErrorStrategy implements RecoveryStrategy {
  name = 'NetworkErrorStrategy';
  maxRetries = 5;
  backoffStrategy = BackoffStrategy.EXPONENTIAL;
  
  private circuitBreaker: NetworkCircuitBreaker;

  constructor() {
    this.circuitBreaker = new NetworkCircuitBreaker();
  }

  canHandle(error: ProcessedError): boolean {
    return error.type === ErrorType.NETWORK;
  }

  async execute(error: ProcessedError): Promise<RecoveryResult> {
    // Check circuit breaker state
    if (this.circuitBreaker.state === CircuitBreakerState.OPEN) {
      return {
        success: false,
        message: 'Circuit breaker is open - service unavailable',
        retryAfter: 30000, // Wait 30 seconds
        fallbackRequired: true,
        data: { circuitBreakerOpen: true }
      };
    }

    const errorMessage = error.originalError.message.toLowerCase();
    const errorCode = (error.originalError as any).code;

    // Handle specific network error types
    if (errorMessage.includes('timeout') || errorCode === 'ECONNABORTED') {
      return this.handleTimeoutError(error);
    }

    if (errorMessage.includes('connection') || errorCode === 'ECONNREFUSED') {
      return this.handleConnectionError(error);
    }

    if (errorMessage.includes('network') || errorCode === 'NETWORK_ERROR') {
      return this.handleGenericNetworkError(error);
    }

    if (errorMessage.includes('dns') || errorCode === 'ENOTFOUND') {
      return this.handleDnsError(error);
    }

    // Default network error handling
    return this.handleGenericNetworkError(error);
  }

  private async handleTimeoutError(error: ProcessedError): Promise<RecoveryResult> {
    // Record failure in circuit breaker
    this.circuitBreaker.recordFailure();

    return {
      success: false,
      message: 'Request timeout - will retry with longer timeout',
      retryAfter: 5000,
      fallbackRequired: false,
      data: { 
        errorType: 'timeout',
        suggestedTimeout: 30000, // Suggest 30s timeout for retry
        message: 'Tempo limite excedido. Tentando novamente...'
      }
    };
  }

  private async handleConnectionError(error: ProcessedError): Promise<RecoveryResult> {
    // Record failure in circuit breaker
    this.circuitBreaker.recordFailure();

    return {
      success: false,
      message: 'Connection error - server may be unavailable',
      retryAfter: 10000,
      fallbackRequired: false,
      data: { 
        errorType: 'connection',
        message: 'Erro de conexão. Verificando disponibilidade do servidor...'
      }
    };
  }

  private async handleGenericNetworkError(error: ProcessedError): Promise<RecoveryResult> {
    // Record failure in circuit breaker
    this.circuitBreaker.recordFailure();

    return {
      success: false,
      message: 'Network error - will retry',
      retryAfter: 3000,
      fallbackRequired: false,
      data: { 
        errorType: 'network',
        message: 'Erro de rede. Tentando reconectar...'
      }
    };
  }

  private async handleDnsError(error: ProcessedError): Promise<RecoveryResult> {
    // DNS errors are usually not recoverable by retry
    return {
      success: false,
      message: 'DNS resolution failed',
      fallbackRequired: true,
      data: { 
        errorType: 'dns',
        message: 'Erro de resolução DNS. Verifique sua conexão com a internet.'
      }
    };
  }

  /**
   * Reset circuit breaker (called when operation succeeds)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }
}

/**
 * Circuit Breaker implementation for network operations
 */
class NetworkCircuitBreaker implements CircuitBreaker {
  state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  failureCount: number = 0;
  lastFailureTime?: Date;
  
  private readonly failureThreshold = 5;
  private readonly timeout = 60000; // 1 minute
  private readonly halfOpenMaxCalls = 3;
  private halfOpenCalls = 0;

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.halfOpenCalls = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    this.state = CircuitBreakerState.CLOSED;
    this.halfOpenCalls = 0;
  }

  private onSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenCalls++;
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) {
        this.reset();
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.recordFailure();
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.timeout;
  }
}