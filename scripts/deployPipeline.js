const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Git Operations Automation
 * Handles automated Git operations for the deployment pipeline
 */
class GitOperations {
  constructor(options = {}) {
    this.workingDir = options.workingDir || process.cwd();
    this.verbose = options.verbose || false;
  }

  /**
   * Execute a Git command and return the result
   * @param {string} command - Git command to execute
   * @returns {string} - Command output
   */
  executeGitCommand(command) {
    try {
      const fullCommand = `git ${command}`;
      if (this.verbose) {
        console.log(`Executing: ${fullCommand}`);
      }
      
      const result = execSync(fullCommand, {
        cwd: this.workingDir,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      return result.trim();
    } catch (error) {
      throw new Error(`Git command failed: ${command}\nError: ${error.message}`);
    }
  }

  /**
   * Check if the working directory is clean (no uncommitted changes)
   * @returns {boolean} - True if working directory is clean
   */
  isWorkingDirectoryClean() {
    try {
      const status = this.executeGitCommand('status --porcelain');
      return status.length === 0;
    } catch (error) {
      throw new Error(`Failed to check Git status: ${error.message}`);
    }
  }

  /**
   * Get the current Git branch name
   * @returns {string} - Current branch name
   */
  getCurrentBranch() {
    try {
      return this.executeGitCommand('rev-parse --abbrev-ref HEAD');
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error.message}`);
    }
  }

  /**
   * Stage all changes in the working directory
   * @returns {void}
   */
  stageAllChanges() {
    try {
      this.executeGitCommand('add .');
      if (this.verbose) {
        console.log('All changes staged successfully');
      }
    } catch (error) {
      throw new Error(`Failed to stage changes: ${error.message}`);
    }
  }

  /**
   * Stage specific files
   * @param {string[]} files - Array of file paths to stage
   * @returns {void}
   */
  stageFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('Files array is required and must not be empty');
    }

    try {
      const filesString = files.map(file => `"${file}"`).join(' ');
      this.executeGitCommand(`add ${filesString}`);
      if (this.verbose) {
        console.log(`Files staged: ${files.join(', ')}`);
      }
    } catch (error) {
      throw new Error(`Failed to stage files: ${error.message}`);
    }
  }

  /**
   * Create a commit with the specified message
   * @param {string} message - Commit message
   * @returns {string} - Commit hash
   */
  createCommit(message) {
    if (!message || typeof message !== 'string') {
      throw new Error('Commit message is required and must be a string');
    }

    try {
      this.executeGitCommand(`commit -m "${message}"`);
      const commitHash = this.executeGitCommand('rev-parse HEAD');
      
      if (this.verbose) {
        console.log(`Commit created: ${commitHash.substring(0, 8)} - ${message}`);
      }
      
      return commitHash;
    } catch (error) {
      throw new Error(`Failed to create commit: ${error.message}`);
    }
  }

  /**
   * Generate meaningful commit message based on change type
   * @param {string} changeType - Type of change (admin, docs, deploy, feature, fix)
   * @param {string} description - Description of the change
   * @param {string[]} files - Optional array of affected files
   * @returns {string} - Generated commit message
   */
  generateCommitMessage(changeType, description, files = []) {
    const typeMap = {
      admin: 'admin',
      docs: 'docs',
      deploy: 'deploy',
      feature: 'feat',
      fix: 'fix',
      refactor: 'refactor',
      test: 'test'
    };

    const prefix = typeMap[changeType] || 'chore';
    let message = `${prefix}: ${description}`;

    if (files.length > 0) {
      const fileList = files.length > 3 
        ? `${files.slice(0, 3).join(', ')} and ${files.length - 3} more`
        : files.join(', ');
      message += `\n\nAffected files: ${fileList}`;
    }

    return message;
  }

  /**
   * Validate working directory before operations
   * @param {boolean} requireClean - Whether to require a clean working directory
   * @returns {object} - Validation result with status and details
   */
  validateWorkingDirectory(requireClean = true) {
    const validation = {
      isValid: true,
      issues: [],
      branch: null,
      isClean: false
    };

    try {
      // Check if we're in a Git repository
      this.executeGitCommand('rev-parse --git-dir');
    } catch (error) {
      validation.isValid = false;
      validation.issues.push('Not in a Git repository');
      return validation;
    }

    try {
      validation.branch = this.getCurrentBranch();
      validation.isClean = this.isWorkingDirectoryClean();

      if (requireClean && !validation.isClean) {
        validation.isValid = false;
        validation.issues.push('Working directory has uncommitted changes');
      }

      // Check if there are any staged changes
      const stagedFiles = this.executeGitCommand('diff --cached --name-only');
      if (stagedFiles.length > 0) {
        validation.stagedFiles = stagedFiles.split('\n').filter(f => f.trim());
      }

    } catch (error) {
      validation.isValid = false;
      validation.issues.push(`Git validation failed: ${error.message}`);
    }

    return validation;
  }

  /**
   * Automatically stage and commit changes with validation
   * @param {object} options - Commit options
   * @param {string} options.changeType - Type of change
   * @param {string} options.description - Description of changes
   * @param {string[]} options.files - Optional specific files to stage
   * @param {boolean} options.stageAll - Whether to stage all changes (default: true)
   * @returns {object} - Result with commit hash and details
   */
  autoCommit(options = {}) {
    const {
      changeType = 'chore',
      description = 'Automated commit',
      files = [],
      stageAll = true
    } = options;

    // Validate working directory
    const validation = this.validateWorkingDirectory(false);
    if (!validation.isValid) {
      throw new Error(`Git validation failed: ${validation.issues.join(', ')}`);
    }

    try {
      // Stage changes
      if (files.length > 0) {
        this.stageFiles(files);
      } else if (stageAll) {
        this.stageAllChanges();
      }

      // Check if there are changes to commit
      const stagedChanges = this.executeGitCommand('diff --cached --name-only');
      if (!stagedChanges.trim()) {
        return {
          success: false,
          message: 'No changes to commit',
          commitHash: null
        };
      }

      // Generate commit message and create commit
      const commitMessage = this.generateCommitMessage(
        changeType, 
        description, 
        stagedChanges.split('\n').filter(f => f.trim())
      );
      
      const commitHash = this.createCommit(commitMessage);

      return {
        success: true,
        message: 'Changes committed successfully',
        commitHash,
        commitMessage,
        branch: validation.branch,
        stagedFiles: stagedChanges.split('\n').filter(f => f.trim())
      };

    } catch (error) {
      throw new Error(`Auto-commit failed: ${error.message}`);
    }
  }

  /**
   * Get the last commit hash
   * @returns {string} - Last commit hash
   */
  getLastCommitHash() {
    try {
      return this.executeGitCommand('rev-parse HEAD');
    } catch (error) {
      throw new Error(`Failed to get last commit hash: ${error.message}`);
    }
  }

  /**
   * Revert to a specific commit
   * @param {string} commitHash - Commit hash to revert to
   * @param {boolean} hard - Whether to perform a hard reset (default: false)
   * @returns {void}
   */
  revertToCommit(commitHash, hard = false) {
    if (!commitHash) {
      throw new Error('Commit hash is required');
    }

    try {
      const resetType = hard ? '--hard' : '--soft';
      this.executeGitCommand(`reset ${resetType} ${commitHash}`);
      
      if (this.verbose) {
        console.log(`Reverted to commit: ${commitHash.substring(0, 8)}`);
      }
    } catch (error) {
      throw new Error(`Failed to revert to commit: ${error.message}`);
    }
  }
}

module.exports = { GitOperations };

/**
 * Firebase Deployment Automation
 * Handles automated Firebase deployments for hosting, functions, and Firestore
 */
class FirebaseDeployment {
  constructor(options = {}) {
    this.projectId = options.projectId || 'curva-mestra';
    this.workingDir = options.workingDir || process.cwd();
    this.verbose = options.verbose || false;
    this.deploymentTargets = options.targets || ['hosting', 'functions', 'firestore'];
  }

  /**
   * Execute a Firebase CLI command
   * @param {string} command - Firebase command to execute
   * @param {object} options - Command options
   * @returns {string} - Command output
   */
  executeFirebaseCommand(command, options = {}) {
    try {
      const { timeout = 300000, env = {} } = options; // 5 minute default timeout
      const fullCommand = `firebase ${command} --project=${this.projectId}`;
      
      if (this.verbose) {
        console.log(`Executing: ${fullCommand}`);
      }

      const result = execSync(fullCommand, {
        cwd: this.workingDir,
        encoding: 'utf8',
        timeout,
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      return result.trim();
    } catch (error) {
      throw new Error(`Firebase command failed: ${command}\nError: ${error.message}`);
    }
  }

  /**
   * Validate environment before deployment
   * @returns {object} - Validation result
   */
  validateEnvironment() {
    const validation = {
      isValid: true,
      issues: [],
      checks: {}
    };

    try {
      // Check if Firebase CLI is installed
      try {
        execSync('firebase --version', { stdio: 'pipe' });
        validation.checks.firebaseCli = true;
      } catch (error) {
        validation.isValid = false;
        validation.issues.push('Firebase CLI is not installed');
        validation.checks.firebaseCli = false;
      }

      // Check if logged in to Firebase
      try {
        this.executeFirebaseCommand('projects:list');
        validation.checks.firebaseAuth = true;
      } catch (error) {
        validation.isValid = false;
        validation.issues.push('Not authenticated with Firebase CLI');
        validation.checks.firebaseAuth = false;
      }

      // Check if project exists and is accessible
      try {
        this.executeFirebaseCommand('use --current');
        validation.checks.projectAccess = true;
      } catch (error) {
        validation.isValid = false;
        validation.issues.push(`Cannot access Firebase project: ${this.projectId}`);
        validation.checks.projectAccess = false;
      }

      // Check if required files exist
      const requiredFiles = ['firebase.json'];
      for (const file of requiredFiles) {
        const filePath = path.join(this.workingDir, file);
        if (fs.existsSync(filePath)) {
          validation.checks[`file_${file}`] = true;
        } else {
          validation.isValid = false;
          validation.issues.push(`Required file missing: ${file}`);
          validation.checks[`file_${file}`] = false;
        }
      }

      // Check deployment targets
      if (this.deploymentTargets.includes('hosting')) {
        const hostingPath = path.join(this.workingDir, 'frontend', 'dist');
        if (fs.existsSync(hostingPath)) {
          validation.checks.hostingBuild = true;
        } else {
          validation.issues.push('Frontend build directory not found (frontend/dist)');
          validation.checks.hostingBuild = false;
        }
      }

      if (this.deploymentTargets.includes('functions')) {
        const functionsPath = path.join(this.workingDir, 'functions');
        if (fs.existsSync(functionsPath)) {
          validation.checks.functionsSource = true;
        } else {
          validation.issues.push('Functions source directory not found');
          validation.checks.functionsSource = false;
        }
      }

    } catch (error) {
      validation.isValid = false;
      validation.issues.push(`Environment validation failed: ${error.message}`);
    }

    return validation;
  }

  /**
   * Build frontend before deployment
   * @returns {void}
   */
  buildFrontend() {
    try {
      if (this.verbose) {
        console.log('Building frontend...');
      }

      const frontendPath = path.join(this.workingDir, 'frontend');
      
      // Check if package.json exists
      if (!fs.existsSync(path.join(frontendPath, 'package.json'))) {
        throw new Error('Frontend package.json not found');
      }

      // Run build command
      execSync('npm run build', {
        cwd: frontendPath,
        stdio: this.verbose ? 'inherit' : 'pipe',
        timeout: 300000 // 5 minutes
      });

      if (this.verbose) {
        console.log('Frontend build completed');
      }
    } catch (error) {
      throw new Error(`Frontend build failed: ${error.message}`);
    }
  }

  /**
   * Build functions before deployment
   * @returns {void}
   */
  buildFunctions() {
    try {
      if (this.verbose) {
        console.log('Building functions...');
      }

      const functionsPath = path.join(this.workingDir, 'functions');
      
      // Check if package.json exists
      if (!fs.existsSync(path.join(functionsPath, 'package.json'))) {
        throw new Error('Functions package.json not found');
      }

      // Install dependencies and build
      execSync('npm install', {
        cwd: functionsPath,
        stdio: this.verbose ? 'inherit' : 'pipe',
        timeout: 180000 // 3 minutes
      });

      // Check if build script exists
      const packageJson = JSON.parse(fs.readFileSync(path.join(functionsPath, 'package.json'), 'utf8'));
      if (packageJson.scripts && packageJson.scripts.build) {
        execSync('npm run build', {
          cwd: functionsPath,
          stdio: this.verbose ? 'inherit' : 'pipe',
          timeout: 180000 // 3 minutes
        });
      }

      if (this.verbose) {
        console.log('Functions build completed');
      }
    } catch (error) {
      throw new Error(`Functions build failed: ${error.message}`);
    }
  }

  /**
   * Deploy specific Firebase service
   * @param {string} target - Deployment target (hosting, functions, firestore, storage)
   * @returns {object} - Deployment result
   */
  deployTarget(target) {
    const startTime = Date.now();
    
    try {
      if (this.verbose) {
        console.log(`Deploying ${target}...`);
      }

      // Pre-deployment builds
      if (target === 'hosting') {
        this.buildFrontend();
      } else if (target === 'functions') {
        this.buildFunctions();
      }

      // Execute deployment
      const output = this.executeFirebaseCommand(`deploy --only ${target}`, {
        timeout: 600000 // 10 minutes
      });

      const duration = Date.now() - startTime;

      return {
        success: true,
        target,
        duration,
        output: output.split('\n').slice(-10).join('\n'), // Last 10 lines
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        target,
        duration,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Deploy all configured targets
   * @returns {object} - Deployment results for all targets
   */
  deployAll() {
    const results = {
      success: true,
      deployments: [],
      startTime: new Date().toISOString(),
      endTime: null,
      totalDuration: 0
    };

    const overallStartTime = Date.now();

    try {
      // Validate environment first
      const validation = this.validateEnvironment();
      if (!validation.isValid) {
        throw new Error(`Environment validation failed: ${validation.issues.join(', ')}`);
      }

      // Deploy each target
      for (const target of this.deploymentTargets) {
        if (this.verbose) {
          console.log(`\n--- Deploying ${target} ---`);
        }

        const result = this.deployTarget(target);
        results.deployments.push(result);

        if (!result.success) {
          results.success = false;
          if (this.verbose) {
            console.error(`Deployment failed for ${target}: ${result.error}`);
          }
          // Continue with other targets even if one fails
        }
      }

    } catch (error) {
      results.success = false;
      results.error = error.message;
    }

    results.totalDuration = Date.now() - overallStartTime;
    results.endTime = new Date().toISOString();

    return results;
  }

  /**
   * Get deployment status and logs
   * @returns {object} - Current deployment status
   */
  getDeploymentStatus() {
    try {
      const releases = this.executeFirebaseCommand('hosting:releases:list --limit=5');
      const functions = this.executeFirebaseCommand('functions:list');
      
      return {
        success: true,
        hosting: {
          releases: releases.split('\n').filter(line => line.trim())
        },
        functions: {
          list: functions.split('\n').filter(line => line.trim())
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Create deployment log entry
   * @param {object} deploymentResult - Result from deployment
   * @param {string} logPath - Path to log file
   * @returns {void}
   */
  logDeployment(deploymentResult, logPath = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      projectId: this.projectId,
      targets: this.deploymentTargets,
      result: deploymentResult,
      environment: process.env.NODE_ENV || 'development'
    };

    const logString = JSON.stringify(logEntry, null, 2) + '\n';

    if (logPath) {
      try {
        // Ensure log directory exists
        const logDir = path.dirname(logPath);
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }

        // Append to log file
        fs.appendFileSync(logPath, logString);
      } catch (error) {
        console.error(`Failed to write deployment log: ${error.message}`);
      }
    }

    if (this.verbose) {
      console.log('Deployment logged:', logString);
    }
  }
}

/**
 * Deployment Rollback System
 * Handles rollback functionality for failed deployments
 */
class DeploymentRollback {
  constructor(options = {}) {
    this.gitOps = options.gitOps || new GitOperations(options);
    this.firebaseDeployment = options.firebaseDeployment || new FirebaseDeployment(options);
    this.verbose = options.verbose || false;
    this.notificationHandlers = [];
  }

  /**
   * Add notification handler for deployment failures
   * @param {function} handler - Function to handle notifications
   * @returns {void}
   */
  addNotificationHandler(handler) {
    if (typeof handler === 'function') {
      this.notificationHandlers.push(handler);
    }
  }

  /**
   * Send notification about deployment failure
   * @param {object} failureInfo - Information about the failure
   * @returns {void}
   */
  async sendFailureNotification(failureInfo) {
    const notification = {
      type: 'deployment_failure',
      timestamp: new Date().toISOString(),
      project: this.firebaseDeployment.projectId,
      ...failureInfo
    };

    for (const handler of this.notificationHandlers) {
      try {
        await handler(notification);
      } catch (error) {
        console.error(`Notification handler failed: ${error.message}`);
      }
    }

    // Default console notification
    if (this.verbose) {
      console.error('Deployment Failure Notification:', JSON.stringify(notification, null, 2));
    }
  }

  /**
   * Create a deployment checkpoint before starting deployment
   * @returns {object} - Checkpoint information
   */
  createDeploymentCheckpoint() {
    try {
      const checkpoint = {
        timestamp: new Date().toISOString(),
        gitCommit: this.gitOps.getLastCommitHash(),
        gitBranch: this.gitOps.getCurrentBranch(),
        workingDirectoryClean: this.gitOps.isWorkingDirectoryClean(),
        firebaseStatus: this.firebaseDeployment.getDeploymentStatus()
      };

      if (this.verbose) {
        console.log('Deployment checkpoint created:', checkpoint.gitCommit.substring(0, 8));
      }

      return checkpoint;
    } catch (error) {
      throw new Error(`Failed to create deployment checkpoint: ${error.message}`);
    }
  }

  /**
   * Rollback Git changes to a specific commit
   * @param {string} commitHash - Commit to rollback to
   * @param {boolean} hard - Whether to perform hard reset
   * @returns {object} - Rollback result
   */
  rollbackGitChanges(commitHash, hard = false) {
    try {
      if (this.verbose) {
        console.log(`Rolling back Git changes to: ${commitHash.substring(0, 8)}`);
      }

      // Validate commit exists
      try {
        this.gitOps.executeGitCommand(`cat-file -e ${commitHash}`);
      } catch (error) {
        throw new Error(`Invalid commit hash: ${commitHash}`);
      }

      // Perform rollback
      this.gitOps.revertToCommit(commitHash, hard);

      return {
        success: true,
        commitHash,
        resetType: hard ? 'hard' : 'soft',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        commitHash,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Rollback Firebase deployment to previous version
   * @param {string} target - Target to rollback (hosting, functions)
   * @returns {object} - Rollback result
   */
  rollbackFirebaseDeployment(target) {
    try {
      if (this.verbose) {
        console.log(`Rolling back Firebase ${target}...`);
      }

      let rollbackCommand;
      
      switch (target) {
        case 'hosting':
          // Get previous release and rollback
          const releases = this.firebaseDeployment.executeFirebaseCommand('hosting:releases:list --limit=2');
          const releaseLines = releases.split('\n').filter(line => line.includes('FINALIZED'));
          
          if (releaseLines.length < 2) {
            throw new Error('No previous hosting release found for rollback');
          }

          // Extract release ID from second line (previous release)
          const previousReleaseId = releaseLines[1].split(/\s+/)[0];
          rollbackCommand = `hosting:releases:rollback ${previousReleaseId}`;
          break;

        case 'functions':
          // Functions don't have direct rollback, need to redeploy previous version
          throw new Error('Functions rollback requires redeploying from previous Git commit');

        default:
          throw new Error(`Rollback not supported for target: ${target}`);
      }

      const output = this.firebaseDeployment.executeFirebaseCommand(rollbackCommand);

      return {
        success: true,
        target,
        output,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        target,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Perform automatic rollback on deployment failure
   * @param {object} deploymentResult - Failed deployment result
   * @param {object} checkpoint - Pre-deployment checkpoint
   * @returns {object} - Rollback result
   */
  async performAutomaticRollback(deploymentResult, checkpoint) {
    const rollbackResult = {
      triggered: true,
      timestamp: new Date().toISOString(),
      checkpoint,
      deploymentFailure: deploymentResult,
      actions: [],
      success: false
    };

    try {
      if (this.verbose) {
        console.log('Performing automatic rollback...');
      }

      // Send failure notification
      await this.sendFailureNotification({
        deploymentResult,
        checkpoint,
        rollbackStarted: true
      });

      // Rollback Git changes if there were commits during deployment
      const currentCommit = this.gitOps.getLastCommitHash();
      if (currentCommit !== checkpoint.gitCommit) {
        const gitRollback = this.rollbackGitChanges(checkpoint.gitCommit, false);
        rollbackResult.actions.push({
          type: 'git_rollback',
          result: gitRollback
        });
      }

      // Rollback Firebase deployments for failed targets
      if (deploymentResult.deployments) {
        for (const deployment of deploymentResult.deployments) {
          if (!deployment.success && deployment.target === 'hosting') {
            const firebaseRollback = this.rollbackFirebaseDeployment(deployment.target);
            rollbackResult.actions.push({
              type: 'firebase_rollback',
              target: deployment.target,
              result: firebaseRollback
            });
          }
        }
      }

      // Check if all rollback actions succeeded
      rollbackResult.success = rollbackResult.actions.every(action => 
        action.result && action.result.success
      );

      // Send completion notification
      await this.sendFailureNotification({
        deploymentResult,
        checkpoint,
        rollbackCompleted: true,
        rollbackSuccess: rollbackResult.success,
        rollbackActions: rollbackResult.actions
      });

      if (this.verbose) {
        const status = rollbackResult.success ? 'completed successfully' : 'completed with errors';
        console.log(`Automatic rollback ${status}`);
      }

    } catch (error) {
      rollbackResult.success = false;
      rollbackResult.error = error.message;
      
      await this.sendFailureNotification({
        deploymentResult,
        checkpoint,
        rollbackFailed: true,
        rollbackError: error.message
      });
    }

    return rollbackResult;
  }

  /**
   * Validate rollback capability
   * @returns {object} - Validation result
   */
  validateRollbackCapability() {
    const validation = {
      canRollback: true,
      issues: [],
      capabilities: {}
    };

    try {
      // Check Git rollback capability
      try {
        const commits = this.gitOps.executeGitCommand('log --oneline -5');
        validation.capabilities.git = {
          available: true,
          recentCommits: commits.split('\n').length
        };
      } catch (error) {
        validation.canRollback = false;
        validation.issues.push('Git rollback not available');
        validation.capabilities.git = { available: false };
      }

      // Check Firebase rollback capability
      try {
        const releases = this.firebaseDeployment.executeFirebaseCommand('hosting:releases:list --limit=2');
        const releaseCount = releases.split('\n').filter(line => line.includes('FINALIZED')).length;
        
        validation.capabilities.firebase = {
          hosting: releaseCount >= 2,
          functions: false // Functions require Git-based rollback
        };

        if (releaseCount < 2) {
          validation.issues.push('No previous Firebase hosting release for rollback');
        }
      } catch (error) {
        validation.issues.push('Firebase rollback capability check failed');
        validation.capabilities.firebase = { hosting: false, functions: false };
      }

    } catch (error) {
      validation.canRollback = false;
      validation.issues.push(`Rollback validation failed: ${error.message}`);
    }

    return validation;
  }
}

/**
 * Integrated Deployment Pipeline
 * Combines Git operations, Firebase deployment, and rollback functionality
 */
class DeploymentPipeline {
  constructor(options = {}) {
    this.gitOps = new GitOperations(options);
    this.firebaseDeployment = new FirebaseDeployment(options);
    this.rollback = new DeploymentRollback({
      ...options,
      gitOps: this.gitOps,
      firebaseDeployment: this.firebaseDeployment
    });
    this.verbose = options.verbose || false;
    this.autoRollback = options.autoRollback !== false; // Default to true
  }

  /**
   * Execute complete deployment pipeline with rollback capability
   * @param {object} options - Deployment options
   * @returns {object} - Complete deployment result
   */
  async executeDeployment(options = {}) {
    const {
      commitMessage = 'Automated deployment',
      changeType = 'deploy',
      skipCommit = false,
      targets = null
    } = options;

    const pipelineResult = {
      success: false,
      startTime: new Date().toISOString(),
      endTime: null,
      checkpoint: null,
      gitCommit: null,
      deployment: null,
      rollback: null,
      duration: 0
    };

    const startTime = Date.now();

    try {
      // Create deployment checkpoint
      pipelineResult.checkpoint = this.rollback.createDeploymentCheckpoint();

      // Commit changes if requested
      if (!skipCommit) {
        const commitResult = this.gitOps.autoCommit({
          changeType,
          description: commitMessage,
          stageAll: true
        });
        pipelineResult.gitCommit = commitResult;

        if (!commitResult.success && commitResult.message !== 'No changes to commit') {
          throw new Error(`Git commit failed: ${commitResult.message}`);
        }
      }

      // Set deployment targets
      if (targets) {
        this.firebaseDeployment.deploymentTargets = targets;
      }

      // Execute Firebase deployment
      pipelineResult.deployment = this.firebaseDeployment.deployAll();

      // Check if deployment succeeded
      pipelineResult.success = pipelineResult.deployment.success;

      // Perform automatic rollback if deployment failed and auto-rollback is enabled
      if (!pipelineResult.success && this.autoRollback) {
        pipelineResult.rollback = await this.rollback.performAutomaticRollback(
          pipelineResult.deployment,
          pipelineResult.checkpoint
        );
      }

    } catch (error) {
      pipelineResult.success = false;
      pipelineResult.error = error.message;

      // Attempt rollback on pipeline error
      if (this.autoRollback && pipelineResult.checkpoint) {
        try {
          pipelineResult.rollback = await this.rollback.performAutomaticRollback(
            { success: false, error: error.message },
            pipelineResult.checkpoint
          );
        } catch (rollbackError) {
          pipelineResult.rollbackError = rollbackError.message;
        }
      }
    }

    pipelineResult.duration = Date.now() - startTime;
    pipelineResult.endTime = new Date().toISOString();

    // Log deployment result
    this.firebaseDeployment.logDeployment(pipelineResult, 'logs/deployment.log');

    return pipelineResult;
  }

  /**
   * Add notification handler for deployment events
   * @param {function} handler - Notification handler function
   * @returns {void}
   */
  addNotificationHandler(handler) {
    this.rollback.addNotificationHandler(handler);
  }
}

module.exports = { 
  GitOperations, 
  FirebaseDeployment, 
  DeploymentRollback, 
  DeploymentPipeline 
};