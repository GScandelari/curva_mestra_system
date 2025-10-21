/**
 * Pre-Deploy Validation System
 * Comprehensive validation before deployment execution
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { ValidationResult, PreDeployValidation } from '../types/deploymentTypes'

export interface ValidationConfig {
  workingDir: string
  skipTests?: boolean
  skipLint?: boolean
  skipSecurity?: boolean
  customValidators?: CustomValidator[]
}

export interface CustomValidator {
  name: string
  validate: () => Promise<boolean>
  errorMessage: string
}

export class PreDeployValidator {
  private config: ValidationConfig
  private validationResults: PreDeployValidation[] = []

  constructor(config: ValidationConfig) {
    this.config = config
  }

  /**
   * Run complete pre-deployment validation
   */
  async validate(): Promise<ValidationResult> {
    const startTime = new Date()
    this.validationResults = []

    const result: ValidationResult = {
      isValid: true,
      issues: [],
      warnings: [],
      checks: {
        syntax: false,
        tests: false,
        environment: false,
        dependencies: false,
        build: false
      },
      timestamp: startTime
    }

    try {
      // 1. Syntax validation
      result.checks.syntax = await this.validateSyntax()
      if (!result.checks.syntax) {
        result.issues.push('Syntax validation failed')
        result.isValid = false
      }

      // 2. Lint validation
      if (!this.config.skipLint) {
        const lintResult = await this.validateLint()
        if (!lintResult) {
          result.warnings.push('Lint validation failed - proceeding with warnings')
        }
      }

      // 3. Environment configuration validation
      result.checks.environment = await this.validateEnvironmentConfig()
      if (!result.checks.environment) {
        result.issues.push('Environment configuration validation failed')
        result.isValid = false
      }

      // 4. Dependencies validation
      result.checks.dependencies = await this.validateDependencies()
      if (!result.checks.dependencies) {
        result.issues.push('Dependencies validation failed')
        result.isValid = false
      }

      // 5. Security validation
      if (!this.config.skipSecurity) {
        const securityResult = await this.validateSecurity()
        if (!securityResult) {
          result.warnings.push('Security validation failed - review recommended')
        }
      }

      // 6. Test validation
      if (!this.config.skipTests) {
        result.checks.tests = await this.validateTests()
        if (!result.checks.tests) {
          result.issues.push('Test validation failed')
          result.isValid = false
        }
      } else {
        result.warnings.push('Tests were skipped')
      }

      // 7. Build validation
      result.checks.build = await this.validateBuild()
      if (!result.checks.build) {
        result.issues.push('Build validation failed')
        result.isValid = false
      }

      // 8. Custom validators
      if (this.config.customValidators) {
        for (const validator of this.config.customValidators) {
          const customResult = await this.runCustomValidator(validator)
          if (!customResult) {
            result.issues.push(`Custom validation failed: ${validator.name}`)
            result.isValid = false
          }
        }
      }

      // 9. Firebase configuration validation
      const firebaseResult = await this.validateFirebaseConfig()
      if (!firebaseResult) {
        result.issues.push('Firebase configuration validation failed')
        result.isValid = false
      }

      // 10. Git status validation
      const gitResult = await this.validateGitStatus()
      if (!gitResult) {
        result.warnings.push('Git repository has uncommitted changes')
      }

    } catch (error) {
      result.issues.push(`Validation error: ${error.message}`)
      result.isValid = false
    }

    return result
  }

  /**
   * Get detailed validation results
   */
  getValidationResults(): PreDeployValidation[] {
    return [...this.validationResults]
  }

  // Private validation methods

  private async validateSyntax(): Promise<boolean> {
    try {
      this.addValidationResult('syntax', 'syntax', true, 'Checking TypeScript/JavaScript syntax')

      // Check frontend syntax
      if (fs.existsSync(path.join(this.config.workingDir, 'frontend'))) {
        execSync('npx tsc --noEmit', { 
          cwd: path.join(this.config.workingDir, 'frontend'),
          stdio: 'pipe'
        })
      }

      // Check backend syntax
      if (fs.existsSync(path.join(this.config.workingDir, 'backend'))) {
        execSync('npx tsc --noEmit', { 
          cwd: path.join(this.config.workingDir, 'backend'),
          stdio: 'pipe'
        })
      }

      // Check functions syntax
      if (fs.existsSync(path.join(this.config.workingDir, 'functions'))) {
        execSync('npm run build', { 
          cwd: path.join(this.config.workingDir, 'functions'),
          stdio: 'pipe'
        })
      }

      this.updateValidationResult('syntax', true, 'Syntax validation passed')
      return true

    } catch (error) {
      this.updateValidationResult('syntax', false, `Syntax validation failed: ${error.message}`)
      return false
    }
  }

  private async validateLint(): Promise<boolean> {
    try {
      this.addValidationResult('lint', 'lint', true, 'Running linting checks')

      // Run ESLint on frontend
      if (fs.existsSync(path.join(this.config.workingDir, 'frontend'))) {
        execSync('npm run lint', { 
          cwd: path.join(this.config.workingDir, 'frontend'),
          stdio: 'pipe'
        })
      }

      // Run ESLint on backend
      if (fs.existsSync(path.join(this.config.workingDir, 'backend'))) {
        execSync('npm run lint', { 
          cwd: path.join(this.config.workingDir, 'backend'),
          stdio: 'pipe'
        })
      }

      this.updateValidationResult('lint', true, 'Lint validation passed')
      return true

    } catch (error) {
      this.updateValidationResult('lint', false, `Lint validation failed: ${error.message}`)
      return false
    }
  }

  private async validateEnvironmentConfig(): Promise<boolean> {
    try {
      this.addValidationResult('environment', 'environment', true, 'Validating environment configuration')

      const requiredFiles = [
        'firebase.json',
        '.firebaserc'
      ]

      const optionalFiles = [
        '.env.example',
        '.env.production.example',
        'firestore.rules',
        'storage.rules'
      ]

      // Check required files
      for (const file of requiredFiles) {
        const filePath = path.join(this.config.workingDir, file)
        if (!fs.existsSync(filePath)) {
          throw new Error(`Required file missing: ${file}`)
        }
      }

      // Validate firebase.json structure
      const firebaseConfigPath = path.join(this.config.workingDir, 'firebase.json')
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'))
      
      if (!firebaseConfig.hosting && !firebaseConfig.functions) {
        throw new Error('firebase.json must contain hosting or functions configuration')
      }

      // Check environment files in components
      const components = ['frontend', 'backend', 'functions']
      for (const component of components) {
        const componentPath = path.join(this.config.workingDir, component)
        if (fs.existsSync(componentPath)) {
          const envExamplePath = path.join(componentPath, '.env.example')
          if (fs.existsSync(envExamplePath)) {
            // Validate .env.example has required variables
            const envContent = fs.readFileSync(envExamplePath, 'utf8')
            if (component === 'frontend' && !envContent.includes('VITE_FIREBASE_')) {
              throw new Error(`${component}/.env.example missing Firebase configuration variables`)
            }
          }
        }
      }

      this.updateValidationResult('environment', true, 'Environment configuration validation passed')
      return true

    } catch (error) {
      this.updateValidationResult('environment', false, `Environment validation failed: ${error.message}`)
      return false
    }
  }

  private async validateDependencies(): Promise<boolean> {
    try {
      this.addValidationResult('dependencies', 'dependencies', true, 'Validating dependencies')

      const components = ['frontend', 'backend', 'functions']
      
      for (const component of components) {
        const componentPath = path.join(this.config.workingDir, component)
        if (fs.existsSync(componentPath)) {
          const packageJsonPath = path.join(componentPath, 'package.json')
          const lockFilePath = path.join(componentPath, 'package-lock.json')
          
          if (!fs.existsSync(packageJsonPath)) {
            throw new Error(`${component}/package.json not found`)
          }

          if (!fs.existsSync(lockFilePath)) {
            throw new Error(`${component}/package-lock.json not found - run npm install`)
          }

          // Check for security vulnerabilities
          try {
            execSync('npm audit --audit-level=high', { 
              cwd: componentPath,
              stdio: 'pipe'
            })
          } catch (auditError) {
            // npm audit returns non-zero exit code when vulnerabilities are found
            // We'll treat this as a warning rather than a failure
            console.warn(`Security vulnerabilities found in ${component}`)
          }

          // Verify node_modules exists and is not empty
          const nodeModulesPath = path.join(componentPath, 'node_modules')
          if (!fs.existsSync(nodeModulesPath)) {
            throw new Error(`${component}/node_modules not found - run npm install`)
          }
        }
      }

      this.updateValidationResult('dependencies', true, 'Dependencies validation passed')
      return true

    } catch (error) {
      this.updateValidationResult('dependencies', false, `Dependencies validation failed: ${error.message}`)
      return false
    }
  }

  private async validateSecurity(): Promise<boolean> {
    try {
      this.addValidationResult('security', 'security', true, 'Running security checks')

      // Check for common security issues
      const securityChecks = [
        this.checkForHardcodedSecrets(),
        this.checkFirebaseRules(),
        this.checkCorsConfiguration(),
        this.checkEnvironmentVariables()
      ]

      const results = await Promise.all(securityChecks)
      const allPassed = results.every(result => result)

      this.updateValidationResult('security', allPassed, 
        allPassed ? 'Security validation passed' : 'Security issues found')
      return allPassed

    } catch (error) {
      this.updateValidationResult('security', false, `Security validation failed: ${error.message}`)
      return false
    }
  }

  private async validateTests(): Promise<boolean> {
    try {
      this.addValidationResult('tests', 'tests', true, 'Running tests')

      const components = ['frontend', 'backend', 'functions', 'shared']
      let testsPassed = true

      for (const component of components) {
        const componentPath = path.join(this.config.workingDir, component)
        if (fs.existsSync(componentPath)) {
          const packageJsonPath = path.join(componentPath, 'package.json')
          
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
            
            if (packageJson.scripts && packageJson.scripts.test) {
              try {
                execSync('npm test', { 
                  cwd: componentPath,
                  stdio: 'pipe'
                })
              } catch (testError) {
                console.error(`Tests failed in ${component}:`, testError.message)
                testsPassed = false
              }
            }
          }
        }
      }

      this.updateValidationResult('tests', testsPassed, 
        testsPassed ? 'All tests passed' : 'Some tests failed')
      return testsPassed

    } catch (error) {
      this.updateValidationResult('tests', false, `Test validation failed: ${error.message}`)
      return false
    }
  }

  private async validateBuild(): Promise<boolean> {
    try {
      this.addValidationResult('build', 'build', true, 'Validating build process')

      const components = ['frontend', 'backend', 'functions']
      
      for (const component of components) {
        const componentPath = path.join(this.config.workingDir, component)
        if (fs.existsSync(componentPath)) {
          const packageJsonPath = path.join(componentPath, 'package.json')
          
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
            
            if (packageJson.scripts && packageJson.scripts.build) {
              execSync('npm run build', { 
                cwd: componentPath,
                stdio: 'pipe'
              })
            }
          }
        }
      }

      this.updateValidationResult('build', true, 'Build validation passed')
      return true

    } catch (error) {
      this.updateValidationResult('build', false, `Build validation failed: ${error.message}`)
      return false
    }
  }

  private async validateFirebaseConfig(): Promise<boolean> {
    try {
      this.addValidationResult('firebase', 'configuration', true, 'Validating Firebase configuration')

      // Check if Firebase CLI is available
      execSync('firebase --version', { stdio: 'pipe' })

      // Check if user is logged in
      execSync('firebase projects:list', { 
        cwd: this.config.workingDir,
        stdio: 'pipe'
      })

      // Validate project configuration
      const firebaserc = path.join(this.config.workingDir, '.firebaserc')
      if (fs.existsSync(firebaserc)) {
        const config = JSON.parse(fs.readFileSync(firebaserc, 'utf8'))
        if (!config.projects || !config.projects.default) {
          throw new Error('Firebase project not configured in .firebaserc')
        }
      }

      this.updateValidationResult('firebase', true, 'Firebase configuration validation passed')
      return true

    } catch (error) {
      this.updateValidationResult('firebase', false, `Firebase validation failed: ${error.message}`)
      return false
    }
  }

  private async validateGitStatus(): Promise<boolean> {
    try {
      this.addValidationResult('git', 'git', true, 'Checking Git status')

      // Check if we're in a git repository
      execSync('git status', { 
        cwd: this.config.workingDir,
        stdio: 'pipe'
      })

      // Check for uncommitted changes
      const status = execSync('git status --porcelain', { 
        cwd: this.config.workingDir,
        encoding: 'utf8'
      })

      const hasUncommittedChanges = status.trim().length > 0

      this.updateValidationResult('git', !hasUncommittedChanges, 
        hasUncommittedChanges ? 'Uncommitted changes detected' : 'Git status clean')
      
      return !hasUncommittedChanges

    } catch (error) {
      this.updateValidationResult('git', false, `Git validation failed: ${error.message}`)
      return false
    }
  }

  private async runCustomValidator(validator: CustomValidator): Promise<boolean> {
    try {
      this.addValidationResult('custom', validator.name, true, `Running custom validator: ${validator.name}`)
      
      const result = await validator.validate()
      
      this.updateValidationResult('custom', result, 
        result ? `Custom validator ${validator.name} passed` : validator.errorMessage)
      
      return result

    } catch (error) {
      this.updateValidationResult('custom', false, `Custom validator ${validator.name} failed: ${error.message}`)
      return false
    }
  }

  // Security check methods
  private async checkForHardcodedSecrets(): Promise<boolean> {
    try {
      // Look for potential hardcoded secrets in source files
      const secretPatterns = [
        /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
        /secret[_-]?key\s*[:=]\s*['"][^'"]+['"]/i,
        /password\s*[:=]\s*['"][^'"]+['"]/i,
        /token\s*[:=]\s*['"][^'"]+['"]/i
      ]

      const sourceFiles = this.getSourceFiles()
      
      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8')
        for (const pattern of secretPatterns) {
          if (pattern.test(content)) {
            console.warn(`Potential hardcoded secret found in ${file}`)
            return false
          }
        }
      }

      return true
    } catch (error) {
      return false
    }
  }

  private async checkFirebaseRules(): Promise<boolean> {
    try {
      const rulesFiles = ['firestore.rules', 'storage.rules']
      
      for (const rulesFile of rulesFiles) {
        const rulesPath = path.join(this.config.workingDir, rulesFile)
        if (fs.existsSync(rulesPath)) {
          const rules = fs.readFileSync(rulesPath, 'utf8')
          
          // Check for overly permissive rules
          if (rules.includes('allow read, write: if true')) {
            console.warn(`Overly permissive rules found in ${rulesFile}`)
            return false
          }
        }
      }

      return true
    } catch (error) {
      return false
    }
  }

  private async checkCorsConfiguration(): Promise<boolean> {
    try {
      // Check for proper CORS configuration in backend
      const backendPath = path.join(this.config.workingDir, 'backend')
      if (fs.existsSync(backendPath)) {
        // Look for CORS configuration
        const sourceFiles = this.getSourceFiles(backendPath)
        let corsConfigFound = false

        for (const file of sourceFiles) {
          const content = fs.readFileSync(file, 'utf8')
          if (content.includes('cors') || content.includes('Access-Control-Allow-Origin')) {
            corsConfigFound = true
            break
          }
        }

        if (!corsConfigFound) {
          console.warn('CORS configuration not found in backend')
          return false
        }
      }

      return true
    } catch (error) {
      return false
    }
  }

  private async checkEnvironmentVariables(): Promise<boolean> {
    try {
      // Check that sensitive environment variables are not committed
      const envFiles = ['.env', '.env.local', '.env.production']
      
      for (const envFile of envFiles) {
        const envPath = path.join(this.config.workingDir, envFile)
        if (fs.existsSync(envPath)) {
          // Check if file is tracked by git
          try {
            execSync(`git ls-files --error-unmatch ${envFile}`, { 
              cwd: this.config.workingDir,
              stdio: 'pipe'
            })
            console.warn(`Environment file ${envFile} is tracked by git`)
            return false
          } catch (error) {
            // File is not tracked, which is good
          }
        }
      }

      return true
    } catch (error) {
      return false
    }
  }

  // Helper methods
  private getSourceFiles(basePath?: string): string[] {
    const searchPath = basePath || this.config.workingDir
    const files: string[] = []
    
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.json']
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'lib']

    const scanDirectory = (dir: string) => {
      try {
        const items = fs.readdirSync(dir)
        
        for (const item of items) {
          const itemPath = path.join(dir, item)
          const stat = fs.statSync(itemPath)
          
          if (stat.isDirectory() && !excludeDirs.includes(item)) {
            scanDirectory(itemPath)
          } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
            files.push(itemPath)
          }
        }
      } catch (error) {
        // Ignore errors for inaccessible directories
      }
    }

    scanDirectory(searchPath)
    return files
  }

  private addValidationResult(component: string, type: string, success: boolean, message: string): void {
    this.validationResults.push({
      component,
      validationType: type as any,
      success,
      message
    })
  }

  private updateValidationResult(component: string, success: boolean, message: string): void {
    const result = this.validationResults.find(r => r.component === component)
    if (result) {
      result.success = success
      result.message = message
    }
  }
}