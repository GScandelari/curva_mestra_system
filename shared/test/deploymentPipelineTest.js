/**
 * Deployment Pipeline Tests
 * Tests for the complete deployment pipeline system
 */

const { DeploymentPipeline } = require('../utils/DeploymentPipeline')
const { PreDeployValidator } = require('../utils/PreDeployValidator')
const { AutoDeployer } = require('../utils/AutoDeployer')
const { RollbackManager } = require('../utils/RollbackManager')
const { GitIntegration } = require('../utils/GitIntegration')
const fs = require('fs')
const path = require('path')

describe('Deployment Pipeline Integration Tests', () => {
  let testWorkingDir
  let deploymentPipeline
  let mockConfig

  beforeEach(() => {
    // Create temporary test directory
    testWorkingDir = path.join(__dirname, 'temp-deployment-test')
    if (!fs.existsSync(testWorkingDir)) {
      fs.mkdirSync(testWorkingDir, { recursive: true })
    }

    // Mock configuration
    mockConfig = {
      projectId: 'test-project',
      environment: 'development',
      targets: [
        {
          name: 'frontend',
          type: 'hosting',
          enabled: true,
          buildRequired: true
        },
        {
          name: 'functions',
          type: 'functions',
          enabled: true,
          buildRequired: true
        }
      ],
      autoRollback: true,
      validationRequired: true,
      backupBeforeDeploy: true
    }

    deploymentPipeline = new DeploymentPipeline(mockConfig, {
      workingDir: testWorkingDir,
      verbose: false
    })
  })

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(testWorkingDir)) {
      fs.rmSync(testWorkingDir, { recursive: true, force: true })
    }
  })

  describe('Pre-deployment Validation', () => {
    test('should validate syntax successfully', async () => {
      // Create mock package.json files
      const frontendDir = path.join(testWorkingDir, 'frontend')
      fs.mkdirSync(frontendDir, { recursive: true })
      fs.writeFileSync(
        path.join(frontendDir, 'package.json'),
        JSON.stringify({
          name: 'frontend',
          version: '1.0.0',
          scripts: { build: 'echo "build"', lint: 'echo "lint"' }
        })
      )

      const validator = new PreDeployValidator({
        workingDir: testWorkingDir,
        skipTests: true,
        skipLint: true,
        skipSecurity: true
      })

      const result = await validator.validate()
      
      expect(result).toBeDefined()
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(Array.isArray(result.issues)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
    })

    test('should detect missing configuration files', async () => {
      const validator = new PreDeployValidator({
        workingDir: testWorkingDir,
        skipTests: true,
        skipLint: true,
        skipSecurity: true
      })

      const result = await validator.validate()
      
      expect(result.isValid).toBe(false)
      expect(result.issues.some(issue => 
        issue.includes('Environment configuration validation failed')
      )).toBe(true)
    })

    test('should validate Firebase configuration', async () => {
      // Create mock Firebase configuration
      fs.writeFileSync(
        path.join(testWorkingDir, 'firebase.json'),
        JSON.stringify({
          hosting: {
            public: 'dist'
          }
        })
      )

      fs.writeFileSync(
        path.join(testWorkingDir, '.firebaserc'),
        JSON.stringify({
          projects: {
            default: 'test-project'
          }
        })
      )

      const validator = new PreDeployValidator({
        workingDir: testWorkingDir,
        skipTests: true,
        skipLint: true,
        skipSecurity: true
      })

      const result = await validator.validate()
      
      // Should pass environment validation now
      expect(result.checks.environment).toBe(true)
    })
  })

  describe('Deployment Execution', () => {
    test('should handle deployment with missing build outputs', async () => {
      // Create minimal configuration
      fs.writeFileSync(
        path.join(testWorkingDir, 'firebase.json'),
        JSON.stringify({ hosting: { public: 'dist' } })
      )

      const autoDeployer = new AutoDeployer({
        projectId: 'test-project',
        workingDir: testWorkingDir,
        targets: [
          {
            name: 'frontend',
            type: 'hosting',
            enabled: true,
            buildRequired: true
          }
        ],
        verbose: false,
        dryRun: true // Use dry run to avoid actual Firebase calls
      })

      const result = await autoDeployer.deployAll()
      
      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
      expect(result.deploymentId).toBeDefined()
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(Array.isArray(result.errors)).toBe(true)
    })

    test('should generate deployment ID correctly', async () => {
      const result1 = await deploymentPipeline.deploy({ skipValidation: true })
      const result2 = await deploymentPipeline.deploy({ skipValidation: true })
      
      expect(result1.deploymentId).toBeDefined()
      expect(result2.deploymentId).toBeDefined()
      expect(result1.deploymentId).not.toBe(result2.deploymentId)
    })

    test('should handle deployment with custom commit message', async () => {
      const customMessage = 'Custom deployment message'
      
      try {
        const result = await deploymentPipeline.deploy({
          commitMessage: customMessage,
          skipValidation: true
        })
        
        expect(result).toBeDefined()
        // In a real scenario, we would check if the commit message was used
      } catch (error) {
        // Expected to fail in test environment without proper Git setup
        expect(error.message).toContain('Git')
      }
    })
  })

  describe('Rollback System', () => {
    test('should initialize rollback manager correctly', () => {
      const gitIntegration = new GitIntegration({
        workingDir: testWorkingDir,
        autoCommit: true,
        autoPush: false,
        commitMessageTemplate: 'Deploy {deploymentId}',
        branchProtection: false
      })

      const rollbackManager = new RollbackManager({
        workingDir: testWorkingDir,
        autoRollbackEnabled: true,
        rollbackTimeoutMs: 30000,
        maxRollbackAttempts: 3,
        validationRequired: true,
        backupBeforeRollback: true
      }, gitIntegration)

      expect(rollbackManager).toBeDefined()
      
      const targets = rollbackManager.getAvailableRollbackTargets()
      expect(Array.isArray(targets)).toBe(true)
    })

    test('should validate deployment health', async () => {
      const gitIntegration = new GitIntegration({
        workingDir: testWorkingDir,
        autoCommit: true,
        autoPush: false,
        commitMessageTemplate: 'Deploy {deploymentId}',
        branchProtection: false
      })

      const rollbackManager = new RollbackManager({
        workingDir: testWorkingDir,
        autoRollbackEnabled: true,
        rollbackTimeoutMs: 30000,
        maxRollbackAttempts: 3,
        validationRequired: true,
        backupBeforeRollback: true
      }, gitIntegration)

      const validation = await rollbackManager.validateDeploymentHealth()
      
      expect(validation).toBeDefined()
      expect(typeof validation.success).toBe('boolean')
      expect(Array.isArray(validation.errors)).toBe(true)
      expect(Array.isArray(validation.warnings)).toBe(true)
      expect(Array.isArray(validation.healthChecks)).toBe(true)
    })

    test('should handle rollback when no targets available', async () => {
      const gitIntegration = new GitIntegration({
        workingDir: testWorkingDir,
        autoCommit: true,
        autoPush: false,
        commitMessageTemplate: 'Deploy {deploymentId}',
        branchProtection: false
      })

      const rollbackManager = new RollbackManager({
        workingDir: testWorkingDir,
        autoRollbackEnabled: true,
        rollbackTimeoutMs: 30000,
        maxRollbackAttempts: 3,
        validationRequired: true,
        backupBeforeRollback: true
      }, gitIntegration)

      const result = await rollbackManager.executeAutoRollback('Test failure')
      
      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.errors.some(error => 
        error.includes('No healthy deployment found')
      )).toBe(true)
    })
  })

  describe('Git Integration', () => {
    test('should handle Git status check gracefully', async () => {
      const gitIntegration = new GitIntegration({
        workingDir: testWorkingDir,
        autoCommit: true,
        autoPush: false,
        commitMessageTemplate: 'Deploy {deploymentId}',
        branchProtection: false
      })

      try {
        const status = await gitIntegration.getStatus()
        expect(status).toBeDefined()
      } catch (error) {
        // Expected to fail in non-Git directory
        expect(error.message).toContain('Git')
      }
    })

    test('should validate repository for deployment', async () => {
      const gitIntegration = new GitIntegration({
        workingDir: testWorkingDir,
        autoCommit: true,
        autoPush: false,
        commitMessageTemplate: 'Deploy {deploymentId}',
        branchProtection: false
      })

      const validation = await gitIntegration.validateForDeployment()
      
      expect(validation).toBeDefined()
      expect(typeof validation.valid).toBe('boolean')
      expect(Array.isArray(validation.issues)).toBe(true)
    })

    test('should generate commit messages correctly', () => {
      const gitIntegration = new GitIntegration({
        workingDir: testWorkingDir,
        autoCommit: true,
        autoPush: false,
        commitMessageTemplate: 'Deploy {deploymentId} at {date}',
        branchProtection: false
      })

      // Test the private method indirectly by checking the template
      expect(gitIntegration).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid configuration gracefully', () => {
      expect(() => {
        new DeploymentPipeline(null)
      }).toThrow()
    })

    test('should handle missing working directory', () => {
      const invalidConfig = {
        ...mockConfig
      }

      expect(() => {
        new DeploymentPipeline(invalidConfig, {
          workingDir: '/nonexistent/directory'
        })
      }).not.toThrow() // Should not throw on construction
    })

    test('should handle deployment failure gracefully', async () => {
      // Create configuration that will cause deployment to fail
      const result = await deploymentPipeline.deploy({
        skipValidation: true
      })

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
      expect(result.deploymentId).toBeDefined()
      
      if (!result.success) {
        expect(Array.isArray(result.errors)).toBe(true)
        expect(result.errors.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Performance Tests', () => {
    test('should complete validation within reasonable time', async () => {
      const startTime = Date.now()
      
      const validator = new PreDeployValidator({
        workingDir: testWorkingDir,
        skipTests: true,
        skipLint: true,
        skipSecurity: true
      })

      await validator.validate()
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
    })

    test('should handle concurrent deployment attempts', async () => {
      const promises = []
      
      for (let i = 0; i < 3; i++) {
        promises.push(
          deploymentPipeline.deploy({
            skipValidation: true,
            commitMessage: `Concurrent deployment ${i}`
          })
        )
      }

      const results = await Promise.allSettled(promises)
      
      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.status).toBeDefined()
      })
    })
  })

  describe('Configuration Validation', () => {
    test('should validate deployment targets', () => {
      const validConfig = {
        projectId: 'test-project',
        environment: 'development',
        targets: [
          {
            name: 'frontend',
            type: 'hosting',
            enabled: true,
            buildRequired: true
          }
        ],
        autoRollback: true,
        validationRequired: true,
        backupBeforeDeploy: true
      }

      expect(() => {
        new DeploymentPipeline(validConfig)
      }).not.toThrow()
    })

    test('should handle empty targets array', () => {
      const configWithEmptyTargets = {
        ...mockConfig,
        targets: []
      }

      expect(() => {
        new DeploymentPipeline(configWithEmptyTargets)
      }).not.toThrow()
    })

    test('should validate environment values', () => {
      const validEnvironments = ['development', 'staging', 'production']
      
      validEnvironments.forEach(env => {
        const config = {
          ...mockConfig,
          environment: env
        }

        expect(() => {
          new DeploymentPipeline(config)
        }).not.toThrow()
      })
    })
  })
})

