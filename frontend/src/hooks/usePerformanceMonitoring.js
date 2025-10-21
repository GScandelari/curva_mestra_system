import { useEffect, useRef } from 'react';
import performanceService from '../services/performanceService';

/**
 * Hook para monitoramento de performance de componentes
 */
export const usePerformanceMonitoring = (componentName) => {
  const renderTracker = useRef(null);

  useEffect(() => {
    renderTracker.current = performanceService.measureComponentRender(componentName);
    renderTracker.current.start();

    return () => {
      if (renderTracker.current) {
        renderTracker.current.stop();
      }
    };
  }, [componentName]);

  return {
    startTrace: (traceName) => performanceService.startTrace(traceName),
    stopTrace: (traceName, attributes) => performanceService.stopTrace(traceName, attributes),
    measureFunction: (functionName, asyncFunction, attributes) => 
      performanceService.measureFunction(functionName, asyncFunction, attributes),
    recordMetric: (metricName, value, attributes) => 
      performanceService.recordMetric(metricName, value, attributes)
  };
};

/**
 * Hook para monitoramento de operações de banco de dados
 */
export const useDatabasePerformance = () => {
  const measureDatabaseOperation = async (operation, collection, asyncFunction) => {
    const startTime = Date.now();
    performanceService.startDatabaseOperation(operation, collection);
    
    try {
      const result = await asyncFunction();
      const recordCount = Array.isArray(result) ? result.length : 1;
      performanceService.stopDatabaseOperation(operation, collection, recordCount, true);
      
      // Registrar métrica de tempo de resposta
      performanceService.recordMetric(`db_response_time`, Date.now() - startTime, {
        operation,
        collection,
        record_count: recordCount
      });
      
      return result;
    } catch (error) {
      performanceService.stopDatabaseOperation(operation, collection, 0, false);
      
      // Registrar métrica de erro
      performanceService.recordMetric(`db_error_rate`, 1, {
        operation,
        collection,
        error: error.message
      });
      
      throw error;
    }
  };

  return {
    measureDatabaseOperation
  };
};

/**
 * Hook para monitoramento de chamadas de API
 */
export const useApiPerformance = () => {
  const measureApiCall = async (endpoint, asyncFunction) => {
    const startTime = Date.now();
    performanceService.startApiCall(endpoint);
    
    try {
      const result = await asyncFunction();
      const responseTime = Date.now() - startTime;
      const responseSize = JSON.stringify(result).length;
      
      performanceService.stopApiCall(endpoint, 200, responseSize);
      
      // Registrar métricas
      performanceService.recordMetric(`api_response_time`, responseTime, {
        endpoint,
        response_size: responseSize
      });
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const statusCode = error.code || 500;
      
      performanceService.stopApiCall(endpoint, statusCode, 0);
      
      // Registrar métrica de erro
      performanceService.recordMetric(`api_error_rate`, 1, {
        endpoint,
        status_code: statusCode,
        response_time: responseTime
      });
      
      throw error;
    }
  };

  return {
    measureApiCall
  };
};