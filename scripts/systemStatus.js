#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

/**
 * System Status Checker
 * Comprehensive status check for the Admin System Organization
 */
class SystemStatusChecker {
  constructor() {
    this.checks = [];
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      total: 0
    };
  }

  /**
   * Run all system status checks
   */
  async runAllChecks() {
    console.log(chalk.bold.blue('\n🔍 Admin System Organization - Status Check\n'));

    const checks = [
      { name: 'Project Structure', fn: () => this.checkProjectStructure() },
      { name: 'Dependencies', fn: () => this.checkDependencies() },
      { name: 'Configuration Files', fn: () => this.checkConfigurationFiles() },
      { name: 'System Scripts', fn: () => this.checkSystemScripts() },
      { name: 'Test Coverage', fn: () => this.checkTestCoverage() },
      { name: 'Git Repository', fn: () => this.checkGitRepository() },
      { name: 'Firebase Setup', fn: () => this.checkFirebaseSetup() },
      { name: 'Admin Components', fn: () => this.checkAdminComponents() },
      { name: 'Documentation System', fn: () => this.checkDocumentationSystem() },
      { name: 'Deployment Pipeline', fn: () => this.checkDeploymentPipeline() }
    ];

    for (const check of checks) {
      try {
        const result = await check.fn();
        this.displayResult(check.name, result);
        this.updateStats(result);
      } catch (error) {
        this.displayResult(check.name, { status: 'fail', message: error.message });
        this.updateStats({ status: 'fail' });
      }
    }

    this.displaySummary();
    return this.results;
  }

  /**
   * Check project structure
   */
  async checkProjectStructure() {
    const requiredDirs = [
      '.',
      '../functions/src/admin',
      '../.kiro',
      '../.kiro/config'
    ];

    const requiredFiles = [
      '../package.json',
      '../firebase.json',
      'systemOrchestrator.js',
      'configManager.js',
      'validateEnvironment.js',
      '../functions/src/admin/adminInitializer.ts',
      '../functions/src/admin/userRoleManager.ts'
    ];

    const missing = [];

    // Check directories
    for (const dir of requiredDirs) {
      try {
        const stat = await fs.stat(dir);
        if (!stat.isDirectory()) {
          missing.push(`${dir} (not a directory)`);
        }
      } catch {
        missing.push(`${dir} (missing)`);
      }
    }

    // Check files
    for (const file of requiredFiles) {
      try {
        await fs.access(file);
      } catch {
        missing.push(`${file} (missing)`);
      }
    }

    if (missing.length === 0) {
      return { status: 'pass', message: 'All required files and directories present' };
    } else {
      return { status: 'fail', message: `Missing: ${missing.join(', ')}` };
    }
  }

  /**
   * Check dependencies
   */
  async checkDependencies() {
    const packagePaths = [
      '../package.json',
      'package.json',
      '../functions/package.json'
    ];

    const results = [];

    for (const packagePath of packagePaths) {
      try {
        await fs.access(packagePath);
        const nodeModulesPath = path.join(path.dirname(packagePath), 'node_modules');
        try {
          await fs.access(nodeModulesPath);
          results.push({ package: packagePath, installed: true });
        } catch {
          results.push({ package: packagePath, installed: false });
        }
      } catch {
        results.push({ package: packagePath, exists: false });
      }
    }

    const missing = results.filter(r => !r.installed);
    
    if (missing.length === 0) {
      return { status: 'pass', message: 'All dependencies installed' };
    } else {
      return { status: 'warn', message: `Dependencies missing for: ${missing.map(m => m.package).join(', ')}` };
    }
  }

  /**
   * Check configuration files
   */
  async checkConfigurationFiles() {
    const configFiles = [
      '../.kiro/system-config.json',
      '../.kiro/config/development.json',
      '../.kiro/config/production.json'
    ];

    const results = [];

    for (const file of configFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        JSON.parse(content); // Validate JSON
        results.push({ file, valid: true });
      } catch (error) {
        results.push({ file, valid: false, error: error.message });
      }
    }

    const invalid = results.filter(r => !r.valid);
    
    if (invalid.length === 0) {
      return { status: 'pass', message: 'All configuration files valid' };
    } else {
      return { status: 'fail', message: `Invalid configs: ${invalid.map(i => i.file).join(', ')}` };
    }
  }

  /**
   * Check system scripts
   */
  async checkSystemScripts() {
    const scripts = [
      'systemOrchestrator.js',
      'configManager.js',
      'validateEnvironment.js',
      'documentationManager.js',
      'deployPipeline.js'
    ];

    const results = [];

    for (const script of scripts) {
      try {
        // Check if file is readable and executable
        await fs.access(script, fs.constants.R_OK);
        
        // Basic syntax check by requiring the module
        const content = await fs.readFile(script, 'utf8');
        if (content.includes('module.exports') || content.includes('export')) {
          results.push({ script, status: 'ok' });
        } else {
          results.push({ script, status: 'warn', message: 'No exports found' });
        }
      } catch (error) {
        results.push({ script, status: 'fail', error: error.message });
      }
    }

    const failed = results.filter(r => r.status === 'fail');
    
    if (failed.length === 0) {
      return { status: 'pass', message: 'All system scripts accessible' };
    } else {
      return { status: 'fail', message: `Script issues: ${failed.map(f => f.script).join(', ')}` };
    }
  }

  /**
   * Check test coverage
   */
  async checkTestCoverage() {
    try {
      const testDir = 'test';
      const testFiles = await fs.readdir(testDir);
      const testCount = testFiles.filter(f => f.endsWith('.test.js')).length;

      if (testCount >= 5) {
        return { status: 'pass', message: `${testCount} test files found` };
      } else {
        return { status: 'warn', message: `Only ${testCount} test files found` };
      }
    } catch {
      return { status: 'fail', message: 'Test directory not found' };
    }
  }

  /**
   * Check Git repository
   */
  checkGitRepository() {
    try {
      execSync('git rev-parse --git-dir', { stdio: 'pipe' });
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      
      if (status.trim() === '') {
        return { status: 'pass', message: 'Git repository clean' };
      } else {
        return { status: 'warn', message: 'Git repository has uncommitted changes' };
      }
    } catch {
      return { status: 'fail', message: 'Not a Git repository or Git not configured' };
    }
  }

  /**
   * Check Firebase setup
   */
  checkFirebaseSetup() {
    try {
      // Check Firebase CLI
      execSync('firebase --version', { stdio: 'pipe' });
      
      // Check project access
      const projects = execSync('firebase projects:list', { encoding: 'utf8', stdio: 'pipe' });
      
      if (projects.includes('curva-mestra')) {
        return { status: 'pass', message: 'Firebase CLI configured and project accessible' };
      } else {
        return { status: 'warn', message: 'Firebase CLI configured but curva-mestra project not found' };
      }
    } catch (error) {
      if (error.message.includes('not authenticated')) {
        return { status: 'fail', message: 'Firebase CLI not authenticated' };
      } else {
        return { status: 'fail', message: 'Firebase CLI not installed or configured' };
      }
    }
  }

  /**
   * Check admin components
   */
  async checkAdminComponents() {
    const adminFiles = [
      '../functions/src/admin/adminInitializer.ts',
      '../functions/src/admin/userRoleManager.ts'
    ];

    const testFiles = [
      '../functions/src/test/admin-role-management.test.ts'
    ];

    const missing = [];

    for (const file of [...adminFiles, ...testFiles]) {
      try {
        await fs.access(file);
      } catch {
        missing.push(file);
      }
    }

    if (missing.length === 0) {
      return { status: 'pass', message: 'All admin components present' };
    } else {
      return { status: 'fail', message: `Missing admin files: ${missing.join(', ')}` };
    }
  }

  /**
   * Check documentation system
   */
  async checkDocumentationSystem() {
    try {
      const docManagerPath = 'documentationManager.js';
      await fs.access(docManagerPath);
      
      const testPath = 'test/documentationManager.test.js';
      await fs.access(testPath);
      
      return { status: 'pass', message: 'Documentation system components present' };
    } catch {
      return { status: 'fail', message: 'Documentation system components missing' };
    }
  }

  /**
   * Check deployment pipeline
   */
  async checkDeploymentPipeline() {
    try {
      const pipelinePath = 'deployPipeline.js';
      await fs.access(pipelinePath);
      
      const testPath = 'test/deploymentPipeline.test.js';
      await fs.access(testPath);
      
      return { status: 'pass', message: 'Deployment pipeline components present' };
    } catch {
      return { status: 'fail', message: 'Deployment pipeline components missing' };
    }
  }

  /**
   * Display check result
   */
  displayResult(name, result) {
    const emoji = result.status === 'pass' ? '✅' : 
                 result.status === 'warn' ? '⚠️' : '❌';
    
    const color = result.status === 'pass' ? chalk.green : 
                  result.status === 'warn' ? chalk.yellow : chalk.red;
    
    console.log(`${emoji} ${color(name)}: ${result.message}`);
  }

  /**
   * Update statistics
   */
  updateStats(result) {
    this.results.total++;
    if (result.status === 'pass') {
      this.results.passed++;
    } else if (result.status === 'warn') {
      this.results.warnings++;
    } else {
      this.results.failed++;
    }
  }

  /**
   * Display final summary
   */
  displaySummary() {
    console.log(chalk.bold('\n📊 System Status Summary'));
    console.log(`Total Checks: ${this.results.total}`);
    console.log(chalk.green(`✅ Passed: ${this.results.passed}`));
    console.log(chalk.yellow(`⚠️  Warnings: ${this.results.warnings}`));
    console.log(chalk.red(`❌ Failed: ${this.results.failed}`));

    const score = Math.round((this.results.passed / this.results.total) * 100);
    console.log(`\n🎯 Overall Score: ${score}%`);

    if (this.results.failed === 0) {
      console.log(chalk.green.bold('\n🎉 System is ready for deployment!'));
    } else {
      console.log(chalk.red.bold('\n🚨 System has issues that need to be resolved before deployment.'));
    }

    if (this.results.warnings > 0) {
      console.log(chalk.yellow('\n💡 Consider addressing warnings for optimal performance.'));
    }
  }
}

// CLI execution
if (require.main === module) {
  const checker = new SystemStatusChecker();
  checker.runAllChecks().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error(chalk.red(`Status check failed: ${error.message}`));
    process.exit(1);
  });
}

module.exports = SystemStatusChecker;