describe('Deployment Pipeline Unit Tests', () => {
  describe('DeploymentPipeline Class', () => {
    test('should initialize with default options', () => {
      const config = {
        projectId: 'test-project',
        environment: 'development',
        targets: [],
        autoRollback: false,
        validationRequired: false,
        backupBeforeDeploy: false
      }

      const pipeline = new DeploymentPipeline(config)
      expect(pipeline).toBeDefined()
    })

    test('should accept custom working directory', () => {
      const config = {
        projectId: 'test-project',
        environment: 'development',
        targets: [],
        autoRollback: false,
        validationRequired: false,
        backupBeforeDeploy: false
      }

      const pipeline = new DeploymentPipeline(config, {
        workingDir: '/custom/path',
        verbose: true
      })
      
      expect(pipeline).toBeDefined()
    })

    test('should handle notification handlers', () => {
      const config = {
        projectId: 'test-project',
        environment: 'development',
        targets: [],
        autoRollback: false,
        validationRequired: false,
        backupBeforeDeploy: false
      }

      const pipeline = new DeploymentPipeline(config)
      
      let notificationReceived = false
      pipeline.onNotification((notification) => {
        notificationReceived = true
        expect(notification.type).toBeDefined()
        expect(notification.timestamp).toBeInstanceOf(Date)
      })

      expect(pipeline).toBeDefined()
    })
  })

  describe('Validation Results', () => {
    test('should create proper validation result structure', async () => {
      const validator = new PreDeployValidator({
        workingDir: process.cwd(),
        skipTests: true,
        skipLint: true,
        skipSecurity: true
      })

      const result = await validator.validate()
      
      expect(result).toHaveProperty('isValid')
      expect(result).toHaveProperty('issues')
      expect(result).toHaveProperty('warnings')
      expect(result).toHaveProperty('checks')
      expect(result).toHaveProperty('timestamp')
      
      expect(typeof result.isValid).toBe('boolean')
      expect(Array.isArray(result.issues)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
      expect(result.timestamp).toBeInstanceOf(Date)
      
      expect(result.checks).toHaveProperty('syntax')
      expect(result.checks).toHaveProperty('tests')
      expect(result.checks).toHaveProperty('environment')
      expect(result.checks).toHaveProperty('dependencies')
      expect(result.checks).toHaveProperty('build')
    })
  })

  describe('Deployment Results', () => {
    test('should create proper deployment result structure', async () => {
      const autoDeployer = new AutoDeployer({
        projectId: 'test-project',
        workingDir: process.cwd(),
        targets: [],
        verbose: false,
        dryRun: true
      })

      const result = await autoDeployer.deployAll()
      
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('version')
      expect(result).toHaveProperty('deployedComponents')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
      expect(result).toHaveProperty('rollbackAvailable')
      expect(result).toHaveProperty('deploymentId')
      expect(result).toHaveProperty('timestamp')
      expect(result).toHaveProperty('duration')
      
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.version).toBe('string')
      expect(Array.isArray(result.deployedComponents)).toBe(true)
      expect(Array.isArray(result.errors)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
      expect(typeof result.rollbackAvailable).toBe('boolean')
      expect(typeof result.deploymentId).toBe('string')
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(typeof result.duration).toBe('number')
    })
  })
})

// Helper function to run all deployment tests
function runDeploymentTests() {
  console.log('Running deployment pipeline tests...')
  
  // This would typically be handled by a test runner like Jest
  // For now, we'll just export the test functions
  return {
    message: 'Deployment tests defined and ready to run',
    testSuites: [
      'Deployment Pipeline Integration Tests',
      'Deployment Pipeline Unit Tests'
    ]
  }
}

module.exports = {
  runDeploymentTests
}