import { 
  SystemMetrics, 
  ComponentMetrics, 
  MetricTrendData, 
  Alert, 
  TimePeriod,
  MonitoringDashboard as IMonitoringDashboard 
} from '../types/monitoringTypes';
import { MetricsCollector } from './MetricsCollector';
import { AlertManager } from './AlertManager';

export class MonitoringDashboard implements IMonitoringDashboard {
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;

  constructor(metricsCollector: MetricsCollector, alertManager: AlertManager) {
    this.metricsCollector = metricsCollector;
    this.alertManager = alertManager;
  }

  // Get system overview
  async getSystemOverview(): Promise<SystemMetrics> {
    return await this.metricsCollector.getSystemMetrics();
  }

  // Get component-specific metrics
  async getComponentMetrics(component: string, period: TimePeriod): Promise<ComponentMetrics> {
    return await this.metricsCollector.getComponentMetrics(component, period);
  }

  // Get error trends over time
  async getErrorTrends(period: TimePeriod): Promise<MetricTrendData[]> {
    const components = ['frontend', 'backend', 'firebase', 'auth'];
    const trends: MetricTrendData[] = [];

    for (const component of components) {
      const aggregations = await this.metricsCollector.getAggregatedMetrics(
        component, 
        'error_count', 
        period, 
        'sum' as any
      );

      for (const agg of aggregations) {
        trends.push({
          timestamp: agg.timestamp,
          value: agg.value,
          component
        });
      }
    }

    return trends.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Get performance trends over time
  async getPerformanceTrends(period: TimePeriod): Promise<MetricTrendData[]> {
    const components = ['frontend', 'backend', 'firebase'];
    const trends: MetricTrendData[] = [];

    for (const component of components) {
      const aggregations = await this.metricsCollector.getAggregatedMetrics(
        component, 
        'response_time', 
        period, 
        'average' as any
      );

      for (const agg of aggregations) {
        trends.push({
          timestamp: agg.timestamp,
          value: agg.value,
          component
        });
      }
    }

    return trends.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // Get alert history
  async getAlertHistory(period: TimePeriod): Promise<Alert[]> {
    const allAlerts = await this.alertManager.getAllAlerts();
    const cutoffTime = this.getCutoffTime(period);

    return allAlerts
      .filter(alert => alert.timestamp >= cutoffTime)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Get real-time dashboard data
  async getDashboardData(period: TimePeriod = TimePeriod.LAST_HOUR) {
    const [
      systemOverview,
      errorTrends,
      performanceTrends,
      alertHistory,
      activeAlerts
    ] = await Promise.all([
      this.getSystemOverview(),
      this.getErrorTrends(period),
      this.getPerformanceTrends(period),
      this.getAlertHistory(period),
      this.alertManager.getActiveAlerts()
    ]);

    return {
      systemOverview,
      errorTrends,
      performanceTrends,
      alertHistory,
      activeAlerts,
      timestamp: new Date()
    };
  }

  // Get component health summary
  async getComponentHealthSummary() {
    const systemMetrics = await this.getSystemOverview();
    
    return {
      totalComponents: systemMetrics.components.length,
      healthyComponents: systemMetrics.components.filter(c => c.status === 'healthy').length,
      degradedComponents: systemMetrics.components.filter(c => c.status === 'degraded').length,
      unhealthyComponents: systemMetrics.components.filter(c => c.status === 'unhealthy').length,
      overallHealth: systemMetrics.overallHealth
    };
  }

  // Get error distribution by component
  async getErrorDistribution(period: TimePeriod) {
    const components = ['frontend', 'backend', 'firebase', 'auth'];
    const distribution: { component: string; errorCount: number; percentage: number }[] = [];
    let totalErrors = 0;

    for (const component of components) {
      const aggregations = await this.metricsCollector.getAggregatedMetrics(
        component, 
        'error_count', 
        period, 
        'sum' as any
      );
      
      const errorCount = aggregations.reduce((sum, agg) => sum + agg.value, 0);
      distribution.push({ component, errorCount, percentage: 0 });
      totalErrors += errorCount;
    }

    // Calculate percentages
    distribution.forEach(item => {
      item.percentage = totalErrors > 0 ? (item.errorCount / totalErrors) * 100 : 0;
    });

    return distribution;
  }

  // Get performance metrics summary
  async getPerformanceSummary(period: TimePeriod) {
    const systemMetrics = await this.getSystemOverview();
    
    const performanceData = {
      averageResponseTime: systemMetrics.averageResponseTime,
      systemAvailability: systemMetrics.systemAvailability,
      totalErrors: systemMetrics.totalErrors,
      activeUsers: systemMetrics.activeUsers,
      components: systemMetrics.components.map(c => ({
        name: c.component,
        responseTime: c.responseTime,
        availability: c.availability,
        errorRate: c.errorRate,
        status: c.status
      }))
    };

    return performanceData;
  }

  // Get alert statistics
  async getAlertStatistics(period: TimePeriod) {
    const alerts = await this.getAlertHistory(period);
    
    const stats = {
      totalAlerts: alerts.length,
      resolvedAlerts: alerts.filter(a => a.resolved).length,
      activeAlerts: alerts.filter(a => !a.resolved).length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
      highAlerts: alerts.filter(a => a.severity === 'high').length,
      mediumAlerts: alerts.filter(a => a.severity === 'medium').length,
      lowAlerts: alerts.filter(a => a.severity === 'low').length,
      averageResolutionTime: this.calculateAverageResolutionTime(alerts.filter(a => a.resolved))
    };

    return stats;
  }

  // Get system health score
  async getSystemHealthScore(): Promise<number> {
    const systemMetrics = await this.getSystemOverview();
    return systemMetrics.overallHealth;
  }

  // Get uptime statistics
  async getUptimeStatistics(period: TimePeriod) {
    const components = ['frontend', 'backend', 'firebase'];
    const uptimeStats: { component: string; uptime: number; downtime: number }[] = [];

    for (const component of components) {
      const metrics = await this.metricsCollector.getComponentMetrics(component, period);
      const uptime = metrics.availability;
      const downtime = 100 - uptime;
      
      uptimeStats.push({
        component,
        uptime,
        downtime
      });
    }

    return uptimeStats;
  }

  private getCutoffTime(period: TimePeriod): Date {
    const now = new Date();
    
    switch (period) {
      case TimePeriod.LAST_HOUR:
        return new Date(now.getTime() - 60 * 60 * 1000);
      case TimePeriod.LAST_DAY:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case TimePeriod.LAST_WEEK:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case TimePeriod.LAST_MONTH:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 60 * 60 * 1000);
    }
  }

  private calculateAverageResolutionTime(resolvedAlerts: Alert[]): number {
    if (resolvedAlerts.length === 0) return 0;

    const totalResolutionTime = resolvedAlerts.reduce((sum, alert) => {
      if (alert.resolvedAt) {
        return sum + (alert.resolvedAt.getTime() - alert.timestamp.getTime());
      }
      return sum;
    }, 0);

    return totalResolutionTime / resolvedAlerts.length / 1000 / 60; // Return in minutes
  }
}