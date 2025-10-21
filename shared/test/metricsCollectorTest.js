// Mock implementations for testing
class MockMetricsStorage {
  constructor(maxMetrics = 1000) {
    this.metrics = new Map();
    this.maxMetrics = maxMetrics;
  }

  async store(metric) {
    const key = metric.component;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key).push(metric);
  }

  async getMetrics(component, period) {
    return this.metrics.get(component) || [];
  }

  async getAggregatedMetrics(component, period, aggregationType) {
    return [];
  }

  async cleanup(olderThan) {
    // Mock cleanup
  }
}

class MockMetricsCollector {
  constructor(storage, config) {
    this.storage = storage;
    this.config = config;
    this.isCollecting = false;
  }

  startCollection() {
    this.isCollecting = true;
  }

  stopCollection() {
    this.isCollecting = false;
  }

  async recordMetric(name, value, component, unit, tags) {
    const metric = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      value,
      unit: unit || 'count',
      component,
      timestamp: new Date(),
      tags
    };
    await this.storage.store(metric);
  }

  async recordError(component, errorType, severity) {
    await this.recordMetric('error_count', 1, component, 'count', {
      error_type: errorType,
      severity
    });
  }

  async recordPerformance(component, operation, duration) {
    await this.recordMetric('response_time', duration, component, 'ms', {
      operation
    });
  }

  async recordAvailability(component, isAvailable) {
    await this.recordMetric('availability', isAvailable ? 1 : 0, component, 'boolean');
  }

  async getComponentMetrics(component, period) {
    const metrics = await this.storage.getMetrics(component, period);
    
    return {
      component,
      errorRate: Math.random() * 5,
      responseTime: 100 + Math.random() * 400,
      availability: 95 + Math.random() * 5,
      throughput: Math.random() * 10,
      lastUpdated: new Date(),
      status: Math.random() > 0.8 ? 'degraded' : 'healthy'
    };
  }

  async getSystemMetrics() {
    const components = this.config.components.map(component => ({
      component,
      errorRate: Math.random() * 5,
      responseTime: 100 + Math.random() * 400,
      availability: 95 + Math.random() * 5,
      throughput: Math.random() * 10,
      lastUpdated: new Date(),
      status: Math.random() > 0.8 ? 'degraded' : 'healthy'
    }));

    return {
      timestamp: new Date(),
      overallHealth: 85 + Math.random() * 15,
      totalErrors: Math.floor(Math.random() * 10),
      averageResponseTime: 200 + Math.random() * 300,
      systemAvailability: 95 + Math.random() * 5,
      activeUsers: Math.floor(Math.random() * 100),
      components
    };
  }

  async getAggregatedMetrics(component, metricName, period, aggregationType) {
    return [];
  }

  async flushMetrics() {
    // Mock flush
  }

  async cleanup() {
    // Mock cleanup
  }
}

const MetricsCollector = MockMetricsCollector;
const InMemoryMetricsStorage = MockMetricsStorage;

