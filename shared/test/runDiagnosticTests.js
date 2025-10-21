/**
 * Diagnostic Tests Runner
 * Executes all diagnostic system tests
 */

import { testDiagnosticEngine } from './diagnosticEngineTest.js';
import { testHealthChecks } from './healthChecksTest.js';
import { testDiagnosticIntegration } from './diagnosticIntegrationTest.js';

async function runAllDiagnosticTests() {
  console.log('🧪 Starting Diagnostic System Test Suite');
  console.log('=' .repeat(50));

  const testResults = {
    passed: 0,
    failed: 0,
    total: 0
  };

  const tests = [
    { name: 'Diagnostic Engine Tests', fn: testDiagnosticEngine },
    { name: 'Health Checks Tests', fn: testHealthChecks },
    { name: 'Integration Tests', fn: testDiagnosticIntegration }
  ];

  for (const test of tests) {
    testResults.total++;
    
    try {
      console.log(`\n🔍 Running ${test.name}...`);
      console.log('-'.repeat(30));
      
      await test.fn();
      
      console.log(`✅ ${test.name} PASSED`);
      testResults.passed++;
      
    } catch (error) {
      console.error(`❌ ${test.name} FAILED:`, error.message);
      testResults.failed++;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed} ✅`);
  console.log(`Failed: ${testResults.failed} ❌`);
  console.log(`Success Rate: ${Math.round((testResults.passed / testResults.total) * 100)}%`);

  if (testResults.failed === 0) {
    console.log('\n🎉 All diagnostic tests passed!');
    return true;
  } else {
    console.log('\n⚠️  Some tests failed. Please review the output above.');
    return false;
  }
}

// Performance test for diagnostic system
async function runPerformanceTests() {
  console.log('\n⚡ Running Performance Tests...');
  
  try {
    const { DiagnosticEngine } = await import('../utils/DiagnosticEngine.js');
    const { MockHealthCheck } = await import('./diagnosticEngineTest.js');
    
    const engine = new DiagnosticEngine();
    
    // Add multiple health checks
    for (let i = 0; i < 20; i++) {
      engine.registerHealthCheck(new MockHealthCheck(`perf-check-${i}`, `component-${i}`));
    }
    
    // Measure execution time
    const iterations = 5;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await engine.runFullDiagnostic();
      const endTime = Date.now();
      times.push(endTime - startTime);
    }
    
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log('📈 Performance Results:');
    console.log(`  Average execution time: ${avgTime.toFixed(2)}ms`);
    console.log(`  Minimum execution time: ${minTime}ms`);
    console.log(`  Maximum execution time: ${maxTime}ms`);
    console.log(`  Components per test: 20`);
    console.log(`  Iterations: ${iterations}`);
    
    // Performance thresholds
    if (avgTime > 5000) {
      console.log('⚠️  Warning: Average execution time exceeds 5 seconds');
    } else {
      console.log('✅ Performance within acceptable limits');
    }
    
  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
  }
}

// Memory usage test
async function runMemoryTests() {
  console.log('\n🧠 Running Memory Tests...');
  
  try {
    const { DiagnosticEngine } = await import('../utils/DiagnosticEngine.js');
    const { MockHealthCheck } = await import('./diagnosticEngineTest.js');
    
    // Measure initial memory
    const initialMemory = process.memoryUsage();
    
    // Create and run multiple diagnostic engines
    const engines = [];
    for (let i = 0; i < 10; i++) {
      const engine = new DiagnosticEngine();
      
      // Add health checks
      for (let j = 0; j < 5; j++) {
        engine.registerHealthCheck(new MockHealthCheck(`mem-check-${i}-${j}`, `component-${i}-${j}`));
      }
      
      engines.push(engine);
      await engine.runFullDiagnostic();
    }
    
    // Measure final memory
    const finalMemory = process.memoryUsage();
    
    const memoryIncrease = {
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      rss: finalMemory.rss - initialMemory.rss
    };
    
    console.log('💾 Memory Usage Results:');
    console.log(`  Heap Used Increase: ${(memoryIncrease.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Heap Total Increase: ${(memoryIncrease.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  RSS Increase: ${(memoryIncrease.rss / 1024 / 1024).toFixed(2)} MB`);
    
    // Memory thresholds
    const heapIncreaseMB = memoryIncrease.heapUsed / 1024 / 1024;
    if (heapIncreaseMB > 50) {
      console.log('⚠️  Warning: High memory usage detected');
    } else {
      console.log('✅ Memory usage within acceptable limits');
    }
    
  } catch (error) {
    console.error('❌ Memory test failed:', error.message);
  }
}

// Main test execution
async function main() {
  try {
    const success = await runAllDiagnosticTests();
    
    if (success) {
      await runPerformanceTests();
      await runMemoryTests();
    }
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (typeof window === 'undefined' && typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runAllDiagnosticTests, runPerformanceTests, runMemoryTests };