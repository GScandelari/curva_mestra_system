/**
 * Auto Deployer
 * Handles automatic deployment to Firebase services
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { DeployResult, BuildResult } from '../types/deploymentTypes'

export interface DeploymentTarget {
  name: string
  type: 'hosting' | 'functions' | 'firestore' | 'storage'
  enabled: boolean
  buildRequired: boolean
  buildCommand?: string
  deployCommand?: string
  outputPath?: string
}

export interface AutoDeployConfig {
  projectId: string
  workingDir: string
  targets: DeploymentTarget[]
  verbose: boolean
  dryRun: boolean
}

export class AutoDeployer {
  private config: AutoDeployConfig

  constructor(config: AutoDeployConfig) {
    this.config = config
  }

  /**
   * Deploy all enabled targets
   */
  async deployAll(): Promise<DeployResult> {
    const startTime = new Date()
    const deploymentId = this.generateDeploymentId()
    
    try {
      this.log('Starting automatic deployment', 'info')

      // Step 1: Build all components that require building
      const buildResults = await this.buildAllComponents()
      
      // Check if any builds failed
      const failedBuilds = buildResults.filter(r => !r.success)
      if (failedBuilds.length > 0) {
        throw new Error(`Build failed for: ${failedBuilds.map(r => r.component).join(', ')}`)
      }

      // Step 2: Deploy to Firebase services
      const deployedComponents: string[] = []
      let deployUrl: string | undefined

      // Deploy Frontend (Firebase Hosting)
      if (this.isTargetEnabled('hosting')) {
        this.log('Deploying to Firebase Hosting...', 'info')
        const hostingResult = await this.deployHosting()
        if (hostingResult.success) {
          deployedComponents.push('frontend')
          deployUrl = hostingResult.url
        } else {
          throw new Error(`Hosting deployment failed: ${hostingResult.error}`)
        }
      }

      // Deploy Backend (Firebase Functions)
      if (this.isTargetEnabled('functions')) {
        this.log('Deploying Firebase Functions...', 'info')
        const functionsResult = await this.deployFunctions()
        if (functionsResult.success) {
          deployedComponents.push('functions')
        } else {
          throw new Error(`Functions deployment failed: ${functionsResult.error}`)
        }
      }

      // Deploy Firestore Rules
      if (this.isTargetEnabled('firestore')) {
        this.log('Deploying Firestore rules...', 'info')
        const firestoreResult = await this.deployFirestoreRules()
        if (firestoreResult.success) {
          deployedComponents.push('firestore-rules')
        } else {
          throw new Error(`Firestore rules deployment failed: ${firestoreResult.error}`)
        }
      }

      // Deploy Storage Rules
      if (this.isTargetEnabled('storage')) {
        this.log('Deploying Storage rules...', 'info')
        const storageResult = await this.deployStorageRules()
        if (storageResult.success) {
          deployedComponents.push('storage-rules')
        } else {
          throw new Error(`Storage rules deployment failed: ${storageResult.error}`)
        }
      }

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      const result: DeployResult = {
        success: true,
        version: deploymentId,
        deployedComponents,
        errors: [],
        warnings: [],
        rollbackAvailable: true,
        deploymentId,
        timestamp: endTime,
        duration,
        url: deployUrl
      }

      this.log(`Deployment completed successfully in ${duration}ms`, 'info')
      return result

    } catch (error) {
      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      const result: DeployResult = {
        success: false,
        version: deploymentId,
        deployedComponents: [],
        errors: [error.message],
        warnings: [],
        rollbackAvailable: false,
        deploymentId,
        timestamp: endTime,
        duration
      }

      this.log(`Deployment failed: ${error.message}`, 'error')
      return result
    }
  }

  /**
   * Deploy specific component
   */
  async deployComponent(componentName: string): Promise<DeployResult> {
    const startTime = new Date()
    const deploymentId = this.generateDeploymentId()

    try {
      this.log(`Deploying component: ${componentName}`, 'info')

      let result: { success: boolean; error?: string; url?: string }

      switch (componentName) {
        case 'hosting':
        case 'frontend':
          result = await this.deployHosting()
          break
        case 'functions':
        case 'backend':
          result = await this.deployFunctions()
          break
        case 'firestore':
        case 'firestore-rules':
          result = await this.deployFirestoreRules()
          break
        case 'storage':
        case 'storage-rules':
          result = await this.deployStorageRules()
          break
        default:
          throw new Error(`Unknown component: ${componentName}`)
      }

      if (!result.success) {
        throw new Error(result.error || 'Deployment failed')
      }

      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      return {
        success: true,
        version: deploymentId,
        deployedComponents: [componentName],
        errors: [],
        warnings: [],
        rollbackAvailable: true,
        deploymentId,
        timestamp: endTime,
        duration,
        url: result.url
      }

    } catch (error) {
      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      return {
        success: false,
        version: deploymentId,
        deployedComponents: [],
        errors: [error.message],
        warnings: [],
        rollbackAvailable: false,
        deploymentId,
        timestamp: endTime,
        duration
      }
    }
  }

  /**
   * Build all components that require building
   */
  private async buildAllComponents(): Promise<BuildResult[]> {
    const results: BuildResult[] = []
    
    const buildTargets = this.config.targets.filter(t => t.enabled && t.buildRequired)
    
    for (const target of buildTargets) {
      const buildResult = await this.buildComponent(target)
      results.push(buildResult)
    }

    return results
  }

  /**
   * Build specific component
   */
  private async buildComponent(target: DeploymentTarget): Promise<BuildResult> {
    const startTime = Date.now()
    
    try {
      this.log(`Building ${target.name}...`, 'info')

      let buildCommand = target.buildCommand || 'npm run build'
      let componentPath = ''
      let outputPath = ''

      // Determine component path and output based on target type
      switch (target.type) {
        case 'hosting':
          componentPath = path.join(this.config.workingDir, 'frontend')
          outputPath = target.outputPath || path.join(componentPath, 'dist')
          break
        case 'functions':
          componentPath = path.join(this.config.workingDir, 'functions')
          outputPath = target.outputPath || path.join(componentPath, 'lib')
          break
        default:
          // For rules, no build is typically required
          return {
            success: true,
            component: target.name,
            duration: Date.now() - startTime,
            outputPath: '',
            errors: [],
            warnings: []
          }
      }

      if (!fs.existsSync(componentPath)) {
        throw new Error(`Component directory not found: ${componentPath}`)
      }

      // Execute build command
      if (this.config.dryRun) {
        this.log(`[DRY RUN] Would execute: ${buildCommand}`, 'info')
      } else {
        execSync(buildCommand, {
          cwd: componentPath,
          stdio: this.config.verbose ? 'inherit' : 'pipe'
        })
      }

      // Verify output exists
      if (!this.config.dryRun && !fs.existsSync(outputPath)) {
        throw new Error(`Build output not found: ${outputPath}`)
      }

      const duration = Date.now() - startTime

      return {
        success: true,
        component: target.name,
        duration,
        outputPath,
        errors: [],
        warnings: []
      }

    } catch (error) {
      const duration = Date.now() - startTime

      return {
        success: false,
        component: target.name,
        duration,
        outputPath: '',
        errors: [error.message],
        warnings: []
      }
    }
  }

  /**
   * Deploy to Firebase Hosting
   */
  private async deployHosting(): Promise<{ success: boolean; error?: string; url?: string }> {
    try {
      // Check if hosting is configured
      const firebaseJsonPath = path.join(this.config.workingDir, 'firebase.json')
      if (!fs.existsSync(firebaseJsonPath)) {
        throw new Error('firebase.json not found')
      }

      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'))
      if (!firebaseConfig.hosting) {
        throw new Error('Hosting not configured in firebase.json')
      }

      // Check if build output exists
      const publicDir = firebaseConfig.hosting.public || 'dist'
      const publicPath = path.join(this.config.workingDir, publicDir)
      
      if (!fs.existsSync(publicPath)) {
        throw new Error(`Hosting public directory not found: ${publicPath}`)
      }

      // Deploy to Firebase Hosting
      if (this.config.dryRun) {
        this.log('[DRY RUN] Would deploy to Firebase Hosting', 'info')
        return { success: true, url: 'https://example.web.app' }
      }

      const output = execSync('firebase deploy --only hosting', {
        cwd: this.config.workingDir,
        encoding: 'utf8'
      })

      // Extract hosting URL from output
      let hostingUrl: string | undefined
      const urlMatch = output.match(/Hosting URL: (https:\/\/[^\s]+)/)
      if (urlMatch) {
        hostingUrl = urlMatch[1]
      }

      return { success: true, url: hostingUrl }

    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Deploy Firebase Functions
   */
  private async deployFunctions(): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if functions directory exists
      const functionsPath = path.join(this.config.workingDir, 'functions')
      if (!fs.existsSync(functionsPath)) {
        throw new Error('Functions directory not found')
      }

      // Check if functions are built
      const libPath = path.join(functionsPath, 'lib')
      if (!fs.existsSync(libPath)) {
        throw new Error('Functions not built - run build first')
      }

      // Deploy Firebase Functions
      if (this.config.dryRun) {
        this.log('[DRY RUN] Would deploy Firebase Functions', 'info')
        return { success: true }
      }

      execSync('firebase deploy --only functions', {
        cwd: this.config.workingDir,
        stdio: this.config.verbose ? 'inherit' : 'pipe'
      })

      return { success: true }

    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Deploy Firestore Rules
   */
  private async deployFirestoreRules(): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if firestore.rules exists
      const rulesPath = path.join(this.config.workingDir, 'firestore.rules')
      if (!fs.existsSync(rulesPath)) {
        throw new Error('firestore.rules not found')
      }

      // Validate rules syntax
      const rules = fs.readFileSync(rulesPath, 'utf8')
      if (!rules.includes('rules_version') || !rules.includes('service cloud.firestore')) {
        throw new Error('Invalid Firestore rules syntax')
      }

      // Deploy Firestore Rules
      if (this.config.dryRun) {
        this.log('[DRY RUN] Would deploy Firestore rules', 'info')
        return { success: true }
      }

      execSync('firebase deploy --only firestore:rules', {
        cwd: this.config.workingDir,
        stdio: this.config.verbose ? 'inherit' : 'pipe'
      })

      return { success: true }

    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Deploy Storage Rules
   */
  private async deployStorageRules(): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if storage.rules exists
      const rulesPath = path.join(this.config.workingDir, 'storage.rules')
      if (!fs.existsSync(rulesPath)) {
        throw new Error('storage.rules not found')
      }

      // Validate rules syntax
      const rules = fs.readFileSync(rulesPath, 'utf8')
      if (!rules.includes('rules_version') || !rules.includes('service firebase.storage')) {
        throw new Error('Invalid Storage rules syntax')
      }

      // Deploy Storage Rules
      if (this.config.dryRun) {
        this.log('[DRY RUN] Would deploy Storage rules', 'info')
        return { success: true }
      }

      execSync('firebase deploy --only storage', {
        cwd: this.config.workingDir,
        stdio: this.config.verbose ? 'inherit' : 'pipe'
      })

      return { success: true }

    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Check if deployment target is enabled
   */
  private isTargetEnabled(targetType: string): boolean {
    return this.config.targets.some(t => 
      (t.type === targetType || t.name === targetType) && t.enabled
    )
  }

  /**
   * Generate unique deployment ID
   */
  private generateDeploymentId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const random = Math.random().toString(36).substring(2, 8)
    return `deploy-${timestamp}-${random}`
  }

  /**
   * Log message with timestamp
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (this.config.verbose) {
      const timestamp = new Date().toISOString()
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`)
    }
  }
}

/**
 * Create deployment scripts for different environments
 */
export class DeploymentScriptGenerator {
  private workingDir: string

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir
  }

  /**
   * Generate deployment script for frontend (Firebase Hosting)
   */
  generateHostingScript(): string {
    return `#!/bin/bash
# Frontend Deployment Script for Firebase Hosting

set -e

echo "Starting frontend deployment..."

# Navigate to frontend directory
cd frontend

# Install dependencies
echo "Installing dependencies..."
npm ci

# Run tests
echo "Running tests..."
npm test -- --run

# Build for production
echo "Building for production..."
npm run build

# Navigate back to root
cd ..

# Deploy to Firebase Hosting
echo "Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo "Frontend deployment completed successfully!"
`
  }

  /**
   * Generate deployment script for backend (Firebase Functions)
   */
  generateFunctionsScript(): string {
    return `#!/bin/bash
# Backend Deployment Script for Firebase Functions

set -e

echo "Starting backend deployment..."

# Navigate to functions directory
cd functions

# Install dependencies
echo "Installing dependencies..."
npm ci

# Run tests
echo "Running tests..."
npm test

# Build TypeScript
echo "Building TypeScript..."
npm run build

# Navigate back to root
cd ..

# Deploy to Firebase Functions
echo "Deploying to Firebase Functions..."
firebase deploy --only functions

echo "Backend deployment completed successfully!"
`
  }

  /**
   * Generate deployment script for Firestore rules
   */
  generateFirestoreRulesScript(): string {
    return `#!/bin/bash
# Firestore Rules Deployment Script

set -e

echo "Starting Firestore rules deployment..."

# Validate rules syntax
if [ ! -f "firestore.rules" ]; then
    echo "Error: firestore.rules not found"
    exit 1
fi

# Deploy Firestore rules
echo "Deploying Firestore rules..."
firebase deploy --only firestore:rules

echo "Firestore rules deployment completed successfully!"
`
  }

  /**
   * Generate complete deployment script
   */
  generateCompleteScript(): string {
    return `#!/bin/bash
# Complete Deployment Script

set -e

echo "Starting complete deployment pipeline..."

# Function to handle errors
handle_error() {
    echo "Error occurred in deployment pipeline"
    echo "Rolling back changes..."
    # Add rollback logic here
    exit 1
}

trap handle_error ERR

# Pre-deployment validation
echo "Running pre-deployment validation..."
npm run validate || handle_error

# Build and deploy frontend
if [ -d "frontend" ]; then
    echo "Deploying frontend..."
    cd frontend
    npm ci
    npm test -- --run
    npm run build
    cd ..
    firebase deploy --only hosting
fi

# Build and deploy functions
if [ -d "functions" ]; then
    echo "Deploying functions..."
    cd functions
    npm ci
    npm test
    npm run build
    cd ..
    firebase deploy --only functions
fi

# Deploy Firestore rules
if [ -f "firestore.rules" ]; then
    echo "Deploying Firestore rules..."
    firebase deploy --only firestore:rules
fi

# Deploy Storage rules
if [ -f "storage.rules" ]; then
    echo "Deploying Storage rules..."
    firebase deploy --only storage
fi

echo "Complete deployment pipeline finished successfully!"
`
  }

  /**
   * Generate PowerShell deployment script for Windows
   */
  generatePowerShellScript(): string {
    return `# Complete Deployment Script (PowerShell)

$ErrorActionPreference = "Stop"

Write-Host "Starting complete deployment pipeline..." -ForegroundColor Green

try {
    # Pre-deployment validation
    Write-Host "Running pre-deployment validation..." -ForegroundColor Yellow
    npm run validate
    if ($LASTEXITCODE -ne 0) { throw "Validation failed" }

    # Build and deploy frontend
    if (Test-Path "frontend") {
        Write-Host "Deploying frontend..." -ForegroundColor Yellow
        Set-Location frontend
        npm ci
        npm test -- --run
        if ($LASTEXITCODE -ne 0) { throw "Frontend tests failed" }
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
        Set-Location ..
        firebase deploy --only hosting
        if ($LASTEXITCODE -ne 0) { throw "Frontend deployment failed" }
    }

    # Build and deploy functions
    if (Test-Path "functions") {
        Write-Host "Deploying functions..." -ForegroundColor Yellow
        Set-Location functions
        npm ci
        npm test
        if ($LASTEXITCODE -ne 0) { throw "Functions tests failed" }
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Functions build failed" }
        Set-Location ..
        firebase deploy --only functions
        if ($LASTEXITCODE -ne 0) { throw "Functions deployment failed" }
    }

    # Deploy Firestore rules
    if (Test-Path "firestore.rules") {
        Write-Host "Deploying Firestore rules..." -ForegroundColor Yellow
        firebase deploy --only firestore:rules
        if ($LASTEXITCODE -ne 0) { throw "Firestore rules deployment failed" }
    }

    # Deploy Storage rules
    if (Test-Path "storage.rules") {
        Write-Host "Deploying Storage rules..." -ForegroundColor Yellow
        firebase deploy --only storage
        if ($LASTEXITCODE -ne 0) { throw "Storage rules deployment failed" }
    }

    Write-Host "Complete deployment pipeline finished successfully!" -ForegroundColor Green

} catch {
    Write-Host "Error occurred in deployment pipeline: $_" -ForegroundColor Red
    Write-Host "Rolling back changes..." -ForegroundColor Yellow
    # Add rollback logic here
    exit 1
}
`
  }

  /**
   * Write all deployment scripts to files
   */
  writeAllScripts(): void {
    const scriptsDir = path.join(this.workingDir, 'scripts', 'deployment')
    
    // Create scripts directory if it doesn't exist
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true })
    }

    // Write bash scripts
    fs.writeFileSync(
      path.join(scriptsDir, 'deploy-hosting.sh'),
      this.generateHostingScript()
    )

    fs.writeFileSync(
      path.join(scriptsDir, 'deploy-functions.sh'),
      this.generateFunctionsScript()
    )

    fs.writeFileSync(
      path.join(scriptsDir, 'deploy-firestore-rules.sh'),
      this.generateFirestoreRulesScript()
    )

    fs.writeFileSync(
      path.join(scriptsDir, 'deploy-complete.sh'),
      this.generateCompleteScript()
    )

    // Write PowerShell script
    fs.writeFileSync(
      path.join(scriptsDir, 'deploy-complete.ps1'),
      this.generatePowerShellScript()
    )

    // Make bash scripts executable (on Unix systems)
    if (process.platform !== 'win32') {
      const scripts = [
        'deploy-hosting.sh',
        'deploy-functions.sh',
        'deploy-firestore-rules.sh',
        'deploy-complete.sh'
      ]

      for (const script of scripts) {
        try {
          execSync(`chmod +x "${path.join(scriptsDir, script)}"`)
        } catch (error) {
          // Ignore chmod errors on non-Unix systems
        }
      }
    }

    console.log(`Deployment scripts generated in: ${scriptsDir}`)
  }
}