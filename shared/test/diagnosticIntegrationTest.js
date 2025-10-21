/**
 * Diagnostic Integration Tests
 * Integration tests for the complete diagnostic system
 */

import { DiagnosticEngine } from '../utils/DiagnosticEngine.js';
import { 
  FirebaseConnectivityCheck,
  ApiHealthCheck,
  EnvironmentConfigCheck,
  PerformanceCheck
} from '../utils/healthChecks/index.js';
import { HealthStatus } from '../types/diagnosticTypes.js';

// Mock implementations for testing
class MockFirebaseConnectivityCheck extends FirebaseConnectivityCheck {
  constructor(shouldFail = false) {
    super({
      projectId: 'test-project',
      apiKey: 'test-key',
      authDomain: 'test.firebaseapp.com'
    });
    this.shouldFail = shouldFail;
  }

  async execute() {
    const startTime = Date.now();
    
    if (this.shouldFail) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: 'Firebase connectivity failed',
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        error: new Error('Mock Firebase error')
      };
    }

    return {
      status: HealthStatus.HEALTHY,
      message: 'Firebase connectivity is healthy',
      timestamp: new Date(),
      responseTime: Date.now() - startTime,
      metrics: {
        authStatus: 'healthy',
        firestoreStatus: 'healthy',
        configurationValid: true
      }
    };
  }
}

class MockApiHealthCheck extends ApiHealthCheck {
  constructor(shouldFail = false) {
    super('http://localhost:3001', ['/health']);
    this.shouldFail = shouldFail;
  }

  async execute() {
    const startTime = Date.now();
    
    if (this.shouldFail) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: 'API endpoints are unhealthy',
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        metrics: {
          totalEndpoints: 1,
          healthyEndpoints: 0,
          healthyRatio: 0,
          errors: ['Connection refused']
        }
      };
    }

    return {
      status: HealthStatus.HEALTHY,
      message: 'All API endpoints are healthy',
      timestamp: new Date(),
      responseTime: Date.now() - startTime,
      metrics: {
        totalEndpoints: 1,
        healthyEndpoints: 1,
        healthyRatio: 1,
        averageResponseTime: 150
      }
    };
  }
}

