/**
 * Recovery Manager - Coordenador de Estratégias de Recuperação
 * Gerencia execução de estratégias de recuperação e fallbacks
 */

import {
  ErrorType,
  ProcessedError,
  RecoveryStrategy,
  RecoveryResult,
  IRecoveryManager,
  FallbackHandler
} from '../types/errorTypes.js';

export class RecoveryManager implements IRecoveryManager {
  private strategies: Map<ErrorType, RecoveryStrategy[]> = new Map();
  private fallbackHandlers: FallbackHandler[] = [];
  private recoveryAttempts: Map<string, number> = new Map();
  private maxGlobalRetries: number;

  constructor(maxGlobalRetries: number = 5) {
    this.maxGlobalRetries = maxGlobalRetries;
    this.initializeStrategies();
  }

  /**
   * Inicializa as estratégias padrão para cada tipo de erro
   */
  private initializeStrategies(): void {
    // Inicializa mapas vazios para cada tipo de erro
    Object.values(ErrorType).forEach(errorType => {
      this.strategies.set(errorType, []);
    });
  }

  /**
   * Registra uma estratégia de recuperação para um tipo de erro
   */
  registerStrategy(errorType: ErrorType, strategy: RecoveryStrategy): void {
    const strategies = this.strategies.get(errorType) || [];
    
    // Verifica se a estratégia já está registrada
    const existingStrategy = strategies.find(s => s.name === strategy.name);
    if (existingStrategy) {
      console.warn(`Strategy ${strategy.name} already registered for ${errorType}`);
      return;
    }

    strategies.push(strategy);
    this.strategies.set(errorType, strategies);
    
    console.log(`Recovery strategy ${strategy.name} registered for ${errorType}`);
  }

  /**
   * Registra um handler de fallback
   */
  registerFallbackHandler(handler: FallbackHandler): void {
    const existingHandler = this.fallbackHandlers.find(h => h.name === handler.name);
    if (existingHandler) {
      console.warn(`Fallback handler ${handler.name} already registered`);
      return;
    }

    this.fallbackHandlers.push(handler);
    console.log(`Fallback handler ${handler.name} registered`);
  }

  /**
   * Executa recuperação para um erro específico
   */
  async executeRecovery(error: ProcessedError): Promise<RecoveryResult> {
    const errorKey = this.generateErrorKey(error);
    const currentAttempts = this.recoveryAttempts.get(errorKey) || 0;

    // Verifica se excedeu o limite global de tentativas
    if (currentAttempts >= this.maxGlobalRetries) {
      console.warn(`Max global retries exceeded for error ${error.id}`);
      return {
        success: false,
        message: 'Maximum global retry attempts exceeded',
        fallbackRequired: true
      };
    }

    // Incrementa contador de tentativas
    this.recoveryAttempts.set(errorKey, currentAttempts + 1);

    // Busca estratégias para o tipo de erro
    const strategies = this.strategies.get(error.type) || [];
    
    if (strategies.length === 0) {
      console.warn(`No recovery strategies found for error type ${error.type}`);
      return {
        success: false,
        message: `No recovery strategies available for ${error.type}`,
        fallbackRequired: true
      };
    }

    // Tenta cada estratégia em ordem de prioridade
    for (const strategy of strategies) {
      if (!strategy.canHandle(error)) {
        continue;
      }

      try {
        console.log(`Attempting recovery with strategy: ${strategy.name}`);
        const result = await this.executeStrategyWithTimeout(strategy, error);

        if (result.success) {
          // Reset contador em caso de sucesso
          this.recoveryAttempts.delete(errorKey);
          console.log(`Recovery successful with strategy: ${strategy.name}`);
          return result;
        } else {
          console.warn(`Recovery failed with strategy: ${strategy.name} - ${result.message}`);
          
          // Se a estratégia indica que fallback é necessário, para aqui
          if (result.fallbackRequired) {
            break;
          }
        }
      } catch (strategyError) {
        const errorMessage = strategyError instanceof Error ? strategyError.message : String(strategyError);
        console.error(`Strategy ${strategy.name} threw error: ${errorMessage}`);
        
        // Continua para próxima estratégia se esta falhar
        continue;
      }
    }

    // Se chegou aqui, todas as estratégias falharam
    return {
      success: false,
      message: 'All recovery strategies failed',
      fallbackRequired: true
    };
  }

