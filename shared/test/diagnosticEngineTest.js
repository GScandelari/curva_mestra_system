/**
 * Diagnostic Engine Tests
 * Unit tests for the DiagnosticEngine and health checks
 */

import { DiagnosticEngine } from '../utils/DiagnosticEngine.js';
import { HealthStatus } from '../types/diagnosticTypes.js';

// Mock health check for testing
class MockHealthCheck {
  constructor(name, component, status = HealthStatus.HEALTHY, responseTime = 100) {
    this.name = name;
    this.component = component;
    this.timeout = 5000;
    this.retryCount = 1;
    this.enabled = true;
    this.mockStatus = status;
    this.mockResponseTime = responseTime;
  }

  async execute() {
    const startTime = Date.now();
    
    // Simulate some async work
    await new Promise(resolve => setTimeout(resolve, this.mockResponseTime));
    
    return {
      status: this.mockStatus,
      message: `Mock health check result: ${this.mockStatus}`,
      timestamp: new Date(),
      responseTime: Date.now() - startTime,
      metrics: {
        mockMetric: 'test-value',
        executionCount: 1
      }
    };
  }
}

// Test function
async function testDiagnosticEngine() {
  console.log('Testing Diagnostic Engine...');

  // Test 1: Engine Initialization
  console.log('\n1. Testing Engine Initialization...');
  try {
    const engine = new DiagnosticEngine({
      enableRealTimeMonitoring: false,
      monitoringInterval: 30000,
      healthCheckTimeout: 5000,
      maxRetries: 2
    });

    console.log('✓ DiagnosticEngine initialized successfully');
    
    // Test health checks registration
    const mockCheck1 = new MockHealthCheck('test-check-1', 'test-component-1');
    const mockCheck2 = new MockHealthCheck('test-check-2', 'test-component-2');
    
    engine.registerHealthCheck(mockCheck1);
    engine.registerHealthCheck(mockCheck2);
    
    const registeredChecks = engine.getHealthChecks();
    console.log(`✓ Registered ${registeredChecks.length} health checks`);
    
    if (registeredChecks.length !== 2) {
      throw new Error('Expected 2 health checks, got ' + registeredChecks.length);
    }
  } catch (error) {
    console.error('✗ Engine initialization test failed:', error.message);
  }

  // Test 2: Full Diagnostic Execution
  console.log('\n2. Testing Full Diagnostic Execution...');
  try {
    const engine = new DiagnosticEngine();
    
    // Register mock health checks with different statuses
    engine.registerHealthCheck(new MockHealthCheck('healthy-check', 'component-1', HealthStatus.HEALTHY, 50));
    engine.registerHealthCheck(new MockHealthCheck('degraded-check', 'component-2', HealthStatus.DEGRADED, 150));
    engine.registerHealthCheck(new MockHealthCheck('unhealthy-check', 'component-3', HealthStatus.UNHEALTHY, 300));
    
    const report = await engine.runFullDiagnostic();
    
    console.log('✓ Full diagnostic completed:', {
      id: report.id,
      overallHealth: report.overallHealth,
      componentsCount: report.components.length,
      executionTime: report.executionTime,
      criticalIssues: report.criticalIssues.length,
      recommendations: report.recommendations.length
    });
    
    // Validate report structure
    if (!report.id || !report.timestamp || !report.components) {
      throw new Error('Invalid report structure');
    }
    
    if (report.components.length !== 3) {
      throw new Error('Expected 3 component reports');
    }
    
    // Check that overall health reflects component statuses
    if (report.overallHealth === HealthStatus.HEALTHY) {
      throw new Error('Overall health should not be healthy with unhealthy components');
    }
    
  } catch (error) {
    console.error('✗ Full diagnostic test failed:', error.message);
  }

  // Test 3: Component Diagnostic
  console.log('\n3. Testing Component Diagnostic...');
  try {
    const engine = new DiagnosticEngine();
    
    engine.registerHealthCheck(new MockHealthCheck('component-check-1', 'target-component', HealthStatus.HEALTHY));
    engine.registerHealthCheck(new MockHealthCheck('component-check-2', 'target-component', HealthStatus.DEGRADED));
    engine.registerHealthCheck(new MockHealthCheck('other-check', 'other-component', HealthStatus.HEALTHY));
    
    const componentReport = await engine.runComponentDiagnostic('target-component');
    
    console.log('✓ Component diagnostic completed:', {
      name: componentReport.name,
      status: componentReport.status,
      responseTime: componentReport.responseTime,
      issuesCount: componentReport.issues.length
    });
    
    // Should only include checks for the target component
    if (componentReport.name !== 'target-component') {
      throw new Error('Wrong component name in report');
    }
    
    // Should have degraded status due to one degraded check
    if (componentReport.status !== HealthStatus.DEGRADED) {
      throw new Error('Expected degraded status for component with mixed health checks');
    }
    
  } catch (error) {
    console.error('✗ Component diagnostic test failed:', error.message);
  }

  // Test 4: System Health Summary
  console.log('\n4. Testing System Health Summary...');
  try {
    const engine = new DiagnosticEngine();
    
    // Register checks with known statuses
    engine.registerHealthCheck(new MockHealthCheck('healthy-1', 'comp-1', HealthStatus.HEALTHY));
    engine.registerHealthCheck(new MockHealthCheck('healthy-2', 'comp-2', HealthStatus.HEALTHY));
    engine.registerHealthCheck(new MockHealthCheck('degraded-1', 'comp-3', HealthStatus.DEGRADED));
    engine.registerHealthCheck(new MockHealthCheck('unhealthy-1', 'comp-4', HealthStatus.UNHEALTHY));
    
    const summary = await engine.getSystemHealthSummary();
    
    console.log('✓ System health summary generated:', {
      overallStatus: summary.overallStatus,
      totalComponents: summary.totalComponents,
      healthyComponents: summary.healthyComponents,
      degradedComponents: summary.degradedComponents,
      unhealthyComponents: summary.unhealthyComponents,
      criticalIssues: summary.criticalIssues
    });
    
    // Validate summary counts
    if (summary.totalComponents !== 4) {
      throw new Error('Expected 4 total components');
    }
    
    if (summary.healthyComponents !== 2) {
      throw new Error('Expected 2 healthy components');
    }
    
    if (summary.degradedComponents !== 1) {
      throw new Error('Expected 1 degraded component');
    }
    
    if (summary.unhealthyComponents !== 1) {
      throw new Error('Expected 1 unhealthy component');
    }
    
  } catch (error) {
    console.error('✗ System health summary test failed:', error.message);
  }

  // Test 5: Error Handling
  console.log('\n5. Testing Error Handling...');
  try {
    const engine = new DiagnosticEngine();
    
    // Create a health check that throws an error
    class FailingHealthCheck {
      constructor() {
        this.name = 'failing-check';
        this.component = 'failing-component';
        this.timeout = 5000;
        this.retryCount = 1;
        this.enabled = true;
      }
      
      async execute() {
        throw new Error('Simulated health check failure');
      }
    }
    
    engine.registerHealthCheck(new FailingHealthCheck());
    
    const report = await engine.runFullDiagnostic();
    
    console.log('✓ Error handling test completed');
    
    // Should still generate a report even with failing health checks
    if (!report || !report.components) {
      throw new Error('Report should be generated even with failing health checks');
    }
    
    // The failing component should be marked as unhealthy
    const failingComponent = report.components.find(c => c.name === 'failing-component');
    if (!failingComponent || failingComponent.status !== HealthStatus.UNHEALTHY) {
      throw new Error('Failing component should be marked as unhealthy');
    }
    
    // Should have issues recorded
    if (!failingComponent.issues || failingComponent.issues.length === 0) {
      throw new Error('Failing component should have issues recorded');
    }
    
  } catch (error) {
    console.error('✗ Error handling test failed:', error.message);
  }

  console.log('\n✓ Diagnostic Engine tests completed!');
}

// Run tests if this file is executed directly
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  testDiagnosticEngine().catch(console.error);
}

export { testDiagnosticEngine, MockHealthCheck };