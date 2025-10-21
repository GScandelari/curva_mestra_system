#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs').promises;

// Import system components
const DocumentationManager = require('./documentationManager');
const { DeploymentPipeline } = require('./deployPipeline');

/**
 * System Orchestrator
 * Master script that coordinates admin setup, documentation organization, and deployment
 */
class SystemOrchestrator {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.dryRun = options.dryRun || false;
    this.configPath = options.configPath || '.kiro/system-config.json';
    this.logPath = options.logPath || 'logs/system-orchestrator.log';
    
    // Initialize components
    this.documentationManager = new DocumentationManager();
    this.deploymentPipeline = new DeploymentPipeline({
      verbose: this.verbose,
      autoRollback: true
    });
    
    // Progress tracking
    this.progress = {
      total: 0,
      completed: 0,
      current: null,
      steps: []
    };
  }

  /**
   * Load system configuration
   * @returns {Promise<object>} Configuration object
   */
  async loadConfiguration() {
    try {
      const configExists = await this.fileExists(this.configPath);
      if (!configExists) {
        return this.createDefaultConfiguration();
      }

      const configData = await fs.readFile(this.configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not load configuration: ${error.message}`));
      return this.createDefaultConfiguration();
    }
  }

  /**
   * Create default system configuration
   * @returns {object} Default configuration
   */
  createDefaultConfiguration() {
    return {
      admin: {
        defaultUID: 'gEjUSOsHF9QmS0Dvi0zB10GsxrD2',
        defaultEmail: 'scandelari.guilherme@hotmail.com',
        autoInitialize: true
      },
      documentation: {
        autoOrganize: true,
        createBackup: true,
        updateReferences: true,
        useGitMv: true
      },
      deployment: {
        autoCommit: true,
        targets: ['hosting', 'functions', 'firestore'],
        autoRollback: true,
        buildBeforeDeploy: true
      },
      notifications: {
        console: true,
        logFile: true
      }
    };
  }

  /**
   * Save system configuration
   * @param {object} config Configuration to save
   * @returns {Promise<void>}
   */
  async saveConfiguration(config) {
    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      await this.ensureDirectoryExists(configDir);

      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      this.log('Configuration saved successfully');
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  /**
   * Initialize progress tracking
   * @param {string[]} steps Array of step names
   */
  initializeProgress(steps) {
    this.progress = {
      total: steps.length,
      completed: 0,
      current: null,
      steps: steps.map(step => ({ name: step, status: 'pending', startTime: null, endTime: null }))
    };
  }

  /**
   * Update progress for current step
   * @param {string} stepName Name of the step
   * @param {string} status Status: 'running', 'completed', 'failed'
   * @param {string} message Optional status message
   */
  updateProgress(stepName, status, message = '') {
    const step = this.progress.steps.find(s => s.name === stepName);
    if (step) {
      step.status = status;
      step.message = message;
      
      if (status === 'running') {
        step.startTime = new Date().toISOString();
        this.progress.current = stepName;
      } else if (status === 'completed' || status === 'failed') {
        step.endTime = new Date().toISOString();
        if (status === 'completed') {
          this.progress.completed++;
        }
      }
    }

    if (this.verbose) {
      const emoji = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '🔄';
      console.log(`${emoji} ${stepName}: ${status}${message ? ` - ${message}` : ''}`);
    }
  }

  /**
   * Print progress summary
   */
  printProgressSummary() {
    console.log(chalk.bold('\n=== System Orchestration Progress ==='));
    console.log(`Total Steps: ${this.progress.total}`);
    console.log(`Completed: ${this.progress.completed}`);
    console.log(`Current: ${this.progress.current || 'None'}\n`);

    this.progress.steps.forEach(step => {
      const emoji = step.status === 'completed' ? '✅' : 
                   step.status === 'failed' ? '❌' : 
                   step.status === 'running' ? '🔄' : '⏳';
      
      const duration = step.startTime && step.endTime ? 
        ` (${Math.round((new Date(step.endTime) - new Date(step.startTime)) / 1000)}s)` : '';
      
      console.log(`${emoji} ${step.name}${duration}`);
      if (step.message) {
        console.log(`   ${chalk.gray(step.message)}`);
      }
    });
  }

  /**
   * Execute admin setup process
   * @param {object} config System configuration
   * @returns {Promise<object>} Setup result
   */
  async executeAdminSetup(config) {
    this.updateProgress('Admin Setup', 'running', 'Initializing admin user');

    try {
      if (this.dryRun) {
        this.updateProgress('Admin Setup', 'completed', 'Dry run - admin setup skipped');
        return { success: true, dryRun: true };
      }

      // Call Firebase function to initialize admin
      const { execSync } = require('child_process');
      
      // Check if Firebase CLI is available
      try {
        execSync('firebase --version', { stdio: 'pipe' });
      } catch (error) {
        throw new Error('Firebase CLI not found. Please install Firebase CLI first.');
      }

      // Call the admin initialization function
      const result = execSync(
        `firebase functions:call initializeDefaultAdmin --project=curva-mestra`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      const adminResult = JSON.parse(result);
      
      if (adminResult.success) {
        this.updateProgress('Admin Setup', 'completed', 
          `Admin user initialized: ${config.admin.defaultEmail}`);
        return adminResult;
      } else {
        throw new Error(adminResult.message || 'Admin initialization failed');
      }

    } catch (error) {
      this.updateProgress('Admin Setup', 'failed', error.message);
      throw error;
    }
  }

  /**
   * Execute documentation organization
   * @param {object} config System configuration
   * @returns {Promise<object>} Organization result
   */
  async executeDocumentationOrganization(config) {
    this.updateProgress('Documentation Organization', 'running', 'Scanning and organizing files');

    try {
      if (this.dryRun) {
        // Perform dry run - scan only
        await this.documentationManager.generateFileInventory();
        this.documentationManager.printInventorySummary();
        
        this.updateProgress('Documentation Organization', 'completed', 'Dry run - files scanned only');
        return { success: true, dryRun: true, filesFound: this.documentationManager.fileInventory.length };
      }

      // Generate file inventory
      await this.documentationManager.generateFileInventory();
      
      // Create documentation structure
      await this.documentationManager.createDocumentationStructure();
      
      // Create backup if configured
      let backupDir = null;
      if (config.documentation.createBackup) {
        backupDir = await this.documentationManager.createBackup();
      }
      
      // Move files to documentation structure
      const moveOperations = await this.documentationManager.moveFilesToDocumentation(
        config.documentation.useGitMv
      );
      
      // Update category indexes
      await this.documentationManager.updateCategoryIndexes(moveOperations);
      
      this.updateProgress('Documentation Organization', 'completed', 
        `Organized ${moveOperations.length} files`);
      
      return {
        success: true,
        filesOrganized: moveOperations.length,
        backupCreated: backupDir,
        moveOperations
      };

    } catch (error) {
      this.updateProgress('Documentation Organization', 'failed', error.message);
      throw error;
    }
  }

  /**
   * Execute deployment pipeline
   * @param {object} config System configuration
   * @returns {Promise<object>} Deployment result
   */
  async executeDeployment(config) {
    this.updateProgress('Deployment', 'running', 'Executing deployment pipeline');

    try {
      if (this.dryRun) {
        // Validate deployment environment only
        const validation = this.deploymentPipeline.firebaseDeployment.validateEnvironment();
        
        this.updateProgress('Deployment', 'completed', 'Dry run - environment validated');
        return { success: true, dryRun: true, validation };
      }

      // Execute deployment pipeline
      const deploymentResult = await this.deploymentPipeline.executeDeployment({
        commitMessage: 'System orchestration: automated deployment',
        changeType: 'deploy',
        skipCommit: !config.deployment.autoCommit,
        targets: config.deployment.targets
      });

      if (deploymentResult.success) {
        this.updateProgress('Deployment', 'completed', 
          `Deployed ${config.deployment.targets.join(', ')}`);
      } else {
        this.updateProgress('Deployment', 'failed', 
          deploymentResult.error || 'Deployment failed');
      }

      return deploymentResult;

    } catch (error) {
      this.updateProgress('Deployment', 'failed', error.message);
      throw error;
    }
  }

  /**
   * Execute complete system setup
   * @param {object} options Setup options
   * @returns {Promise<object>} Complete setup result
   */
  async executeCompleteSetup(options = {}) {
    const {
      skipAdmin = false,
      skipDocs = false,
      skipDeploy = false,
      interactive = false
    } = options;

    console.log(chalk.bold.blue('\n🚀 Starting System Orchestration\n'));

    // Load configuration
    const config = await this.loadConfiguration();
    
    // Interactive mode - ask user for confirmation
    if (interactive && !this.dryRun) {
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'This will set up admin user, organize documentation, and deploy to Firebase. Continue?',
          default: false
        }
      ]);

      if (!answers.proceed) {
        console.log(chalk.yellow('Setup cancelled by user'));
        return { success: false, cancelled: true };
      }
    }

    // Initialize progress tracking
    const steps = [];
    if (!skipAdmin) steps.push('Admin Setup');
    if (!skipDocs) steps.push('Documentation Organization');
    if (!skipDeploy) steps.push('Deployment');
    
    this.initializeProgress(steps);

    const setupResult = {
      success: true,
      startTime: new Date().toISOString(),
      endTime: null,
      config,
      results: {},
      errors: []
    };

    const startTime = Date.now();

    try {
      // Execute admin setup
      if (!skipAdmin) {
        setupResult.results.admin = await this.executeAdminSetup(config);
      }

      // Execute documentation organization
      if (!skipDocs) {
        setupResult.results.documentation = await this.executeDocumentationOrganization(config);
      }

      // Execute deployment
      if (!skipDeploy) {
        setupResult.results.deployment = await this.executeDeployment(config);
      }

      // Check overall success
      setupResult.success = Object.values(setupResult.results).every(result => result.success);

    } catch (error) {
      setupResult.success = false;
      setupResult.errors.push(error.message);
      console.error(chalk.red(`\n❌ Setup failed: ${error.message}`));
    }

    setupResult.duration = Date.now() - startTime;
    setupResult.endTime = new Date().toISOString();

    // Print final summary
    this.printProgressSummary();
    
    if (setupResult.success) {
      console.log(chalk.green.bold('\n✅ System orchestration completed successfully!'));
    } else {
      console.log(chalk.red.bold('\n❌ System orchestration completed with errors'));
    }

    // Log results
    await this.logResults(setupResult);

    return setupResult;
  }

  /**
   * Utility: Check if file exists
   * @param {string} filePath Path to check
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Utility: Ensure directory exists
   * @param {string} dirPath Directory path
   * @returns {Promise<void>}
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Log operation results
   * @param {object} results Results to log
   * @returns {Promise<void>}
   */
  async logResults(results) {
    try {
      const logDir = path.dirname(this.logPath);
      await this.ensureDirectoryExists(logDir);

      const logEntry = {
        timestamp: new Date().toISOString(),
        operation: 'system_orchestration',
        results,
        environment: process.env.NODE_ENV || 'development'
      };

      const logString = JSON.stringify(logEntry, null, 2) + '\n';
      await fs.appendFile(this.logPath, logString);

      if (this.verbose) {
        console.log(chalk.gray(`\nResults logged to: ${this.logPath}`));
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not write log: ${error.message}`));
    }
  }

  /**
   * Simple logging method
   * @param {string} message Message to log
   */
  log(message) {
    if (this.verbose) {
      console.log(chalk.gray(`[${new Date().toISOString()}] ${message}`));
    }
  }
}

