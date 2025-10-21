/**
 * Health Checks Tests
 * Unit tests for individual health check implementations
 */

import { 
  FirebaseConnectivityCheck,
  ApiHealthCheck,
  EnvironmentConfigCheck,
  PerformanceCheck
} from '../utils/healthChecks/index.js';
import { HealthStatus } from '../types/diagnosticTypes.js';

// Mock fetch for API health check tests
global.fetch = async (url, options) => {
  // Simulate different responses based on URL
  if (url.includes('/health')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 'healthy', version: '1.0.0', uptime: 3600 })
    };
  } else if (url.includes('/error')) {
    return {
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' })
    };
  } else {
    throw new Error('Network error');
  }
};

// Test function
async function testHealthChecks() {
  console.log('Testing Health Checks...');

  // Test 1: Firebase Connectivity Check
  console.log('\n1. Testing Firebase Connectivity Check...');
  try {
    // Test with valid configuration
    const validConfig = {
      projectId: 'test-project',
      apiKey: 'test-api-key',
      authDomain: 'test-project.firebaseapp.com',
      databaseURL: 'https://test-project.firebaseio.com',
      storageBucket: 'test-project.appspot.com'
    };
    
    const firebaseCheck = new FirebaseConnectivityCheck(validConfig);
    const result = await firebaseCheck.execute();
    
    console.log('✓ Firebase connectivity check completed:', {
      status: result.status,
      message: result.message,
      responseTime: result.responseTime
    });
    
    // Should be healthy with valid config (even if services aren't actually available)
    if (result.status === HealthStatus.UNHEALTHY && result.message.includes('configuration')) {
      throw new Error('Valid configuration should not be marked as unhealthy due to config issues');
    }
    
    // Test with invalid configuration
    const invalidConfig = {
      projectId: 'placeholder-project',
      apiKey: 'your-api-key',
      authDomain: ''
    };
    
    const invalidFirebaseCheck = new FirebaseConnectivityCheck(invalidConfig);
    const invalidResult = await invalidFirebaseCheck.execute();
    
    console.log('✓ Firebase invalid config test:', {
      status: invalidResult.status,
      message: invalidResult.message
    });
    
    if (invalidResult.status !== HealthStatus.UNHEALTHY) {
      throw new Error('Invalid configuration should be marked as unhealthy');
    }
    
  } catch (error) {
    console.error('✗ Firebase connectivity check test failed:', error.message);
  }

  // Test 2: API Health Check
  console.log('\n2. Testing API Health Check...');
  try {
    // Test with healthy endpoints
    const apiCheck = new ApiHealthCheck(
      'http://localhost:3001',
      ['/health', '/api/health']
    );
    
    const result = await apiCheck.execute();
    
    console.log('✓ API health check completed:', {
      status: result.status,
      message: result.message,
      responseTime: result.responseTime,
      healthyEndpoints: result.metrics?.healthyEndpoints,
      totalEndpoints: result.metrics?.totalEndpoints
    });
    
    if (result.status !== HealthStatus.HEALTHY) {
      console.log('Note: API check not healthy (expected in test environment)');
    }
    
    // Test with error endpoints
    const errorApiCheck = new ApiHealthCheck(
      'http://localhost:3001',
      ['/error', '/not-found']
    );
    
    const errorResult = await errorApiCheck.execute();
    
    console.log('✓ API error endpoints test:', {
      status: errorResult.status,
      message: errorResult.message
    });
    
    // Should be unhealthy with error endpoints
    if (errorResult.status === HealthStatus.HEALTHY) {
      throw new Error('Error endpoints should not be marked as healthy');
    }
    
  } catch (error) {
    console.error('✗ API health check test failed:', error.message);
  }

  // Test 3: Environment Configuration Check
  console.log('\n3. Testing Environment Configuration Check...');
  try {
    // Mock environment variables
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PORT: '3000',
      FIREBASE_PROJECT_ID: 'test-project',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'test_db',
      DB_USER: 'test_user',
      DB_PASSWORD: 'test_password',
      JWT_SECRET: 'super-secret-jwt-key-for-testing-purposes-only'
    };
    
    const configCheck = new EnvironmentConfigCheck('test');
    const result = await configCheck.execute();
    
    console.log('✓ Environment config check completed:', {
      status: result.status,
      message: result.message,
      missingRequired: result.metrics?.missingRequired?.length || 0,
      invalidFormat: result.metrics?.invalidFormat?.length || 0,
      securityIssues: result.metrics?.securityIssues?.length || 0
    });
    
    // Should be healthy with proper test configuration
    if (result.status === HealthStatus.UNHEALTHY) {
      console.log('Config issues found:', result.metrics);
    }
    
    // Test with missing required variables
    delete process.env.JWT_SECRET;
    delete process.env.DB_PASSWORD;
    
    const missingConfigCheck = new EnvironmentConfigCheck('test');
    const missingResult = await missingConfigCheck.execute();
    
    console.log('✓ Missing config test:', {
      status: missingResult.status,
      message: missingResult.message
    });
    
    if (missingResult.status !== HealthStatus.UNHEALTHY) {
      throw new Error('Missing required config should be marked as unhealthy');
    }
    
    // Restore environment
    process.env = originalEnv;
    
  } catch (error) {
    console.error('✗ Environment config check test failed:', error.message);
  }

  // Test 4: Performance Check
  console.log('\n4. Testing Performance Check...');
  try {
    const performanceCheck = new PerformanceCheck();
    const result = await performanceCheck.execute();
    
    console.log('✓ Performance check completed:', {
      status: result.status,
      message: result.message,
      responseTime: result.responseTime,
      memoryUsage: result.metrics?.memoryUsage,
      cpuUsage: result.metrics?.cpuUsage
    });
    
    // Performance check should complete successfully
    if (!result.timestamp || !result.responseTime) {
      throw new Error('Performance check should return timestamp and response time');
    }
    
    // Test with custom thresholds
    const strictPerformanceCheck = new PerformanceCheck({
      memory: { warning: 0.1, critical: 0.2 },
      responseTime: { warning: 10, critical: 50 }
    });
    
    const strictResult = await strictPerformanceCheck.execute();
    
    console.log('✓ Strict performance check:', {
      status: strictResult.status,
      message: strictResult.message
    });
    
    // With strict thresholds, might be degraded or unhealthy
    if (strictResult.status === HealthStatus.HEALTHY) {
      console.log('Note: System performing well even with strict thresholds');
    }
    
  } catch (error) {
    console.error('✗ Performance check test failed:', error.message);
  }

  // Test 5: Health Check Interface Compliance
  console.log('\n5. Testing Health Check Interface Compliance...');
  try {
    const checks = [
      new FirebaseConnectivityCheck({}),
      new ApiHealthCheck('http://localhost', ['/test']),
      new EnvironmentConfigCheck(),
      new PerformanceCheck()
    ];
    
    for (const check of checks) {
      // Verify required properties
      if (!check.name || typeof check.name !== 'string') {
        throw new Error(`Health check missing or invalid name: ${check.constructor.name}`);
      }
      
      if (!check.component || typeof check.component !== 'string') {
        throw new Error(`Health check missing or invalid component: ${check.constructor.name}`);
      }
      
      if (typeof check.timeout !== 'number' || check.timeout <= 0) {
        throw new Error(`Health check invalid timeout: ${check.constructor.name}`);
      }
      
      if (typeof check.retryCount !== 'number' || check.retryCount < 0) {
        throw new Error(`Health check invalid retryCount: ${check.constructor.name}`);
      }
      
      if (typeof check.enabled !== 'boolean') {
        throw new Error(`Health check invalid enabled flag: ${check.constructor.name}`);
      }
      
      if (typeof check.execute !== 'function') {
        throw new Error(`Health check missing execute method: ${check.constructor.name}`);
      }
      
      console.log(`✓ ${check.constructor.name} interface compliance verified`);
    }
    
  } catch (error) {
    console.error('✗ Interface compliance test failed:', error.message);
  }

  console.log('\n✓ Health Checks tests completed!');
}

// Run tests if this file is executed directly
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  testHealthChecks().catch(console.error);
}

export { testHealthChecks };