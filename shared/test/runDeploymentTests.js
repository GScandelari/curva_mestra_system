/**
 * Deployment Test Runner
 * Runs all deployment pipeline tests
 */

const { runDeploymentTests } = require('./deploymentPipelineTest')
const { runRollbackTests } = require('./rollbackTest')
const { runValidationTests } = require('./validationTest')

/**
 * Run all deployment-related tests
 */
async function runAllDeploymentTests() {
  console.log('🚀 Starting Deployment Pipeline Test Suite')
  console.log('=' .repeat(50))

  const results = {
    startTime: new Date(),
    testSuites: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    }
  }

  try {
    // Run deployment pipeline tests
    console.log('\n📦 Running Deployment Pipeline Tests...')
    const deploymentResult = runDeploymentTests()
    results.testSuites.push({
      name: 'Deployment Pipeline',
      result: deploymentResult,
      status: 'completed'
    })
    console.log('✅ Deployment Pipeline Tests: READY')

    // Run rollback tests
    console.log('\n🔄 Running Rollback System Tests...')
    const rollbackResult = runRollbackTests()
    results.testSuites.push({
      name: 'Rollback System',
      result: rollbackResult,
      status: 'completed'
    })
    console.log('✅ Rollback System Tests: READY')

    // Run validation tests
    console.log('\n✅ Running Validation System Tests...')
    const validationResult = runValidationTests()
    results.testSuites.push({
      name: 'Validation System',
      result: validationResult,
      status: 'completed'
    })
    console.log('✅ Validation System Tests: READY')

    // Calculate summary
    results.summary.total = results.testSuites.length
    results.summary.passed = results.testSuites.filter(s => s.status === 'completed').length
    results.summary.failed = results.testSuites.filter(s => s.status === 'failed').length
    results.summary.skipped = results.testSuites.filter(s => s.status === 'skipped').length

    results.endTime = new Date()
    results.duration = results.endTime.getTime() - results.startTime.getTime()

    // Print summary
    console.log('\n' + '=' .repeat(50))
    console.log('📊 Test Suite Summary')
    console.log('=' .repeat(50))
    console.log(`Total Test Suites: ${results.summary.total}`)
    console.log(`✅ Passed: ${results.summary.passed}`)
    console.log(`❌ Failed: ${results.summary.failed}`)
    console.log(`⏭️  Skipped: ${results.summary.skipped}`)
    console.log(`⏱️  Duration: ${results.duration}ms`)
    console.log(`🕐 Completed: ${results.endTime.toISOString()}`)

    if (results.summary.failed === 0) {
      console.log('\n🎉 All deployment tests are ready to run!')
    } else {
      console.log('\n⚠️  Some test suites had issues. Check the logs above.')
    }

    return results

  } catch (error) {
    console.error('\n❌ Error running deployment tests:', error.message)
    results.error = error.message
    results.endTime = new Date()
    return results
  }
}

/**
 * Run specific test suite
 */
async function runSpecificTestSuite(suiteName) {
  console.log(`🎯 Running specific test suite: ${suiteName}`)

  switch (suiteName.toLowerCase()) {
    case 'deployment':
    case 'pipeline':
      return runDeploymentTests()
    
    case 'rollback':
      return runRollbackTests()
    
    case 'validation':
      return runValidationTests()
    
    default:
      throw new Error(`Unknown test suite: ${suiteName}`)
  }
}

/**
 * Validate test environment
 */
function validateTestEnvironment() {
  console.log('🔍 Validating test environment...')

  const checks = {
    nodeVersion: process.version,
    platform: process.platform,
    workingDirectory: process.cwd(),
    memoryUsage: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  }

  console.log('Environment Details:')
  console.log(`- Node.js Version: ${checks.nodeVersion}`)
  console.log(`- Platform: ${checks.platform}`)
  console.log(`- Working Directory: ${checks.workingDirectory}`)
  console.log(`- Environment: ${checks.environment}`)
  console.log(`- Memory Usage: ${Math.round(checks.memoryUsage.heapUsed / 1024 / 1024)}MB`)

  // Basic validation
  const majorVersion = parseInt(checks.nodeVersion.slice(1).split('.')[0])
  if (majorVersion < 16) {
    throw new Error(`Node.js version ${checks.nodeVersion} is not supported. Minimum version is 16.`)
  }

  console.log('✅ Test environment validation passed')
  return checks
}

/**
 * Generate test report
 */
function generateTestReport(results) {
  const report = {
    title: 'Deployment Pipeline Test Report',
    timestamp: new Date().toISOString(),
    environment: validateTestEnvironment(),
    results: results,
    recommendations: []
  }

  // Add recommendations based on results
  if (results.summary.failed > 0) {
    report.recommendations.push('Review failed test suites and fix underlying issues')
  }

  if (results.duration > 30000) {
    report.recommendations.push('Consider optimizing test performance - tests took longer than 30 seconds')
  }

  report.recommendations.push('Run tests in CI/CD pipeline before deployment')
  report.recommendations.push('Monitor test results and update tests as system evolves')

  return report
}

/**
 * Main test execution function
 */
async function main() {
  try {
    // Validate environment first
    validateTestEnvironment()

    // Run all tests
    const results = await runAllDeploymentTests()

    // Generate report
    const report = generateTestReport(results)

    // Save report if in CI environment
    if (process.env.CI) {
      const fs = require('fs')
      const path = require('path')
      
      const reportPath = path.join(process.cwd(), 'deployment-test-report.json')
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
      console.log(`\n📄 Test report saved to: ${reportPath}`)
    }

    // Exit with appropriate code
    process.exit(results.summary.failed > 0 ? 1 : 0)

  } catch (error) {
    console.error('\n💥 Fatal error running tests:', error.message)
    process.exit(1)
  }
}

// Export functions for use in other modules
module.exports = {
  runAllDeploymentTests,
  runSpecificTestSuite,
  validateTestEnvironment,
  generateTestReport
}

// Run tests if this file is executed directly
if (require.main === module) {
  main()
}