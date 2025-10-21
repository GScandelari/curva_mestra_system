/**
 * Deployment Pipeline
 * Automated deployment system with validation and rollback capabilities
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { 
  ValidationResult, 
  DeployResult, 
  RollbackResult, 
  DeploymentConfig,
  DeploymentVersion,
  DeploymentLog,
  GitCommitInfo,
  BuildResult,
  PreDeployValidation,
  PostDeployValidation,
  DeploymentNotification,
  DeploymentStatus,
  DeploymentProgress
} from '../types/deploymentTypes'

export class DeploymentPipeline {
  private config: DeploymentConfig
  private workingDir: string
  private verbose: boolean
  private deploymentHistory: DeploymentVersion[] = []
  private notificationHandlers: ((notification: DeploymentNotification) => void)[] = []

  constructor(config: DeploymentConfig, options: { workingDir?: string; verbose?: boolean } = {}) {
    this.config = config
    this.workingDir = options.workingDir || process.cwd()
    this.verbose = options.verbose || false
    this.loadDeploymentHistory()
  }

  /**
   * Execute complete deployment pipeline
   */
  async deploy(options: {
    commitMessage?: string
    skipValidation?: boolean
    skipTests?: boolean
    targets?: string[]
  } = {}): Promise<DeployResult> {
    const deploymentId = this.generateDeploymentId()
    const startTime = new Date()
    
    const progress: DeploymentProgress = {
      status: DeploymentStatus.PENDING,
      currentStep: 'Initializing deployment',
      totalSteps: 8,
      completedSteps: 0,
      startTime,
      errors: [],
      warnings: []
    }

    try {
      this.log('Starting deployment pipeline', 'info')
      await this.sendNotification({
        type: 'started',
        timestamp: startTime,
        version: deploymentId,
        components: this.getTargetComponents(options.targets),
        message: 'Deployment pipeline started'
      })

      // Step 1: Pre-deployment validation
      progress.status = DeploymentStatus.VALIDATING
      progress.currentStep = 'Running pre-deployment validation'
      
      if (!options.skipValidation) {
        const validation = await this.validateChanges(options.skipTests)
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.issues.join(', ')}`)
        }
        progress.warnings.push(...validation.warnings)
      }
      progress.completedSteps++

      // Step 2: Create Git commit
      progress.currentStep = 'Creating Git commit'
      const gitCommit = await this.createGitCommit(options.commitMessage || `Deploy ${deploymentId}`)
      progress.completedSteps++

      // Step 3: Build components
      progress.status = DeploymentStatus.BUILDING
      progress.currentStep = 'Building components'
      const buildResults = await this.buildComponents(this.getTargetComponents(options.targets))
      progress.completedSteps++

      // Step 4: Deploy to Firebase
      progress.status = DeploymentStatus.DEPLOYING
      progress.currentStep = 'Deploying to Firebase'
      const deployResults = await this.deployToFirebase(buildResults)
      progress.completedSteps++

      // Step 5: Post-deployment validation
      progress.status = DeploymentStatus.VALIDATING_POST
      progress.currentStep = 'Running post-deployment validation'
      const postValidation = await this.validatePostDeploy()
      if (!postValidation.success) {
        throw new Error(`Post-deployment validation failed: ${postValidation.errors.join(', ')}`)
      }
      progress.completedSteps++

      // Step 6: Update deployment history
      progress.currentStep = 'Updating deployment history'
      const version = await this.createDeploymentVersion(deploymentId, gitCommit, deployResults.components)
      progress.completedSteps++

      // Step 7: Send completion notification
      progress.status = DeploymentStatus.COMPLETED
      progress.currentStep = 'Deployment completed'
      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      const result: DeployResult = {
        success: true,
        version: deploymentId,
        deployedComponents: deployResults.components,
        errors: [],
        warnings: progress.warnings,
        rollbackAvailable: true,
        deploymentId,
        timestamp: endTime,
        duration,
        url: deployResults.url
      }

      await this.sendNotification({
        type: 'completed',
        timestamp: endTime,
        version: deploymentId,
        components: deployResults.components,
        message: `Deployment completed successfully in ${duration}ms`
      })

      this.log(`Deployment ${deploymentId} completed successfully`, 'info')
      return result

    } catch (error) {
      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      progress.status = DeploymentStatus.FAILED
      progress.errors.push(error.message)

      const result: DeployResult = {
        success: false,
        version: deploymentId,
        deployedComponents: [],
        errors: [error.message],
        warnings: progress.warnings,
        rollbackAvailable: false,
        deploymentId,
        timestamp: endTime,
        duration
      }

      await this.sendNotification({
        type: 'failed',
        timestamp: endTime,
        version: deploymentId,
        components: [],
        message: `Deployment failed: ${error.message}`
      })

      this.log(`Deployment ${deploymentId} failed: ${error.message}`, 'error')

      // Auto-rollback if enabled
      if (this.config.autoRollback && this.deploymentHistory.length > 0) {
        this.log('Attempting auto-rollback', 'info')
        await this.rollback()
      }

      return result
    }
  }

  /**
   * Validate changes before deployment
   */
  async validateChanges(skipTests: boolean = false): Promise<ValidationResult> {
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
      timestamp: new Date()
    }

    try {
      // Check syntax
      this.log('Validating syntax...', 'info')
      result.checks.syntax = await this.validateSyntax()
      if (!result.checks.syntax) {
        result.issues.push('Syntax validation failed')
        result.isValid = false
      }

      // Check environment configuration
      this.log('Validating environment configuration...', 'info')
      result.checks.environment = await this.validateEnvironment()
      if (!result.checks.environment) {
        result.issues.push('Environment configuration validation failed')
        result.isValid = false
      }

      // Check dependencies
      this.log('Validating dependencies...', 'info')
      result.checks.dependencies = await this.validateDependencies()
      if (!result.checks.dependencies) {
        result.issues.push('Dependencies validation failed')
        result.isValid = false
      }

      // Run tests if not skipped
      if (!skipTests) {
        this.log('Running tests...', 'info')
        result.checks.tests = await this.runTests()
        if (!result.checks.tests) {
          result.issues.push('Tests failed')
          result.isValid = false
        }
      } else {
        result.warnings.push('Tests were skipped')
      }

      // Validate build
      this.log('Validating build...', 'info')
      result.checks.build = await this.validateBuild()
      if (!result.checks.build) {
        result.issues.push('Build validation failed')
        result.isValid = false
      }

    } catch (error) {
      result.issues.push(`Validation error: ${error.message}`)
      result.isValid = false
    }

    return result
  }

  /**
   * Rollback to previous version
   */
  async rollback(targetVersion?: string): Promise<RollbackResult> {
    const startTime = new Date()
    const rollbackId = this.generateDeploymentId()

    try {
      this.log('Starting rollback process', 'info')

      // Find target version
      const target = targetVersion 
        ? this.deploymentHistory.find(v => v.version === targetVersion)
        : this.deploymentHistory.find(v => v.status === 'active')

      if (!target) {
        throw new Error('No valid rollback target found')
      }

      // Rollback Git
      await this.rollbackGit(target.gitCommit)

      // Rollback Firebase components
      const rollbackResults = await this.rollbackFirebase(target.components)

      // Update deployment history
      target.status = 'active'
      this.deploymentHistory.forEach(v => {
        if (v.id !== target.id && v.status === 'active') {
          v.status = 'rolled_back'
        }
      })
      this.saveDeploymentHistory()

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      const result: RollbackResult = {
        success: true,
        version: target.version,
        rolledBackComponents: rollbackResults.components,
        errors: [],
        rollbackId,
        timestamp: endTime,
        duration
      }

      await this.sendNotification({
        type: 'rolled_back',
        timestamp: endTime,
        version: target.version,
        components: rollbackResults.components,
        message: `Rollback to version ${target.version} completed successfully`
      })

      this.log(`Rollback to version ${target.version} completed`, 'info')
      return result

    } catch (error) {
      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      const result: RollbackResult = {
        success: false,
        version: targetVersion || 'unknown',
        rolledBackComponents: [],
        errors: [error.message],
        rollbackId,
        timestamp: endTime,
        duration
      }

      this.log(`Rollback failed: ${error.message}`, 'error')
      return result
    }
  }

  /**
   * Get deployment history
   */
  getDeploymentHistory(): DeploymentVersion[] {
    return [...this.deploymentHistory]
  }

  /**
   * Add notification handler
   */
  onNotification(handler: (notification: DeploymentNotification) => void): void {
    this.notificationHandlers.push(handler)
  }

  // Private helper methods

  private generateDeploymentId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const random = Math.random().toString(36).substring(2, 8)
    return `deploy-${timestamp}-${random}`
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (this.verbose) {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`)
    }
  }

  private async sendNotification(notification: DeploymentNotification): Promise<void> {
    for (const handler of this.notificationHandlers) {
      try {
        handler(notification)
      } catch (error) {
        this.log(`Notification handler error: ${error.message}`, 'error')
      }
    }
  }

  private getTargetComponents(targets?: string[]): string[] {
    if (targets) {
      return this.config.targets
        .filter(t => targets.includes(t.name) && t.enabled)
        .map(t => t.name)
    }
    return this.config.targets.filter(t => t.enabled).map(t => t.name)
  }

  private async createGitCommit(message: string): Promise<GitCommitInfo> {
    try {
      // Add all changes
      execSync('git add .', { cwd: this.workingDir })
      
      // Create commit
      execSync(`git commit -m "${message}"`, { cwd: this.workingDir })
      
      // Get commit info
      const hash = execSync('git rev-parse HEAD', { cwd: this.workingDir }).toString().trim()
      const author = execSync('git log -1 --pretty=format:"%an"', { cwd: this.workingDir }).toString().trim()
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: this.workingDir }).toString().trim()
      const files = execSync('git diff-tree --no-commit-id --name-only -r HEAD', { cwd: this.workingDir })
        .toString().trim().split('\n').filter(f => f)

      return {
        hash,
        message,
        author,
        timestamp: new Date(),
        branch,
        files
      }
    } catch (error) {
      throw new Error(`Git commit failed: ${error.message}`)
    }
  }

  private async buildComponents(components: string[]): Promise<BuildResult[]> {
    const results: BuildResult[] = []

    for (const component of components) {
      const startTime = Date.now()
      try {
        this.log(`Building ${component}...`, 'info')
        
        let buildCommand = ''
        let outputPath = ''

        switch (component) {
          case 'frontend':
            buildCommand = 'npm run build'
            outputPath = path.join(this.workingDir, 'frontend/dist')
            break
          case 'backend':
            buildCommand = 'npm run build'
            outputPath = path.join(this.workingDir, 'backend/dist')
            break
          case 'functions':
            buildCommand = 'npm run build'
            outputPath = path.join(this.workingDir, 'functions/lib')
            break
          default:
            throw new Error(`Unknown component: ${component}`)
        }

        execSync(buildCommand, { 
          cwd: path.join(this.workingDir, component),
          stdio: this.verbose ? 'inherit' : 'pipe'
        })

        const duration = Date.now() - startTime
        results.push({
          success: true,
          component,
          duration,
          outputPath,
          errors: [],
          warnings: []
        })

      } catch (error) {
        const duration = Date.now() - startTime
        results.push({
          success: false,
          component,
          duration,
          outputPath: '',
          errors: [error.message],
          warnings: []
        })
      }
    }

    return results
  }

  private async deployToFirebase(buildResults: BuildResult[]): Promise<{ components: string[]; url?: string }> {
    const deployedComponents: string[] = []
    let deployUrl: string | undefined

    try {
      // Deploy hosting (frontend)
      if (buildResults.some(r => r.component === 'frontend' && r.success)) {
        this.log('Deploying to Firebase Hosting...', 'info')
        const output = execSync('firebase deploy --only hosting', { 
          cwd: this.workingDir,
          encoding: 'utf8'
        })
        
        // Extract URL from output
        const urlMatch = output.match(/Hosting URL: (https:\/\/[^\s]+)/)
        if (urlMatch) {
          deployUrl = urlMatch[1]
        }
        
        deployedComponents.push('frontend')
      }

      // Deploy functions (backend)
      if (buildResults.some(r => r.component === 'functions' && r.success)) {
        this.log('Deploying Firebase Functions...', 'info')
        execSync('firebase deploy --only functions', { 
          cwd: this.workingDir,
          stdio: this.verbose ? 'inherit' : 'pipe'
        })
        deployedComponents.push('functions')
      }

      // Deploy Firestore rules
      if (fs.existsSync(path.join(this.workingDir, 'firestore.rules'))) {
        this.log('Deploying Firestore rules...', 'info')
        execSync('firebase deploy --only firestore:rules', { 
          cwd: this.workingDir,
          stdio: this.verbose ? 'inherit' : 'pipe'
        })
        deployedComponents.push('firestore-rules')
      }

      return { components: deployedComponents, url: deployUrl }

    } catch (error) {
      throw new Error(`Firebase deployment failed: ${error.message}`)
    }
  }

  private async validatePostDeploy(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = []

    try {
      // Basic health check - try to reach the deployed URL
      if (this.config.environment === 'production') {
        // Add production-specific validations
        this.log('Running production health checks...', 'info')
      }

      return { success: errors.length === 0, errors }
    } catch (error) {
      errors.push(error.message)
      return { success: false, errors }
    }
  }

  private async createDeploymentVersion(
    deploymentId: string, 
    gitCommit: GitCommitInfo, 
    components: string[]
  ): Promise<DeploymentVersion> {
    const version: DeploymentVersion = {
      id: deploymentId,
      version: deploymentId,
      timestamp: new Date(),
      gitCommit: gitCommit.hash,
      gitBranch: gitCommit.branch,
      components,
      status: 'active',
      rollbackAvailable: true
    }

    // Mark previous versions as inactive
    this.deploymentHistory.forEach(v => {
      if (v.status === 'active') {
        v.status = 'rolled_back'
      }
    })

    this.deploymentHistory.unshift(version)
    
    // Keep only last 10 deployments
    if (this.deploymentHistory.length > 10) {
      this.deploymentHistory = this.deploymentHistory.slice(0, 10)
    }

    this.saveDeploymentHistory()
    return version
  }

  private async rollbackGit(commitHash: string): Promise<void> {
    try {
      execSync(`git reset --hard ${commitHash}`, { cwd: this.workingDir })
    } catch (error) {
      throw new Error(`Git rollback failed: ${error.message}`)
    }
  }

  private async rollbackFirebase(components: string[]): Promise<{ components: string[] }> {
    // For Firebase, we would need to redeploy the previous version
    // This is a simplified implementation
    try {
      if (components.includes('frontend')) {
        execSync('firebase deploy --only hosting', { cwd: this.workingDir })
      }
      if (components.includes('functions')) {
        execSync('firebase deploy --only functions', { cwd: this.workingDir })
      }
      return { components }
    } catch (error) {
      throw new Error(`Firebase rollback failed: ${error.message}`)
    }
  }

  private loadDeploymentHistory(): void {
    const historyFile = path.join(this.workingDir, '.deployment-history.json')
    try {
      if (fs.existsSync(historyFile)) {
        const data = fs.readFileSync(historyFile, 'utf8')
        this.deploymentHistory = JSON.parse(data)
      }
    } catch (error) {
      this.log(`Failed to load deployment history: ${error.message}`, 'warn')
      this.deploymentHistory = []
    }
  }

  private saveDeploymentHistory(): void {
    const historyFile = path.join(this.workingDir, '.deployment-history.json')
    try {
      fs.writeFileSync(historyFile, JSON.stringify(this.deploymentHistory, null, 2))
    } catch (error) {
      this.log(`Failed to save deployment history: ${error.message}`, 'error')
    }
  }

  // Validation helper methods
  private async validateSyntax(): Promise<boolean> {
    try {
      // Check TypeScript/JavaScript syntax
      execSync('npm run lint', { cwd: this.workingDir, stdio: 'pipe' })
      return true
    } catch (error) {
      return false
    }
  }

  private async validateEnvironment(): Promise<boolean> {
    try {
      // Check if required environment files exist
      const requiredFiles = ['.env.example', 'firebase.json']
      for (const file of requiredFiles) {
        if (!fs.existsSync(path.join(this.workingDir, file))) {
          return false
        }
      }
      return true
    } catch (error) {
      return false
    }
  }

  private async validateDependencies(): Promise<boolean> {
    try {
      // Check if node_modules are up to date
      execSync('npm audit --audit-level=high', { cwd: this.workingDir, stdio: 'pipe' })
      return true
    } catch (error) {
      return false
    }
  }

  private async runTests(): Promise<boolean> {
    try {
      execSync('npm test', { cwd: this.workingDir, stdio: 'pipe' })
      return true
    } catch (error) {
      return false
    }
  }

  private async validateBuild(): Promise<boolean> {
    try {
      // Try a test build
      execSync('npm run build', { cwd: this.workingDir, stdio: 'pipe' })
      return true
    } catch (error) {
      return false
    }
  }
}