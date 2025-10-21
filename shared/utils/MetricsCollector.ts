import { 
  Metric, 
  MetricAggregation, 
  ComponentMetrics, 
  SystemMetrics,
  TimePeriod, 
  AggregationType, 
  ComponentStatus,
  MetricsStorage,
  MetricsCollectorConfig 
} from '../types/monitoringTypes';

export class MetricsCollector {
  private storage: MetricsStorage;
  private config: MetricsCollectorConfig;
  private collectionTimer?: NodeJS.Timeout;
  private metricsBuffer: Map<string, Metric[]> = new Map();

  constructor(storage: MetricsStorage, config: MetricsCollectorConfig) {
    this.storage = storage;
    this.config = config;
  }

  // Start real-time metrics collection
  startCollection(): void {
    if (!this.config.enableRealTimeCollection) {
      return;
    }

    this.collectionTimer = setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.collectionInterval);

    console.log(`Metrics collection started with ${this.config.collectionInterval}ms interval`);
  }

  // Stop metrics collection
  stopCollection(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = undefined;
      console.log('Metrics collection stopped');
    }
  }

  // Record a single metric
  async recordMetric(
    name: string, 
    value: number, 
    component: string, 
    unit: string = 'count',
    tags?: Record<string, string>
  ): Promise<void> {
    const metric: Metric = {
      id: this.generateMetricId(),
      name,
      value,
      unit,
      component,
      timestamp: new Date(),
      tags
    };

    // Buffer metrics for batch processing
    if (!this.metricsBuffer.has(component)) {
      this.metricsBuffer.set(component, []);
    }
    
    this.metricsBuffer.get(component)!.push(metric);

    // Store immediately for critical metrics
    if (this.isCriticalMetric(name)) {
      await this.storage.store(metric);
    }
  }

  // Record error metric
  async recordError(component: string, errorType: string, severity: string): Promise<void> {
    await this.recordMetric('error_count', 1, component, 'count', {
      error_type: errorType,
      severity
    });
  }

  // Record performance metric
  async recordPerformance(component: string, operation: string, duration: number): Promise<void> {
    await this.recordMetric('response_time', duration, component, 'ms', {
      operation
    });
  }

  // Record availability metric
  async recordAvailability(component: string, isAvailable: boolean): Promise<void> {
    await this.recordMetric('availability', isAvailable ? 1 : 0, component, 'boolean');
  }

  // Get component metrics for a time period
  async getComponentMetrics(component: string, period: TimePeriod): Promise<ComponentMetrics> {
    const metrics = await this.storage.getMetrics(component, period);
    
    const errorMetrics = metrics.filter(m => m.name === 'error_count');
    const performanceMetrics = metrics.filter(m => m.name === 'response_time');
    const availabilityMetrics = metrics.filter(m => m.name === 'availability');

    const errorRate = this.calculateErrorRate(errorMetrics, metrics.length);
    const responseTime = this.calculateAverageResponseTime(performanceMetrics);
    const availability = this.calculateAvailability(availabilityMetrics);
    const throughput = this.calculateThroughput(metrics, period);

    return {
      component,
      errorRate,
      responseTime,
      availability,
      throughput,
      lastUpdated: new Date(),
      status: this.determineComponentStatus(errorRate, responseTime, availability)
    };
  }

  // Get system-wide metrics
  async getSystemMetrics(): Promise<SystemMetrics> {
    const components = this.config.components;
    const componentMetrics: ComponentMetrics[] = [];
    
    let totalErrors = 0;
    let totalResponseTime = 0;
    let totalAvailability = 0;
    let activeComponents = 0;

    for (const component of components) {
      const metrics = await this.getComponentMetrics(component, TimePeriod.LAST_HOUR);
      componentMetrics.push(metrics);
      
      totalErrors += metrics.errorRate;
      totalResponseTime += metrics.responseTime;
      totalAvailability += metrics.availability;
      activeComponents++;
    }

    const overallHealth = this.calculateOverallHealth(componentMetrics);
    const averageResponseTime = activeComponents > 0 ? totalResponseTime / activeComponents : 0;
    const systemAvailability = activeComponents > 0 ? totalAvailability / activeComponents : 0;

    return {
      timestamp: new Date(),
      overallHealth,
      totalErrors,
      averageResponseTime,
      systemAvailability,
      activeUsers: await this.getActiveUserCount(),
      components: componentMetrics
    };
  }

  // Flush buffered metrics to storage
  async flushMetrics(): Promise<void> {
    for (const [component, metrics] of this.metricsBuffer.entries()) {
      for (const metric of metrics) {
        await this.storage.store(metric);
      }
    }
    this.metricsBuffer.clear();
  }

  // Get aggregated metrics
  async getAggregatedMetrics(
    component: string, 
    metricName: string,
    period: TimePeriod, 
    aggregationType: AggregationType
  ): Promise<MetricAggregation[]> {
    return await this.storage.getAggregatedMetrics(component, period, aggregationType);
  }

  // Cleanup old metrics
  async cleanup(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionPeriod);
    await this.storage.cleanup(cutoffDate);
  }

  // Private helper methods
  private async collectSystemMetrics(): Promise<void> {
    try {
      // Collect metrics for each configured component
      for (const component of this.config.components) {
        await this.collectComponentMetrics(component);
      }
      
      // Flush buffered metrics periodically
      await this.flushMetrics();
    } catch (error) {
      console.error('Error collecting system metrics:', error);
    }
  }

  private async collectComponentMetrics(component: string): Promise<void> {
    // This would be implemented based on the specific component
    // For now, we'll record basic availability
    const isHealthy = await this.checkComponentHealth(component);
    await this.recordAvailability(component, isHealthy);
  }

  private async checkComponentHealth(component: string): Promise<boolean> {
    // Basic health check - this would be expanded based on component type
    try {
      switch (component) {
        case 'frontend':
          return true; // Would check if frontend is responding
        case 'backend':
          return true; // Would check API endpoints
        case 'firebase':
          return true; // Would check Firebase connectivity
        default:
          return true;
      }
    } catch {
      return false;
    }
  }

  private calculateErrorRate(errorMetrics: Metric[], totalRequests: number): number {
    if (totalRequests === 0) return 0;
    const errorCount = errorMetrics.reduce((sum, metric) => sum + metric.value, 0);
    return (errorCount / totalRequests) * 100;
  }

  private calculateAverageResponseTime(performanceMetrics: Metric[]): number {
    if (performanceMetrics.length === 0) return 0;
    const totalTime = performanceMetrics.reduce((sum, metric) => sum + metric.value, 0);
    return totalTime / performanceMetrics.length;
  }

  private calculateAvailability(availabilityMetrics: Metric[]): number {
    if (availabilityMetrics.length === 0) return 100;
    const uptime = availabilityMetrics.reduce((sum, metric) => sum + metric.value, 0);
    return (uptime / availabilityMetrics.length) * 100;
  }

  private calculateThroughput(metrics: Metric[], period: TimePeriod): number {
    const periodMs = this.getPeriodInMs(period);
    const requestMetrics = metrics.filter(m => m.name === 'request_count');
    const totalRequests = requestMetrics.reduce((sum, metric) => sum + metric.value, 0);
    return (totalRequests / periodMs) * 1000; // requests per second
  }

  private calculateOverallHealth(componentMetrics: ComponentMetrics[]): number {
    if (componentMetrics.length === 0) return 100;
    
    let healthScore = 0;
    for (const component of componentMetrics) {
      switch (component.status) {
        case ComponentStatus.HEALTHY:
          healthScore += 100;
          break;
        case ComponentStatus.DEGRADED:
          healthScore += 70;
          break;
        case ComponentStatus.UNHEALTHY:
          healthScore += 30;
          break;
        default:
          healthScore += 50;
      }
    }
    
    return healthScore / componentMetrics.length;
  }

  private determineComponentStatus(errorRate: number, responseTime: number, availability: number): ComponentStatus {
    if (availability < 95 || errorRate > 10) {
      return ComponentStatus.UNHEALTHY;
    } else if (availability < 99 || errorRate > 5 || responseTime > 2000) {
      return ComponentStatus.DEGRADED;
    } else {
      return ComponentStatus.HEALTHY;
    }
  }

  private async getActiveUserCount(): Promise<number> {
    // This would integrate with your user session tracking
    // For now, return a placeholder
    return 0;
  }

  private getPeriodInMs(period: TimePeriod): number {
    switch (period) {
      case TimePeriod.LAST_HOUR:
        return 60 * 60 * 1000;
      case TimePeriod.LAST_DAY:
        return 24 * 60 * 60 * 1000;
      case TimePeriod.LAST_WEEK:
        return 7 * 24 * 60 * 60 * 1000;
      case TimePeriod.LAST_MONTH:
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000;
    }
  }

  private isCriticalMetric(name: string): boolean {
    const criticalMetrics = ['error_count', 'system_failure', 'auth_failure'];
    return criticalMetrics.includes(name);
  }

  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}