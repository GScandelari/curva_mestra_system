import { 
  Metric, 
  MetricAggregation, 
  TimePeriod, 
  AggregationType, 
  MetricsStorage 
} from '../types/monitoringTypes';

export class InMemoryMetricsStorage implements MetricsStorage {
  private metrics: Map<string, Metric[]> = new Map();
  private maxMetricsPerComponent: number;

  constructor(maxMetricsPerComponent: number = 10000) {
    this.maxMetricsPerComponent = maxMetricsPerComponent;
  }

  async store(metric: Metric): Promise<void> {
    const key = metric.component;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const componentMetrics = this.metrics.get(key)!;
    componentMetrics.push(metric);
    
    // Maintain size limit per component
    if (componentMetrics.length > this.maxMetricsPerComponent) {
      componentMetrics.shift(); // Remove oldest metric
    }
    
    // Sort by timestamp to maintain order
    componentMetrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getMetrics(component: string, period: TimePeriod): Promise<Metric[]> {
    const componentMetrics = this.metrics.get(component) || [];
    const cutoffTime = this.getCutoffTime(period);
    
    return componentMetrics.filter(metric => metric.timestamp >= cutoffTime);
  }

  async getAggregatedMetrics(
    component: string, 
    period: TimePeriod, 
    aggregationType: AggregationType
  ): Promise<MetricAggregation[]> {
    const metrics = await this.getMetrics(component, period);
    const aggregations: Map<string, MetricAggregation> = new Map();
    
    // Group metrics by name and time bucket
    const bucketSize = this.getBucketSize(period);
    
    for (const metric of metrics) {
      const bucketTime = this.getBucketTime(metric.timestamp, bucketSize);
      const key = `${metric.name}_${bucketTime.getTime()}`;
      
      if (!aggregations.has(key)) {
        aggregations.set(key, {
          component: metric.component,
          metricName: metric.name,
          period,
          aggregationType,
          value: 0,
          count: 0,
          timestamp: bucketTime
        });
      }
      
      const aggregation = aggregations.get(key)!;
      this.updateAggregation(aggregation, metric.value, aggregationType);
    }
    
    return Array.from(aggregations.values()).sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  async cleanup(olderThan: Date): Promise<void> {
    for (const [component, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(metric => metric.timestamp >= olderThan);
      this.metrics.set(component, filteredMetrics);
    }
  }

  // Get all stored metrics (for debugging/testing)
  getAllMetrics(): Map<string, Metric[]> {
    return new Map(this.metrics);
  }

  // Clear all metrics
  clear(): void {
    this.metrics.clear();
  }

  // Get metrics count for a component
  getMetricsCount(component: string): number {
    return this.metrics.get(component)?.length || 0;
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

  private getBucketSize(period: TimePeriod): number {
    // Return bucket size in milliseconds
    switch (period) {
      case TimePeriod.LAST_HOUR:
        return 5 * 60 * 1000; // 5 minutes
      case TimePeriod.LAST_DAY:
        return 60 * 60 * 1000; // 1 hour
      case TimePeriod.LAST_WEEK:
        return 6 * 60 * 60 * 1000; // 6 hours
      case TimePeriod.LAST_MONTH:
        return 24 * 60 * 60 * 1000; // 1 day
      default:
        return 5 * 60 * 1000;
    }
  }

  private getBucketTime(timestamp: Date, bucketSize: number): Date {
    const time = timestamp.getTime();
    const bucketStart = Math.floor(time / bucketSize) * bucketSize;
    return new Date(bucketStart);
  }

  private updateAggregation(
    aggregation: MetricAggregation, 
    value: number, 
    aggregationType: AggregationType
  ): void {
    aggregation.count++;
    
    switch (aggregationType) {
      case AggregationType.SUM:
      case AggregationType.COUNT:
        aggregation.value += value;
        break;
      case AggregationType.AVERAGE:
        aggregation.value = ((aggregation.value * (aggregation.count - 1)) + value) / aggregation.count;
        break;
      case AggregationType.MIN:
        aggregation.value = aggregation.count === 1 ? value : Math.min(aggregation.value, value);
        break;
      case AggregationType.MAX:
        aggregation.value = aggregation.count === 1 ? value : Math.max(aggregation.value, value);
        break;
    }
  }
}

// Firebase-based storage implementation for production use
export class FirebaseMetricsStorage implements MetricsStorage {
  private collectionName: string = 'metrics';

  constructor(private firestore: any) {}

  async store(metric: Metric): Promise<void> {
    try {
      await this.firestore.collection(this.collectionName).add({
        ...metric,
        timestamp: metric.timestamp.toISOString()
      });
    } catch (error) {
      console.error('Error storing metric to Firebase:', error);
      throw error;
    }
  }

  async getMetrics(component: string, period: TimePeriod): Promise<Metric[]> {
    try {
      const cutoffTime = this.getCutoffTime(period);
      const snapshot = await this.firestore
        .collection(this.collectionName)
        .where('component', '==', component)
        .where('timestamp', '>=', cutoffTime.toISOString())
        .orderBy('timestamp', 'asc')
        .get();

      return snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          ...data,
          timestamp: new Date(data.timestamp)
        } as Metric;
      });
    } catch (error) {
      console.error('Error getting metrics from Firebase:', error);
      return [];
    }
  }

  async getAggregatedMetrics(
    component: string, 
    period: TimePeriod, 
    aggregationType: AggregationType
  ): Promise<MetricAggregation[]> {
    // For Firebase, we'd implement server-side aggregation
    // For now, fall back to client-side aggregation
    const metrics = await this.getMetrics(component, period);
    const storage = new InMemoryMetricsStorage();
    
    // Store metrics temporarily for aggregation
    for (const metric of metrics) {
      await storage.store(metric);
    }
    
    return await storage.getAggregatedMetrics(component, period, aggregationType);
  }

  async cleanup(olderThan: Date): Promise<void> {
    try {
      const snapshot = await this.firestore
        .collection(this.collectionName)
        .where('timestamp', '<', olderThan.toISOString())
        .get();

      const batch = this.firestore.batch();
      snapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error) {
      console.error('Error cleaning up metrics in Firebase:', error);
    }
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
}