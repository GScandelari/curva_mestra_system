import { MetricsCollector } from './MetricsCollector';
import { AlertManager } from './AlertManager';
import { MonitoringDashboard } from './MonitoringDashboard';
import { InMemoryMetricsStorage, FirebaseMetricsStorage } from './MetricsStorage';
import { 
  MonitoringConfig, 
  MetricsCollectorConfig,
  SystemMetrics,
  Alert,
  TimePeriod 
} from '../types/monitoringTypes';

export class MonitoringSystem {
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;
  private dashboard: MonitoringDashboard;
  private config: MonitoringConfig;
  private isRunning: boolean = false;

  constructor(config: MonitoringConfig, firestore?: any) {
    this.config = config;
    
    // Initialize storage
    const storage = firestore 
      ? new FirebaseMetricsStorage(firestore)
      : new InMemoryMetricsStorage(config.metrics.maxMetricsPerComponent);

    // Initialize components
    this.metricsCollector = new MetricsCollector(storage, config.metrics);
    this.alertManager = new AlertManager(config.alerts.checkInterval);
    this.dashboard = new MonitoringDashboard(this.metricsCollector, this.alertManager);

    // Set up alert checking
    this.setupAlertMonitoring();
  }

  // Start the monitoring system
  start(): void {
    if (this.isRunning) {
      console.warn('Monitoring system is already running');
      return;
    }

    console.log('Starting monitoring system...');
    
    this.metricsCollector.startCollection();
    this.alertManager.startMonitoring();
    this.isRunning = true;

    console.log('Monitoring system started successfully');
  }

  // Stop the monitoring system
  stop(): void {
    if (!this.isRunning) {
      console.warn('Monitoring system is not running');
      return;
    }

    console.log('Stopping monitoring system...');
    
    this.metricsCollector.stopCollection();
    this.alertManager.stopMonitoring();
    this.isRunning = false;

    console.log('Monitoring system stopped');
  }

  // Record metrics
  async recordError(component: string, errorType: string, severity: string): Promise<void> {
    await this.metricsCollector.recordError(component, errorType, severity);
  }

  async recordPerformance(component: string, operation: string, duration: number): Promise<void> {
    await this.metricsCollector.recordPerformance(component, operation, duration);
  }

  async recordAvailability(component: string, isAvailable: boolean): Promise<void> {
    await this.metricsCollector.recordAvailability(component, isAvailable);
  }

  async recordCustomMetric(
    name: string, 
    value: number, 
    component: string, 
    unit: string = 'count',
    tags?: Record<string, string>
  ): Promise<void> {
    await this.metricsCollector.recordMetric(name, value, component, unit, tags);
  }

  // Get system metrics
  async getSystemMetrics(): Promise<SystemMetrics> {
    return await this.dashboard.getSystemOverview();
  }

  // Get dashboard data
  async getDashboardData(period: TimePeriod = TimePeriod.LAST_HOUR) {
    return await this.dashboard.getDashboardData(period);
  }

  // Get active alerts
  async getActiveAlerts(): Promise<Alert[]> {
    return await this.alertManager.getActiveAlerts();
  }

  // Resolve alert
  async resolveAlert(alertId: string): Promise<void> {
    await this.alertManager.resolveAlert(alertId);
  }

  // Get health score
  async getHealthScore(): Promise<number> {
    return await this.dashboard.getSystemHealthScore();
  }

  // Add custom alert rule
  async addAlertRule(rule: any): Promise<void> {
    await this.alertManager.addRule(rule);
  }

  // Remove alert rule
  async removeAlertRule(ruleId: string): Promise<void> {
    await this.alertManager.removeRule(ruleId);
  }

  // Get monitoring statistics
  async getMonitoringStats() {
    const systemMetrics = await this.getSystemMetrics();
    const activeAlerts = await this.getActiveAlerts();
    
    return {
      systemHealth: systemMetrics.overallHealth,
      totalComponents: systemMetrics.components.length,
      healthyComponents: systemMetrics.components.filter(c => c.status === 'healthy').length,
      activeAlerts: activeAlerts.length,
      criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length,
      averageResponseTime: systemMetrics.averageResponseTime,
      systemAvailability: systemMetrics.systemAvailability,
      isRunning: this.isRunning
    };
  }

  // Cleanup old data
  async cleanup(): Promise<void> {
    await this.metricsCollector.cleanup();
  }

  // Get configuration
  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  // Update configuration
  updateConfig(newConfig: Partial<MonitoringConfig>): void {{
    this.config = { ...this.config, ...newConfig };
    
    // Restart if running to apply new config
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  // Private helper methods
  private setupAlertMonitoring(): void {
    // Set up periodic alert checking
    if (this.config.alerts.enabled) {
      setInterval(async () => {
        try {
          // Get recent metrics for alert checking
          const recentMetrics = await this.getRecentMetricsForAlerts();
          const triggeredAlerts = await this.alertManager.checkRules(recentMetrics);
          
          // Trigger any new alerts
          for (const alert of triggeredAlerts) {
            await this.alertManager.triggerAlert(alert);
          }
        } catch (error) {
          console.error('Error in alert monitoring:', error);
        }
      }, this.config.alerts.checkInterval);
    }
  }

  private async getRecentMetricsForAlerts(): Promise<any[]> {
    // This would get recent metrics from storage for alert evaluation
    // For now, return empty array - would be implemented based on storage
    return [];
  }

  // Static factory method
  static create(config?: Partial<MonitoringConfig>, firestore?: any): MonitoringSystem {
    const defaultConfig: MonitoringConfig = {
      metrics: {
        collectionInterval: 30000, // 30 seconds
        retentionPeriod: 7, // 7 days
        maxMetricsPerComponent: 10000,
        enableRealTimeCollection: true,
        components: ['frontend', 'backend', 'firebase', 'auth']
      },
      alerts: {
        enabled: true,
        checkInterval: 60000, // 1 minute
        defaultCooldown: 15 // 15 minutes
      },
      dashboard: {
        refreshInterval: 30000, // 30 seconds
        maxDataPoints: 100
      }
    };

    const finalConfig = { ...defaultConfig, ...config };
    return new MonitoringSystem(finalConfig, firestore);
  }
}

// Global monitoring instance
let globalMonitoringSystem: MonitoringSystem | null = null;

export const getMonitoringSystem = (config?: Partial<MonitoringConfig>, firestore?: any): MonitoringSystem => {
  if (!globalMonitoringSystem) {
    globalMonitoringSystem = MonitoringSystem.create(config, firestore);
  }
  return globalMonitoringSystem;
};

export const initializeMonitoring = (config?: Partial<MonitoringConfig>, firestore?: any): MonitoringSystem => {
  const system = getMonitoringSystem(config, firestore);
  system.start();
  return system;
};