/**
 * Service Wrapper com Circuit Breaker
 * Integra circuit breaker pattern nos serviços críticos
 */

import { CircuitBreaker, CircuitBreakerFactory } from './CircuitBreaker.js';
import { ErrorType, ProcessedError } from '../types/errorTypes.js';

export interface ServiceConfig {
  name: string;
  type: 'external-api' | 'database' | 'critical-service' | 'custom';
  circuitBreakerConfig?: any;
  retryConfig?: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  };
}

export class ServiceWrapper {
  private circuitBreaker: CircuitBreaker;
  private config: ServiceConfig;
  private metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    lastRequestTime?: Date;
  };

  constructor(config: ServiceConfig) {
    this.config = config;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };

    // Cria circuit breaker baseado no tipo de serviço
    this.circuitBreaker = this.createCircuitBreaker();
  }

  /**
   * Cria circuit breaker apropriado para o tipo de serviço
   */
  private createCircuitBreaker(): CircuitBreaker {
    switch (this.config.type) {
      case 'external-api':
        return CircuitBreakerFactory.forExternalAPI();
      case 'database':
        return CircuitBreakerFactory.forDatabase();
      case 'critical-service':
        return CircuitBreakerFactory.forCriticalService();
      case 'custom':
        return new CircuitBreaker(this.config.circuitBreakerConfig);
      default:
        return CircuitBreakerFactory.forExternalAPI();
    }
  }

  /**
   * Executa operação com proteção do circuit breaker
   */
  async execute<T>(operation: () => Promise<T>, context?: string): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    this.metrics.lastRequestTime = new Date();

    try {
      const result = await this.circuitBreaker.execute(operation);
      
      // Atualiza métricas de sucesso
      this.metrics.successfulRequests++;
      this.updateResponseTime(Date.now() - startTime);
      
      console.log(`Service ${this.config.name} operation successful`, {
        context,
        responseTime: Date.now() - startTime,
        circuitState: this.circuitBreaker.state
      });

      return result;
    } catch (error) {
      // Atualiza métricas de falha
      this.metrics.failedRequests++;
      this.updateResponseTime(Date.now() - startTime);

      console.error(`Service ${this.config.name} operation failed`, {
        context,
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
        circuitState: this.circuitBreaker.state
      });

      throw error;
    }
  }

  /**
   * Executa operação com retry automático
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>, 
    context?: string,
    customRetryConfig?: { maxRetries: number; baseDelay: number; maxDelay: number }
  ): Promise<T> {
    const retryConfig = customRetryConfig || this.config.retryConfig || {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000
    };

    let lastError: Error;
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await this.execute(operation, `${context} (attempt ${attempt + 1})`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Se é a última tentativa, não faz retry
        if (attempt === retryConfig.maxRetries) {
          break;
        }

        // Verifica se o erro é retryable
        if (!this.isRetryableError(lastError)) {
          console.log(`Non-retryable error for service ${this.config.name}, stopping retry`, {
            error: lastError.message,
            attempt: attempt + 1
          });
          break;
        }

        // Calcula delay com exponential backoff
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(2, attempt),
          retryConfig.maxDelay
        );

        console.log(`Retrying service ${this.config.name} operation in ${delay}ms`, {
          context,
          attempt: attempt + 1,
          maxRetries: retryConfig.maxRetries,
          error: lastError.message
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Verifica se um erro é retryable
   */
  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as any).code;

    // Erros de rede são retryable
    if (errorMessage.includes('network') || 
        errorMessage.includes('timeout') || 
        errorMessage.includes('connection') ||
        errorMessage.includes('fetch')) {
      return true;
    }

    // Códigos de erro específicos retryable
    const retryableCodes = [
      'auth/network-request-failed',
      'auth/timeout',
      'unavailable',
      'internal',
      'deadline-exceeded'
    ];

    return retryableCodes.includes(errorCode);
  }

  /**
   * Atualiza tempo médio de resposta
   */
  private updateResponseTime(responseTime: number): void {
    const totalRequests = this.metrics.successfulRequests + this.metrics.failedRequests;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtém métricas do serviço
   */
  getMetrics(): {
    service: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    averageResponseTime: number;
    lastRequestTime?: Date;
    circuitBreakerStats: any;
  } {
    const successRate = this.metrics.totalRequests > 0 
      ? this.metrics.successfulRequests / this.metrics.totalRequests 
      : 0;

    return {
      service: this.config.name,
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      successRate,
      averageResponseTime: this.metrics.averageResponseTime,
      lastRequestTime: this.metrics.lastRequestTime,
      circuitBreakerStats: this.circuitBreaker.getStats()
    };
  }

  /**
   * Verifica se o serviço está saudável
   */
  isHealthy(): boolean {
    return this.circuitBreaker.isHealthy();
  }

  /**
   * Reseta métricas e circuit breaker
   */
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0
    };
    this.circuitBreaker.reset();
    console.log(`Service ${this.config.name} reset`);
  }

  /**
   * Força abertura do circuit breaker (para manutenção)
   */
  forceCircuitOpen(): void {
    this.circuitBreaker.forceOpen();
    console.log(`Service ${this.config.name} circuit breaker forced open`);
  }

  /**
   * Força fechamento do circuit breaker
   */
  forceCircuitClose(): void {
    this.circuitBreaker.forceClose();
    console.log(`Service ${this.config.name} circuit breaker forced closed`);
  }

  /**
   * Obtém configuração do serviço
   */
  getConfig(): ServiceConfig {
    return { ...this.config };
  }
}

/**
 * Manager para múltiplos service wrappers
 */
export class ServiceManager {
  private services: Map<string, ServiceWrapper> = new Map();

  /**
   * Registra um serviço
   */
  registerService(config: ServiceConfig): ServiceWrapper {
    const wrapper = new ServiceWrapper(config);
    this.services.set(config.name, wrapper);
    console.log(`Service ${config.name} registered`);
    return wrapper;
  }

  /**
   * Obtém um serviço registrado
   */
  getService(name: string): ServiceWrapper | undefined {
    return this.services.get(name);
  }

  /**
   * Obtém métricas de todos os serviços
   */
  getAllMetrics(): Array<ReturnType<ServiceWrapper['getMetrics']>> {
    return Array.from(this.services.values()).map(service => service.getMetrics());
  }

  /**
   * Verifica saúde de todos os serviços
   */
  getHealthStatus(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Array<{
      name: string;
      healthy: boolean;
      metrics: ReturnType<ServiceWrapper['getMetrics']>;
    }>;
  } {
    const serviceStatuses = Array.from(this.services.entries()).map(([name, service]) => ({
      name,
      healthy: service.isHealthy(),
      metrics: service.getMetrics()
    }));

    const healthyCount = serviceStatuses.filter(s => s.healthy).length;
    const totalCount = serviceStatuses.length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) {
      overall = 'healthy';
    } else if (healthyCount > totalCount / 2) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return {
      overall,
      services: serviceStatuses
    };
  }

  /**
   * Reseta todos os serviços
   */
  resetAll(): void {
    this.services.forEach(service => service.reset());
    console.log('All services reset');
  }

  /**
   * Remove um serviço
   */
  unregisterService(name: string): boolean {
    const removed = this.services.delete(name);
    if (removed) {
      console.log(`Service ${name} unregistered`);
    }
    return removed;
  }
}

// Singleton instance
export const serviceManager = new ServiceManager();