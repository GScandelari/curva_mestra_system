import React, { Suspense, lazy, useState, useEffect } from 'react';

/**
 * Componente para carregamento lazy com fallback personalizado
 */
export const LazyLoader = ({ 
  children, 
  fallback = <div className="flex justify-center items-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>,
  error = null 
}) => {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
};

/**
 * HOC para criar componentes lazy com error boundary
 */
export const withLazyLoading = (importFunc, fallbackComponent) => {
  const LazyComponent = lazy(importFunc);
  
  return (props) => (
    <LazyLoader fallback={fallbackComponent}>
      <LazyComponent {...props} />
    </LazyLoader>
  );
};

/**
 * Componente para carregamento lazy de listas grandes
 */
export const LazyList = ({ 
  items, 
  renderItem, 
  itemHeight = 60, 
  containerHeight = 400,
  loadMoreThreshold = 5,
  onLoadMore,
  loading = false,
  hasMore = true
}) => {
  const [visibleItems, setVisibleItems] = useState([]);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);

  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const bufferSize = Math.floor(visibleCount / 2);

  useEffect(() => {
    const start = Math.max(0, startIndex - bufferSize);
    const end = Math.min(items.length, startIndex + visibleCount + bufferSize);
    
    setVisibleItems(items.slice(start, end));
    setEndIndex(end);
  }, [items, startIndex, visibleCount, bufferSize]);

  const handleScroll = (e) => {
    const { scrollTop } = e.target;
    const newStartIndex = Math.floor(scrollTop / itemHeight);
    
    if (newStartIndex !== startIndex) {
      setStartIndex(newStartIndex);
    }

    // Verificar se precisa carregar mais itens
    if (hasMore && !loading && endIndex >= items.length - loadMoreThreshold) {
      onLoadMore && onLoadMore();
    }
  };

  const totalHeight = items.length * itemHeight;
  const offsetY = Math.max(0, (startIndex - bufferSize) * itemHeight);

  return (
    <div 
      className="overflow-auto"
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={item.id || index} style={{ height: itemHeight }}>
              {renderItem(item, startIndex - bufferSize + index)}
            </div>
          ))}
        </div>
        
        {loading && (
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Componente para carregamento lazy de imagens
 */
export const LazyImage = ({ 
  src, 
  alt, 
  className = '', 
  placeholder = null,
  onLoad,
  onError 
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    const element = document.getElementById(`lazy-image-${src}`);
    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [src]);

  const handleLoad = () => {
    setLoaded(true);
    onLoad && onLoad();
  };

  const handleError = () => {
    setError(true);
    onError && onError();
  };

  return (
    <div id={`lazy-image-${src}`} className={`relative ${className}`}>
      {!loaded && !error && (
        placeholder || (
          <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
          </div>
        )
      )}
      
      {inView && !error && (
        <img
          src={src}
          alt={alt}
          className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      
      {error && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <span className="text-gray-500 text-sm">Erro ao carregar imagem</span>
        </div>
      )}
    </div>
  );
};

/**
 * Hook para carregamento lazy de dados
 */
export const useLazyData = (fetchFunction, dependencies = [], options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const {
    pageSize = 20,
    cacheKey = null,
    enabled = true
  } = options;

  const loadData = async (reset = false) => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const currentData = reset ? [] : (data || []);
      const offset = reset ? 0 : currentData.length;
      
      const result = await fetchFunction({ offset, limit: pageSize });
      
      const newData = reset ? result.items : [...currentData, ...result.items];
      setData(newData);
      setHasMore(result.hasMore);

      // Cache se especificado
      if (cacheKey && window.localStorage) {
        localStorage.setItem(cacheKey, JSON.stringify({
          data: newData,
          timestamp: Date.now(),
          hasMore: result.hasMore
        }));
      }

    } catch (err) {
      setError(err.message);
      console.error('Erro no carregamento lazy:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      loadData(false);
    }
  };

  const refresh = () => {
    loadData(true);
  };

  useEffect(() => {
    // Tentar carregar do cache primeiro
    if (cacheKey && window.localStorage) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { data: cachedData, timestamp, hasMore: cachedHasMore } = JSON.parse(cached);
          
          // Usar cache se for recente (5 minutos)
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            setData(cachedData);
            setHasMore(cachedHasMore);
            return;
          }
        } catch (e) {
          console.warn('Erro ao ler cache:', e);
        }
      }
    }

    // Carregar dados se não tiver cache válido
    loadData(true);
  }, dependencies);

  return {
    data: data || [],
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  };
};

/**
 * Componente para seções lazy (carregam quando ficam visíveis)
 */
export const LazySection = ({ children, className = '', threshold = 0.1, rootMargin = '50px' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded) {
          setIsVisible(true);
          setHasLoaded(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    const element = document.getElementById(`lazy-section-${Math.random()}`);
    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin, hasLoaded]);

  return (
    <div id={`lazy-section-${Math.random()}`} className={className}>
      {isVisible ? children : (
        <div className="h-32 bg-gray-50 animate-pulse rounded-lg flex items-center justify-center">
          <span className="text-gray-400">Carregando seção...</span>
        </div>
      )}
    </div>
  );
};

// Componentes lazy para páginas principais
export const LazyProductList = withLazyLoading(
  () => import('../products/ProductList'),
  <div className="p-8 text-center">Carregando lista de produtos...</div>
);

export const LazyProductForm = withLazyLoading(
  () => import('../products/ProductForm'),
  <div className="p-8 text-center">Carregando formulário...</div>
);

export const LazyPatientList = withLazyLoading(
  () => import('../patients/PatientList'),
  <div className="p-8 text-center">Carregando lista de pacientes...</div>
);

export const LazyRequestList = withLazyLoading(
  () => import('../requests/RequestList'),
  <div className="p-8 text-center">Carregando solicitações...</div>
);

export const LazyDashboard = withLazyLoading(
  () => import('../dashboard/Dashboard'),
  <div className="p-8 text-center">Carregando dashboard...</div>
);

export default LazyLoader;