/**
 * Recovery System - Sistema Integrado de Recuperação Automática
 * Coordena RecoveryManager, CircuitBreaker, RetryManager e FallbackManager
 */

import { RecoveryManager } from './RecoveryManager.js';
import { CircuitBreaker, CircuitBreakerFactory } from './CircuitBreaker.js';
import { RetryManager } from './RetryManager.js';
import { FallbackManager } from './FallbackManager.js';
import { ServiceManager } from './ServiceWrapper.js';
import {
  ErrorType,
  ProcessedError,
  RecoveryResult,
  ErrorHandlerConfig
} from '../types/errorTypes.js';

export interface RecoverySystemConfig {
  enableCircuitBreaker: boolean;
  enableRetry: boolean;
  enableFallback: boolean;
  enableServiceWrapper: boolean;
  globalTimeout: number;
  maxConcurrentRecoveries: number;
}

export class RecoverySystem {
  private recoveryManager: RecoveryManager;
  private retryManager: RetryManager;
  private fallbackManager: FallbackManager;
  private serviceManager: ServiceManager;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private config: RecoverySystemConfig;
  private activeRecoveries: Set<string> = new Set();

  constructor(config: Partial<RecoverySystemConfig> = {}) {
    this.config = {
      enableCircuitBreaker: true,
      enableRetry: true,
      enableFallback: true,
      enableServiceWrapper: true,
      globalTimeout: 30000,
      maxConcurrentRecoveries: 10,
      ...config
    };

    this.initializeComponents();
    this.setupIntegrations();
  }

  /**
   * Inicializa todos os componentes do sistema
   */
  private initializeComponents(): void {
    this.recoveryManager = new RecoveryManager();
    this.retryManager = new RetryManager();
    this.fallbackManager = new FallbackManager();
    this.serviceManager = new ServiceManager();

    console.log('Recovery System components initialized');
  }

  /**
   * Configura integrações entre componentes
   */
  private setupIntegrations(): void {
    // Registra circuit breakers para serviços críticos
    if (this.config.enableCircuitBreaker) {
      this.circuitBreakers.set('firebase-auth', CircuitBreakerFactory.forCriticalService());
      this.circuitBreakers.set('firebase-db', CircuitBreakerFactory.forDatabase());
      this.circuitBreakers.set('external-api', CircuitBreakerFactory.forExternalAPI());
    }

    // Registra serviços no ServiceManager
    if (this.config.enableServiceWrapper) {
      this.serviceManager.registerService({
        name: 'firebase-auth',
        type: 'critical-service'
      });

      this.serviceManager.registerService({
        name: 'firebase-db',
        type: 'database'
      });

      this.serviceManager.registerService({
        name: 'external-api',
        type: 'external-api'
      });
    }

    console.log('Recovery System integrations configured');
  }

  /**
   * Executa recuperação completa para um erro
   */
  async executeFullRecovery(error: ProcessedError): Promise<RecoveryResult> {
    const recoveryId = `recovery_${error.id}_${Date.now()}`;
    
    // Verifica limite de recuperações concorrentes
    if (this.activeRecoveries.size >= this.config.maxConcurrentRecoveries) {
      console.warn('Max concurrent recoveries reached, queuing recovery');
      await this.waitForRecoverySlot();
    }

    this.activeRecoveries.add(recoveryId);

    try {
      console.log(`Starting full recovery for error ${error.id}`);

      // 1. Tenta recuperação via RecoveryManager
      if (this.config.enableRetry) {
        const recoveryResult = await this.recoveryManager.executeRecovery(error);
        
        if (recoveryResult.success) {
          console.log(`Recovery successful for error ${error.id}`);
          return recoveryResult;
        }

        if (!recoveryResult.fallbackRequired) {
          return recoveryResult;
        }
      }

      // 2. Se recuperação falhou, executa fallback
      if (this.config.enableFallback) {
        console.log(`Executing fallback for error ${error.id}`);
        await this.fallbackManager.executeFallback(error);
        
        return {
          success: true,
          message: 'Fallback executed successfully',
          data: null
        };
      }

      // 3. Se nenhuma recuperação foi possível
      return {
        success: false,
        message: 'No recovery strategy available',
        fallbackRequired: false
      };

    } finally {
      this.activeRecoveries.delete(recoveryId);
    }
  }