// CLI Interface
const program = new Command();

program
  .name('system-orchestrator')
  .description('System Orchestrator - Coordinates admin setup, documentation organization, and deployment')
  .version('1.0.0');

program
  .command('setup')
  .description('Execute complete system setup')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-d, --dry-run', 'Perform dry run without making changes')
  .option('-i, --interactive', 'Interactive mode with confirmations')
  .option('--skip-admin', 'Skip admin user setup')
  .option('--skip-docs', 'Skip documentation organization')
  .option('--skip-deploy', 'Skip deployment')
  .option('--config <path>', 'Path to configuration file')
  .action(async (options) => {
    const orchestrator = new SystemOrchestrator({
      verbose: options.verbose,
      dryRun: options.dryRun,
      configPath: options.config
    });

    try {
      await orchestrator.executeCompleteSetup({
        skipAdmin: options.skipAdmin,
        skipDocs: options.skipDocs,
        skipDeploy: options.skipDeploy,
        interactive: options.interactive
      });
    } catch (error) {
      console.error(chalk.red(`Fatal error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('admin')
  .description('Setup admin user only')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-d, --dry-run', 'Perform dry run')
  .action(async (options) => {
    const orchestrator = new SystemOrchestrator({
      verbose: options.verbose,
      dryRun: options.dryRun
    });

    try {
      await orchestrator.executeCompleteSetup({
        skipDocs: true,
        skipDeploy: true
      });
    } catch (error) {
      console.error(chalk.red(`Admin setup failed: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('docs')
  .description('Organize documentation only')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-d, --dry-run', 'Perform dry run')
  .action(async (options) => {
    const orchestrator = new SystemOrchestrator({
      verbose: options.verbose,
      dryRun: options.dryRun
    });

    try {
      await orchestrator.executeCompleteSetup({
        skipAdmin: true,
        skipDeploy: true
      });
    } catch (error) {
      console.error(chalk.red(`Documentation organization failed: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('deploy')
  .description('Execute deployment only')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-d, --dry-run', 'Perform dry run')
  .option('-t, --targets <targets>', 'Deployment targets (comma-separated)', 'hosting,functions,firestore')
  .action(async (options) => {
    const orchestrator = new SystemOrchestrator({
      verbose: options.verbose,
      dryRun: options.dryRun
    });

    // Override deployment targets if specified
    if (options.targets) {
      const config = await orchestrator.loadConfiguration();
      config.deployment.targets = options.targets.split(',').map(t => t.trim());
      await orchestrator.saveConfiguration(config);
    }

    try {
      await orchestrator.executeCompleteSetup({
        skipAdmin: true,
        skipDocs: true
      });
    } catch (error) {
      console.error(chalk.red(`Deployment failed: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Manage system configuration')
  .option('--show', 'Show current configuration')
  .option('--reset', 'Reset to default configuration')
  .action(async (options) => {
    const orchestrator = new SystemOrchestrator();

    if (options.show) {
      const config = await orchestrator.loadConfiguration();
      console.log(JSON.stringify(config, null, 2));
    } else if (options.reset) {
      const defaultConfig = orchestrator.createDefaultConfiguration();
      await orchestrator.saveConfiguration(defaultConfig);
      console.log(chalk.green('Configuration reset to defaults'));
    } else {
      console.log('Use --show to display configuration or --reset to reset to defaults');
    }
  });

// Export for programmatic use
module.exports = SystemOrchestrator;

// CLI execution
if (require.main === module) {
  program.parse();
}