  /**
   * Executa estratégia com timeout para evitar travamentos
   */
  private async executeStrategyWithTimeout(
    strategy: RecoveryStrategy, 
    error: ProcessedError,
    timeoutMs: number = 30000
  ): Promise<RecoveryResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Strategy ${strategy.name} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      strategy.execute(error)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timeout);
          reject(err);
        });
    });
  }

  /**
   * Executa fallback quando recuperação falha
   */
  async executeFallback(error: ProcessedError): Promise<void> {
    console.log(`Executing fallback for error ${error.id}`);

    // Busca handler de fallback apropriado
    for (const handler of this.fallbackHandlers) {
      if (handler.canHandle(error)) {
        try {
          await handler.execute(error);
          console.log(`Fallback executed successfully with handler: ${handler.name}`);
          return;
        } catch (fallbackError) {
          const errorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          console.error(`Fallback handler ${handler.name} failed: ${errorMessage}`);
          continue;
        }
      }
    }

    // Se nenhum handler específico foi encontrado, executa fallback genérico
    await this.executeGenericFallback(error);
  }

  /**
   * Executa fallback genérico quando nenhum handler específico está disponível
   */
  private async executeGenericFallback(error: ProcessedError): Promise<void> {
    console.log(`Executing generic fallback for error ${error.id}`);
    
    // Fallback genérico baseado no tipo de erro
    switch (error.type) {
      case ErrorType.NETWORK:
        // Para erros de rede, pode tentar cache local ou modo offline
        console.log('Network error fallback: switching to cached data');
        break;
        
      case ErrorType.AUTHENTICATION:
        // Para erros de auth, redireciona para login
        console.log('Auth error fallback: redirecting to login');
        break;
        
      case ErrorType.VALIDATION:
        // Para erros de validação, mantém dados do formulário
        console.log('Validation error fallback: preserving form data');
        break;
        
      default:
        // Fallback genérico
        console.log('Generic fallback: showing error message to user');
        break;
    }
  }

  /**
   * Obtém estratégias registradas para um tipo de erro
   */
  getRegisteredStrategies(errorType: ErrorType): RecoveryStrategy[] {
    return [...(this.strategies.get(errorType) || [])];
  }

  /**
   * Remove estratégias registradas
   */
  clearStrategies(errorType?: ErrorType): void {
    if (errorType) {
      this.strategies.set(errorType, []);
      console.log(`Cleared strategies for ${errorType}`);
    } else {
      this.strategies.clear();
      this.initializeStrategies();
      console.log('Cleared all strategies');
    }
  }

  /**
   * Remove handlers de fallback
   */
  clearFallbackHandlers(): void {
    this.fallbackHandlers = [];
    console.log('Cleared all fallback handlers');
  }

  /**
   * Obtém estatísticas de recuperação
   */
  getRecoveryStats(): {
    totalAttempts: number;
    activeErrors: number;
    registeredStrategies: number;
    registeredFallbacks: number;
  } {
    const totalAttempts = Array.from(this.recoveryAttempts.values())
      .reduce((sum, attempts) => sum + attempts, 0);
    
    const registeredStrategies = Array.from(this.strategies.values())
      .reduce((sum, strategies) => sum + strategies.length, 0);

    return {
      totalAttempts,
      activeErrors: this.recoveryAttempts.size,
      registeredStrategies,
      registeredFallbacks: this.fallbackHandlers.length
    };
  }

  /**
   * Limpa tentativas de recuperação antigas
   */
  cleanupOldAttempts(maxAgeMs: number = 300000): void { // 5 minutos por padrão
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key] of this.recoveryAttempts) {
      // Extrai timestamp da chave (formato: errorType_component_action_timestamp)
      const parts = key.split('_');
      const timestamp = parseInt(parts[parts.length - 1]);
      
      if (now - timestamp > maxAgeMs) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.recoveryAttempts.delete(key);
    });

    if (keysToDelete.length > 0) {
      console.log(`Cleaned up ${keysToDelete.length} old recovery attempts`);
    }
  }

  /**
   * Gera chave única para rastreamento de tentativas de recuperação
   */
  private generateErrorKey(error: ProcessedError): string {
    return `${error.type}_${error.context.component}_${error.context.action}_${Date.now()}`;
  }

  /**
   * Reseta contador de tentativas para um erro específico
   */
  resetRecoveryAttempts(error: ProcessedError): void {
    const errorKey = this.generateErrorKey(error);
    this.recoveryAttempts.delete(errorKey);
    console.log(`Reset recovery attempts for error ${error.id}`);
  }

  /**
   * Verifica se um erro pode ser recuperado baseado no histórico
   */
  canAttemptRecovery(error: ProcessedError): boolean {
    const errorKey = this.generateErrorKey(error);
    const currentAttempts = this.recoveryAttempts.get(errorKey) || 0;
    return currentAttempts < this.maxGlobalRetries;
  }
}