// Test function
async function testDiagnosticIntegration() {
  console.log('Testing Diagnostic System Integration...');

  // Test 1: Complete System Health Check
  console.log('\n1. Testing Complete System Health Check...');
  try {
    const engine = new DiagnosticEngine({
      enableRealTimeMonitoring: false,
      healthCheckTimeout: 5000,
      maxRetries: 2
    });

    // Register all health checks
    engine.registerHealthCheck(new MockFirebaseConnectivityCheck(false));
    engine.registerHealthCheck(new MockApiHealthCheck(false));
    engine.registerHealthCheck(new EnvironmentConfigCheck('test'));
    engine.registerHealthCheck(new PerformanceCheck());

    const report = await engine.runFullDiagnostic();
    
    console.log('✓ Complete system diagnostic completed:', {
      id: report.id,
      overallHealth: report.overallHealth,
      componentsChecked: report.components.length,
      executionTime: report.executionTime,
      criticalIssues: report.criticalIssues.length,
      recommendations: report.recommendations.length
    });

    // Validate report completeness
    if (report.components.length < 4) {
      throw new Error('Expected at least 4 component reports');
    }

    // Check that all major components are covered
    const componentNames = report.components.map(c => c.name);
    const expectedComponents = ['firebase', 'backend-api', 'configuration', 'system-performance'];
    
    for (const expected of expectedComponents) {
      if (!componentNames.some(name => name.includes(expected))) {
        console.log(`Warning: Expected component '${expected}' not found in report`);
      }
    }

    // Validate report structure
    if (!report.summary || typeof report.summary !== 'string') {
      throw new Error('Report should have a summary');
    }

    if (!Array.isArray(report.recommendations)) {
      throw new Error('Report should have recommendations array');
    }

  } catch (error) {
    console.error('✗ Complete system health check failed:', error.message);
  }

  // Test 2: System Under Stress (Multiple Failures)
  console.log('\n2. Testing System Under Stress...');
  try {
    const engine = new DiagnosticEngine();

    // Register health checks with failures
    engine.registerHealthCheck(new MockFirebaseConnectivityCheck(true));
    engine.registerHealthCheck(new MockApiHealthCheck(true));
    
    // Add a health check that throws an error
    class FailingHealthCheck {
      constructor() {
        this.name = 'critical-service';
        this.component = 'critical-component';
        this.timeout = 5000;
        this.retryCount = 1;
        this.enabled = true;
      }
      
      async execute() {
        throw new Error('Critical service failure');
      }
    }
    
    engine.registerHealthCheck(new FailingHealthCheck());

    const report = await engine.runFullDiagnostic();
    
    console.log('✓ Stress test completed:', {
      overallHealth: report.overallHealth,
      criticalIssues: report.criticalIssues.length,
      unhealthyComponents: report.components.filter(c => c.status === HealthStatus.UNHEALTHY).length
    });

    // System should be unhealthy with multiple failures
    if (report.overallHealth === HealthStatus.HEALTHY) {
      throw new Error('System should not be healthy with multiple component failures');
    }

    // Should have critical issues
    if (report.criticalIssues.length === 0) {
      throw new Error('Should have critical issues with failing components');
    }

    // Should have recommendations for fixing issues
    if (report.recommendations.length === 0) {
      throw new Error('Should have recommendations for fixing critical issues');
    }

  } catch (error) {
    console.error('✗ Stress test failed:', error.message);
  }

  // Test 3: Real-time Monitoring Simulation
  console.log('\n3. Testing Real-time Monitoring Simulation...');
  try {
    const engine = new DiagnosticEngine({
      enableRealTimeMonitoring: true,
      monitoringInterval: 1000 // 1 second for testing
    });

    // Register a simple health check
    engine.registerHealthCheck(new MockFirebaseConnectivityCheck(false));

    // Start monitoring
    engine.startRealTimeMonitoring();
    
    console.log('✓ Real-time monitoring started');

    // Wait for a few monitoring cycles
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Stop monitoring
    engine.stopRealTimeMonitoring();
    
    console.log('✓ Real-time monitoring stopped');

    // Get final health summary
    const summary = await engine.getSystemHealthSummary();
    
    console.log('✓ Final health summary:', {
      overallStatus: summary.overallStatus,
      totalComponents: summary.totalComponents,
      lastUpdate: summary.lastUpdate
    });

  } catch (error) {
    console.error('✗ Real-time monitoring test failed:', error.message);
  }

  // Test 4: Performance Under Load
  console.log('\n4. Testing Performance Under Load...');
  try {
    const engine = new DiagnosticEngine();

    // Register multiple health checks to simulate load
    for (let i = 0; i < 10; i++) {
      const check = new MockFirebaseConnectivityCheck(false);
      check.name = `load-test-check-${i}`;
      check.component = `load-component-${i}`;
      engine.registerHealthCheck(check);
    }

    const startTime = Date.now();
    const report = await engine.runFullDiagnostic();
    const totalTime = Date.now() - startTime;
    
    console.log('✓ Performance under load test completed:', {
      totalExecutionTime: totalTime,
      componentsChecked: report.components.length,
      averageTimePerComponent: Math.round(totalTime / report.components.length)
    });

    // Should complete within reasonable time
    if (totalTime > 30000) { // 30 seconds
      throw new Error('Diagnostic taking too long under load');
    }

    // All components should be processed
    if (report.components.length !== 10) {
      throw new Error('Not all components were processed under load');
    }

  } catch (error) {
    console.error('✗ Performance under load test failed:', error.message);
  }

  // Test 5: Error Recovery and Resilience
  console.log('\n5. Testing Error Recovery and Resilience...');
  try {
    const engine = new DiagnosticEngine({
      maxRetries: 2
    });

    // Create a health check that fails initially but succeeds on retry
    class RetryableHealthCheck {
      constructor() {
        this.name = 'retryable-check';
        this.component = 'retryable-component';
        this.timeout = 5000;
        this.retryCount = 2;
        this.enabled = true;
        this.attemptCount = 0;
      }
      
      async execute() {
        this.attemptCount++;
        
        if (this.attemptCount < 2) {
          throw new Error('Temporary failure');
        }
        
        return {
          status: HealthStatus.HEALTHY,
          message: 'Succeeded after retry',
          timestamp: new Date(),
          responseTime: 100,
          metrics: {
            attempts: this.attemptCount
          }
        };
      }
    }

    engine.registerHealthCheck(new RetryableHealthCheck());

    const report = await engine.runFullDiagnostic();
    
    console.log('✓ Error recovery test completed:', {
      overallHealth: report.overallHealth,
      retryableComponent: report.components.find(c => c.name === 'retryable-component')?.status
    });

    // Component should eventually succeed
    const retryableComponent = report.components.find(c => c.name === 'retryable-component');
    if (!retryableComponent || retryableComponent.status !== HealthStatus.HEALTHY) {
      throw new Error('Retryable component should succeed after retries');
    }

  } catch (error) {
    console.error('✗ Error recovery test failed:', error.message);
  }

  console.log('\n✓ Diagnostic Integration tests completed!');
}

// Run tests if this file is executed directly
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  testDiagnosticIntegration().catch(console.error);
}

export { testDiagnosticIntegration };