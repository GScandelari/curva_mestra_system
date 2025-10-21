/**
 * Deployment Pipeline Types
 * Defines interfaces for the deployment pipeline system
 */

export interface ValidationResult {
  isValid: boolean
  issues: string[]
  warnings: string[]
  checks: {
    syntax: boolean
    tests: boolean
    environment: boolean
    dependencies: boolean
    build: boolean
  }
  timestamp: Date
}

export interface DeployResult {
  success: boolean
  version: string
  deployedComponents: string[]
  errors: string[]
  warnings: string[]
  rollbackAvailable: boolean
  deploymentId: string
  timestamp: Date
  duration: number
  url?: string
}

export interface RollbackResult {
  success: boolean
  version: string
  rolledBackComponents: string[]
  errors: string[]
  rollbackId: string
  timestamp: Date
  duration: number
}

export interface DeploymentConfig {
  projectId: string
  environment: 'development' | 'staging' | 'production'
  targets: DeploymentTarget[]
  autoRollback: boolean
  validationRequired: boolean
  backupBeforeDeploy: boolean
}

export interface DeploymentTarget {
  name: string
  type: 'hosting' | 'functions' | 'firestore' | 'storage'
  enabled: boolean
  buildRequired: boolean
  validationRules?: string[]
}

export interface DeploymentVersion {
  id: string
  version: string
  timestamp: Date
  gitCommit: string
  gitBranch: string
  components: string[]
  status: 'active' | 'rolled_back' | 'failed'
  rollbackAvailable: boolean
}

export interface DeploymentLog {
  id: string
  timestamp: Date
  type: 'deploy' | 'rollback' | 'validation'
  status: 'started' | 'completed' | 'failed'
  version: string
  components: string[]
  duration: number
  errors: string[]
  warnings: string[]
  metadata: Record<string, any>
}

export interface GitCommitInfo {
  hash: string
  message: string
  author: string
  timestamp: Date
  branch: string
  files: string[]
}

export interface BuildResult {
  success: boolean
  component: string
  duration: number
  outputPath: string
  errors: string[]
  warnings: string[]
  size?: number
}

export interface PreDeployValidation {
  component: string
  validationType: 'syntax' | 'tests' | 'lint' | 'security' | 'performance'
  success: boolean
  message: string
  details?: Record<string, any>
}

export interface PostDeployValidation {
  component: string
  validationType: 'health' | 'functionality' | 'performance' | 'security'
  success: boolean
  message: string
  responseTime?: number
  details?: Record<string, any>
}

export interface DeploymentNotification {
  type: 'started' | 'completed' | 'failed' | 'rolled_back'
  timestamp: Date
  version: string
  components: string[]
  message: string
  details?: Record<string, any>
}

export enum DeploymentStatus {
  PENDING = 'pending',
  VALIDATING = 'validating',
  BUILDING = 'building',
  DEPLOYING = 'deploying',
  VALIDATING_POST = 'validating_post',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLING_BACK = 'rolling_back',
  ROLLED_BACK = 'rolled_back'
}

export interface DeploymentProgress {
  status: DeploymentStatus
  currentStep: string
  totalSteps: number
  completedSteps: number
  startTime: Date
  estimatedCompletion?: Date
  errors: string[]
  warnings: string[]
}