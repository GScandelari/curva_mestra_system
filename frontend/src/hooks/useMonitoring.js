import { useState, useEffect, useCallback, useRef } from 'react';

export const useMonitoring = (period = 'last_hour', autoRefresh = true) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [healthScore, setHealthScore] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const refreshIntervalRef = useRef(null);

  // Mock monitoring service - in real implementation, this would call actual APIs
  const monitoringService = {
    async getDashboardData(period) {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data generation
      const now = new Date();
      const components = ['frontend', 'backend', 'firebase', 'auth'];
      
      // Generate mock system metrics
      const systemOverview = {
        timestamp: now,
        overallHealth: 85 + Math.random() * 15,
        totalErrors: Math.floor(Math.random() * 10),
        averageResponseTime: 200 + Math.random() * 800,
        systemAvailability: 95 + Math.random() * 5,
        activeUsers: Math.floor(Math.random() * 100),
        components: components.map(component => ({
          component,
          errorRate: Math.random() * 5,
          responseTime: 100 + Math.random() * 500,
          availability: 95 + Math.random() * 5,
          throughput: Math.random() * 10,
          lastUpdated: now,
          status: Math.random() > 0.8 ? 'degraded' : 'healthy'
        }))
      };

      // Generate mock trends data
      const generateTrends = (metricType) => {
        const trends = [];
        const points = period === 'last_hour' ? 12 : period === 'last_day' ? 24 : 7;
        
        for (let i = points; i >= 0; i--) {
          const timestamp = new Date(now.getTime() - i * (period === 'last_hour' ? 5 * 60 * 1000 : 60 * 60 * 1000));
          
          components.forEach(component => {
            trends.push({
              timestamp,
              value: metricType === 'error' ? Math.floor(Math.random() * 5) : 100 + Math.random() * 400,
              component
            });
          });
        }
        
        return trends;
      };

      // Generate mock alerts
      const generateAlerts = (isActive = false) => {
        const alertTypes = ['error_rate', 'response_time', 'availability'];
        const severities = ['low', 'medium', 'high', 'critical'];
        const alerts = [];
        
        const numAlerts = isActive ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 10);
        
        for (let i = 0; i < numAlerts; i++) {
          const alertTime = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
          const resolved = isActive ? false : Math.random() > 0.3;
          
          alerts.push({
            id: `alert_${i}_${Date.now()}`,
            type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
            severity: severities[Math.floor(Math.random() * severities.length)],
            title: `Alert ${i + 1}`,
            message: `Sistema detectou problema no componente ${components[Math.floor(Math.random() * components.length)]}`,
            component: components[Math.floor(Math.random() * components.length)],
            timestamp: alertTime,
            resolved,
            resolvedAt: resolved ? new Date(alertTime.getTime() + Math.random() * 60 * 60 * 1000) : null
          });
        }
        
        return alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      };

      return {
        systemOverview,
        errorTrends: generateTrends('error'),
        performanceTrends: generateTrends('performance'),
        alertHistory: generateAlerts(false),
        activeAlerts: generateAlerts(true),
        timestamp: now
      };
    },

    async getHealthScore() {
      return 85 + Math.random() * 15;
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [data, health] = await Promise.all([
        monitoringService.getDashboardData(period),
        monitoringService.getHealthScore()
      ]);
      
      setDashboardData(data);
      setHealthScore(health);
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados de monitoramento');
      console.error('Error fetching monitoring data:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  const refreshData = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        fetchData();
      }, 30000); // Refresh every 30 seconds
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, fetchData]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  return {
    dashboardData,
    healthScore,
    loading,
    error,
    refreshData
  };
};

// Hook for component-specific monitoring
export const useComponentMonitoring = (component, period = 'last_hour') => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchComponentMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock component metrics
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const now = new Date();
      const mockMetrics = {
        component,
        errorRate: Math.random() * 5,
        responseTime: 100 + Math.random() * 500,
        availability: 95 + Math.random() * 5,
        throughput: Math.random() * 10,
        lastUpdated: now,
        status: Math.random() > 0.8 ? 'degraded' : 'healthy'
      };
      
      setMetrics(mockMetrics);
    } catch (err) {
      setError(err.message || 'Erro ao carregar métricas do componente');
    } finally {
      setLoading(false);
    }
  }, [component, period]);

  useEffect(() => {
    fetchComponentMetrics();
  }, [fetchComponentMetrics]);

  return {
    metrics,
    loading,
    error,
    refresh: fetchComponentMetrics
  };
};

// Hook for alerts management
export const useAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock alerts fetch
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // This would normally call the AlertManager
      const mockAlerts = [];
      setAlerts(mockAlerts);
    } catch (err) {
      setError(err.message || 'Erro ao carregar alertas');
    } finally {
      setLoading(false);
    }
  }, []);

  const resolveAlert = useCallback(async (alertId) => {
    try {
      // Mock alert resolution
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, resolved: true, resolvedAt: new Date() }
          : alert
      ));
    } catch (err) {
      setError(err.message || 'Erro ao resolver alerta');
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return {
    alerts,
    loading,
    error,
    resolveAlert,
    refresh: fetchAlerts
  };
};