  /**
   * Executa operação com proteção completa
   */
  async executeWithProtection<T>(
    operation: () => Promise<T>,
    context: {
      serviceName?: string;
      errorType?: ErrorType;
      enableCircuitBreaker?: boolean;
      enableRetry?: boolean;
      enableFallback?: boolean;
      fallbackData?: T;
    } = {}
  ): Promise<T> {
    const {
      serviceName = 'default',
      errorType = ErrorType.UNKNOWN,
      enableCircuitBreaker = this.config.enableCircuitBreaker,
      enableRetry = this.config.enableRetry,
      enableFallback = this.config.enableFallback,
      fallbackData
    } = context;

    let finalOperation = operation;

    // 1. Aplica Circuit Breaker se habilitado
    if (enableCircuitBreaker) {
      const circuitBreaker = this.getOrCreateCircuitBreaker(serviceName);
      const originalOperation = finalOperation;
      finalOperation = () => circuitBreaker.execute(originalOperation);
    }

    // 2. Aplica Retry se habilitado
    if (enableRetry) {
      const originalOperation = finalOperation;
      finalOperation = async () => {
        const result = await this.retryManager.executeWithRetry(
          originalOperation,
          errorType
        );
        
        if (result.success) {
          return result.result!;
        } else {
          throw result.error!;
        }
      };
    }

    // 3. Executa com fallback se habilitado
    if (enableFallback) {
      try {
        return await finalOperation();
      } catch (error) {
        console.log(`Operation failed, trying fallback for service ${serviceName}`);
        
        const fallbackResult = await this.fallbackManager.getDataWithFallback(
          `${serviceName}_${Date.now()}`,
          finalOperation,
          fallbackData
        );

        if (fallbackResult.success) {
          return fallbackResult.data!;
        } else {
          throw error;
        }
      }
    } else {
      return await finalOperation();
    }
  }

  /**
   * Obtém ou cria circuit breaker para um serviço
   */
  private getOrCreateCircuitBreaker(serviceName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, CircuitBreakerFactory.forExternalAPI());
    }
    return this.circuitBreakers.get(serviceName)!;
  }

  /**
   * Aguarda slot disponível para recuperação
   */
  private async waitForRecoverySlot(): Promise<void> {
    return new Promise((resolve) => {
      const checkSlot = () => {
        if (this.activeRecoveries.size < this.config.maxConcurrentRecoveries) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
  }

  /**
   * Obtém status de saúde do sistema
   */
  getSystemHealth(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      circuitBreakers: Array<{
        name: string;
        state: string;
        healthy: boolean;
      }>;
      services: Array<{
        name: string;
        healthy: boolean;
        metrics: any;
      }>;
      fallback: {
        offlineMode: boolean;
        cacheStats: any;
      };
      recovery: {
        activeRecoveries: number;
        totalAttempts: number;
      };
    };
  } {
    // Verifica circuit breakers
    const circuitBreakerHealth = Array.from(this.circuitBreakers.entries()).map(([name, cb]) => ({
      name,
      state: cb.getStats().state,
      healthy: cb.isHealthy()
    }));

    // Verifica serviços
    const serviceHealth = this.serviceManager.getHealthStatus();

    // Verifica fallback
    const fallbackHealth = {
      offlineMode: this.fallbackManager.isOfflineMode(),
      cacheStats: this.fallbackManager.getCacheStats()
    };

    // Verifica recovery
    const recoveryHealth = {
      activeRecoveries: this.activeRecoveries.size,
      totalAttempts: this.recoveryManager.getRecoveryStats().totalAttempts
    };

    // Determina saúde geral
    const healthyCircuitBreakers = circuitBreakerHealth.filter(cb => cb.healthy).length;
    const totalCircuitBreakers = circuitBreakerHealth.length;
    const circuitBreakerHealthRatio = totalCircuitBreakers > 0 ? healthyCircuitBreakers / totalCircuitBreakers : 1;

    const serviceHealthRatio = serviceHealth.services.length > 0 
      ? serviceHealth.services.filter(s => s.healthy).length / serviceHealth.services.length 
      : 1;

    const overallHealthRatio = (circuitBreakerHealthRatio + serviceHealthRatio) / 2;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (overallHealthRatio >= 0.8) {
      overall = 'healthy';
    } else if (overallHealthRatio >= 0.5) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return {
      overall,
      components: {
        circuitBreakers: circuitBreakerHealth,
        services: serviceHealth.services,
        fallback: fallbackHealth,
        recovery: recoveryHealth
      }
    };
  }

  /**
   * Reseta todo o sistema
   */
  reset(): void {
    this.circuitBreakers.forEach(cb => cb.reset());
    this.fallbackManager.clearCache();
    this.serviceManager.resetAll();
    this.activeRecoveries.clear();
    
    console.log('Recovery System reset completed');
  }

  /**
   * Atualiza configuração do sistema
   */
  updateConfig(newConfig: Partial<RecoverySystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Recovery System configuration updated', newConfig);
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): RecoverySystemConfig {
    return { ...this.config };
  }

  /**
   * Obtém estatísticas completas do sistema
   */
  getSystemStats(): {
    recoveryManager: any;
    retryManager: any;
    fallbackManager: any;
    serviceManager: any;
    circuitBreakers: Array<{
      name: string;
      stats: any;
    }>;
    activeRecoveries: number;
  } {
    return {
      recoveryManager: this.recoveryManager.getRecoveryStats(),
      retryManager: this.retryManager.getRetryStats(),
      fallbackManager: this.fallbackManager.getCacheStats(),
      serviceManager: this.serviceManager.getAllMetrics(),
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([name, cb]) => ({
        name,
        stats: cb.getStats()
      })),
      activeRecoveries: this.activeRecoveries.size
    };
  }
}

// Singleton instance
export const recoverySystem = new RecoverySystem();