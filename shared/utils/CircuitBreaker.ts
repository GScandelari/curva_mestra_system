/**
 * Circuit Breaker Pattern Implementation
 * Previne cascata de falhas em serviços externos
 */

import {
  CircuitBreakerState,
  CircuitBreaker as ICircuitBreaker
} from '../types/errorTypes.js';

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Número de falhas para abrir o circuito
  recoveryTimeout: number;       // Tempo em ms para tentar recuperação
  monitoringPeriod: number;      // Período de monitoramento em ms
  expectedErrorRate: number;     // Taxa de erro esperada (0-1)
  minimumRequests: number;       // Mínimo de requests para avaliar
}

export class CircuitBreaker implements ICircuitBreaker {
  public state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  public failureCount: number = 0;
  public lastFailureTime?: Date;
  
  private successCount: number = 0;
  private requestCount: number = 0;
  private lastStateChange: Date = new Date();
  private config: CircuitBreakerConfig;
  private nextAttemptTime?: Date;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000,      // 1 minuto
      monitoringPeriod: 300000,    // 5 minutos
      expectedErrorRate: 0.1,      // 10%
      minimumRequests: 10,
      ...config
    };
  }

  /**
   * Executa operação com proteção do circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Verifica se pode executar baseado no estado atual
    if (!this.canExecute()) {
      throw new Error(`Circuit breaker is ${this.state}. Operation blocked.`);
    }

    // Incrementa contador de requests
    this.requestCount++;

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Verifica se pode executar operação
   */
  private canExecute(): boolean {
    const now = new Date();

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        return true;

      case CircuitBreakerState.OPEN:
        // Verifica se é hora de tentar recuperação
        if (this.shouldAttemptRecovery(now)) {
          this.state = CircuitBreakerState.HALF_OPEN;
          this.lastStateChange = now;
          console.log('Circuit breaker transitioning to HALF_OPEN');
          return true;
        }
        return false;

      case CircuitBreakerState.HALF_OPEN:
        // No estado HALF_OPEN, permite apenas uma tentativa por vez
        return true;

      default:
        return false;
    }
  }

  /**
   * Verifica se deve tentar recuperação
   */
  private shouldAttemptRecovery(now: Date): boolean {
    if (!this.lastFailureTime) return false;
    
    const timeSinceLastFailure = now.getTime() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.recoveryTimeout;
  }

  /**
   * Manipula sucesso da operação
   */
  private onSuccess(): void {
    this.successCount++;
    
    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        // Reset failure count em caso de sucesso
        this.failureCount = 0;
        break;

      case CircuitBreakerState.HALF_OPEN:
        // Sucesso no HALF_OPEN fecha o circuito
        this.reset();
        console.log('Circuit breaker recovered - transitioning to CLOSED');
        break;
    }

    this.cleanupOldMetrics();
  }

  /**
   * Manipula falha da operação
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        if (this.shouldOpenCircuit()) {
          this.openCircuit();
        }
        break;

      case CircuitBreakerState.HALF_OPEN:
        // Falha no HALF_OPEN volta para OPEN
        this.openCircuit();
        console.log('Circuit breaker failed recovery - returning to OPEN');
        break;
    }

    this.cleanupOldMetrics();
  }

  /**
   * Verifica se deve abrir o circuito
   */
  private shouldOpenCircuit(): boolean {
    // Verifica se tem requests mínimos para avaliar
    if (this.requestCount < this.config.minimumRequests) {
      return false;
    }

    // Verifica se excedeu threshold de falhas
    if (this.failureCount >= this.config.failureThreshold) {
      return true;
    }

    // Verifica taxa de erro
    const errorRate = this.failureCount / this.requestCount;
    return errorRate > this.config.expectedErrorRate;
  }

  /**
   * Abre o circuito
   */
  private openCircuit(): void {
    this.state = CircuitBreakerState.OPEN;
    this.lastStateChange = new Date();
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    
    console.log(`Circuit breaker OPENED - failures: ${this.failureCount}, error rate: ${(this.failureCount / this.requestCount * 100).toFixed(2)}%`);
  }

  /**
   * Reseta o circuit breaker para estado inicial
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.requestCount = 0;
    this.lastFailureTime = undefined;
    this.lastStateChange = new Date();
    this.nextAttemptTime = undefined;
    
    console.log('Circuit breaker reset to CLOSED state');
  }

  /**
   * Força abertura do circuito (para testes ou manutenção)
   */
  forceOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.lastStateChange = new Date();
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    
    console.log('Circuit breaker forced to OPEN state');
  }

  /**
   * Força fechamento do circuito (para testes ou manutenção)
   */
  forceClose(): void {
    this.reset();
    console.log('Circuit breaker forced to CLOSED state');
  }

  /**
   * Limpa métricas antigas baseado no período de monitoramento
   */
  private cleanupOldMetrics(): void {
    const now = new Date();
    const timeSinceLastStateChange = now.getTime() - this.lastStateChange.getTime();

    // Se passou do período de monitoramento, reseta contadores
    if (timeSinceLastStateChange >= this.config.monitoringPeriod) {
      const oldFailureCount = this.failureCount;
      const oldRequestCount = this.requestCount;
      
      this.failureCount = 0;
      this.successCount = 0;
      this.requestCount = 0;
      this.lastStateChange = now;

      console.log(`Circuit breaker metrics reset - old failures: ${oldFailureCount}, old requests: ${oldRequestCount}`);
    }
  }

  /**
   * Obtém estatísticas atuais do circuit breaker
   */
  getStats(): {
    state: CircuitBreakerState;
    failureCount: number;
    successCount: number;
    requestCount: number;
    errorRate: number;
    timeSinceLastFailure?: number;
    timeUntilNextAttempt?: number;
    uptime: number;
  } {
    const now = new Date();
    const uptime = now.getTime() - this.lastStateChange.getTime();
    
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      errorRate: this.requestCount > 0 ? this.failureCount / this.requestCount : 0,
      timeSinceLastFailure: this.lastFailureTime 
        ? now.getTime() - this.lastFailureTime.getTime() 
        : undefined,
      timeUntilNextAttempt: this.nextAttemptTime 
        ? Math.max(0, this.nextAttemptTime.getTime() - now.getTime())
        : undefined,
      uptime
    };
  }

  /**
   * Verifica se o circuito está saudável
   */
  isHealthy(): boolean {
    const stats = this.getStats();
    
    // Considera saudável se:
    // - Estado é CLOSED
    // - Taxa de erro está abaixo do esperado
    // - Não há falhas recentes (últimos 30 segundos)
    const recentFailureThreshold = 30000; // 30 segundos
    const hasRecentFailures = stats.timeSinceLastFailure !== undefined && 
                             stats.timeSinceLastFailure < recentFailureThreshold;

    return stats.state === CircuitBreakerState.CLOSED && 
           stats.errorRate <= this.config.expectedErrorRate &&
           !hasRecentFailures;
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Atualiza configuração
   */
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Circuit breaker configuration updated', newConfig);
  }
}

