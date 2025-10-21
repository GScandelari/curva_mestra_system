const fs = require('fs').promises;
const path = require('path');
const SystemOrchestrator = require('../systemOrchestrator');
const ConfigManager = require('../configManager');
const DocumentationManager = require('../documentationManager');
const { DeploymentPipeline } = require('../deployPipeline');

// Mock dependencies
jest.mock('child_process');
jest.mock('../documentationManager');
jest.mock('../deployPipeline');
jest.mock('../configManager');

describe('SystemOrchestrator End-to-End Tests', () => {
  let orchestrator;
  let testDir;
  let originalCwd;
  let mockExecSync;

  beforeEach(async () => {
    // Setup test environment
    originalCwd = process.cwd();
    testDir = path.join(__dirname, 'temp-orchestrator-test');
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);

    // Mock child_process
    mockExecSync = require('child_process').execSync;
    mockExecSync.mockClear();

    // Create orchestrator instance
    orchestrator = new SystemOrchestrator({
      verbose: false,
      dryRun: false,
      configPath: '.kiro/test-config.json',
      logPath: 'logs/test-orchestrator.log'
    });

    // Mock component constructors
    DocumentationManager.mockClear();
    DeploymentPipeline.mockClear();
    ConfigManager.mockClear();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Configuration Management', () => {
    test('should load default configuration when file does not exist', async () => {
      const config = await orchestrator.loadConfiguration();
      
      expect(config).toHaveProperty('admin');
      expect(config).toHaveProperty('documentation');
      expect(config).toHaveProperty('deployment');
      expect(config.admin.defaultUID).toBe('gEjUSOsHF9QmS0Dvi0zB10GsxrD2');
      expect(config.admin.defaultEmail).toBe('scandelari.guilherme@hotmail.com');
    });

    test('should load existing configuration file', async () => {
      const testConfig = {
        admin: { defaultUID: 'test-uid', defaultEmail: 'test@example.com' },
        documentation: { autoOrganize: false },
        deployment: { targets: ['hosting'] }
      };

      await fs.mkdir('.kiro', { recursive: true });
      await fs.writeFile('.kiro/test-config.json', JSON.stringify(testConfig), 'utf8');

      const config = await orchestrator.loadConfiguration();
      
      expect(config.admin.defaultUID).toBe('test-uid');
      expect(config.admin.defaultEmail).toBe('test@example.com');
    });

    test('should save configuration correctly', async () => {
      const config = orchestrator.createDefaultConfiguration();
      config.admin.defaultUID = 'modified-uid';

      await orchestrator.saveConfiguration(config);

      const savedData = await fs.readFile('.kiro/test-config.json', 'utf8');
      const savedConfig = JSON.parse(savedData);
      
      expect(savedConfig.admin.defaultUID).toBe('modified-uid');
    });
  });

  describe('Progress Tracking', () => {
    test('should initialize progress tracking correctly', () => {
      const steps = ['Admin Setup', 'Documentation Organization', 'Deployment'];
      
      orchestrator.initializeProgress(steps);
      
      expect(orchestrator.progress.total).toBe(3);
      expect(orchestrator.progress.completed).toBe(0);
      expect(orchestrator.progress.steps).toHaveLength(3);
      expect(orchestrator.progress.steps[0].name).toBe('Admin Setup');
    });

    test('should update progress correctly', () => {
      orchestrator.initializeProgress(['Test Step']);
      
      orchestrator.updateProgress('Test Step', 'running', 'Starting test');
      expect(orchestrator.progress.current).toBe('Test Step');
      expect(orchestrator.progress.steps[0].status).toBe('running');
      expect(orchestrator.progress.steps[0].startTime).toBeDefined();

      orchestrator.updateProgress('Test Step', 'completed', 'Test finished');
      expect(orchestrator.progress.completed).toBe(1);
      expect(orchestrator.progress.steps[0].status).toBe('completed');
      expect(orchestrator.progress.steps[0].endTime).toBeDefined();
    });
  });

  describe('Admin Setup Execution', () => {
    test('should execute admin setup successfully', async () => {
      const config = orchestrator.createDefaultConfiguration();
      
      // Mock Firebase CLI availability and function call
      mockExecSync
        .mockReturnValueOnce('9.0.0') // firebase --version
        .mockReturnValueOnce('{"success": true, "message": "Admin initialized"}'); // firebase functions:call

      const result = await orchestrator.executeAdminSetup(config);
      
      expect(result.success).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('firebase --version', expect.any(Object));
      expect(mockExecSync).toHaveBeenCalledWith(
        'firebase functions:call initializeDefaultAdmin --project=curva-mestra',
        expect.any(Object)
      );
    });

    test('should handle Firebase CLI not found', async () => {
      const config = orchestrator.createDefaultConfiguration();
      
      mockExecSync.mockImplementation((command) => {
        if (command.includes('firebase --version')) {
          throw new Error('Command not found');
        }
        return 'output';
      });

      await expect(orchestrator.executeAdminSetup(config)).rejects.toThrow('Firebase CLI not found');
    });

    test('should handle admin initialization failure', async () => {
      const config = orchestrator.createDefaultConfiguration();
      
      mockExecSync
        .mockReturnValueOnce('9.0.0')
        .mockReturnValueOnce('{"success": false, "message": "User not found"}');

      await expect(orchestrator.executeAdminSetup(config)).rejects.toThrow('User not found');
    });

    test('should skip admin setup in dry run mode', async () => {
      orchestrator.dryRun = true;
      const config = orchestrator.createDefaultConfiguration();
      
      const result = await orchestrator.executeAdminSetup(config);
      
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });

  describe('Documentation Organization Execution', () => {
    let mockDocManager;

    beforeEach(() => {
      mockDocManager = {
        generateFileInventory: jest.fn().mockResolvedValue([]),
        createDocumentationStructure: jest.fn().mockResolvedValue(),
        createBackup: jest.fn().mockResolvedValue('backup-dir'),
        moveFilesToDocumentation: jest.fn().mockResolvedValue([]),
        updateCategoryIndexes: jest.fn().mockResolvedValue(),
        fileInventory: []
      };
      
      DocumentationManager.mockImplementation(() => mockDocManager);
      orchestrator.documentationManager = mockDocManager;
    });

    test('should execute documentation organization successfully', async () => {
      const config = orchestrator.createDefaultConfiguration();
      const moveOperations = [
        { originalPath: 'test.md', newPath: 'docs/general/test.md', category: 'general' }
      ];
      
      mockDocManager.moveFilesToDocumentation.mockResolvedValue(moveOperations);

      const result = await orchestrator.executeDocumentationOrganization(config);
      
      expect(result.success).toBe(true);
      expect(result.filesOrganized).toBe(1);
      expect(result.backupCreated).toBe('backup-dir');
      expect(mockDocManager.generateFileInventory).toHaveBeenCalled();
      expect(mockDocManager.createDocumentationStructure).toHaveBeenCalled();
      expect(mockDocManager.createBackup).toHaveBeenCalled();
      expect(mockDocManager.moveFilesToDocumentation).toHaveBeenCalledWith(true);
      expect(mockDocManager.updateCategoryIndexes).toHaveBeenCalledWith(moveOperations);
    });

    test('should handle documentation organization failure', async () => {
      const config = orchestrator.createDefaultConfiguration();
      
      mockDocManager.generateFileInventory.mockRejectedValue(new Error('File scan failed'));

      await expect(orchestrator.executeDocumentationOrganization(config)).rejects.toThrow('File scan failed');
    });

    test('should perform dry run for documentation organization', async () => {
      orchestrator.dryRun = true;
      const config = orchestrator.createDefaultConfiguration();
      mockDocManager.fileInventory = [{ name: 'test.md' }, { name: 'test2.md' }];

      const result = await orchestrator.executeDocumentationOrganization(config);
      
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.filesFound).toBe(2);
      expect(mockDocManager.generateFileInventory).toHaveBeenCalled();
      expect(mockDocManager.moveFilesToDocumentation).not.toHaveBeenCalled();
    });
  });

  describe('Deployment Execution', () => {
    let mockDeploymentPipeline;

    beforeEach(() => {
      mockDeploymentPipeline = {
        executeDeployment: jest.fn(),
        firebaseDeployment: {
          validateEnvironment: jest.fn().mockReturnValue({ isValid: true })
        }
      };
      
      DeploymentPipeline.mockImplementation(() => mockDeploymentPipeline);
      orchestrator.deploymentPipeline = mockDeploymentPipeline;
    });

    test('should execute deployment successfully', async () => {
      const config = orchestrator.createDefaultConfiguration();
      const deploymentResult = {
        success: true,
        deployment: { success: true },
        gitCommit: { success: true, commitHash: 'abc123' }
      };
      
      mockDeploymentPipeline.executeDeployment.mockResolvedValue(deploymentResult);

      const result = await orchestrator.executeDeployment(config);
      
      expect(result.success).toBe(true);
      expect(mockDeploymentPipeline.executeDeployment).toHaveBeenCalledWith({
        commitMessage: 'System orchestration: automated deployment',
        changeType: 'deploy',
        skipCommit: false,
        targets: ['hosting', 'functions', 'firestore']
      });
    });

    test('should handle deployment failure', async () => {
      const config = orchestrator.createDefaultConfiguration();
      const deploymentResult = {
        success: false,
        error: 'Deployment failed'
      };
      
      mockDeploymentPipeline.executeDeployment.mockResolvedValue(deploymentResult);

      const result = await orchestrator.executeDeployment(config);
      
      expect(result.success).toBe(false);
    });

    test('should perform dry run for deployment', async () => {
      orchestrator.dryRun = true;
      const config = orchestrator.createDefaultConfiguration();
      const validation = { isValid: true, checks: {} };
      
      mockDeploymentPipeline.firebaseDeployment.validateEnvironment.mockReturnValue(validation);

      const result = await orchestrator.executeDeployment(config);
      
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.validation).toEqual(validation);
      expect(mockDeploymentPipeline.executeDeployment).not.toHaveBeenCalled();
    });
  });

  describe('Complete System Setup Integration', () => {
    let mockDocManager;
    let mockDeploymentPipeline;

    beforeEach(() => {
      // Mock documentation manager
      mockDocManager = {
        generateFileInventory: jest.fn().mockResolvedValue([]),
        createDocumentationStructure: jest.fn().mockResolvedValue(),
        createBackup: jest.fn().mockResolvedValue('backup-dir'),
        moveFilesToDocumentation: jest.fn().mockResolvedValue([
          { originalPath: 'test.md', newPath: 'docs/general/test.md', category: 'general' }
        ]),
        updateCategoryIndexes: jest.fn().mockResolvedValue(),
        fileInventory: [{ name: 'test.md' }]
      };
      
      // Mock deployment pipeline
      mockDeploymentPipeline = {
        executeDeployment: jest.fn().mockResolvedValue({
          success: true,
          deployment: { success: true },
          gitCommit: { success: true, commitHash: 'abc123' }
        }),
        firebaseDeployment: {
          validateEnvironment: jest.fn().mockReturnValue({ isValid: true })
        }
      };
      
      DocumentationManager.mockImplementation(() => mockDocManager);
      DeploymentPipeline.mockImplementation(() => mockDeploymentPipeline);
      
      orchestrator.documentationManager = mockDocManager;
      orchestrator.deploymentPipeline = mockDeploymentPipeline;
    });

    test('should execute complete system setup successfully', async () => {
      // Mock Firebase CLI for admin setup
      mockExecSync
        .mockReturnValueOnce('9.0.0')
        .mockReturnValueOnce('{"success": true, "message": "Admin initialized"}');

      const result = await orchestrator.executeCompleteSetup({
        interactive: false
      });
      
      expect(result.success).toBe(true);
      expect(result.results.admin).toBeDefined();
      expect(result.results.documentation).toBeDefined();
      expect(result.results.deployment).toBeDefined();
      
      expect(result.results.admin.success).toBe(true);
      expect(result.results.documentation.success).toBe(true);
      expect(result.results.documentation.filesOrganized).toBe(1);
      expect(result.results.deployment.success).toBe(true);
    });

    test('should handle partial failures gracefully', async () => {
      // Mock admin setup success but documentation failure
      mockExecSync
        .mockReturnValueOnce('9.0.0')
        .mockReturnValueOnce('{"success": true, "message": "Admin initialized"}');
      
      mockDocManager.generateFileInventory.mockRejectedValue(new Error('Documentation failed'));

      const result = await orchestrator.executeCompleteSetup({
        interactive: false
      });
      
      expect(result.success).toBe(false);
      expect(result.results.admin.success).toBe(true);
      expect(result.errors).toContain('Documentation failed');
    });

    test('should skip specified components', async () => {
      const result = await orchestrator.executeCompleteSetup({
        skipAdmin: true,
        skipDocs: true,
        interactive: false
      });
      
      expect(result.results.admin).toBeUndefined();
      expect(result.results.documentation).toBeUndefined();
      expect(result.results.deployment).toBeDefined();
    });

    test('should perform complete dry run', async () => {
      orchestrator.dryRun = true;

      const result = await orchestrator.executeCompleteSetup({
        interactive: false
      });
      
      expect(result.success).toBe(true);
      expect(result.results.admin.dryRun).toBe(true);
      expect(result.results.documentation.dryRun).toBe(true);
      expect(result.results.deployment.dryRun).toBe(true);
      
      expect(mockExecSync).not.toHaveBeenCalled();
      expect(mockDocManager.moveFilesToDocumentation).not.toHaveBeenCalled();
      expect(mockDeploymentPipeline.executeDeployment).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle configuration loading errors', async () => {
      // Create invalid JSON configuration
      await fs.mkdir('.kiro', { recursive: true });
      await fs.writeFile('.kiro/test-config.json', 'invalid json', 'utf8');

      const config = await orchestrator.loadConfiguration();
      
      // Should fall back to default configuration
      expect(config).toHaveProperty('admin');
      expect(config.admin.defaultUID).toBe('gEjUSOsHF9QmS0Dvi0zB10GsxrD2');
    });

    test('should handle file system errors during logging', async () => {
      // Mock fs.appendFile to throw error
      const originalAppendFile = fs.appendFile;
      fs.appendFile = jest.fn().mockRejectedValue(new Error('Disk full'));

      const results = { success: true, test: 'data' };
      
      // Should not throw error, just warn
      await expect(orchestrator.logResults(results)).resolves.not.toThrow();
      
      // Restore original function
      fs.appendFile = originalAppendFile;
    });

    test('should validate progress tracking with invalid steps', () => {
      orchestrator.initializeProgress(['Valid Step']);
      
      // Try to update non-existent step
      orchestrator.updateProgress('Invalid Step', 'completed');
      
      // Should not crash, just ignore invalid step
      expect(orchestrator.progress.completed).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    test('should check file existence correctly', async () => {
      await fs.writeFile('existing-file.txt', 'content');
      
      const exists = await orchestrator.fileExists('existing-file.txt');
      const notExists = await orchestrator.fileExists('non-existent-file.txt');
      
      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });

    test('should ensure directory creation', async () => {
      const testPath = 'nested/deep/directory';
      
      await orchestrator.ensureDirectoryExists(testPath);
      
      const stats = await fs.stat(testPath);
      expect(stats.isDirectory()).toBe(true);
    });

    test('should handle directory creation errors gracefully', async () => {
      // Try to create directory where file exists
      await fs.writeFile('blocking-file', 'content');
      
      await expect(orchestrator.ensureDirectoryExists('blocking-file/subdir'))
        .rejects.toThrow();
    });
  });

  describe('Environment-Specific Behavior', () => {
    test('should adapt behavior based on NODE_ENV', async () => {
      const originalEnv = process.env.NODE_ENV;
      
      try {
        process.env.NODE_ENV = 'production';
        
        const config = await orchestrator.loadConfiguration();
        
        // In production, certain safety features should be enabled
        expect(config.deployment.autoRollback).toBe(true);
        expect(config.security.requireAuthentication).toBe(true);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('should handle missing environment variables', async () => {
      const originalFirebaseProject = process.env.FIREBASE_PROJECT_ID;
      
      try {
        delete process.env.FIREBASE_PROJECT_ID;
        
        const config = await orchestrator.loadConfiguration();
        
        // Should still work with config-based project ID
        expect(config).toBeDefined();
      } finally {
        if (originalFirebaseProject) {
          process.env.FIREBASE_PROJECT_ID = originalFirebaseProject;
        }
      }
    });
  });

  describe('Performance and Resource Management', () => {
    test('should handle large file inventories efficiently', async () => {
      const mockDocManager = {
        generateFileInventory: jest.fn().mockResolvedValue(
          Array.from({ length: 1000 }, (_, i) => ({ name: `file${i}.md` }))
        ),
        createDocumentationStructure: jest.fn().mockResolvedValue(),
        createBackup: jest.fn().mockResolvedValue('backup-dir'),
        moveFilesToDocumentation: jest.fn().mockResolvedValue([]),
        updateCategoryIndexes: jest.fn().mockResolvedValue(),
        fileInventory: Array.from({ length: 1000 }, (_, i) => ({ name: `file${i}.md` }))
      };
      
      DocumentationManager.mockImplementation(() => mockDocManager);
      orchestrator.documentationManager = mockDocManager;
      
      const config = orchestrator.createDefaultConfiguration();
      
      const startTime = Date.now();
      const result = await orchestrator.executeDocumentationOrganization(config);
      const duration = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle concurrent operations safely', async () => {
      const config = orchestrator.createDefaultConfiguration();
      
      // Mock successful operations
      mockExecSync.mockReturnValue('{"success": true}');
      
      const mockDocManager = {
        generateFileInventory: jest.fn().mockResolvedValue([]),
        createDocumentationStructure: jest.fn().mockResolvedValue(),
        createBackup: jest.fn().mockResolvedValue('backup-dir'),
        moveFilesToDocumentation: jest.fn().mockResolvedValue([]),
        updateCategoryIndexes: jest.fn().mockResolvedValue(),
        fileInventory: []
      };
      
      DocumentationManager.mockImplementation(() => mockDocManager);
      orchestrator.documentationManager = mockDocManager;
      
      // Run multiple operations concurrently (should be handled sequentially)
      const promises = [
        orchestrator.executeAdminSetup(config),
        orchestrator.executeDocumentationOrganization(config)
      ];
      
      const results = await Promise.all(promises);
      
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });
});

describe('SystemOrchestrator CLI Integration', () => {
  test('should export SystemOrchestrator class for programmatic use', () => {
    expect(SystemOrchestrator).toBeDefined();
    expect(typeof SystemOrchestrator).toBe('function');
    
    const instance = new SystemOrchestrator();
    expect(instance).toBeInstanceOf(SystemOrchestrator);
  });

  test('should have all required methods', () => {
    const instance = new SystemOrchestrator();
    
    expect(typeof instance.loadConfiguration).toBe('function');
    expect(typeof instance.executeCompleteSetup).toBe('function');
    expect(typeof instance.executeAdminSetup).toBe('function');
    expect(typeof instance.executeDocumentationOrganization).toBe('function');
    expect(typeof instance.executeDeployment).toBe('function');
  });
});