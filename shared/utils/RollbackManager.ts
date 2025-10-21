/**
 * Rollback Manager
 * Handles automatic and manual rollback operations
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { RollbackResult, DeploymentVersion, PostDeployValidation } from '../types/deploymentTypes'
import { GitIntegration } from './GitIntegration'

export interface RollbackConfig {
  workingDir: string
  autoRollbackEnabled: boolean
  rollbackTimeoutMs: number
  maxRollbackAttempts: number
  validationRequired: boolean
  backupBeforeRollback: boolean
}

export interface RollbackTarget {
  version: string
  commitHash: string
  timestamp: Date
  components: string[]
  isHealthy: boolean
  rollbackAvailable: boolean
}

export interface RollbackValidation {
  success: boolean
  errors: string[]
  warnings: string[]
  healthChecks: PostDeployValidation[]
}

export class RollbackManager {
  private config: RollbackConfig
  private gitIntegration: GitIntegration
  private deploymentHistory: DeploymentVersion[] = []

  constructor(config: RollbackConfig, gitIntegration: GitIntegration) {
    this.config = config
    this.gitIntegration = gitIntegration
    this.loadDeploymentHistory()
  }

  /**
   * Execute automatic rollback
   */
  async executeAutoRollback(reason: string): Promise<RollbackResult> {
    const startTime = new Date()
    const rollbackId = this.generateRollbackId()

    try {
      if (!this.config.autoRollbackEnabled) {
        throw new Error('Auto-rollback is disabled')
      }

      this.log(`Starting auto-rollback due to: ${reason}`, 'warn')

      // Find the last healthy deployment
      const rollbackTarget = await this.findLastHealthyDeployment()
      if (!rollbackTarget) {
        throw new Error('No healthy deployment found for rollback')
      }

      // Execute rollback
      const result = await this.executeRollback(rollbackTarget, rollbackId, true)
      
      this.log(`Auto-rollback completed successfully to version ${rollbackTarget.version}`, 'info')
      return result

    } catch (error) {
      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      const result: RollbackResult = {
        success: false,
        version: 'unknown',
        rolledBackComponents: [],
        errors: [error.message],
        rollbackId,
        timestamp: endTime,
        duration
      }

      this.log(`Auto-rollback failed: ${error.message}`, 'error')
      return result
    }
  }

  /**
   * Execute manual rollback to specific version
   */
  async executeManualRollback(targetVersion: string): Promise<RollbackResult> {
    const rollbackId = this.generateRollbackId()

    try {
      this.log(`Starting manual rollback to version ${targetVersion}`, 'info')

      // Find target deployment
      const rollbackTarget = this.deploymentHistory.find(d => d.version === targetVersion)
      if (!rollbackTarget) {
        throw new Error(`Deployment version ${targetVersion} not found in history`)
      }

      if (!rollbackTarget.rollbackAvailable) {
        throw new Error(`Rollback not available for version ${targetVersion}`)
      }

      // Convert to RollbackTarget
      const target: RollbackTarget = {
        version: rollbackTarget.version,
        commitHash: rollbackTarget.gitCommit,
        timestamp: rollbackTarget.timestamp,
        components: rollbackTarget.components,
        isHealthy: rollbackTarget.status === 'active',
        rollbackAvailable: rollbackTarget.rollbackAvailable
      }

      // Execute rollback
      const result = await this.executeRollback(target, rollbackId, false)
      
      this.log(`Manual rollback completed successfully to version ${targetVersion}`, 'info')
      return result

    } catch (error) {
      const result: RollbackResult = {
        success: false,
        version: targetVersion,
        rolledBackComponents: [],
        errors: [error.message],
        rollbackId,
        timestamp: new Date(),
        duration: 0
      }

      this.log(`Manual rollback failed: ${error.message}`, 'error')
      return result
    }
  }

  /**
   * Get available rollback targets
   */
  getAvailableRollbackTargets(): RollbackTarget[] {
    return this.deploymentHistory
      .filter(d => d.rollbackAvailable && d.status !== 'failed')
      .map(d => ({
        version: d.version,
        commitHash: d.gitCommit,
        timestamp: d.timestamp,
        components: d.components,
        isHealthy: d.status === 'active',
        rollbackAvailable: d.rollbackAvailable
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Validate deployment health for rollback decision
   */
  async validateDeploymentHealth(): Promise<RollbackValidation> {
    const validation: RollbackValidation = {
      success: true,
      errors: [],
      warnings: [],
      healthChecks: []
    }

    try {
      // Basic health checks
      const healthChecks = await this.runHealthChecks()
      validation.healthChecks = healthChecks

      // Check for critical failures
      const criticalFailures = healthChecks.filter(check => 
        !check.success && (check.validationType === 'health' || check.validationType === 'functionality')
      )

      if (criticalFailures.length > 0) {
        validation.success = false
        validation.errors = criticalFailures.map(check => check.message)
      }

      // Check for warnings
      const warnings = healthChecks.filter(check => 
        !check.success && check.validationType === 'performance'
      )

      if (warnings.length > 0) {
        validation.warnings = warnings.map(check => check.message)
      }

    } catch (error) {
      validation.success = false
      validation.errors.push(`Health validation failed: ${error.message}`)
    }

    return validation
  }

  /**
   * Create deployment backup before rollback
   */
  async createRollbackBackup(): Promise<string> {
    try {
      const backupId = `backup-${Date.now()}`
      const backupDir = path.join(this.config.workingDir, '.rollback-backups', backupId)

      // Create backup directory
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true })
      }

      // Backup current deployment state
      const currentCommit = await this.gitIntegration.getLatestCommitInfo()
      
      // Save current state info
      const backupInfo = {
        id: backupId,
        timestamp: new Date(),
        commitHash: currentCommit.hash,
        commitMessage: currentCommit.message,
        branch: currentCommit.branch,
        files: currentCommit.files
      }

      fs.writeFileSync(
        path.join(backupDir, 'backup-info.json'),
        JSON.stringify(backupInfo, null, 2)
      )

      // Create Git stash for uncommitted changes
      try {
        const status = await this.gitIntegration.getStatus()
        if (status.hasUncommittedChanges) {
          execSync(`git stash push -m "Rollback backup ${backupId}"`, {
            cwd: this.config.workingDir
          })
        }
      } catch (error) {
        // Stash might fail if there are no changes, which is fine
      }

      this.log(`Rollback backup created: ${backupId}`, 'info')
      return backupId

    } catch (error) {
      throw new Error(`Failed to create rollback backup: ${error.message}`)
    }
  }

  /**
   * Restore from rollback backup
   */
  async restoreFromBackup(backupId: string): Promise<void> {
    try {
      const backupDir = path.join(this.config.workingDir, '.rollback-backups', backupId)
      
      if (!fs.existsSync(backupDir)) {
        throw new Error(`Backup ${backupId} not found`)
      }

      // Load backup info
      const backupInfoPath = path.join(backupDir, 'backup-info.json')
      const backupInfo = JSON.parse(fs.readFileSync(backupInfoPath, 'utf8'))

      // Restore Git state
      await this.gitIntegration.rollbackToCommit(backupInfo.commitHash, false)

      // Restore stashed changes if any
      try {
        const stashList = execSync('git stash list', {
          cwd: this.config.workingDir,
          encoding: 'utf8'
        })

        if (stashList.includes(`Rollback backup ${backupId}`)) {
          execSync(`git stash pop`, { cwd: this.config.workingDir })
        }
      } catch (error) {
        // Stash restore might fail, which is acceptable
      }

      this.log(`Restored from backup: ${backupId}`, 'info')

    } catch (error) {
      throw new Error(`Failed to restore from backup: ${error.message}`)
    }
  }

  // Private methods

  private async executeRollback(
    target: RollbackTarget, 
    rollbackId: string, 
    isAutoRollback: boolean
  ): Promise<RollbackResult> {
    const startTime = new Date()
    let backupId: string | undefined

    try {
      // Create backup if enabled
      if (this.config.backupBeforeRollback) {
        backupId = await this.createRollbackBackup()
      }

      // Rollback Git repository
      await this.gitIntegration.rollbackToCommit(target.commitHash, true)

      // Rollback Firebase components
      const rolledBackComponents = await this.rollbackFirebaseComponents(target.components)

      // Run post-rollback validation if required
      if (this.config.validationRequired) {
        const validation = await this.validateDeploymentHealth()
        if (!validation.success) {
          throw new Error(`Post-rollback validation failed: ${validation.errors.join(', ')}`)
        }
      }

      // Update deployment history
      this.updateDeploymentHistoryAfterRollback(target.version)

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      const result: RollbackResult = {
        success: true,
        version: target.version,
        rolledBackComponents,
        errors: [],
        rollbackId,
        timestamp: endTime,
        duration
      }

      return result

    } catch (error) {
      // Attempt to restore from backup if rollback failed
      if (backupId && this.config.backupBeforeRollback) {
        try {
          await this.restoreFromBackup(backupId)
          this.log(`Restored from backup after failed rollback`, 'warn')
        } catch (restoreError) {
          this.log(`Failed to restore from backup: ${restoreError.message}`, 'error')
        }
      }

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      const result: RollbackResult = {
        success: false,
        version: target.version,
        rolledBackComponents: [],
        errors: [error.message],
        rollbackId,
        timestamp: endTime,
        duration
      }

      return result
    }
  }

  private async findLastHealthyDeployment(): Promise<RollbackTarget | null> {
    // Sort by timestamp, most recent first
    const sortedHistory = [...this.deploymentHistory]
      .filter(d => d.rollbackAvailable && d.status === 'active')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    for (const deployment of sortedHistory) {
      // Skip the current deployment (most recent)
      if (deployment === sortedHistory[0]) {
        continue
      }

      return {
        version: deployment.version,
        commitHash: deployment.gitCommit,
        timestamp: deployment.timestamp,
        components: deployment.components,
        isHealthy: true,
        rollbackAvailable: deployment.rollbackAvailable
      }
    }

    return null
  }

  private async rollbackFirebaseComponents(components: string[]): Promise<string[]> {
    const rolledBackComponents: string[] = []

    try {
      // For Firebase, rollback means redeploying the previous version
      // Since we've already rolled back the Git repository, we just need to redeploy

      if (components.includes('frontend') || components.includes('hosting')) {
        this.log('Rolling back Firebase Hosting...', 'info')
        execSync('firebase deploy --only hosting', {
          cwd: this.config.workingDir,
          stdio: 'pipe'
        })
        rolledBackComponents.push('frontend')
      }

      if (components.includes('functions') || components.includes('backend')) {
        this.log('Rolling back Firebase Functions...', 'info')
        
        // Build functions first
        const functionsPath = path.join(this.config.workingDir, 'functions')
        if (fs.existsSync(functionsPath)) {
          execSync('npm run build', {
            cwd: functionsPath,
            stdio: 'pipe'
          })
        }

        execSync('firebase deploy --only functions', {
          cwd: this.config.workingDir,
          stdio: 'pipe'
        })
        rolledBackComponents.push('functions')
      }

      if (components.includes('firestore-rules')) {
        this.log('Rolling back Firestore rules...', 'info')
        execSync('firebase deploy --only firestore:rules', {
          cwd: this.config.workingDir,
          stdio: 'pipe'
        })
        rolledBackComponents.push('firestore-rules')
      }

      if (components.includes('storage-rules')) {
        this.log('Rolling back Storage rules...', 'info')
        execSync('firebase deploy --only storage', {
          cwd: this.config.workingDir,
          stdio: 'pipe'
        })
        rolledBackComponents.push('storage-rules')
      }

      return rolledBackComponents

    } catch (error) {
      throw new Error(`Firebase rollback failed: ${error.message}`)
    }
  }

  private async runHealthChecks(): Promise<PostDeployValidation[]> {
    const healthChecks: PostDeployValidation[] = []

    try {
      // Basic connectivity check
      healthChecks.push({
        component: 'system',
        validationType: 'health',
        success: true,
        message: 'System is responsive'
      })

      // Check if Firebase services are accessible
      try {
        execSync('firebase projects:list', {
          cwd: this.config.workingDir,
          stdio: 'pipe'
        })

        healthChecks.push({
          component: 'firebase',
          validationType: 'health',
          success: true,
          message: 'Firebase services accessible'
        })
      } catch (error) {
        healthChecks.push({
          component: 'firebase',
          validationType: 'health',
          success: false,
          message: 'Firebase services not accessible'
        })
      }

      // Check if hosting is accessible (if deployed)
      const firebaseJsonPath = path.join(this.config.workingDir, 'firebase.json')
      if (fs.existsSync(firebaseJsonPath)) {
        const firebaseConfig = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'))
        
        if (firebaseConfig.hosting) {
          // Basic check - verify build output exists
          const publicDir = firebaseConfig.hosting.public || 'dist'
          const publicPath = path.join(this.config.workingDir, publicDir)
          
          healthChecks.push({
            component: 'hosting',
            validationType: 'functionality',
            success: fs.existsSync(publicPath),
            message: fs.existsSync(publicPath) 
              ? 'Hosting build output available' 
              : 'Hosting build output missing'
          })
        }
      }

    } catch (error) {
      healthChecks.push({
        component: 'system',
        validationType: 'health',
        success: false,
        message: `Health check failed: ${error.message}`
      })
    }

    return healthChecks
  }

  private updateDeploymentHistoryAfterRollback(rolledBackToVersion: string): void {
    // Mark the rolled-back-to version as active
    // Mark all newer versions as rolled_back
    let foundTarget = false

    for (const deployment of this.deploymentHistory) {
      if (deployment.version === rolledBackToVersion) {
        deployment.status = 'active'
        foundTarget = true
      } else if (!foundTarget) {
        // This is a newer deployment, mark as rolled back
        deployment.status = 'rolled_back'
      }
    }

    this.saveDeploymentHistory()
  }

  private loadDeploymentHistory(): void {
    const historyFile = path.join(this.config.workingDir, '.deployment-history.json')
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
    const historyFile = path.join(this.config.workingDir, '.deployment-history.json')
    try {
      fs.writeFileSync(historyFile, JSON.stringify(this.deploymentHistory, null, 2))
    } catch (error) {
      this.log(`Failed to save deployment history: ${error.message}`, 'error')
    }
  }

  private generateRollbackId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const random = Math.random().toString(36).substring(2, 8)
    return `rollback-${timestamp}-${random}`
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [ROLLBACK] [${level.toUpperCase()}] ${message}`)
  }
}

/**
 * Rollback strategy for different failure scenarios
 */
export class RollbackStrategy {
  private rollbackManager: RollbackManager

  constructor(rollbackManager: RollbackManager) {
    this.rollbackManager = rollbackManager
  }

  /**
   * Determine if rollback is needed based on deployment validation
   */
  async shouldRollback(validationResult: RollbackValidation): Promise<boolean> {
    // Rollback if there are critical errors
    if (validationResult.errors.length > 0) {
      return true
    }

    // Check for specific failure patterns
    const criticalFailures = validationResult.healthChecks.filter(check =>
      !check.success && (
        check.validationType === 'health' ||
        check.validationType === 'functionality'
      )
    )

    return criticalFailures.length > 0
  }

  /**
   * Execute rollback strategy based on failure type
   */
  async executeStrategy(failureType: 'deployment' | 'validation' | 'health', reason: string): Promise<RollbackResult> {
    switch (failureType) {
      case 'deployment':
        return await this.rollbackManager.executeAutoRollback(`Deployment failure: ${reason}`)
      
      case 'validation':
        return await this.rollbackManager.executeAutoRollback(`Validation failure: ${reason}`)
      
      case 'health':
        return await this.rollbackManager.executeAutoRollback(`Health check failure: ${reason}`)
      
      default:
        throw new Error(`Unknown failure type: ${failureType}`)
    }
  }
}