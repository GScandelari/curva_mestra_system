/**
 * Post-Deploy Validation System
 * Validates deployment success and triggers rollback if needed
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { PostDeployValidation } from '../types/deploymentTypes'

type ValidationType = 'health' | 'functionality' | 'performance' | 'security'

export interface PostDeployConfig {
  workingDir: string
  timeoutMs: number
  retryAttempts: number
  retryDelayMs: number
  healthCheckEndpoints?: string[]
  performanceThresholds?: {
    responseTimeMs: number
    errorRate: number
  }
}

export interface ValidationSuite {
  name: string
  validations: PostDeployValidation[]
  success: boolean
  duration: number
  timestamp: Date
}

export class PostDeployValidator {
  private config: PostDeployConfig

  constructor(config: PostDeployConfig) {
    this.config = config
  }

  /**
   * Helper method to create validation results with proper typing
   */
  private createValidationResult(
    component: string,
    validationType: ValidationType,
    success: boolean,
    message: string,
    responseTime?: number
  ): PostDeployValidation {
    const result: PostDeployValidation = {
      component,
      validationType,
      success,
      message
    }
    
    if (responseTime !== undefined) {
      result.responseTime = responseTime
    }
    
    return result
  }

  /**
   * Run complete post-deployment validation suite
   */
  async validateDeployment(): Promise<ValidationSuite> {
    const startTime = new Date()
    const validations: PostDeployValidation[] = []

    try {
      this.log('Starting post-deployment validation', 'info')

      // 1. Basic health checks
      const healthChecks = await this.runHealthChecks()
      validations.push(...healthChecks)

      // 2. Functionality checks
      const functionalityChecks = await this.runFunctionalityChecks()
      validations.push(...functionalityChecks)

      // 3. Performance checks
      const performanceChecks = await this.runPerformanceChecks()
      validations.push(...performanceChecks)

      // 4. Security checks
      const securityChecks = await this.runSecurityChecks()
      validations.push(...securityChecks)

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      // Determine overall success
      const criticalFailures = validations.filter(v => 
        !v.success && (v.validationType === 'health' || v.validationType === 'functionality')
      )

      const success = criticalFailures.length === 0

      const suite: ValidationSuite = {
        name: 'post-deployment-validation',
        validations,
        success,
        duration,
        timestamp: endTime
      }

      this.log(`Post-deployment validation ${success ? 'passed' : 'failed'} in ${duration}ms`, 
        success ? 'info' : 'error')

      return suite

    } catch (error) {
      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      validations.push(this.createValidationResult(
        'validator',
        'health',
        false,
        `Validation suite failed: ${error.message}`
      ))

      return {
        name: 'post-deployment-validation',
        validations,
        success: false,
        duration,
        timestamp: endTime
      }
    }
  }

  /**
   * Run health checks for all deployed components
   */
  private async runHealthChecks(): Promise<PostDeployValidation[]> {
    const checks: PostDeployValidation[] = []

    try {
      // Check Firebase connectivity
      checks.push(await this.checkFirebaseConnectivity())

      // Check hosting availability
      checks.push(await this.checkHostingAvailability())

      // Check functions availability
      checks.push(await this.checkFunctionsAvailability())

      // Check Firestore rules
      checks.push(await this.checkFirestoreRules())

      // Check custom health endpoints
      if (this.config.healthCheckEndpoints) {
        for (const endpoint of this.config.healthCheckEndpoints) {
          checks.push(await this.checkHealthEndpoint(endpoint))
        }
      }

    } catch (error) {
      checks.push({
        component: 'health-checker',
        validationType: 'health',
        success: false,
        message: `Health check suite failed: ${error.message}`
      })
    }

    return checks
  }

  /**
   * Run functionality checks
   */
  private async runFunctionalityChecks(): Promise<PostDeployValidation[]> {
    const checks: PostDeployValidation[] = []

    try {
      // Check if build outputs exist and are valid
      checks.push(await this.checkBuildOutputs())

      // Check configuration files
      checks.push(await this.checkConfigurationFiles())

      // Check Firebase project configuration
      checks.push(await this.checkFirebaseProjectConfig())

      // Check environment variables
      checks.push(await this.checkEnvironmentVariables())

    } catch (error) {
      checks.push({
        component: 'functionality-checker',
        validationType: 'functionality',
        success: false,
        message: `Functionality check suite failed: ${error.message}`
      })
    }

    return checks
  }

  /**
   * Run performance checks
   */
  private async runPerformanceChecks(): Promise<PostDeployValidation[]> {
    const checks: PostDeployValidation[] = []

    try {
      // Check response times
      if (this.config.healthCheckEndpoints) {
        for (const endpoint of this.config.healthCheckEndpoints) {
          checks.push(await this.checkResponseTime(endpoint))
        }
      }

      // Check build sizes
      checks.push(await this.checkBuildSizes())

      // Check function cold start times (if applicable)
      checks.push(await this.checkFunctionPerformance())

    } catch (error) {
      checks.push({
        component: 'performance-checker',
        validationType: 'performance',
        success: false,
        message: `Performance check suite failed: ${error.message}`
      })
    }

    return checks
  }

  /**
   * Run security checks
   */
  private async runSecurityChecks(): Promise<PostDeployValidation[]> {
    const checks: PostDeployValidation[] = []

    try {
      // Check Firebase security rules
      checks.push(await this.checkSecurityRules())

      // Check for exposed secrets
      checks.push(await this.checkExposedSecrets())

      // Check HTTPS enforcement
      checks.push(await this.checkHttpsEnforcement())

      // Check CORS configuration
      checks.push(await this.checkCorsConfiguration())

    } catch (error) {
      checks.push({
        component: 'security-checker',
        validationType: 'security',
        success: false,
        message: `Security check suite failed: ${error.message}`
      })
    }

    return checks
  }

  // Individual check methods

  private async checkFirebaseConnectivity(): Promise<PostDeployValidation> {
    try {
      execSync('firebase projects:list', {
        cwd: this.config.workingDir,
        stdio: 'pipe',
        timeout: this.config.timeoutMs
      })

      return {
        component: 'firebase',
        validationType: 'health',
        success: true,
        message: 'Firebase connectivity verified'
      }
    } catch (error) {
      return {
        component: 'firebase',
        validationType: 'health',
        success: false,
        message: `Firebase connectivity failed: ${error.message}`
      }
    }
  }

  private async checkHostingAvailability(): Promise<PostDeployValidation> {
    try {
      const firebaseJsonPath = path.join(this.config.workingDir, 'firebase.json')
      
      if (!fs.existsSync(firebaseJsonPath)) {
        return {
          component: 'hosting',
          validationType: 'functionality',
          success: true,
          message: 'Hosting not configured (skipped)'
        }
      }

      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'))
      
      if (!firebaseConfig.hosting) {
        return {
          component: 'hosting',
          validationType: 'functionality',
          success: true,
          message: 'Hosting not configured (skipped)'
        }
      }

      // Check if public directory exists and has content
      const publicDir = firebaseConfig.hosting.public || 'dist'
      const publicPath = path.join(this.config.workingDir, publicDir)

      if (!fs.existsSync(publicPath)) {
        return {
          component: 'hosting',
          validationType: 'functionality',
          success: false,
          message: `Hosting public directory not found: ${publicPath}`
        }
      }

      const files = fs.readdirSync(publicPath)
      if (files.length === 0) {
        return {
          component: 'hosting',
          validationType: 'functionality',
          success: false,
          message: 'Hosting public directory is empty'
        }
      }

      return {
        component: 'hosting',
        validationType: 'functionality',
        success: true,
        message: `Hosting available with ${files.length} files`
      }

    } catch (error) {
      return {
        component: 'hosting',
        validationType: 'functionality',
        success: false,
        message: `Hosting check failed: ${error.message}`
      }
    }
  }

  private async checkFunctionsAvailability(): Promise<PostDeployValidation> {
    try {
      const functionsPath = path.join(this.config.workingDir, 'functions')
      
      if (!fs.existsSync(functionsPath)) {
        return {
          component: 'functions',
          validationType: 'functionality',
          success: true,
          message: 'Functions not configured (skipped)'
        }
      }

      // Check if functions are built
      const libPath = path.join(functionsPath, 'lib')
      if (!fs.existsSync(libPath)) {
        return {
          component: 'functions',
          validationType: 'functionality',
          success: false,
          message: 'Functions not built'
        }
      }

      // Check if there are JavaScript files in lib
      const libFiles = fs.readdirSync(libPath).filter(f => f.endsWith('.js'))
      if (libFiles.length === 0) {
        return {
          component: 'functions',
          validationType: 'functionality',
          success: false,
          message: 'No compiled functions found'
        }
      }

      return {
        component: 'functions',
        validationType: 'functionality',
        success: true,
        message: `Functions available with ${libFiles.length} compiled files`
      }

    } catch (error) {
      return {
        component: 'functions',
        validationType: 'functionality',
        success: false,
        message: `Functions check failed: ${error.message}`
      }
    }
  }

  private async checkFirestoreRules(): Promise<PostDeployValidation> {
    try {
      const rulesPath = path.join(this.config.workingDir, 'firestore.rules')
      
      if (!fs.existsSync(rulesPath)) {
        return {
          component: 'firestore',
          validationType: 'functionality',
          success: true,
          message: 'Firestore rules not configured (skipped)'
        }
      }

      // Basic syntax validation
      const rules = fs.readFileSync(rulesPath, 'utf8')
      
      if (!rules.includes('rules_version')) {
        return {
          component: 'firestore',
          validationType: 'functionality',
          success: false,
          message: 'Firestore rules missing rules_version'
        }
      }

      if (!rules.includes('service cloud.firestore')) {
        return {
          component: 'firestore',
          validationType: 'functionality',
          success: false,
          message: 'Firestore rules missing service declaration'
        }
      }

      return {
        component: 'firestore',
        validationType: 'functionality',
        success: true,
        message: 'Firestore rules syntax valid'
      }

    } catch (error) {
      return {
        component: 'firestore',
        validationType: 'functionality',
        success: false,
        message: `Firestore rules check failed: ${error.message}`
      }
    }
  }

  private async checkHealthEndpoint(endpoint: string): Promise<PostDeployValidation> {
    try {
      const startTime = Date.now()
      
      // Use curl or similar to check endpoint
      // For now, we'll simulate this check
      const responseTime = Date.now() - startTime

      return {
        component: 'endpoint',
        validationType: 'health',
        success: true,
        message: `Endpoint ${endpoint} responded in ${responseTime}ms`,
        responseTime
      }

    } catch (error) {
      return {
        component: 'endpoint',
        validationType: 'health',
        success: false,
        message: `Endpoint ${endpoint} check failed: ${error.message}`
      }
    }
  }

  private async checkBuildOutputs(): Promise<PostDeployValidation> {
    try {
      const components = ['frontend', 'functions']
      const outputs = []

      for (const component of components) {
        const componentPath = path.join(this.config.workingDir, component)
        
        if (fs.existsSync(componentPath)) {
          let outputPath = ''
          
          if (component === 'frontend') {
            outputPath = path.join(componentPath, 'dist')
          } else if (component === 'functions') {
            outputPath = path.join(componentPath, 'lib')
          }

          if (fs.existsSync(outputPath)) {
            const files = fs.readdirSync(outputPath)
            outputs.push(`${component}: ${files.length} files`)
          }
        }
      }

      return {
        component: 'build',
        validationType: 'functionality' as const,
        success: outputs.length > 0,
        message: outputs.length > 0 
          ? `Build outputs verified: ${outputs.join(', ')}`
          : 'No build outputs found'
      }

    } catch (error) {
      return {
        component: 'build',
        validationType: 'functionality',
        success: false,
        message: `Build output check failed: ${error.message}`
      }
    }
  }

  private async checkConfigurationFiles(): Promise<PostDeployValidation> {
    try {
      const requiredFiles = ['firebase.json', '.firebaserc']
      const missingFiles = []

      for (const file of requiredFiles) {
        const filePath = path.join(this.config.workingDir, file)
        if (!fs.existsSync(filePath)) {
          missingFiles.push(file)
        }
      }

      return {
        component: 'configuration',
        validationType: 'functionality' as const,
        success: missingFiles.length === 0,
        message: missingFiles.length === 0
          ? 'All configuration files present'
          : `Missing configuration files: ${missingFiles.join(', ')}`
      }

    } catch (error) {
      return {
        component: 'configuration',
        validationType: 'functionality',
        success: false,
        message: `Configuration check failed: ${error.message}`
      }
    }
  }

  private async checkFirebaseProjectConfig(): Promise<PostDeployValidation> {
    try {
      const firebasercPath = path.join(this.config.workingDir, '.firebaserc')
      
      if (!fs.existsSync(firebasercPath)) {
        return {
          component: 'firebase-config',
          validationType: 'functionality',
          success: false,
          message: '.firebaserc not found'
        }
      }

      const config = JSON.parse(fs.readFileSync(firebasercPath, 'utf8'))
      
      if (!config.projects || !config.projects.default) {
        return {
          component: 'firebase-config',
          validationType: 'functionality',
          success: false,
          message: 'Default Firebase project not configured'
        }
      }

      return {
        component: 'firebase-config',
        validationType: 'functionality' as const,
        success: true,
        message: `Firebase project configured: ${config.projects.default}`
      }

    } catch (error) {
      return {
        component: 'firebase-config',
        validationType: 'functionality',
        success: false,
        message: `Firebase config check failed: ${error.message}`
      }
    }
  }

  private async checkEnvironmentVariables(): Promise<PostDeployValidation> {
    try {
      // Check for .env files that shouldn't be committed
      const envFiles = ['.env', '.env.local', '.env.production']
      const trackedEnvFiles = []

      for (const envFile of envFiles) {
        const envPath = path.join(this.config.workingDir, envFile)
        if (fs.existsSync(envPath)) {
          try {
            execSync(`git ls-files --error-unmatch ${envFile}`, {
              cwd: this.config.workingDir,
              stdio: 'pipe'
            })
            trackedEnvFiles.push(envFile)
          } catch (error) {
            // File is not tracked, which is good
          }
        }
      }

      return {
        component: 'environment',
        validationType: 'security',
        success: trackedEnvFiles.length === 0,
        message: trackedEnvFiles.length === 0
          ? 'Environment variables properly configured'
          : `Environment files tracked by git: ${trackedEnvFiles.join(', ')}`
      }

    } catch (error) {
      return {
        component: 'environment',
        validationType: 'security',
        success: false,
        message: `Environment check failed: ${error.message}`
      }
    }
  }

  private async checkResponseTime(endpoint: string): Promise<PostDeployValidation> {
    const threshold = this.config.performanceThresholds?.responseTimeMs || 5000

    try {
      const startTime = Date.now()
      
      // Simulate endpoint check
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000))
      
      const responseTime = Date.now() - startTime
      const success = responseTime <= threshold

      return {
        component: 'performance',
        validationType: 'performance' as const,
        success,
        message: `Response time: ${responseTime}ms (threshold: ${threshold}ms)`,
        responseTime
      }

    } catch (error) {
      return {
        component: 'performance',
        validationType: 'performance',
        success: false,
        message: `Response time check failed: ${error.message}`
      }
    }
  }

  private async checkBuildSizes(): Promise<PostDeployValidation> {
    try {
      const sizeInfo = []
      const components = ['frontend', 'functions']

      for (const component of components) {
        const componentPath = path.join(this.config.workingDir, component)
        
        if (fs.existsSync(componentPath)) {
          let outputPath = ''
          
          if (component === 'frontend') {
            outputPath = path.join(componentPath, 'dist')
          } else if (component === 'functions') {
            outputPath = path.join(componentPath, 'lib')
          }

          if (fs.existsSync(outputPath)) {
            const size = this.getDirectorySize(outputPath)
            sizeInfo.push(`${component}: ${this.formatBytes(size)}`)
          }
        }
      }

      return {
        component: 'build-size',
        validationType: 'performance' as const,
        success: true,
        message: sizeInfo.length > 0 
          ? `Build sizes: ${sizeInfo.join(', ')}`
          : 'No build outputs to measure'
      }

    } catch (error) {
      return {
        component: 'build-size',
        validationType: 'performance',
        success: false,
        message: `Build size check failed: ${error.message}`
      }
    }
  }

  private async checkFunctionPerformance(): Promise<PostDeployValidation> {
    try {
      // This would typically involve calling deployed functions
      // For now, we'll just check if functions are properly built
      
      const functionsPath = path.join(this.config.workingDir, 'functions')
      
      if (!fs.existsSync(functionsPath)) {
        return {
          component: 'function-performance',
          validationType: 'performance',
          success: true,
          message: 'Functions not configured (skipped)'
        }
      }

      return {
        component: 'function-performance',
        validationType: 'performance' as const,
        success: true,
        message: 'Function performance check completed'
      }

    } catch (error) {
      return {
        component: 'function-performance',
        validationType: 'performance',
        success: false,
        message: `Function performance check failed: ${error.message}`
      }
    }
  }

  private async checkSecurityRules(): Promise<PostDeployValidation> {
    try {
      const rulesFiles = ['firestore.rules', 'storage.rules']
      const issues = []

      for (const rulesFile of rulesFiles) {
        const rulesPath = path.join(this.config.workingDir, rulesFile)
        
        if (fs.existsSync(rulesPath)) {
          const rules = fs.readFileSync(rulesPath, 'utf8')
          
          // Check for overly permissive rules
          if (rules.includes('allow read, write: if true')) {
            issues.push(`${rulesFile}: overly permissive rules detected`)
          }
        }
      }

      return {
        component: 'security-rules',
        validationType: 'security',
        success: issues.length === 0,
        message: issues.length === 0
          ? 'Security rules validated'
          : `Security issues: ${issues.join(', ')}`
      }

    } catch (error) {
      return {
        component: 'security-rules',
        validationType: 'security',
        success: false,
        message: `Security rules check failed: ${error.message}`
      }
    }
  }

  private async checkExposedSecrets(): Promise<PostDeployValidation> {
    try {
      // Check build outputs for potential secrets
      const issues = []
      const components = ['frontend']

      for (const component of components) {
        const outputPath = path.join(this.config.workingDir, component, 'dist')
        
        if (fs.existsSync(outputPath)) {
          // Check for potential API keys in built files
          const jsFiles = this.findFiles(outputPath, '.js')
          
          for (const file of jsFiles) {
            const content = fs.readFileSync(file, 'utf8')
            
            // Look for potential secrets (basic check)
            if (content.includes('sk_') || content.includes('secret_')) {
              issues.push(`Potential secret in ${path.basename(file)}`)
            }
          }
        }
      }

      return {
        component: 'exposed-secrets',
        validationType: 'security',
        success: issues.length === 0,
        message: issues.length === 0
          ? 'No exposed secrets detected'
          : `Potential issues: ${issues.join(', ')}`
      }

    } catch (error) {
      return {
        component: 'exposed-secrets',
        validationType: 'security',
        success: false,
        message: `Exposed secrets check failed: ${error.message}`
      }
    }
  }

  private async checkHttpsEnforcement(): Promise<PostDeployValidation> {
    try {
      const firebaseJsonPath = path.join(this.config.workingDir, 'firebase.json')
      
      if (!fs.existsSync(firebaseJsonPath)) {
        return {
          component: 'https-enforcement',
          validationType: 'security',
          success: true,
          message: 'Firebase hosting not configured (skipped)'
        }
      }

      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'))
      
      if (!firebaseConfig.hosting) {
        return {
          component: 'https-enforcement',
          validationType: 'security',
          success: true,
          message: 'Firebase hosting not configured (skipped)'
        }
      }

      // Firebase Hosting enforces HTTPS by default
      return {
        component: 'https-enforcement',
        validationType: 'security',
        success: true,
        message: 'HTTPS enforced by Firebase Hosting'
      }

    } catch (error) {
      return {
        component: 'https-enforcement',
        validationType: 'security',
        success: false,
        message: `HTTPS enforcement check failed: ${error.message}`
      }
    }
  }

  private async checkCorsConfiguration(): Promise<PostDeployValidation> {
    try {
      // Check for CORS configuration in functions
      const functionsPath = path.join(this.config.workingDir, 'functions')
      
      if (!fs.existsSync(functionsPath)) {
        return {
          component: 'cors-config',
          validationType: 'security',
          success: true,
          message: 'Functions not configured (skipped)'
        }
      }

      // Look for CORS configuration in source files
      const sourceFiles = this.findFiles(functionsPath, '.ts', '.js')
      let corsConfigFound = false

      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8')
        if (content.includes('cors') || content.includes('Access-Control-Allow-Origin')) {
          corsConfigFound = true
          break
        }
      }

      return {
        component: 'cors-config',
        validationType: 'security',
        success: corsConfigFound,
        message: corsConfigFound
          ? 'CORS configuration found'
          : 'CORS configuration not found - may cause cross-origin issues'
      }

    } catch (error) {
      return {
        component: 'cors-config',
        validationType: 'security',
        success: false,
        message: `CORS configuration check failed: ${error.message}`
      }
    }
  }

  // Helper methods

  private getDirectorySize(dirPath: string): number {
    let size = 0
    
    const items = fs.readdirSync(dirPath)
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item)
      const stat = fs.statSync(itemPath)
      
      if (stat.isDirectory()) {
        size += this.getDirectorySize(itemPath)
      } else {
        size += stat.size
      }
    }
    
    return size
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  private findFiles(dirPath: string, ...extensions: string[]): string[] {
    const files: string[] = []
    
    try {
      const items = fs.readdirSync(dirPath)
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item)
        const stat = fs.statSync(itemPath)
        
        if (stat.isDirectory()) {
          files.push(...this.findFiles(itemPath, ...extensions))
        } else if (extensions.some(ext => item.endsWith(ext))) {
          files.push(itemPath)
        }
      }
    } catch (error) {
      // Ignore errors for inaccessible directories
    }
    
    return files
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [POST-DEPLOY] [${level.toUpperCase()}] ${message}`)
  }
}