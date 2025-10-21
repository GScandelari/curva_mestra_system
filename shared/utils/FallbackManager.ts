/**
 * Fallback Manager - Sistema de Fallback e Cache Local
 * Implementa fallbacks locais e degradação graciosa
 */

import {
  ErrorType,
  ProcessedError,
  FallbackHandler
} from '../types/errorTypes.js';

export interface FallbackConfig {
  enableCache: boolean;
  cacheExpiration: number; // em ms
  enableOfflineMode: boolean;
  gracefulDegradation: boolean;
  fallbackData?: any;
  fallbackMessage?: string;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiration: Date;
  key: string;
  source: 'api' | 'fallback' | 'offline';
}

export interface FallbackResult<T> {
  success: boolean;
  data?: T;
  source: 'cache' | 'fallback' | 'offline' | 'error';
  message?: string;
  degraded: boolean;
}

export class FallbackManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private fallbackHandlers: Map<ErrorType, FallbackHandler[]> = new Map();
  private config: FallbackConfig;
  private offlineMode: boolean = false;

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = {
      enableCache: true,
      cacheExpiration: 300000, // 5 minutos
      enableOfflineMode: true,
      gracefulDegradation: true,
      ...config
    };

    this.initializeFallbackHandlers();
    this.setupOfflineDetection();
  }

  /**
   * Inicializa handlers de fallback padrão
   */
  private initializeFallbackHandlers(): void {
    // Handler para erros de autenticação
    this.registerFallbackHandler(ErrorType.AUTHENTICATION, {
      name: 'auth-fallback',
      canHandle: (error) => error.type === ErrorType.AUTHENTICATION,
      execute: async (error) => {
        console.log('Executing auth fallback');
        // Redireciona para login ou usa token cached
        if (typeof window !== 'undefined') {
          const cachedToken = this.getCachedData('auth_token');
          if (cachedToken && !this.isCacheExpired(cachedToken)) {
            console.log('Using cached auth token');
            return;
          }
          
          // Redireciona para login se não há token válido
          console.log('Redirecting to login due to auth error');
          window.location.href = '/login';
        }
      }
    });

    // Handler para erros de rede
    this.registerFallbackHandler(ErrorType.NETWORK, {
      name: 'network-fallback',
      canHandle: (error) => error.type === ErrorType.NETWORK,
      execute: async (error) => {
        console.log('Executing network fallback');
        
        // Ativa modo offline se disponível
        if (this.config.enableOfflineMode) {
          this.setOfflineMode(true);
          console.log('Switched to offline mode due to network error');
        }
        
        // Mostra notificação de problema de rede
        this.showNetworkErrorNotification();
      }
    });

    // Handler para erros de banco de dados
    this.registerFallbackHandler(ErrorType.DATABASE, {
      name: 'database-fallback',
      canHandle: (error) => error.type === ErrorType.DATABASE,
      execute: async (error) => {
        console.log('Executing database fallback');
        
        // Usa dados em cache se disponíveis
        const context = error.context;
        const cacheKey = `${context.component}_${context.action}`;
        const cachedData = this.getCachedData(cacheKey);
        
        if (cachedData) {
          console.log('Using cached data for database fallback');
          return;
        }
        
        // Mostra mensagem de degradação
        this.showDegradationMessage('Alguns dados podem estar desatualizados');
      }
    });

    // Handler para erros de validação
    this.registerFallbackHandler(ErrorType.VALIDATION, {
      name: 'validation-fallback',
      canHandle: (error) => error.type === ErrorType.VALIDATION,
      execute: async (error) => {
        console.log('Executing validation fallback');
        
        // Preserva dados do formulário
        const formData = this.extractFormData(error);
        if (formData) {
          this.cacheData('form_data_' + error.context.component, formData);
        }
        
        // Foca no campo com erro se possível
        this.focusErrorField(error);
      }
    });

    // Handler genérico
    this.registerFallbackHandler(ErrorType.UNKNOWN, {
      name: 'generic-fallback',
      canHandle: () => true,
      execute: async (error) => {
        console.log('Executing generic fallback');
        
        // Tenta usar dados em cache
        const cacheKey = `${error.context.component}_${error.context.action}`;
        const cachedData = this.getCachedData(cacheKey);
        
        if (cachedData) {
          console.log('Using cached data for generic fallback');
          return;
        }
        
        // Mostra mensagem genérica de erro
        this.showGenericErrorMessage(error);
      }
    });
  }

  /**
   * Registra um handler de fallback
   */
  registerFallbackHandler(errorType: ErrorType, handler: FallbackHandler): void {
    const handlers = this.fallbackHandlers.get(errorType) || [];
    handlers.push(handler);
    this.fallbackHandlers.set(errorType, handlers);
    
    console.log(`Fallback handler ${handler.name} registered for ${errorType}`);
  }

  /**
   * Executa fallback para um erro
   */
  async executeFallback(error: ProcessedError): Promise<void> {
    console.log(`Executing fallback for error type: ${error.type}`);
    
    // Busca handlers específicos para o tipo de erro
    const handlers = this.fallbackHandlers.get(error.type) || [];
    
    // Adiciona handlers genéricos se não há específicos
    if (handlers.length === 0) {
      const genericHandlers = this.fallbackHandlers.get(ErrorType.UNKNOWN) || [];
      handlers.push(...genericHandlers);
    }
    
    // Executa handlers em ordem
    for (const handler of handlers) {
      if (handler.canHandle(error)) {
        try {
          await handler.execute(error);
          console.log(`Fallback handler ${handler.name} executed successfully`);
          return;
        } catch (handlerError) {
          const errorMessage = handlerError instanceof Error ? handlerError.message : String(handlerError);
          console.error(`Fallback handler ${handler.name} failed: ${errorMessage}`);
          continue;
        }
      }
    }
    
    console.warn(`No suitable fallback handler found for error type: ${error.type}`);
  }

  /**
   * Obtém dados com fallback automático
   */
  async getDataWithFallback<T>(
    key: string,
    primarySource: () => Promise<T>,
    fallbackData?: T
  ): Promise<FallbackResult<T>> {
    try {
      // Tenta fonte primária
      const data = await primarySource();
      
      // Cache o resultado se bem-sucedido
      if (this.config.enableCache) {
        this.cacheData(key, data);
      }
      
      return {
        success: true,
        data,
        source: 'cache',
        degraded: false
      };
    } catch (error) {
      console.log(`Primary source failed for ${key}, trying fallbacks`);
      
      // Tenta cache primeiro
      if (this.config.enableCache) {
        const cachedData = this.getCachedData<T>(key);
        if (cachedData && !this.isCacheExpired(cachedData)) {
          return {
            success: true,
            data: cachedData.data,
            source: 'cache',
            degraded: true,
            message: 'Dados do cache (podem estar desatualizados)'
          };
        }
      }
      
      // Usa dados de fallback se fornecidos
      if (fallbackData !== undefined) {
        return {
          success: true,
          data: fallbackData,
          source: 'fallback',
          degraded: true,
          message: 'Dados de fallback'
        };
      }
      
      // Se está em modo offline, tenta cache expirado
      if (this.offlineMode) {
        const cachedData = this.getCachedData<T>(key);
        if (cachedData) {
          return {
            success: true,
            data: cachedData.data,
            source: 'offline',
            degraded: true,
            message: 'Dados offline (podem estar muito desatualizados)'
          };
        }
      }
      
      // Nenhum fallback disponível
      return {
        success: false,
        source: 'error',
        degraded: true,
        message: 'Nenhum dado disponível'
      };
    }
  }

  /**
   * Cache dados
   */
  cacheData<T>(key: string, data: T, customExpiration?: number): void {
    if (!this.config.enableCache) return;
    
    const expiration = new Date(Date.now() + (customExpiration || this.config.cacheExpiration));
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date(),
      expiration,
      key,
      source: 'api'
    };
    
    this.cache.set(key, entry);
    console.log(`Data cached for key: ${key}, expires: ${expiration.toISOString()}`);
  }

  /**
   * Obtém dados do cache
   */
  getCachedData<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    return entry as CacheEntry<T>;
  }

  /**
   * Verifica se cache está expirado
   */
  isCacheExpired(entry: CacheEntry<any>): boolean {
    return new Date() > entry.expiration;
  }

  /**
   * Limpa cache expirado
   */
  cleanExpiredCache(): void {
    const now = new Date();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (now > entry.expiration) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`Cleaned ${keysToDelete.length} expired cache entries`);
    }
  }

  /**
   * Limpa todo o cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('Cache cleared');
  }

  /**
   * Define modo offline
   */
  setOfflineMode(offline: boolean): void {
    this.offlineMode = offline;
    console.log(`Offline mode: ${offline ? 'enabled' : 'disabled'}`);
    
    // Notifica mudança de modo
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offlineModeChanged', { 
        detail: { offline } 
      }));
    }
  }

  /**
   * Verifica se está em modo offline
   */
  isOfflineMode(): boolean {
    return this.offlineMode;
  }

  /**
   * Configura detecção de offline
   */
  private setupOfflineDetection(): void {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('online', () => {
      console.log('Network connection restored');
      this.setOfflineMode(false);
    });
    
    window.addEventListener('offline', () => {
      console.log('Network connection lost');
      if (this.config.enableOfflineMode) {
        this.setOfflineMode(true);
      }
    });
  }

  /**
   * Extrai dados do formulário do erro
   */
  private extractFormData(error: ProcessedError): any {
    const additionalData = error.context.additionalData;
    if (additionalData && additionalData.formData) {
      return additionalData.formData;
    }
    return null;
  }

  /**
   * Foca no campo com erro
   */
  private focusErrorField(error: ProcessedError): void {
    if (typeof document === 'undefined') return;
    
    const additionalData = error.context.additionalData;
    if (additionalData && additionalData.fieldName) {
      const field = document.querySelector(`[name="${additionalData.fieldName}"]`) as HTMLElement;
      if (field && field.focus) {
        field.focus();
        console.log(`Focused on error field: ${additionalData.fieldName}`);
      }
    }
  }

  /**
   * Mostra notificação de erro de rede
   */
  private showNetworkErrorNotification(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('showNotification', {
        detail: {
          type: 'warning',
          message: 'Problema de conexão detectado. Usando dados locais.',
          duration: 5000
        }
      }));
    }
  }

  /**
   * Mostra mensagem de degradação
   */
  private showDegradationMessage(message: string): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('showNotification', {
        detail: {
          type: 'info',
          message,
          duration: 3000
        }
      }));
    }
  }

  /**
   * Mostra mensagem genérica de erro
   */
  private showGenericErrorMessage(error: ProcessedError): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('showNotification', {
        detail: {
          type: 'error',
          message: error.userMessage || 'Ocorreu um erro. Tente novamente.',
          duration: 4000
        }
      }));
    }
  }

  /**
   * Obtém estatísticas do cache
   */
  getCacheStats(): {
    totalEntries: number;
    expiredEntries: number;
    cacheSize: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    const now = new Date();
    let expiredCount = 0;
    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;
    
    for (const entry of this.cache.values()) {
      if (now > entry.expiration) {
        expiredCount++;
      }
      
      if (!oldestEntry || entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      
      if (!newestEntry || entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      expiredEntries: expiredCount,
      cacheSize: this.cache.size,
      oldestEntry,
      newestEntry
    };
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): FallbackConfig {
    return { ...this.config };
  }

  /**
   * Atualiza configuração
   */
  updateConfig(newConfig: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Fallback configuration updated', newConfig);
  }

  /**
   * Obtém lista de handlers registrados
   */
  getRegisteredHandlers(): Array<{
    errorType: ErrorType;
    handlers: string[];
  }> {
    return Array.from(this.fallbackHandlers.entries()).map(([errorType, handlers]) => ({
      errorType,
      handlers: handlers.map(h => h.name)
    }));
  }
}

// Singleton instance
export const fallbackManager = new FallbackManager();