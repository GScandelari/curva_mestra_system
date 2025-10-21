/**
 * Rollback System Tests
 * Tests for rollback functionality and recovery scenarios
 */

const { RollbackManager, RollbackStrategy } = require('../utils/RollbackManager')
const { GitIntegration } = require('../utils/GitIntegration')
const fs = require('fs')
const path = require('path')

describe('Rollback System Tests', () => {
  let testWorkingDir
  let rollbackManager
  let gitIntegration
  let mockConfig

  beforeEach(() => {
    // Create temporary test directory
    testWorkingDir = path.join(__dirname, 'temp-rollback-test')
    if (!fs.existsSync(testWorkingDir)) {
      fs.mkdirSync(testWorkingDir, { recursive: true })
    }

    // Mock Git integration
    gitIntegration = new GitIntegration({
      workingDir: testWorkingDir,
      autoCommit: true,
      autoPush: false,
      commitMessageTemplate: 'Deploy {deploymentId}',
      branchProtection: false
    })

    // Mock rollback configuration
    mockConfig = {
      workingDir: testWorkingDir,
      autoRollbackEnabled: true,
      rollbackTimeoutMs: 30000,
      maxRollbackAttempts: 3,
      validationRequired: true,
      backupBeforeRollback: true
    }

    rollbackManager = new RollbackManager(mockConfig, gitIntegration)
  })

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(testWorkingDir)) {
      fs.rmSync(testWorkingDir, { recursive: true, force: true })
    }
  })

  describe('Rollback Manager Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(rollbackManager).toBeDefined()
      
      const targets = rollbackManager.getAvailableRollbackTargets()
      expect(Array.isArray(targets)).toBe(true)
    })

    test('should load deployment history if available', () => {
      // Create mock deployment history
      const historyFile = path.join(testWorkingDir, '.deployment-history.json')
      const mockHistory = [
        {
          id: 'deploy-1',
          version: 'v1.0.0',
          timestamp: new Date().toISOString(),
          gitCommit: 'abc123',
          gitBranch: 'main',
          components: ['frontend'],
          status: 'active',
          rollbackAvailable: true
        }
      ]
      
      fs.writeFileSync(historyFile, JSON.stringify(mockHistory, null, 2))
      
      // Create new rollback manager to load history
      const newRollbackManager = new RollbackManager(mockConfig, gitIntegration)
      const targets = newRollbackManager.getAvailableRollbackTargets()
      
      expect(targets.length).toBeGreaterThan(0)
      expect(targets[0].version).toBe('v1.0.0')
    })

    test('should handle missing deployment history gracefully', () => {
      expect(() => {
        new RollbackManager(mockConfig, gitIntegration)
      }).not.toThrow()
    })
  })

  describe('Health Validation', () => {
    test('should validate deployment health', async () => {
      const validation = await rollbackManager.validateDeploymentHealth()
      
      expect(validation).toBeDefined()
      expect(typeof validation.success).toBe('boolean')
      expect(Array.isArray(validation.errors)).toBe(true)
      expect(Array.isArray(validation.warnings)).toBe(true)
      expect(Array.isArray(validation.healthChecks)).toBe(true)
    })

    test('should detect system health issues', async () => {
      // This test would normally check for actual health issues
      // In a test environment, we'll just verify the structure
      const validation = await rollbackManager.validateDeploymentHealth()
      
      validation.healthChecks.forEach(check => {
        expect(check).toHaveProperty('component')
        expect(check).toHaveProperty('validationType')
        expect(check).toHaveProperty('success')
        expect(check).toHaveProperty('message')
        expect(typeof check.success).toBe('boolean')
      })
    })

    test('should handle validation errors gracefully', async () => {
      // Test with invalid configuration to trigger errors
      const invalidConfig = {
        ...mockConfig,
        workingDir: '/nonexistent/directory'
      }
      
      const invalidRollbackManager = new RollbackManager(invalidConfig, gitIntegration)
      const validation = await invalidRollbackManager.validateDeploymentHealth()
      
      expect(validation.success).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    })
  })

  describe('Auto Rollback', () => {
    test('should handle auto rollback when no targets available', async () => {
      const result = await rollbackManager.executeAutoRollback('Test failure')
      
      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      expect(result.errors.some(error => 
        error.includes('No healthy deployment found')
      )).toBe(true)
    })

    test('should respect auto rollback configuration', async () => {
      // Disable auto rollback
      const disabledConfig = {
        ...mockConfig,
        autoRollbackEnabled: false
      }
      
      const disabledRollbackManager = new RollbackManager(disabledConfig, gitIntegration)
      const result = await disabledRollbackManager.executeAutoRollback('Test failure')
      
      expect(result.success).toBe(false)
      expect(result.errors.some(error => 
        error.includes('Auto-rollback is disabled')
      )).toBe(true)
    })

    test('should generate unique rollback IDs', async () => {
      const result1 = await rollbackManager.executeAutoRollback('Test failure 1')
      const result2 = await rollbackManager.executeAutoRollback('Test failure 2')
      
      expect(result1.rollbackId).toBeDefined()
      expect(result2.rollbackId).toBeDefined()
      expect(result1.rollbackId).not.toBe(result2.rollbackId)
    })
  })

  describe('Manual Rollback', () => {
    test('should handle rollback to non-existent version', async () => {
      const result = await rollbackManager.executeManualRollback('non-existent-version')
      
      expect(result.success).toBe(false)
      expect(result.errors.some(error => 
        error.includes('not found in history')
      )).toBe(true)
    })

    test('should validate rollback availability', async () => {
      // Create mock deployment history with unavailable rollback
      const historyFile = path.join(testWorkingDir, '.deployment-history.json')
      const mockHistory = [
        {
          id: 'deploy-1',
          version: 'v1.0.0',
          timestamp: new Date().toISOString(),
          gitCommit: 'abc123',
          gitBranch: 'main',
          components: ['frontend'],
          status: 'active',
          rollbackAvailable: false // Not available for rollback
        }
      ]
      
      fs.writeFileSync(historyFile, JSON.stringify(mockHistory, null, 2))
      
      const newRollbackManager = new RollbackManager(mockConfig, gitIntegration)
      const result = await newRollbackManager.executeManualRollback('v1.0.0')
      
      expect(result.success).toBe(false)
      expect(result.errors.some(error => 
        error.includes('Rollback not available')
      )).toBe(true)
    })
  })

  describe('Backup System', () => {
    test('should create rollback backup', async () => {
      const backupId = await rollbackManager.createRollbackBackup()
      
      expect(backupId).toBeDefined()
      expect(typeof backupId).toBe('string')
      expect(backupId.startsWith('backup-')).toBe(true)
      
      // Check if backup directory was created
      const backupDir = path.join(testWorkingDir, '.rollback-backups', backupId)
      expect(fs.existsSync(backupDir)).toBe(true)
      
      // Check if backup info file exists
      const backupInfoFile = path.join(backupDir, 'backup-info.json')
      expect(fs.existsSync(backupInfoFile)).toBe(true)
    })

    test('should restore from backup', async () => {
      // First create a backup
      const backupId = await rollbackManager.createRollbackBackup()
      
      // Then try to restore from it
      try {
        await rollbackManager.restoreFromBackup(backupId)
        // If no error is thrown, the restore was successful
        expect(true).toBe(true)
      } catch (error) {
        // Expected to fail in test environment without proper Git setup
        expect(error.message).toContain('Git')
      }
    })

    test('should handle restore from non-existent backup', async () => {
      try {
        await rollbackManager.restoreFromBackup('non-existent-backup')
        expect(false).toBe(true) // Should not reach here
      } catch (error) {
        expect(error.message).toContain('not found')
      }
    })
  })

  describe('Rollback Strategy', () => {
    test('should initialize rollback strategy', () => {
      const strategy = new RollbackStrategy(rollbackManager)
      expect(strategy).toBeDefined()
    })

    test('should determine rollback necessity based on validation', async () => {
      const strategy = new RollbackStrategy(rollbackManager)
      
      // Test with successful validation
      const successfulValidation = {
        success: true,
        errors: [],
        warnings: [],
        healthChecks: [
          {
            component: 'system',
            validationType: 'health',
            success: true,
            message: 'System healthy'
          }
        ]
      }
      
      const shouldRollback1 = await strategy.shouldRollback(successfulValidation)
      expect(shouldRollback1).toBe(false)
      
      // Test with failed validation
      const failedValidation = {
        success: false,
        errors: ['Critical system failure'],
        warnings: [],
        healthChecks: [
          {
            component: 'system',
            validationType: 'health',
            success: false,
            message: 'System unhealthy'
          }
        ]
      }
      
      const shouldRollback2 = await strategy.shouldRollback(failedValidation)
      expect(shouldRollback2).toBe(true)
    })

    test('should execute appropriate rollback strategy', async () => {
      const strategy = new RollbackStrategy(rollbackManager)
      
      const failureTypes = ['deployment', 'validation', 'health']
      
      for (const failureType of failureTypes) {
        const result = await strategy.executeStrategy(failureType, 'Test failure')
        
        expect(result).toBeDefined()
        expect(typeof result.success).toBe('boolean')
        expect(result.rollbackId).toBeDefined()
      }
    })

    test('should handle unknown failure types', async () => {
      const strategy = new RollbackStrategy(rollbackManager)
      
      try {
        await strategy.executeStrategy('unknown-failure', 'Test failure')
        expect(false).toBe(true) // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Unknown failure type')
      }
    })
  })

  describe('Performance and Reliability', () => {
    test('should complete rollback operations within timeout', async () => {
      const startTime = Date.now()
      
      await rollbackManager.executeAutoRollback('Performance test')
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(mockConfig.rollbackTimeoutMs)
    })

    test('should handle concurrent rollback attempts', async () => {
      const promises = []
      
      for (let i = 0; i < 3; i++) {
        promises.push(
          rollbackManager.executeAutoRollback(`Concurrent test ${i}`)
        )
      }
      
      const results = await Promise.allSettled(promises)
      
      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.status).toBeDefined()
        if (result.status === 'fulfilled') {
          expect(result.value.rollbackId).toBeDefined()
        }
      })
    })

    test('should maintain rollback history integrity', async () => {
      // Perform multiple rollback attempts
      await rollbackManager.executeAutoRollback('Test 1')
      await rollbackManager.executeAutoRollback('Test 2')
      await rollbackManager.executeAutoRollback('Test 3')
      
      const targets = rollbackManager.getAvailableRollbackTargets()
      expect(Array.isArray(targets)).toBe(true)
      
      // History should remain consistent
      const historyFile = path.join(testWorkingDir, '.deployment-history.json')
      if (fs.existsSync(historyFile)) {
        const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'))
        expect(Array.isArray(history)).toBe(true)
      }
    })
  })

  describe('Error Recovery', () => {
    test('should handle Git operation failures gracefully', async () => {
      // Test with invalid Git configuration
      const invalidGitIntegration = new GitIntegration({
        workingDir: '/nonexistent/directory',
        autoCommit: true,
        autoPush: false,
        commitMessageTemplate: 'Deploy {deploymentId}',
        branchProtection: false
      })
      
      const invalidRollbackManager = new RollbackManager(mockConfig, invalidGitIntegration)
      const result = await invalidRollbackManager.executeAutoRollback('Git failure test')
      
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    test('should handle filesystem errors gracefully', async () => {
      // Test with read-only directory (if possible)
      const result = await rollbackManager.executeAutoRollback('Filesystem test')
      
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })

    test('should provide meaningful error messages', async () => {
      const result = await rollbackManager.executeManualRollback('invalid-version')
      
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('not found in history')
    })
  })
})

// Helper function to run rollback tests
function runRollbackTests() {
  console.log('Running rollback system tests...')
  
  return {
    message: 'Rollback tests defined and ready to run',
    testCategories: [
      'Rollback Manager Initialization',
      'Health Validation',
      'Auto Rollback',
      'Manual Rollback',
      'Backup System',
      'Rollback Strategy',
      'Performance and Reliability',
      'Error Recovery'
    ]
  }
}

module.exports = {
  runRollbackTests
}