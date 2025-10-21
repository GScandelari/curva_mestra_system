#!/usr/bin/env node

const ConfigManager = require('./configManager');
const chalk = require('chalk');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

/**
 * Environment Validation Script
 * Validates system environment and configuration for proper operation
 */
class EnvironmentValidator {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.configManager = new ConfigManager({ environment: this.environment, verbose: this.verbose });
  }

  /**
   * Run complete environment validation
   * @returns {Promise<object>} Validation results
   */
  async validateEnvironment() {
    console.log(chalk.bold.blue(`\n🔍 Validating Environment: ${this.environment}\n`));

    const results = {
      environment: this.environment,
      timestamp: new Date().toISOString(),
      overall: { passed: true, score: 0, total: 0 },
      checks: {}
    };

    const checks = [
      { name: 'Node.js Version', fn: () => this.checkNodeVersion() },
      { name: 'NPM Version', fn: () => this.checkNpmVersion() },
      { name: 'Git Configuration', fn: () => this.checkGitConfiguration() },
      { name: 'Firebase CLI', fn: () => this.checkFirebaseCLI() },
      { name: 'Firebase Authentication', fn: () => this.checkFirebaseAuth() },
      { name: 'Configuration Files', fn: () => this.checkConfigurationFiles() },
      { name: 'Environment Variables', fn: () => this.checkEnvironmentVariables() },
      { name: 'Project Structure', fn: () => this.checkProjectStructure() },
      { name: 'Dependencies', fn: () => this.checkDependencies() },
      { name: 'File Permissions', fn: () => this.checkFilePermissions() }
    ];

    for (const check of checks) {
      try {
        console.log(chalk.gray(`Checking ${check.name}...`));
        const result = await check.fn();
        results.checks[check.name] = { ...result, passed: result.status === 'pass' };
        results.overall.total++;
        if (result.status === 'pass') {
          results.overall.score++;
          console.log(chalk.green(`✅ ${check.name}: ${result.message}`));
        } else if (result.status === 'warn') {
          console.log(chalk.yellow(`⚠️  ${check.name}: ${result.message}`));
        } else {
          results.overall.passed = false;
          console.log(chalk.red(`❌ ${check.name}: ${result.message}`));
        }
      } catch (error) {
        results.overall.passed = false;
        results.checks[check.name] = { 
          status: 'fail', 
          message: error.message, 
          passed: false 
        };
        console.log(chalk.red(`❌ ${check.name}: ${error.message}`));
      }
    }

    // Print summary
    this.printValidationSummary(results);

    return results;
  }

  /**
   * Check Node.js version
   * @returns {object} Check result
   */
  async checkNodeVersion() {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    
    if (majorVersion >= 16) {
      return { status: 'pass', message: `Node.js ${nodeVersion}`, version: nodeVersion };
    } else if (majorVersion >= 14) {
      return { status: 'warn', message: `Node.js ${nodeVersion} (recommend v16+)`, version: nodeVersion };
    } else {
      return { status: 'fail', message: `Node.js ${nodeVersion} (requires v14+)`, version: nodeVersion };
    }
  }

  /**
   * Check NPM version
   * @returns {object} Check result
   */
  async checkNpmVersion() {
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      const majorVersion = parseInt(npmVersion.split('.')[0]);
      
      if (majorVersion >= 8) {
        return { status: 'pass', message: `NPM ${npmVersion}`, version: npmVersion };
      } else {
        return { status: 'warn', message: `NPM ${npmVersion} (recommend v8+)`, version: npmVersion };
      }
    } catch (error) {
      return { status: 'fail', message: 'NPM not found' };
    }
  }

  /**
   * Check Git configuration
   * @returns {object} Check result
   */
  async checkGitConfiguration() {
    try {
      const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
      const gitUser = execSync('git config user.name', { encoding: 'utf8' }).trim();
      const gitEmail = execSync('git config user.email', { encoding: 'utf8' }).trim();
      
      if (gitUser && gitEmail) {
        return { 
          status: 'pass', 
          message: `Git configured (${gitUser} <${gitEmail}>)`,
          version: gitVersion,
          user: gitUser,
          email: gitEmail
        };
      } else {
        return { 
          status: 'fail', 
          message: 'Git user.name or user.email not configured',
          version: gitVersion
        };
      }
    } catch (error) {
      return { status: 'fail', message: 'Git not found or not configured' };
    }
  }

  /**
   * Check Firebase CLI
   * @returns {object} Check result
   */
  async checkFirebaseCLI() {
    try {
      const firebaseVersion = execSync('firebase --version', { encoding: 'utf8' }).trim();
      return { status: 'pass', message: `Firebase CLI ${firebaseVersion}`, version: firebaseVersion };
    } catch (error) {
      return { status: 'fail', message: 'Firebase CLI not found. Install with: npm install -g firebase-tools' };
    }
  }

  /**
   * Check Firebase authentication
   * @returns {object} Check result
   */
  async checkFirebaseAuth() {
    try {
      const projects = execSync('firebase projects:list', { encoding: 'utf8', stdio: 'pipe' });
      
      if (projects.includes('curva-mestra')) {
        return { status: 'pass', message: 'Firebase authenticated and project accessible' };
      } else {
        return { status: 'warn', message: 'Firebase authenticated but curva-mestra project not found' };
      }
    } catch (error) {
      if (error.message.includes('not authenticated')) {
        return { status: 'fail', message: 'Firebase not authenticated. Run: firebase login' };
      } else {
        return { status: 'fail', message: 'Firebase authentication check failed' };
      }
    }
  }

  /**
   * Check configuration files
   * @returns {object} Check result
   */
  async checkConfigurationFiles() {
    const requiredFiles = [
      '.kiro/system-config.json',
      'firebase.json',
      'package.json'
    ];

    const optionalFiles = [
      `.kiro/config/${this.environment}.json`,
      'firestore.rules',
      'storage.rules'
    ];

    const results = { required: [], optional: [] };

    // Check required files
    for (const file of requiredFiles) {
      try {
        await fs.access(file);
        results.required.push({ file, exists: true });
      } catch {
        results.required.push({ file, exists: false });
      }
    }

    // Check optional files
    for (const file of optionalFiles) {
      try {
        await fs.access(file);
        results.optional.push({ file, exists: true });
      } catch {
        results.optional.push({ file, exists: false });
      }
    }

    const missingRequired = results.required.filter(f => !f.exists);
    
    if (missingRequired.length === 0) {
      return { 
        status: 'pass', 
        message: 'All required configuration files found',
        files: results
      };
    } else {
      return { 
        status: 'fail', 
        message: `Missing required files: ${missingRequired.map(f => f.file).join(', ')}`,
        files: results
      };
    }
  }

  /**
   * Check environment variables
   * @returns {object} Check result
   */
  async checkEnvironmentVariables() {
    try {
      const config = await this.configManager.loadConfiguration();
      
      // This will throw if required environment variables are missing
      await this.configManager.validateConfiguration(config);
      
      const envVars = {
        NODE_ENV: process.env.NODE_ENV || 'not set',
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'not set',
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || 'not set'
      };

      return { 
        status: 'pass', 
        message: 'Environment variables validated',
        variables: envVars
      };
    } catch (error) {
      return { 
        status: 'fail', 
        message: `Environment validation failed: ${error.message}`
      };
    }
  }

  /**
   * Check project structure
   * @returns {object} Check result
   */
  async checkProjectStructure() {
    const requiredDirs = [
      'frontend',
      'backend', 
      'functions',
      'scripts',
      '.kiro'
    ];

    const results = [];
    
    for (const dir of requiredDirs) {
      try {
        const stat = await fs.stat(dir);
        results.push({ directory: dir, exists: stat.isDirectory() });
      } catch {
        results.push({ directory: dir, exists: false });
      }
    }

    const missingDirs = results.filter(d => !d.exists);
    
    if (missingDirs.length === 0) {
      return { 
        status: 'pass', 
        message: 'Project structure validated',
        directories: results
      };
    } else {
      return { 
        status: 'fail', 
        message: `Missing directories: ${missingDirs.map(d => d.directory).join(', ')}`,
        directories: results
      };
    }
  }

  /**
   * Check dependencies
   * @returns {object} Check result
   */
  async checkDependencies() {
    const packagePaths = [
      'package.json',
      'frontend/package.json',
      'backend/package.json',
      'functions/package.json',
      'scripts/package.json'
    ];

    const results = [];
    
    for (const packagePath of packagePaths) {
      try {
        await fs.access(packagePath);
        await fs.access(path.join(path.dirname(packagePath), 'node_modules'));
        results.push({ package: packagePath, installed: true });
      } catch {
        results.push({ package: packagePath, installed: false });
      }
    }

    const missingDeps = results.filter(r => !r.installed);
    
    if (missingDeps.length === 0) {
      return { 
        status: 'pass', 
        message: 'All dependencies installed',
        packages: results
      };
    } else {
      return { 
        status: 'warn', 
        message: `Dependencies not installed for: ${missingDeps.map(d => d.package).join(', ')}`,
        packages: results
      };
    }
  }

  /**
   * Check file permissions
   * @returns {object} Check result
   */
  async checkFilePermissions() {
    const scriptsToCheck = [
      'scripts/systemOrchestrator.js',
      'scripts/documentationManager.js',
      'scripts/deployPipeline.js'
    ];

    const results = [];
    
    for (const script of scriptsToCheck) {
      try {
        await fs.access(script, fs.constants.R_OK);
        results.push({ file: script, readable: true });
      } catch {
        results.push({ file: script, readable: false });
      }
    }

    const unreadableFiles = results.filter(r => !r.readable);
    
    if (unreadableFiles.length === 0) {
      return { 
        status: 'pass', 
        message: 'File permissions validated',
        files: results
      };
    } else {
      return { 
        status: 'fail', 
        message: `Unreadable files: ${unreadableFiles.map(f => f.file).join(', ')}`,
        files: results
      };
    }
  }

  /**
   * Print validation summary
   * @param {object} results Validation results
   */
  printValidationSummary(results) {
    console.log(chalk.bold('\n=== Environment Validation Summary ==='));
    console.log(`Environment: ${chalk.cyan(results.environment)}`);
    console.log(`Score: ${chalk.cyan(results.overall.score)}/${chalk.cyan(results.overall.total)}`);
    
    if (results.overall.passed) {
      console.log(chalk.green.bold('✅ Environment validation PASSED'));
      console.log(chalk.green('System is ready for operation'));
    } else {
      console.log(chalk.red.bold('❌ Environment validation FAILED'));
      console.log(chalk.red('Please fix the issues above before proceeding'));
    }

    // Recommendations
    const failedChecks = Object.entries(results.checks)
      .filter(([_, check]) => check.status === 'fail')
      .map(([name, _]) => name);

    if (failedChecks.length > 0) {
      console.log(chalk.bold('\n📋 Recommended Actions:'));
      
      if (failedChecks.includes('Firebase CLI')) {
        console.log('• Install Firebase CLI: npm install -g firebase-tools');
      }
      
      if (failedChecks.includes('Firebase Authentication')) {
        console.log('• Authenticate with Firebase: firebase login');
      }
      
      if (failedChecks.includes('Git Configuration')) {
        console.log('• Configure Git: git config --global user.name "Your Name"');
        console.log('• Configure Git: git config --global user.email "your.email@example.com"');
      }
      
      if (failedChecks.includes('Dependencies')) {
        console.log('• Install dependencies: npm run install:all');
      }
    }

    console.log('');
  }
}

// CLI interface
if (require.main === module) {
  const { Command } = require('commander');
  const program = new Command();

  program
    .name('validate-environment')
    .description('Validate system environment and configuration')
    .version('1.0.0')
    .option('-v, --verbose', 'Enable verbose output')
    .option('-e, --environment <env>', 'Environment to validate', process.env.NODE_ENV || 'development')
    .action(async (options) => {
      const validator = new EnvironmentValidator({
        verbose: options.verbose,
        environment: options.environment
      });

      try {
        const results = await validator.validateEnvironment();
        process.exit(results.overall.passed ? 0 : 1);
      } catch (error) {
        console.error(chalk.red(`Validation failed: ${error.message}`));
        process.exit(1);
      }
    });

  program.parse();
}

module.exports = EnvironmentValidator;