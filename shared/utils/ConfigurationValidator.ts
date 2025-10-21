/**
 * Configuration Validator
 * Validates environment configurations and dependencies
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

export interface ConfigValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  details: {
    firebase: boolean
    environment: boolean
    dependencies: boolean
    nodeVersion: boolean
  }
}

export class ConfigurationValidator {
  private workingDir: string

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir
  }

  /**
   * Validate all configuration aspects
   */
  async validateAll(): Promise<ConfigValidationResult> {
    const result: ConfigValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      details: {
        firebase: false,
        environment: false,
        dependencies: false,
        nodeVersion: false
      }
    }

    try {
      // Validate Node.js version
      result.details.nodeVersion = await this.validateNodeVersion()
      if (!result.details.nodeVersion) {
        result.errors.push('Node.js version validation failed')
        result.isValid = false
      }

      // Validate Firebase configuration
      result.details.firebase = await this.validateFirebaseConfiguration()
      if (!result.details.firebase) {
        result.errors.push('Firebase configuration validation failed')
        result.isValid = false
      }

      // Validate environment configuration
      result.details.environment = await this.validateEnvironmentConfiguration()
      if (!result.details.environment) {
        result.errors.push('Environment configuration validation failed')
        result.isValid = false
      }

      // Validate dependencies
      result.details.dependencies = await this.validateDependencies()
      if (!result.details.dependencies) {
        result.errors.push('Dependencies validation failed')
        result.isValid = false
      }

    } catch (error) {
      result.errors.push(`Configuration validation error: ${error.message}`)
      result.isValid = false
    }

    return result
  }

  /**
   * Validate Node.js version compatibility
   */
  private async validateNodeVersion(): Promise<boolean> {
    try {
      const nodeVersion = process.version
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0])

      // Check minimum Node.js version (16+)
      if (majorVersion < 16) {
        console.error(`Node.js version ${nodeVersion} is not supported. Minimum version is 16.`)
        return false
      }

      // Check if npm is available
      execSync('npm --version', { stdio: 'pipe' })

      return true
    } catch (error) {
      console.error('Node.js or npm validation failed:', error.message)
      return false
    }
  }

  /**
   * Validate Firebase configuration files and setup
   */
  private async validateFirebaseConfiguration(): Promise<boolean> {
    try {
      // Check required Firebase files
      const requiredFiles = [
        'firebase.json',
        '.firebaserc'
      ]

      for (const file of requiredFiles) {
        const filePath = path.join(this.workingDir, file)
        if (!fs.existsSync(filePath)) {
          console.error(`Required Firebase file missing: ${file}`)
          return false
        }
      }

      // Validate firebase.json structure
      const firebaseJsonPath = path.join(this.workingDir, 'firebase.json')
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'))

      // Check for required configurations
      if (!firebaseConfig.hosting && !firebaseConfig.functions && !firebaseConfig.firestore) {
        console.error('firebase.json must contain at least one service configuration (hosting, functions, or firestore)')
        return false
      }

      // Validate hosting configuration if present
      if (firebaseConfig.hosting) {
        if (!firebaseConfig.hosting.public) {
          console.error('Firebase hosting configuration missing "public" directory')
          return false
        }
      }

      // Validate functions configuration if present
      if (firebaseConfig.functions) {
        const functionsDir = firebaseConfig.functions.source || 'functions'
        const functionsPath = path.join(this.workingDir, functionsDir)
        if (!fs.existsSync(functionsPath)) {
          console.error(`Firebase functions directory not found: ${functionsDir}`)
          return false
        }
      }

      // Validate .firebaserc
      const firebasercPath = path.join(this.workingDir, '.firebaserc')
      const firebasercConfig = JSON.parse(fs.readFileSync(firebasercPath, 'utf8'))

      if (!firebasercConfig.projects || !firebasercConfig.projects.default) {
        console.error('.firebaserc missing default project configuration')
        return false
      }

      // Check Firebase CLI availability
      try {
        execSync('firebase --version', { stdio: 'pipe' })
      } catch (error) {
        console.error('Firebase CLI not found. Install with: npm install -g firebase-tools')
        return false
      }

      return true
    } catch (error) {
      console.error('Firebase configuration validation failed:', error.message)
      return false
    }
  }

  /**
   * Validate environment configuration files
   */
  private async validateEnvironmentConfiguration(): Promise<boolean> {
    try {
      const components = ['frontend', 'backend', 'functions']
      
      for (const component of components) {
        const componentPath = path.join(this.workingDir, component)
        
        if (fs.existsSync(componentPath)) {
          // Check for .env.example file
          const envExamplePath = path.join(componentPath, '.env.example')
          if (!fs.existsSync(envExamplePath)) {
            console.warn(`${component}/.env.example not found - recommended for documentation`)
            continue
          }

          // Validate environment variables based on component
          const envContent = fs.readFileSync(envExamplePath, 'utf8')
          
          if (component === 'frontend') {
            const requiredVars = [
              'VITE_FIREBASE_API_KEY',
              'VITE_FIREBASE_AUTH_DOMAIN',
              'VITE_FIREBASE_PROJECT_ID'
            ]
            
            for (const varName of requiredVars) {
              if (!envContent.includes(varName)) {
                console.error(`${component}/.env.example missing required variable: ${varName}`)
                return false
              }
            }
          }

          if (component === 'backend' || component === 'functions') {
            const requiredVars = [
              'FIREBASE_PROJECT_ID'
            ]
            
            for (const varName of requiredVars) {
              if (!envContent.includes(varName)) {
                console.warn(`${component}/.env.example missing recommended variable: ${varName}`)
              }
            }
          }

          // Check that .env files are not tracked by git
          const envFiles = ['.env', '.env.local', '.env.production']
          for (const envFile of envFiles) {
            const envPath = path.join(componentPath, envFile)
            if (fs.existsSync(envPath)) {
              try {
                execSync(`git ls-files --error-unmatch ${envFile}`, { 
                  cwd: componentPath,
                  stdio: 'pipe'
                })
                console.error(`Environment file ${component}/${envFile} is tracked by git - this is a security risk`)
                return false
              } catch (error) {
                // File is not tracked, which is correct
              }
            }
          }
        }
      }

      // Check root-level configuration files
      const rootConfigFiles = [
        'firestore.rules',
        'storage.rules'
      ]

      for (const configFile of rootConfigFiles) {
        const configPath = path.join(this.workingDir, configFile)
        if (fs.existsSync(configPath)) {
          // Validate rules syntax
          const content = fs.readFileSync(configPath, 'utf8')
          
          // Basic syntax check for Firestore rules
          if (configFile === 'firestore.rules') {
            if (!content.includes('rules_version') || !content.includes('service cloud.firestore')) {
              console.error(`${configFile} has invalid syntax`)
              return false
            }
          }

          // Basic syntax check for Storage rules
          if (configFile === 'storage.rules') {
            if (!content.includes('rules_version') || !content.includes('service firebase.storage')) {
              console.error(`${configFile} has invalid syntax`)
              return false
            }
          }
        }
      }

      return true
    } catch (error) {
      console.error('Environment configuration validation failed:', error.message)
      return false
    }
  }

  /**
   * Validate dependencies and package configurations
   */
  private async validateDependencies(): Promise<boolean> {
    try {
      const components = ['frontend', 'backend', 'functions']
      
      for (const component of components) {
        const componentPath = path.join(this.workingDir, component)
        
        if (fs.existsSync(componentPath)) {
          // Check package.json exists
          const packageJsonPath = path.join(componentPath, 'package.json')
          if (!fs.existsSync(packageJsonPath)) {
            console.error(`${component}/package.json not found`)
            return false
          }

          // Validate package.json structure
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
          
          if (!packageJson.name || !packageJson.version) {
            console.error(`${component}/package.json missing required fields (name, version)`)
            return false
          }

          // Check for required scripts
          const requiredScripts = ['build']
          if (packageJson.scripts) {
            for (const script of requiredScripts) {
              if (!packageJson.scripts[script]) {
                console.error(`${component}/package.json missing required script: ${script}`)
                return false
              }
            }
          } else {
            console.error(`${component}/package.json missing scripts section`)
            return false
          }

          // Check package-lock.json exists
          const lockFilePath = path.join(componentPath, 'package-lock.json')
          if (!fs.existsSync(lockFilePath)) {
            console.error(`${component}/package-lock.json not found - run 'npm install'`)
            return false
          }

          // Check node_modules exists
          const nodeModulesPath = path.join(componentPath, 'node_modules')
          if (!fs.existsSync(nodeModulesPath)) {
            console.error(`${component}/node_modules not found - run 'npm install'`)
            return false
          }

          // Validate specific dependencies based on component
          if (component === 'frontend') {
            const requiredDeps = ['react', 'vite']
            for (const dep of requiredDeps) {
              if (!packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]) {
                console.error(`${component} missing required dependency: ${dep}`)
                return false
              }
            }
          }

          if (component === 'backend') {
            const requiredDeps = ['express']
            for (const dep of requiredDeps) {
              if (!packageJson.dependencies?.[dep]) {
                console.error(`${component} missing required dependency: ${dep}`)
                return false
              }
            }
          }

          if (component === 'functions') {
            const requiredDeps = ['firebase-functions', 'firebase-admin']
            for (const dep of requiredDeps) {
              if (!packageJson.dependencies?.[dep]) {
                console.error(`${component} missing required dependency: ${dep}`)
                return false
              }
            }
          }

          // Run security audit (non-blocking)
          try {
            execSync('npm audit --audit-level=high', { 
              cwd: componentPath,
              stdio: 'pipe'
            })
          } catch (auditError) {
            console.warn(`Security vulnerabilities found in ${component} - consider running 'npm audit fix'`)
          }
        }
      }

      return true
    } catch (error) {
      console.error('Dependencies validation failed:', error.message)
      return false
    }
  }

  /**
   * Validate specific Firebase project access
   */
  async validateFirebaseAccess(projectId?: string): Promise<boolean> {
    try {
      // Check if user is logged in to Firebase
      execSync('firebase projects:list', { stdio: 'pipe' })

      // If project ID is provided, check access to specific project
      if (projectId) {
        const output = execSync('firebase projects:list', { encoding: 'utf8' })
        if (!output.includes(projectId)) {
          console.error(`No access to Firebase project: ${projectId}`)
          return false
        }
      }

      return true
    } catch (error) {
      console.error('Firebase access validation failed:', error.message)
      console.error('Run "firebase login" to authenticate')
      return false
    }
  }

  /**
   * Generate configuration report
   */
  async generateReport(): Promise<string> {
    const result = await this.validateAll()
    
    let report = '# Configuration Validation Report\n\n'
    report += `**Status:** ${result.isValid ? '✅ VALID' : '❌ INVALID'}\n\n`
    
    report += '## Validation Details\n\n'
    report += `- Node.js Version: ${result.details.nodeVersion ? '✅' : '❌'}\n`
    report += `- Firebase Configuration: ${result.details.firebase ? '✅' : '❌'}\n`
    report += `- Environment Configuration: ${result.details.environment ? '✅' : '❌'}\n`
    report += `- Dependencies: ${result.details.dependencies ? '✅' : '❌'}\n\n`
    
    if (result.errors.length > 0) {
      report += '## Errors\n\n'
      for (const error of result.errors) {
        report += `- ❌ ${error}\n`
      }
      report += '\n'
    }
    
    if (result.warnings.length > 0) {
      report += '## Warnings\n\n'
      for (const warning of result.warnings) {
        report += `- ⚠️ ${warning}\n`
      }
      report += '\n'
    }
    
    report += `**Generated:** ${new Date().toISOString()}\n`
    
    return report
  }
}