/**
 * Factory para criar circuit breakers com configurações pré-definidas
 */
export class CircuitBreakerFactory {
  /**
   * Cria circuit breaker para APIs externas
   */
  static forExternalAPI(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000,     // 30 segundos
      monitoringPeriod: 120000,   // 2 minutos
      expectedErrorRate: 0.05,    // 5%
      minimumRequests: 5
    });
  }

  /**
   * Cria circuit breaker para banco de dados
   */
  static forDatabase(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 60000,     // 1 minuto
      monitoringPeriod: 300000,   // 5 minutos
      expectedErrorRate: 0.02,    // 2%
      minimumRequests: 10
    });
  }

  /**
   * Cria circuit breaker para serviços críticos
   */
  static forCriticalService(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 2,
      recoveryTimeout: 120000,    // 2 minutos
      monitoringPeriod: 600000,   // 10 minutos
      expectedErrorRate: 0.01,    // 1%
      minimumRequests: 20
    });
  }

  /**
   * Cria circuit breaker para testes
   */
  static forTesting(): CircuitBreaker {
    return new CircuitBreaker({
      failureThreshold: 2,
      recoveryTimeout: 1000,      // 1 segundo
      monitoringPeriod: 5000,     // 5 segundos
      expectedErrorRate: 0.5,     // 50%
      minimumRequests: 2
    });
  }
}