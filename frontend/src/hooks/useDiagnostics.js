/**
 * Diagnostics Hook
 * React hook for managing diagnostic operations
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { DiagnosticEngine } from '../../shared/utils/DiagnosticEngine';
import { 
  FirebaseConnectivityCheck,
  ApiHealthCheck,
  EnvironmentConfigCheck,
  PerformanceCheck
} from '../../shared/utils/healthChecks';

export const useDiagnostics = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastReport, setLastReport] = useState(null);
  const [healthSummary, setHealthSummary] = useState(null);
  const [error, setError] = useState(null);
  
  const diagnosticEngineRef = useRef(null);

  // Initialize diagnostic engine
  useEffect(() => {
    const initializeDiagnosticEngine = () => {
      try {
        const engine = new DiagnosticEngine({
          enableRealTimeMonitoring: false,
          monitoringInterval: 60000, // 1 minute
          healthCheckTimeout: 10000, // 10 seconds
          maxRetries: 3
        });

        // Register health checks
        registerHealthChecks(engine);
        
        diagnosticEngineRef.current = engine;
      } catch (error) {
        console.error('Failed to initialize diagnostic engine:', error);
        setError('Falha ao inicializar sistema de diagnóstico');
      }
    };

    initializeDiagnosticEngine();
  }, []);

  // Register health checks with the engine
  const registerHealthChecks = (engine) => {
    try {
      // Firebase connectivity check
      const firebaseConfig = {
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
      };
      
      engine.registerHealthCheck(new FirebaseConnectivityCheck(firebaseConfig));

      // API health check
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      engine.registerHealthCheck(new ApiHealthCheck(
        apiBaseUrl,
        ['/health', '/api/health', '/api/status']
      ));

      // Environment configuration check
      engine.registerHealthCheck(new EnvironmentConfigCheck('development'));

      // Performance check
      engine.registerHealthCheck(new PerformanceCheck());

    } catch (error) {
      console.error('Failed to register health checks:', error);
    }
  };

  // Run diagnostic
  const runDiagnostic = useCallback(async () => {
    if (!diagnosticEngineRef.current || isRunning) {
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const report = await diagnosticEngineRef.current.runFullDiagnostic();
      setLastReport(report);
      
      // Generate health summary
      const summary = await diagnosticEngineRef.current.getSystemHealthSummary();
      setHealthSummary(summary);

    } catch (error) {
      console.error('Diagnostic failed:', error);
      setError(error.message || 'Falha ao executar diagnóstico');
    } finally {
      setIsRunning(false);
    }
  }, [isRunning]);

  // Start real-time monitoring
  const startMonitoring = useCallback(() => {
    if (!diagnosticEngineRef.current || isMonitoring) {
      return;
    }

    try {
      diagnosticEngineRef.current.startRealTimeMonitoring();
      setIsMonitoring(true);
      setError(null);
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      setError('Falha ao iniciar monitoramento');
    }
  }, [isMonitoring]);

  // Stop real-time monitoring
  const stopMonitoring = useCallback(() => {
    if (!diagnosticEngineRef.current || !isMonitoring) {
      return;
    }

    try {
      diagnosticEngineRef.current.stopRealTimeMonitoring();
      setIsMonitoring(false);
    } catch (error) {
      console.error('Failed to stop monitoring:', error);
      setError('Falha ao parar monitoramento');
    }
  }, [isMonitoring]);

  // Run component diagnostic
  const runComponentDiagnostic = useCallback(async (componentName) => {
    if (!diagnosticEngineRef.current || isRunning) {
      return null;
    }

    try {
      const componentReport = await diagnosticEngineRef.current.runComponentDiagnostic(componentName);
      return componentReport;
    } catch (error) {
      console.error(`Component diagnostic failed for ${componentName}:`, error);
      throw error;
    }
  }, [isRunning]);

  // Get health checks
  const getHealthChecks = useCallback(() => {
    if (!diagnosticEngineRef.current) {
      return [];
    }

    return diagnosticEngineRef.current.getHealthChecks();
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Reset diagnostics
  const resetDiagnostics = useCallback(() => {
    setLastReport(null);
    setHealthSummary(null);
    setError(null);
  }, []);

  return {
    // State
    isRunning,
    isMonitoring,
    lastReport,
    healthSummary,
    error,
    
    // Actions
    runDiagnostic,
    startMonitoring,
    stopMonitoring,
    runComponentDiagnostic,
    getHealthChecks,
    clearError,
    resetDiagnostics
  };
};