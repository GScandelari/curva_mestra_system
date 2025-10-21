/**
 * Validation System Tests
 * Tests for pre-deployment and post-deployment validation
 */

const { PreDeployValidator, ConfigurationValidator } = require('../utils/PreDeployValidator')
const { PostDeployValidator } = require('../utils/PostDeployValidator')
const fs = require('fs')
const path = require('path')

describe('Validation System Tests', () => {
  let testWorkingDir

  beforeEach(() => {
    // Create temporary test directory
    testWorkingDir = path.join(__dirname, 'temp-validation-test')
    if (!fs.existsSync(testWorkingDir)) {
      fs.mkdirSync(testWorkingDir, { recursive: true })
    }
  })

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(testWorkingDir)) {
      fs.rmSync(testWorkingDir, { recursive: true, force: true })
    }
  })

  describe('Pre-Deploy Validation', () => {
    test('should initialize with correct configuration', () => {
      const validator = new PreDeployValidator({
        workingDir: testWorkingDir,
        skipTests: true,
        skipLint: true,
        skipSecurity: true
      })

      expect(validator).toBeDefined()
    })

    test('should validate basic project structure', async () => {
      // Create minimal project structure
      const frontendDir = path.join(testWorkingDir, 'frontend')
      fs.mkdirSync(frontendDir, { recursive: true })
      
      fs.writeFileSync(
        path.join(frontendDir, 'package.json'),
        JSON.stringify({
          name: 'frontend',
          version: '1.0.0',
          scripts: {
            build: 'echo "build"',
            lint: 'echo "lint"',
            test: 'echo "test"'
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
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('isValid')
      expect(result).toHaveProperty('issues')
      expect(result).toHaveProperty('warnings')
      expect(result).toHaveProperty('checks')
      expect(result).toHaveProperty('timestamp')
      
      expect(typeof result.isValid).toBe('boolean')
      expect(Array.isArray(result.issues)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    test('should detect missing Firebase configuration', async () => {
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

    test('should validate Firebase configuration when present', async () => {
      // Create Firebase configuration files
      fs.writeFileSync(
        path.join(testWorkingDir, 'firebase.json'),
        JSON.stringify({
          hosting: {
            public: 'dist'
          },
          functions: {
            source: 'functions'
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
      
      expect(result.checks.environment).toBe(true)
    })

    test('should handle custom validators', async () => {
      const customValidator = {
        name: 'test-validator',
        validate: async () => true,
        errorMessage: 'Custom validation failed'
      }

      const validator = new PreDeployValidator({
        workingDir: testWorkingDir,
        skipTests: true,
        skipLint: true,
        skipSecurity: true,
        customValidators: [customValidator]
      })

      const result = await validator.validate()
      
      expect(result).toBeDefined()
      
      const validationResults = validator.getValidationResults()
      expect(validationResults.some(v => v.component === 'custom')).toBe(true)
    })

    test('should handle failing custom validators', async () => {
      const failingValidator = {
        name: 'failing-validator',
        validate: async () => false,
        errorMessage: 'This validator always fails'
      }

      const validator = new PreDeployValidator({
        workingDir: testWorkingDir,
        skipTests: true,
        skipLint: true,
        skipSecurity: true,
        customValidators: [failingValidator]
      })

      const result = await validator.validate()
      
      expect(result.isValid).toBe(false)
      expect(result.issues.some(issue => 
        issue.includes('Custom validation failed: failing-validator')
      )).toBe(true)
    })

    test('should validate environment variables security', async () => {
      // Create .env file in working directory
      fs.writeFileSync(
        path.join(testWorkingDir, '.env'),
        'SECRET_KEY=test-secret\nAPI_KEY=test-api-key'
      )

      const validator = new PreDeployValidator({
        workingDir: testWorkingDir,
        skipTests: true,
        skipLint: true,
        skipSecurity: false // Enable security checks
      })

      const result = await validator.validate()
      
      // Should detect potential security issues
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('Configuration Validator', () => {
    test('should validate Node.js version', async () => {
      const validator = new ConfigurationValidator(testWorkingDir)
      const result = await validator.validateAll()
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('isValid')
      expect(result).toHaveProperty('details')
      expect(result.details).toHaveProperty('nodeVersion')
      
      // Should pass Node.js version check in test environment
      expect(result.details.nodeVersion).toBe(true)
    })

    test('should validate Firebase configuration', async () => {
      // Create valid Firebase configuration
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

      const validator = new ConfigurationValidator(testWorkingDir)
      const result = await validator.validateAll()
      
      expect(result.details.firebase).toBe(true)
    })

    test('should detect missing Firebase configuration', async () => {
      const validator = new ConfigurationValidator(testWorkingDir)
      const result = await validator.validateAll()
      
      expect(result.details.firebase).toBe(false)
      expect(result.errors.some(error => 
        error.includes('Firebase configuration validation failed')
      )).toBe(true)
    })

    test('should validate dependencies', async () => {
      // Create package.json with dependencies
      const frontendDir = path.join(testWorkingDir, 'frontend')
      fs.mkdirSync(frontendDir, { recursive: true })
      
      fs.writeFileSync(
        path.join(frontendDir, 'package.json'),
        JSON.stringify({
          name: 'frontend',
          version: '1.0.0',
          scripts: {
            build: 'echo "build"'
          },
          dependencies: {
            react: '^18.0.0',
            vite: '^4.0.0'
          }
        })
      )

      // Create package-lock.json
      fs.writeFileSync(
        path.join(frontendDir, 'package-lock.json'),
        JSON.stringify({
          name: 'frontend',
          version: '1.0.0',
          lockfileVersion: 2
        })
      )

      // Create node_modules directory
      fs.mkdirSync(path.join(frontendDir, 'node_modules'), { recursive: true })

      const validator = new ConfigurationValidator(testWorkingDir)
      const result = await validator.validateAll()
      
      expect(result.details.dependencies).toBe(true)
    })

    test('should generate configuration report', async () => {
      const validator = new ConfigurationValidator(testWorkingDir)
      const report = await validator.generateReport()
      
      expect(typeof report).toBe('string')
      expect(report).toContain('Configuration Validation Report')
      expect(report).toContain('Node.js Version')
      expect(report).toContain('Firebase Configuration')
      expect(report).toContain('Environment Configuration')
      expect(report).toContain('Dependencies')
    })
  })

  describe('Post-Deploy Validation', () => {
    test('should initialize with correct configuration', () => {
      const validator = new PostDeployValidator({
        workingDir: testWorkingDir,
        timeoutMs: 30000,
        retryAttempts: 3,
        retryDelayMs: 1000
      })

      expect(validator).toBeDefined()
    })

    test('should validate deployment components', async () => {
      // Create mock Firebase configuration
      fs.writeFileSync(
        path.join(testWorkingDir, 'firebase.json'),
        JSON.stringify({
          hosting: {
            public: 'dist'
          }
        })
      )

      // Create mock build output
      const distDir = path.join(testWorkingDir, 'dist')
      fs.mkdirSync(distDir, { recursive: true })
      fs.writeFileSync(path.join(distDir, 'index.html'), '<html></html>')

      const validator = new PostDeployValidator({
        workingDir: testWorkingDir,
        timeoutMs: 30000,
        retryAttempts: 3,
        retryDelayMs: 1000
      })

      const result = await validator.validateDeployment()
      
      expect(result).toBeDefined()
      expect(result).toHaveProperty('name')
      expect(result).toHaveProperty('validations')
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('duration')
      expect(result).toHaveProperty('timestamp')
      
      expect(Array.isArray(result.validations)).toBe(true)
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.duration).toBe('number')
      expect(result.timestamp).toBeInstanceOf(Date)
    })

    test('should validate Firebase project configuration', async () => {
      // Create .firebaserc
      fs.writeFileSync(
        path.join(testWorkingDir, '.firebaserc'),
        JSON.stringify({
          projects: {
            default: 'test-project'
          }
        })
      )

      const validator = new PostDeployValidator({
        workingDir: testWorkingDir,
        timeoutMs: 30000,
        retryAttempts: 3,
        retryDelayMs: 1000
      })

      const result = await validator.validateDeployment()
      
      const firebaseConfigCheck = result.validations.find(v => 
        v.component === 'firebase-config'
      )
      
      expect(firebaseConfigCheck).toBeDefined()
      expect(firebaseConfigCheck.success).toBe(true)
    })

    test('should detect missing build outputs', async () => {
      const validator = new PostDeployValidator({
        workingDir: testWorkingDir,
        timeoutMs: 30000,
        retryAttempts: 3,
        retryDelayMs: 1000
      })

      const result = await validator.validateDeployment()
      
      const buildCheck = result.validations.find(v => 
        v.component === 'build'
      )
      
      expect(buildCheck).toBeDefined()
      expect(buildCheck.success).toBe(false)
      expect(buildCheck.message).toContain('No build outputs found')
    })

    test('should validate security configurations', async () => {
      // Create Firestore rules
      fs.writeFileSync(
        path.join(testWorkingDir, 'firestore.rules'),
        `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`
      )

      const validator = new PostDeployValidator({
        workingDir: testWorkingDir,
        timeoutMs: 30000,
        retryAttempts: 3,
        retryDelayMs: 1000
      })

      const result = await validator.validateDeployment()
      
      const securityChecks = result.validations.filter(v => 
        v.validationType === 'security'
      )
      
      expect(securityChecks.length).toBeGreaterThan(0)
    })

    test('should handle performance thresholds', async () => {
      const validator = new PostDeployValidator({
        workingDir: testWorkingDir,
        timeoutMs: 30000,
        retryAttempts: 3,
        retryDelayMs: 1000,
        performanceThresholds: {
          responseTimeMs: 1000,
          errorRate: 0.01
        }
      })

      const result = await validator.validateDeployment()
      
      expect(result).toBeDefined()
      // Performance checks would be included in validations
    })

    test('should validate with custom health endpoints', async () => {
      const validator = new PostDeployValidator({
        workingDir: testWorkingDir,
        timeoutMs: 30000,
        retryAttempts: 3,
        retryDelayMs: 1000,
        healthCheckEndpoints: [
          'https://example.com/health',
          'https://api.example.com/status'
        ]
      })

      const result = await validator.validateDeployment()
      
      const endpointChecks = result.validations.filter(v => 
        v.component === 'endpoint'
      )
      
      expect(endpointChecks.length).toBeGreaterThan(0)
    })
  })

  describe('Validation Performance', () => {
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

    test('should handle concurrent validations', async () => {
      const promises = []
      
      for (let i = 0; i < 3; i++) {
        const validator = new PreDeployValidator({
          workingDir: testWorkingDir,
          skipTests: true,
          skipLint: true,
          skipSecurity: true
        })
        
        promises.push(validator.validate())
      }

      const results = await Promise.allSettled(promises)
      
      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.status).toBe('fulfilled')
        if (result.status === 'fulfilled') {
          expect(result.value).toHaveProperty('isValid')
        }
      })
    })

    test('should handle validation timeouts gracefully', async () => {
      const validator = new PostDeployValidator({
        workingDir: testWorkingDir,
        timeoutMs: 100, // Very short timeout
        retryAttempts: 1,
        retryDelayMs: 50
      })

      const result = await validator.validateDeployment()
      
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })
  })

  describe('Error Handling', () => {
    test('should handle invalid working directory', async () => {
      const validator = new PreDeployValidator({
        workingDir: '/nonexistent/directory',
        skipTests: true,
        skipLint: true,
        skipSecurity: true
      })

      const result = await validator.validate()
      
      expect(result.isValid).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
    })

    test('should handle malformed configuration files', async () => {
      // Create malformed firebase.json
      fs.writeFileSync(
        path.join(testWorkingDir, 'firebase.json'),
        'invalid json content'
      )

      const validator = new PreDeployValidator({
        workingDir: testWorkingDir,
        skipTests: true,
        skipLint: true,
        skipSecurity: true
      })

      const result = await validator.validate()
      
      expect(result.isValid).toBe(false)
    })

    test('should provide meaningful error messages', async () => {
      const validator = new PreDeployValidator({
        workingDir: testWorkingDir,
        skipTests: true,
        skipLint: true,
        skipSecurity: true
      })

      const result = await validator.validate()
      
      result.issues.forEach(issue => {
        expect(typeof issue).toBe('string')
        expect(issue.length).toBeGreaterThan(0)
      })
    })

    test('should handle validation exceptions gracefully', async () => {
      // Test with configuration that might cause exceptions
      const validator = new PreDeployValidator({
        workingDir: testWorkingDir,
        skipTests: false, // Enable tests (might fail)
        skipLint: false,  // Enable lint (might fail)
        skipSecurity: false // Enable security (might fail)
      })

      const result = await validator.validate()
      
      expect(result).toBeDefined()
      expect(typeof result.isValid).toBe('boolean')
    })
  })
})

// Helper function to run validation tests
function runValidationTests() {
  console.log('Running validation system tests...')
  
  return {
    message: 'Validation tests defined and ready to run',
    testCategories: [
      'Pre-Deploy Validation',
      'Configuration Validator',
      'Post-Deploy Validation',
      'Validation Performance',
      'Error Handling'
    ]
  }
}

module.exports = {
  runValidationTests
}