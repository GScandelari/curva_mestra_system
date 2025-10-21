/**
 * Serviço de cache inteligente para otimizar consultas frequentes
 */
class CacheService {
  constructor() {
    this.cache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      totalRequests: 0
    };
    
    // Configurações padrão
    this.defaultTTL = 5 * 60 * 1000; // 5 minutos
    this.maxCacheSize = 100; // Máximo de 100 entradas
    
    // Limpar cache expirado a cada 2 minutos
    setInterval(() => this.cleanExpiredEntries(), 2 * 60 * 1000);
  }

  /**
   * Obtém dados do cache ou executa a função se não existir/expirado
   */
  async get(key, fetchFunction, options = {}) {
    const {
      ttl = this.defaultTTL,
      forceRefresh = false,
      category = 'default'
    } = options;

    this.cacheStats.totalRequests++;

    // Verificar se deve forçar refresh
    if (forceRefresh) {
      this.cache.delete(key);
    }

    // Verificar se existe no cache e não expirou
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      this.cacheStats.hits++;
      console.log(`Cache hit: ${key}`);
      return cached.data;
    }

    // Cache miss - buscar dados
    this.cacheStats.misses++;
    console.log(`Cache miss: ${key}`);

    try {
      const data = await fetchFunction();
      
      // Armazenar no cache
      this.set(key, data, ttl, category);
      
      return data;
    } catch (error) {
      console.error(`Erro ao buscar dados para cache ${key}:`, error);
      
      // Se temos dados expirados, retornar eles como fallback
      if (cached) {
        console.warn(`Usando dados expirados como fallback para ${key}`);
        return cached.data;
      }
      
      throw error;
    }
  }

  /**
   * Define dados no cache
   */
  set(key, data, ttl = this.defaultTTL, category = 'default') {
    // Verificar limite de tamanho do cache
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestEntry();
    }

    const entry = {
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      category,
      accessCount: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    console.log(`Cached: ${key} (TTL: ${ttl}ms, Category: ${category})`);
  }

  /**
   * Remove entrada específica do cache
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`Cache entry deleted: ${key}`);
    }
    return deleted;
  }

  /**
   * Invalida cache por padrão ou categoria
   */
  invalidate(pattern) {
    let deletedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Invalidar por padrão de chave
      if (typeof pattern === 'string' && key.includes(pattern)) {
        this.cache.delete(key);
        deletedCount++;
      }
      // Invalidar por categoria
      else if (typeof pattern === 'object' && pattern.category && entry.category === pattern.category) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    console.log(`Cache invalidated: ${deletedCount} entries removed`);
    return deletedCount;
  }

  /**
   * Limpa entradas expiradas
   */
  cleanExpiredEntries() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cache cleanup: ${cleanedCount} expired entries removed`);
    }
  }

  /**
   * Remove entrada mais antiga quando cache está cheio
   */
  evictOldestEntry() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`Cache eviction: removed oldest entry ${oldestKey}`);
    }
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats() {
    const hitRate = this.cacheStats.totalRequests > 0 
      ? (this.cacheStats.hits / this.cacheStats.totalRequests * 100).toFixed(2)
      : 0;

    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size,
      maxSize: this.maxCacheSize
    };
  }

  /**
   * Limpa todo o cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`Cache cleared: ${size} entries removed`);
    
    // Reset stats
    this.cacheStats = {
      hits: 0,
      misses: 0,
      totalRequests: 0
    };
  }

  /**
   * Pré-carrega dados no cache
   */
  async preload(entries) {
    console.log(`Preloading ${entries.length} cache entries...`);
    
    const promises = entries.map(async ({ key, fetchFunction, ttl, category }) => {
      try {
        const data = await fetchFunction();
        this.set(key, data, ttl, category);
        return { key, success: true };
      } catch (error) {
        console.error(`Failed to preload ${key}:`, error);
        return { key, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    
    console.log(`Cache preload completed: ${successful}/${entries.length} successful`);
    return results;
  }
}

/**
 * Cache específico para produtos
 */
class ProductCacheService extends CacheService {
  constructor() {
    super();
    this.defaultTTL = 10 * 60 * 1000; // 10 minutos para produtos
  }

  /**
   * Cache para lista de produtos com filtros
   */
  async getProducts(filters, fetchFunction) {
    const key = `products_${JSON.stringify(filters)}`;
    return this.get(key, fetchFunction, {
      ttl: this.defaultTTL,
      category: 'products'
    });
  }

  /**
   * Cache para produto específico
   */
  async getProduct(productId, fetchFunction) {
    const key = `product_${productId}`;
    return this.get(key, fetchFunction, {
      ttl: this.defaultTTL,
      category: 'product'
    });
  }

  /**
   * Invalida cache quando produto é modificado
   */
  invalidateProduct(productId) {
    this.delete(`product_${productId}`);
    this.invalidate('products_'); // Invalida listas de produtos
  }

  /**
   * Cache para produtos com estoque baixo
   */
  async getLowStockProducts(fetchFunction) {
    const key = 'products_low_stock';
    return this.get(key, fetchFunction, {
      ttl: 2 * 60 * 1000, // 2 minutos - dados mais críticos
      category: 'alerts'
    });
  }

  /**
   * Cache para produtos vencendo
   */
  async getExpiringProducts(days, fetchFunction) {
    const key = `products_expiring_${days}`;
    return this.get(key, fetchFunction, {
      ttl: 5 * 60 * 1000, // 5 minutos
      category: 'alerts'
    });
  }
}

/**
 * Cache específico para solicitações
 */
class RequestCacheService extends CacheService {
  constructor() {
    super();
    this.defaultTTL = 3 * 60 * 1000; // 3 minutos para solicitações
  }

  /**
   * Cache para lista de solicitações
   */
  async getRequests(filters, fetchFunction) {
    const key = `requests_${JSON.stringify(filters)}`;
    return this.get(key, fetchFunction, {
      ttl: this.defaultTTL,
      category: 'requests'
    });
  }

  /**
   * Cache para solicitações do usuário
   */
  async getUserRequests(userId, fetchFunction) {
    const key = `user_requests_${userId}`;
    return this.get(key, fetchFunction, {
      ttl: this.defaultTTL,
      category: 'user_requests'
    });
  }

  /**
   * Invalida cache quando solicitação é modificada
   */
  invalidateRequest(requestId, userId) {
    this.delete(`request_${requestId}`);
    this.invalidate('requests_'); // Invalida listas
    if (userId) {
      this.delete(`user_requests_${userId}`);
    }
  }
}

/**
 * Cache específico para pacientes
 */
class PatientCacheService extends CacheService {
  constructor() {
    super();
    this.defaultTTL = 15 * 60 * 1000; // 15 minutos para pacientes
  }

  /**
   * Cache para lista de pacientes
   */
  async getPatients(filters, fetchFunction) {
    const key = `patients_${JSON.stringify(filters)}`;
    return this.get(key, fetchFunction, {
      ttl: this.defaultTTL,
      category: 'patients'
    });
  }

  /**
   * Cache para paciente específico
   */
  async getPatient(patientId, fetchFunction) {
    const key = `patient_${patientId}`;
    return this.get(key, fetchFunction, {
      ttl: this.defaultTTL,
      category: 'patient'
    });
  }

  /**
   * Cache para histórico de consumo do paciente
   */
  async getPatientConsumption(patientId, fetchFunction) {
    const key = `patient_consumption_${patientId}`;
    return this.get(key, fetchFunction, {
      ttl: 30 * 60 * 1000, // 30 minutos - dados históricos
      category: 'patient_history'
    });
  }
}

// Instâncias globais dos serviços de cache
export const cacheService = new CacheService();
export const productCache = new ProductCacheService();
export const requestCache = new RequestCacheService();
export const patientCache = new PatientCacheService();

// Hook React para usar cache com invalidação automática
export const useCache = () => {
  const invalidateOnUpdate = (category) => {
    cacheService.invalidate({ category });
  };

  const getCacheStats = () => {
    return {
      general: cacheService.getStats(),
      products: productCache.getStats(),
      requests: requestCache.getStats(),
      patients: patientCache.getStats()
    };
  };

  return {
    invalidateOnUpdate,
    getCacheStats,
    clearAllCaches: () => {
      cacheService.clear();
      productCache.clear();
      requestCache.clear();
      patientCache.clear();
    }
  };
};

export default cacheService;