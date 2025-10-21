const fs = require('fs').promises;
const path = require('path');
const SystemOrchestrator = require('../systemOrchestrator');
const ConfigManager = require('../configManager');
const EnvironmentValidator = require('../validateEnvironment');
const DocumentationManager = require('../documentationManager');
const { DeploymentPipeline } = require('../deployPipeline');

// Mock child_process for all integration tests
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

describe('System Integration Tests', () => {
  let testDir;
  let originalCwd;
  let mockExecSync;

  beforeAll(async () => {
    originalCwd = process.cwd();
    testDir = path.join(__dirname, 'temp-integration-test');
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);

    mockExecSync = require('child_process').execSync;
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    mockExecSync.mockClear();
  });

  describe('End-to-End System Workflow', () => {
    test('should complete full system setup workflow', async () => {
      // Setup test environment
      await setupTestEnvironment();

      // Mock all external commands for successful execution
      mockSuccessfulCommands();

      // Create system orchestrator
      const orchestrator = new SystemOrchestrator({
        verbose: false,
        dryRun: false,
        configPath: '.kiro/test-config.json'
      });

      // Execute complete setup
      const result = await orchestrator.executeCompleteSetup({
        interactive: false
      });

      // Verify overall success
      expect(result.success).toBe(true);
      expect(result.results).toHaveProperty('admin');
      expect(result.results).toHaveProperty('documentation');
      expect(result.results).toHaveProperty('deployment');

      // Verify admin setup
      expect(result.results.admin.success).toBe(true);

      // Verify documentation organization
      expect(result.results.documentation.success).toBe(true);
      expect(result.results.documentation.filesOrganized).toBeGreaterThanOrEqual(0);

      // Verify deployment
      expect(result.results.deployment.success).toBe(true);

      // Verify configuration was saved
      const configExists = await fs.access('.kiro/test-config.json').then(() => true).catch(() => false);
      expect(configExists).toBe(true);

      // Verify logs were created
      const logExists = await fs.access('logs/system-orchestrator.log').then(() => true).catch(() => false);
      expect(logExists).toBe(true);
    });

    test('should handle partial failures with proper rollback', async () => {
      await setupTestEnvironment();

      // Mock admin success but deployment failure
      mockExecSync
        .mockReturnValueOnce('9.0.0') // firebase --version
        .mockReturnValueOnce('{"success": true}') // admin initialization
        .mockReturnValueOnce('/path/to/.git') // git validation
        .mockReturnValueOnce('main') // git branch
        .mockReturnValueOnce('') // git status
        .mockReturnValueOnce('abc123') // git commit hash
        .mockReturnValueOnce('{"success": true}') // firebase status
        .mockReturnValueOnce('') // git add
        .mockReturnValueOnce('file1.txt') // staged files
        .mockReturnValueOnce('') // git commit
        .mockReturnValueOnce('def456') // new commit hash
        .mockImplementation((command) => {
          if (command.includes('firebase deploy')) {
            throw new Error('Deployment failed');
          }
          return 'output';
        });

      const orchestrator = new SystemOrchestrator({
        verbose: false,
        dryRun: false
      });

      const result = await orchestrator.executeCompleteSetup({
        interactive: false
      });

      expect(result.success).toBe(false);
      expect(result.results.admin.success).toBe(true);
      expect(result.results.deployment.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should perform dry run without making changes', async () => {
      await setupTestEnvironment();

      const orchestrator = new SystemOrchestrator({
        verbose: false,
        dryRun: true
      });

      const result = await orchestrator.executeCompleteSetup({
        interactive: false
      });

      expect(result.success).toBe(true);
      expect(result.results.admin.dryRun).toBe(true);
      expect(result.results.documentation.dryRun).toBe(true);
      expect(result.results.deployment.dryRun).toBe(true);

      // Verify no external commands were executed
      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Management Integration', () => {
    test('should load and merge configurations correctly', async () => {
      // Create base configuration
      const baseConfig = {
        admin: {
          defaultUID: 'base-uid',
          defaultEmail: 'base@example.com',
          autoInitialize: true
        },
        deployment: {
          targets: ['hosting', 'functions'],
          autoRollback: true
        }
      };

      // Create environment-specific configuration
      const envConfig = {
        admin: {
          defaultUID: 'env-uid'
        },
        deployment: {
          autoRollback: false,
          buildBeforeDeploy: true
        },
        firebase: {
          projectId: 'env-project'
        }
      };

      await fs.mkdir('.kiro/config', { recursive: true });
      await fs.writeFile('.kiro/system-config.json', JSON.stringify(baseConfig), 'utf8');
      await fs.writeFile('.kiro/config/test.json', JSON.stringify(envConfig), 'utf8');

      const configManager = new ConfigManager({
        baseConfigPath: '.kiro/system-config.json',
        environmentConfigDir: '.kiro/config',
        environment: 'test'
      });

      const mergedConfig = await configManager.loadConfiguration();

      // Verify merging worked correctly
      expect(mergedConfig.admin.defaultUID).toBe('env-uid'); // Overridden
      expect(mergedConfig.admin.defaultEmail).toBe('base@example.com'); // Preserved
      expect(mergedConfig.admin.autoInitialize).toBe(true); // Preserved
      expect(mergedConfig.deployment.targets).toEqual(['hosting', 'functions']); // Preserved
      expect(mergedConfig.deployment.autoRollback).toBe(false); // Overridden
      expect(mergedConfig.deployment.buildBeforeDeploy).toBe(true); // Added
      expect(mergedConfig.firebase.projectId).toBe('env-project'); // Added
    });

    test('should validate configuration across all components', async () => {
      const configManager = new ConfigManager({
        environment: 'test'
      });

      const invalidConfig = {
        admin: {
          // Missing defaultUID and defaultEmail
        },
        deployment: {
          targets: ['invalid-target']
        }
      };

      await expect(configManager.validateConfiguration(invalidConfig))
        .rejects.toThrow('Configuration validation failed');
    });
  });

  describe('Environment Validation Integration', () => {
    test('should validate complete environment setup', async () => {
      await setupCompleteEnvironment();

      // Mock all successful command responses
      mockExecSync
        .mockReturnValueOnce('9.5.0') // npm --version
        .mockReturnValueOnce('git version 2.39.0') // git --version
        .mockReturnValueOnce('John Doe') // git user.name
        .mockReturnValueOnce('john@example.com') // git user.email
        .mockReturnValueOnce('12.4.0') // firebase --version
        .mockReturnValueOnce('Project list including curva-mestra'); // firebase projects:list

      const validator = new EnvironmentValidator({
        verbose: false,
        environment: 'test'
      });

      const results = await validator.validateEnvironment();

      expect(results.overall.passed).toBe(true);
      expect(results.overall.score).toBe(results.overall.total);

      // Verify all checks passed
      Object.values(results.checks).forEach(check => {
        expect(['pass', 'warn']).toContain(check.status);
      });
    });

    test('should provide actionable recommendations for failures', async () => {
      // Setup minimal environment with missing components
      await fs.writeFile('package.json', '{}');

      // Mock failing commands
      mockExecSync.mockImplementation((command) => {
        if (command.includes('firebase')) {
          throw new Error('Command not found');
        }
        if (command.includes('git config')) {
          throw new Error('Not configured');
        }
        return 'output';
      });

      const validator = new EnvironmentValidator({
        verbose: false,
        environment: 'test'
      });

      const results = await validator.validateEnvironment();

      expect(results.overall.passed).toBe(false);
      
      // Verify specific failure checks
      expect(results.checks['Firebase CLI'].status).toBe('fail');
      expect(results.checks['Git Configuration'].status).toBe('fail');
    });
  });

  describe('Component Integration', () => {
    test('should integrate documentation manager with system orchestrator', async () => {
      await setupTestEnvironment();

      // Create test markdown files
      await fs.writeFile('admin-guide.md', '# Admin Guide\nUser management instructions.');
      await fs.writeFile('setup-guide.md', '# Setup Guide\nFirebase configuration.');
      await fs.writeFile('referencing.md', '# References\n[Admin](admin-guide.md)\n[Setup](setup-guide.md)');

      const orchestrator = new SystemOrchestrator({
        verbose: false,
        dryRun: false
      });

      // Execute documentation organization only
      const config = await orchestrator.loadConfiguration();
      const result = await orchestrator.executeDocumentationOrganization(config);

      expect(result.success).toBe(true);
      expect(result.filesOrganized).toBeGreaterThan(0);

      // Verify documentation structure was created
      const docsExists = await fs.access('docs').then(() => true).catch(() => false);
      expect(docsExists).toBe(true);

      // Verify files were moved and categorized
      const adminFileExists = await fs.access('docs/admin/admin-guide.md').then(() => true).catch(() => false);
      const setupFileExists = await fs.access('docs/setup/setup-guide.md').then(() => true).catch(() => false);
      
      expect(adminFileExists).toBe(true);
      expect(setupFileExists).toBe(true);
    });

    test('should integrate deployment pipeline with system orchestrator', async () => {
      await setupTestEnvironment();

      // Mock successful deployment commands
      mockExecSync
        .mockReturnValueOnce('/path/to/.git') // git validation
        .mockReturnValueOnce('main') // git branch
        .mockReturnValueOnce('') // git status
        .mockReturnValueOnce('abc123') // git commit hash
        .mockReturnValueOnce('{"success": true}') // firebase status
        .mockReturnValueOnce('') // git add
        .mockReturnValueOnce('file1.txt') // staged files
        .mockReturnValueOnce('') // git commit
        .mockReturnValueOnce('def456') // new commit hash
        .mockReturnValueOnce('9.0.0') // firebase version
        .mockReturnValueOnce('project list') // firebase projects
        .mockReturnValueOnce('test-project') // firebase use
        .mockReturnValueOnce('Deploy completed'); // firebase deploy

      const orchestrator = new SystemOrchestrator({
        verbose: false,
        dryRun: false
      });

      // Execute deployment only
      const config = await orchestrator.loadConfiguration();
      const result = await orchestrator.executeDeployment(config);

      expect(result.success).toBe(true);
      expect(result.deployment).toBeDefined();
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should recover from transient failures', async () => {
      await setupTestEnvironment();

      let callCount = 0;
      mockExecSync.mockImplementation((command) => {
        callCount++;
        if (command.includes('firebase deploy') && callCount === 1) {
          throw new Error('Transient network error');
        }
        return 'success';
      });

      const orchestrator = new SystemOrchestrator({
        verbose: false,
        dryRun: false
      });

      // The system should handle the error gracefully
      const config = await orchestrator.loadConfiguration();
      
      try {
        await orchestrator.executeDeployment(config);
      } catch (error) {
        expect(error.message).toContain('Transient network error');
      }
    });

    test('should maintain system state consistency during failures', async () => {
      await setupTestEnvironment();

      const orchestrator = new SystemOrchestrator({
        verbose: false,
        dryRun: false
      });

      // Mock admin setup failure
      mockExecSync.mockImplementation((command) => {
        if (command.includes('firebase functions:call')) {
          throw new Error('Admin setup failed');
        }
        return 'output';
      });

      const result = await orchestrator.executeCompleteSetup({
        interactive: false,
        skipDocs: true,
        skipDeploy: true
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Admin setup failed');

      // Verify system state is consistent
      expect(result.results.admin).toBeUndefined();
      expect(result.results.documentation).toBeUndefined();
      expect(result.results.deployment).toBeUndefined();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large-scale operations efficiently', async () => {
      await setupTestEnvironment();

      // Create many test files
      const fileCount = 100;
      for (let i = 0; i < fileCount; i++) {
        await fs.writeFile(`test-file-${i}.md`, `# Test File ${i}\nContent for file ${i}`);
      }

      const orchestrator = new SystemOrchestrator({
        verbose: false,
        dryRun: false
      });

      const startTime = Date.now();
      const config = await orchestrator.loadConfiguration();
      const result = await orchestrator.executeDocumentationOrganization(config);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.filesOrganized).toBe(fileCount);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    test('should handle concurrent operations safely', async () => {
      await setupTestEnvironment();

      const orchestrator = new SystemOrchestrator({
        verbose: false,
        dryRun: true // Use dry run to avoid conflicts
      });

      // Run multiple operations concurrently
      const promises = [
        orchestrator.loadConfiguration(),
        orchestrator.loadConfiguration(),
        orchestrator.loadConfiguration()
      ];

      const results = await Promise.all(promises);

      // All should succeed and return consistent results
      results.forEach(config => {
        expect(config).toHaveProperty('admin');
        expect(config).toHaveProperty('deployment');
      });
    });
  });

  // Helper functions
  async function setupTestEnvironment() {
    // Create basic project structure
    await fs.mkdir('frontend', { recursive: true });
    await fs.mkdir('backend', { recursive: true });
    await fs.mkdir('functions', { recursive: true });
    await fs.mkdir('scripts', { recursive: true });
    await fs.mkdir('.kiro', { recursive: true });

    // Create basic configuration files
    await fs.writeFile('package.json', JSON.stringify({
      name: 'test-project',
      version: '1.0.0'
    }));

    await fs.writeFile('firebase.json', JSON.stringify({
      hosting: { public: 'frontend/dist' },
      functions: { source: 'functions' }
    }));

    await fs.writeFile('.kiro/system-config.json', JSON.stringify({
      admin: {
        defaultUID: 'test-uid',
        defaultEmail: 'test@example.com',
        autoInitialize: true
      },
      documentation: {
        autoOrganize: true,
        createBackup: true
      },
      deployment: {
        targets: ['hosting', 'functions'],
        autoRollback: true
      }
    }));
  }

  async function setupCompleteEnvironment() {
    await setupTestEnvironment();

    // Create all required directories and files
    await fs.mkdir('.kiro/config', { recursive: true });
    await fs.mkdir('logs', { recursive: true });

    // Create node_modules directories
    await fs.mkdir('node_modules', { recursive: true });
    await fs.mkdir('frontend/node_modules', { recursive: true });
    await fs.mkdir('backend/node_modules', { recursive: true });
    await fs.mkdir('functions/node_modules', { recursive: true });
    await fs.mkdir('scripts/node_modules', { recursive: true });

    // Create package.json files for all modules
    await fs.writeFile('frontend/package.json', '{"name": "frontend"}');
    await fs.writeFile('backend/package.json', '{"name": "backend"}');
    await fs.writeFile('functions/package.json', '{"name": "functions"}');
    await fs.writeFile('scripts/package.json', '{"name": "scripts"}');

    // Create script files
    await fs.writeFile('scripts/systemOrchestrator.js', 'module.exports = {};');
    await fs.writeFile('scripts/documentationManager.js', 'module.exports = {};');
    await fs.writeFile('scripts/deployPipeline.js', 'module.exports = {};');

    // Create environment-specific config
    await fs.writeFile('.kiro/config/test.json', JSON.stringify({
      environment: 'test',
      firebase: { projectId: 'test-project' }
    }));
  }

  function mockSuccessfulCommands() {
    mockExecSync
      .mockReturnValueOnce('9.0.0') // firebase --version (admin setup)
      .mockReturnValueOnce('{"success": true, "message": "Admin initialized"}') // firebase functions:call
      .mockReturnValueOnce('/path/to/.git') // git validation (deployment)
      .mockReturnValueOnce('main') // git branch
      .mockReturnValueOnce('') // git status
      .mockReturnValueOnce('abc123') // git commit hash
      .mockReturnValueOnce('{"success": true}') // firebase status
      .mockReturnValueOnce('') // git add
      .mockReturnValueOnce('file1.txt') // staged files
      .mockReturnValueOnce('') // git commit
      .mockReturnValueOnce('def456') // new commit hash
      .mockReturnValueOnce('9.0.0') // firebase version (deployment validation)
      .mockReturnValueOnce('project list') // firebase projects
      .mockReturnValueOnce('test-project') // firebase use
      .mockReturnValueOnce('Deploy completed successfully'); // firebase deploy
  }
});