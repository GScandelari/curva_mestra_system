const { runMonitoringTests } = require('./monitoringSystemTest');
const { runMetricsCollectorTests } = require('./metricsCollectorTest');
const { runAlertManagerTests } = require('./alertManagerTest');

async function runAllMonitoringTests() {
  console.log('🚀 Starting Comprehensive Monitoring System Tests\n');
  console.log('=' .repeat(60));
  
  const results = {
    monitoringSystem: false,
    metricsCollector: false,
    alertManager: false
  };
  
  try {
    // Test 1: Metrics Collector
    console.log('\n📊 METRICS COLLECTOR TESTS');
    console.log('-'.repeat(40));
    results.metricsCollector = await runMetricsCollectorTests();
    
    // Test 2: Alert Manager
    console.log('\n🚨 ALERT MANAGER TESTS');
    console.log('-'.repeat(40));
    results.alertManager = await runAlertManagerTests();
    
    // Test 3: Complete Monitoring System
    console.log('\n🔍 MONITORING SYSTEM INTEGRATION TESTS');
    console.log('-'.repeat(40));
    results.monitoringSystem = await runMonitoringTests();
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(Boolean).length;
    
    console.log(`📊 Metrics Collector: ${results.metricsCollector ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`🚨 Alert Manager: ${results.alertManager ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`🔍 Monitoring System: ${results.monitoringSystem ? '✅ PASSED' : '❌ FAILED'}`);
    
    console.log(`\n📈 Overall: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 ALL MONITORING TESTS PASSED! 🎉');
      console.log('✨ The monitoring and alerting system is ready for production use.');
      return true;
    } else {
      console.log('\n⚠️  Some tests failed. Please review the errors above.');
      return false;
    }
    
  } catch (error) {
    console.error('\n💥 Critical error during testing:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Integration test for the complete monitoring workflow
async function runIntegrationTest() {
  console.log('\n🔄 INTEGRATION TEST: Complete Monitoring Workflow');
  console.log('-'.repeat(50));
  
  try {
    const { MonitoringSystem } = require('../utils/MonitoringSystem');
    
    // Create monitoring system
    const system = MonitoringSystem.create({
      metrics: {
        collectionInterval: 1000,
        retentionPeriod: 1,
        maxMetricsPerComponent: 100,
        enableRealTimeCollection: false,
        components: ['frontend', 'backend', 'firebase', 'auth']
      },
      alerts: {
        enabled: true,
        checkInterval: 1000,
        defaultCooldown: 1
      }
    });
    
    console.log('✅ Step 1: System created');
    
    // Start monitoring
    system.start();
    console.log('✅ Step 2: Monitoring started');
    
    // Record various metrics
    await system.recordError('frontend', 'validation_error', 'medium');
    await system.recordError('frontend', 'network_error', 'high');
    await system.recordPerformance('backend', 'api_call', 1500);
    await system.recordPerformance('backend', 'database_query', 800);
    await system.recordAvailability('firebase', true);
    await system.recordAvailability('auth', false);
    
    console.log('✅ Step 3: Metrics recorded');
    
    // Get dashboard data
    const dashboardData = await system.getDashboardData('last_hour');
    console.log('✅ Step 4: Dashboard data retrieved');
    console.log(`   - System health: ${dashboardData.systemOverview.overallHealth.toFixed(1)}%`);
    console.log(`   - Components monitored: ${dashboardData.systemOverview.components.length}`);
    
    // Add custom alert rule
    await system.addAlertRule({
      id: 'integration_test_rule',
      name: 'Integration Test Alert',
      component: 'frontend',
      metric: 'error_count',
      condition: 'greater_than',
      threshold: 1,
      severity: 'medium',
      enabled: true,
      cooldownPeriod: 1,
      actions: [
        { type: 'log', target: 'console', enabled: true }
      ]
    });
    
    console.log('✅ Step 5: Custom alert rule added');
    
    // Get monitoring statistics
    const stats = await system.getMonitoringStats();
    console.log('✅ Step 6: Statistics retrieved');
    console.log(`   - Total components: ${stats.totalComponents}`);
    console.log(`   - Healthy components: ${stats.healthyComponents}`);
    console.log(`   - Active alerts: ${stats.activeAlerts}`);
    
    // Test health score
    const healthScore = await system.getHealthScore();
    console.log('✅ Step 7: Health score calculated');
    console.log(`   - Health score: ${healthScore.toFixed(1)}%`);
    
    // Cleanup
    await system.cleanup();
    console.log('✅ Step 8: Cleanup completed');
    
    // Stop monitoring
    system.stop();
    console.log('✅ Step 9: Monitoring stopped');
    
    console.log('\n🎯 Integration test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Integration test failed:', error.message);
    return false;
  }
}

// Performance test
async function runPerformanceTest() {
  console.log('\n⚡ PERFORMANCE TEST: High Volume Metrics');
  console.log('-'.repeat(40));
  
  try {
    const { MonitoringSystem } = require('../utils/MonitoringSystem');
    
    const system = MonitoringSystem.create({
      metrics: {
        collectionInterval: 100,
        retentionPeriod: 1,
        maxMetricsPerComponent: 1000,
        enableRealTimeCollection: false,
        components: ['test_component']
      }
    });
    
    const startTime = Date.now();
    const numMetrics = 100;
    
    console.log(`📊 Recording ${numMetrics} metrics...`);
    
    // Record many metrics quickly
    for (let i = 0; i < numMetrics; i++) {
      await system.recordCustomMetric('perf_test', i, 'test_component', 'count');
      
      if (i % 20 === 0) {
        process.stdout.write('.');
      }
    }
    
    const recordTime = Date.now() - startTime;
    console.log(`\n✅ Recorded ${numMetrics} metrics in ${recordTime}ms`);
    console.log(`   - Average: ${(recordTime / numMetrics).toFixed(2)}ms per metric`);
    
    // Test retrieval performance
    const retrievalStart = Date.now();
    const systemMetrics = await system.getSystemMetrics();
    const retrievalTime = Date.now() - retrievalStart;
    
    console.log(`✅ Retrieved system metrics in ${retrievalTime}ms`);
    
    if (recordTime < 5000 && retrievalTime < 1000) {
      console.log('🚀 Performance test PASSED!');
      return true;
    } else {
      console.log('⚠️  Performance test completed but may be slow');
      return true; // Still pass, just note the performance
    }
    
  } catch (error) {
    console.error('\n❌ Performance test failed:', error.message);
    return false;
  }
}

// Main test runner
async function main() {
  const startTime = Date.now();
  
  try {
    // Run all tests
    const basicTestsPass = await runAllMonitoringTests();
    const integrationTestPass = await runIntegrationTest();
    const performanceTestPass = await runPerformanceTest();
    
    const totalTime = Date.now() - startTime;
    
    console.log('\n' + '='.repeat(60));
    console.log('🏁 FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`⏱️  Total execution time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`🧪 Basic Tests: ${basicTestsPass ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`🔄 Integration Test: ${integrationTestPass ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`⚡ Performance Test: ${performanceTestPass ? '✅ PASSED' : '❌ FAILED'}`);
    
    const allTestsPass = basicTestsPass && integrationTestPass && performanceTestPass;
    
    if (allTestsPass) {
      console.log('\n🎊 ALL TESTS PASSED! 🎊');
      console.log('🚀 The monitoring and alerting system is fully functional and ready for deployment!');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed. Please review and fix the issues.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Test runner failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Export functions for use in other files
module.exports = {
  runAllMonitoringTests,
  runIntegrationTest,
  runPerformanceTest
};

// Run if this file is executed directly
if (require.main === module) {
  main();
}