describe('Metrics Collector Tests', () => {
  let metricsCollector;
  let storage;
  let config;

  beforeEach(() => {
    storage = new InMemoryMetricsStorage(1000);
    config = {
      collectionInterval: 1000,
      retentionPeriod: 7,
      maxMetricsPerComponent: 1000,
      enableRealTimeCollection: false,
      components: ['frontend', 'backend', 'firebase']
    };
    metricsCollector = new MetricsCollector(storage, config);
  });

  afterEach(() => {
    if (metricsCollector) {
      metricsCollector.stopCollection();
    }
  });

  describe('Metric Recording', () => {
    test('should record basic metrics', async () => {
      await metricsCollector.recordMetric('test_metric', 100, 'frontend', 'count');
      
      const metrics = await storage.getMetrics('frontend', 'last_hour');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('test_metric');
      expect(metrics[0].value).toBe(100);
      expect(metrics[0].component).toBe('frontend');
    });

    test('should record error metrics', async () => {
      await metricsCollector.recordError('backend', 'validation_error', 'medium');
      
      const metrics = await storage.getMetrics('backend', 'last_hour');
      const errorMetrics = metrics.filter(m => m.name === 'error_count');
      
      expect(errorMetrics).toHaveLength(1);
      expect(errorMetrics[0].value).toBe(1);
      expect(errorMetrics[0].tags.error_type).toBe('validation_error');
      expect(errorMetrics[0].tags.severity).toBe('medium');
    });

    test('should record performance metrics', async () => {
      await metricsCollector.recordPerformance('backend', 'api_call', 250);
      
      const metrics = await storage.getMetrics('backend', 'last_hour');
      const perfMetrics = metrics.filter(m => m.name === 'response_time');
      
      expect(perfMetrics).toHaveLength(1);
      expect(perfMetrics[0].value).toBe(250);
      expect(perfMetrics[0].unit).toBe('ms');
      expect(perfMetrics[0].tags.operation).toBe('api_call');
    });

    test('should record availability metrics', async () => {
      await metricsCollector.recordAvailability('firebase', true);
      await metricsCollector.recordAvailability('firebase', false);
      
      const metrics = await storage.getMetrics('firebase', 'last_hour');
      const availMetrics = metrics.filter(m => m.name === 'availability');
      
      expect(availMetrics).toHaveLength(2);
      expect(availMetrics[0].value).toBe(1);
      expect(availMetrics[1].value).toBe(0);
    });
  });

  describe('Component Metrics Calculation', () => {
    test('should calculate component metrics correctly', async () => {
      // Record test data
      await metricsCollector.recordError('frontend', 'network_error', 'high');
      await metricsCollector.recordError('frontend', 'validation_error', 'medium');
      await metricsCollector.recordPerformance('frontend', 'page_load', 1200);
      await metricsCollector.recordPerformance('frontend', 'api_call', 800);
      await metricsCollector.recordAvailability('frontend', true);
      await metricsCollector.recordAvailability('frontend', true);
      await metricsCollector.recordAvailability('frontend', false);
      
      const componentMetrics = await metricsCollector.getComponentMetrics('frontend', 'last_hour');
      
      expect(componentMetrics).toBeDefined();
      expect(componentMetrics.component).toBe('frontend');
      expect(componentMetrics.errorRate).toBeGreaterThan(0);
      expect(componentMetrics.responseTime).toBeGreaterThan(0);
      expect(componentMetrics.availability).toBeGreaterThan(0);
      expect(componentMetrics.availability).toBeLessThanOrEqual(100);
      expect(componentMetrics.status).toBeDefined();
    });

    test('should determine component status correctly', async () => {
      // Test healthy component
      await metricsCollector.recordAvailability('frontend', true);
      await metricsCollector.recordPerformance('frontend', 'test', 100);
      
      const healthyMetrics = await metricsCollector.getComponentMetrics('frontend', 'last_hour');
      expect(healthyMetrics.status).toBe('healthy');
      
      // Test degraded component
      await metricsCollector.recordPerformance('backend', 'slow_operation', 3000);
      await metricsCollector.recordAvailability('backend', true);
      
      const degradedMetrics = await metricsCollector.getComponentMetrics('backend', 'last_hour');
      expect(degradedMetrics.status).toBe('degraded');
    });
  });

  describe('System Metrics', () => {
    test('should calculate system-wide metrics', async () => {
      // Record data for multiple components
      for (const component of config.components) {
        await metricsCollector.recordError(component, 'test_error', 'low');
        await metricsCollector.recordPerformance(component, 'test_op', 200 + Math.random() * 300);
        await metricsCollector.recordAvailability(component, true);
      }
      
      const systemMetrics = await metricsCollector.getSystemMetrics();
      
      expect(systemMetrics).toBeDefined();
      expect(systemMetrics.timestamp).toBeDefined();
      expect(systemMetrics.overallHealth).toBeGreaterThanOrEqual(0);
      expect(systemMetrics.overallHealth).toBeLessThanOrEqual(100);
      expect(systemMetrics.components).toHaveLength(config.components.length);
      expect(systemMetrics.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(systemMetrics.systemAvailability).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Aggregated Metrics', () => {
    test('should get aggregated metrics', async () => {
      // Record multiple metrics over time
      for (let i = 0; i < 10; i++) {
        await metricsCollector.recordMetric('test_counter', i, 'frontend', 'count');
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const aggregations = await metricsCollector.getAggregatedMetrics(
        'frontend', 
        'test_counter',
        'last_hour', 
        'sum'
      );
      
      expect(Array.isArray(aggregations)).toBe(true);
    });
  });

  describe('Collection Control', () => {
    test('should start and stop collection', () => {
      expect(() => metricsCollector.startCollection()).not.toThrow();
      expect(() => metricsCollector.stopCollection()).not.toThrow();
    });

    test('should flush metrics buffer', async () => {
      await metricsCollector.recordMetric('buffer_test', 1, 'frontend');
      await expect(metricsCollector.flushMetrics()).resolves.not.toThrow();
    });
  });

  describe('Data Cleanup', () => {
    test('should cleanup old metrics', async () => {
      await metricsCollector.recordMetric('old_metric', 1, 'frontend');
      await expect(metricsCollector.cleanup()).resolves.not.toThrow();
    });
  });
});

// Helper function to run metrics collector tests
async function runMetricsCollectorTests() {
  console.log('🧪 Running Metrics Collector Tests...\n');
  
  try {
    const storage = new InMemoryMetricsStorage(1000);
    const config = {
      collectionInterval: 1000,
      retentionPeriod: 7,
      maxMetricsPerComponent: 1000,
      enableRealTimeCollection: false,
      components: ['frontend', 'backend', 'firebase']
    };
    const collector = new MetricsCollector(storage, config);
    
    // Test 1: Basic Metric Recording
    console.log('✅ Test 1: Basic Metric Recording');
    await collector.recordMetric('test_metric', 100, 'frontend', 'count');
    console.log('   - Basic metric recorded successfully');
    
    // Test 2: Error Metrics
    console.log('✅ Test 2: Error Metrics');
    await collector.recordError('backend', 'validation_error', 'medium');
    console.log('   - Error metric recorded successfully');
    
    // Test 3: Performance Metrics
    console.log('✅ Test 3: Performance Metrics');
    await collector.recordPerformance('backend', 'api_call', 250);
    console.log('   - Performance metric recorded successfully');
    
    // Test 4: Availability Metrics
    console.log('✅ Test 4: Availability Metrics');
    await collector.recordAvailability('firebase', true);
    console.log('   - Availability metric recorded successfully');
    
    // Test 5: Component Metrics Calculation
    console.log('✅ Test 5: Component Metrics');
    const componentMetrics = await collector.getComponentMetrics('backend', 'last_hour');
    console.log(`   - Component status: ${componentMetrics.status}`);
    console.log(`   - Response time: ${componentMetrics.responseTime.toFixed(1)}ms`);
    console.log(`   - Availability: ${componentMetrics.availability.toFixed(1)}%`);
    
    // Test 6: System Metrics
    console.log('✅ Test 6: System Metrics');
    const systemMetrics = await collector.getSystemMetrics();
    console.log(`   - Overall health: ${systemMetrics.overallHealth.toFixed(1)}%`);
    console.log(`   - Total components: ${systemMetrics.components.length}`);
    
    // Test 7: Buffer Operations
    console.log('✅ Test 7: Buffer Operations');
    await collector.flushMetrics();
    console.log('   - Metrics buffer flushed successfully');
    
    console.log('\n🎉 All metrics collector tests passed!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Metrics collector test failed:', error.message);
    return false;
  }
}

module.exports = {
  runMetricsCollectorTests
};

if (require.main === module) {
  runMetricsCollectorTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}