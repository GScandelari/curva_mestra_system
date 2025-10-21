const fs = require('fs').promises;
const path = require('path');
const EnvironmentValidator = require('../validateEnvironment');

// Mock child_process for command execution
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

// Mock ConfigManager
jest.mock('../configManager', () => {
  return jest.fn().mockImplementation(() => ({
    loadConfiguration: jest.fn().mockResolvedValue({
      admin: { defaultUID: 'test-uid', defaultEmail: 'test@example.com' },
      firebase: { projectId: 'test-project' }
    }),
    validateConfiguration: jest.fn().mockResolvedValue()
  }));
});

describe('EnvironmentValidator', () => {
  let validator;
  let testDir;
  let originalCwd;
  let mockExecSync;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = path.join(__dirname, 'temp-validator-test');
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);

    mockExecSync = require('child_process').execSync;
    mockExecSync.mockClear();

    validator = new EnvironmentValidator({
      verbose: false,
      environment: 'test'
    });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Node.js Version Check', () => {
    test('should pass for Node.js v16+', async () => {
      // Mock Node.js version (process.version is read-only, so we test the logic)
      const originalVersion = process.version;
      Object.defineProperty(process, 'version', { value: 'v18.15.0', configurable: true });

      const result = await validator.checkNodeVersion();

      expect(result.status).toBe('pass');
      expect(result.message).toContain('Node.js v18.15.0');

      Object.defineProperty(process, 'version', { value: originalVersion, configurable: true });
    });

    test('should warn for Node.js v14-15', async () => {
      const originalVersion = process.version;
      Object.defineProperty(process, 'version', { value: 'v14.20.0', configurable: true });

      const result = await validator.checkNodeVersion();

      expect(result.status).toBe('warn');
      expect(result.message).toContain('recommend v16+');

      Object.defineProperty(process, 'version', { value: originalVersion, configurable: true });
    });

    test('should fail for Node.js v13 and below', async () => {
      const originalVersion = process.version;
      Object.defineProperty(process, 'version', { value: 'v12.22.0', configurable: true });

      const result = await validator.checkNodeVersion();

      expect(result.status).toBe('fail');
      expect(result.message).toContain('requires v14+');

      Object.defineProperty(process, 'version', { value: originalVersion, configurable: true });
    });
  });

  describe('NPM Version Check', () => {
    test('should pass for NPM v8+', async () => {
      mockExecSync.mockReturnValue('9.5.0');

      const result = await validator.checkNpmVersion();

      expect(result.status).toBe('pass');
      expect(result.message).toContain('NPM 9.5.0');
      expect(mockExecSync).toHaveBeenCalledWith('npm --version', { encoding: 'utf8' });
    });

    test('should warn for NPM v6-7', async () => {
      mockExecSync.mockReturnValue('7.24.0');

      const result = await validator.checkNpmVersion();

      expect(result.status).toBe('warn');
      expect(result.message).toContain('recommend v8+');
    });

    test('should fail when NPM is not found', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const result = await validator.checkNpmVersion();

      expect(result.status).toBe('fail');
      expect(result.message).toBe('NPM not found');
    });
  });

  describe('Git Configuration Check', () => {
    test('should pass with proper Git configuration', async () => {
      mockExecSync
        .mockReturnValueOnce('git version 2.39.0')
        .mockReturnValueOnce('John Doe')
        .mockReturnValueOnce('john@example.com');

      const result = await validator.checkGitConfiguration();

      expect(result.status).toBe('pass');
      expect(result.message).toContain('John Doe <john@example.com>');
      expect(result.user).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
    });

    test('should fail when Git user is not configured', async () => {
      mockExecSync
        .mockReturnValueOnce('git version 2.39.0')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('john@example.com');

      const result = await validator.checkGitConfiguration();

      expect(result.status).toBe('fail');
      expect(result.message).toContain('user.name or user.email not configured');
    });

    test('should fail when Git is not found', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('git: command not found');
      });

      const result = await validator.checkGitConfiguration();

      expect(result.status).toBe('fail');
      expect(result.message).toContain('Git not found or not configured');
    });
  });

  describe('Firebase CLI Check', () => {
    test('should pass when Firebase CLI is installed', async () => {
      mockExecSync.mockReturnValue('12.4.0');

      const result = await validator.checkFirebaseCLI();

      expect(result.status).toBe('pass');
      expect(result.message).toContain('Firebase CLI 12.4.0');
      expect(mockExecSync).toHaveBeenCalledWith('firebase --version', { encoding: 'utf8' });
    });

    test('should fail when Firebase CLI is not found', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command not found');
      });

      const result = await validator.checkFirebaseCLI();

      expect(result.status).toBe('fail');
      expect(result.message).toContain('Install with: npm install -g firebase-tools');
    });
  });

  describe('Firebase Authentication Check', () => {
    test('should pass when authenticated and project accessible', async () => {
      mockExecSync.mockReturnValue('Project list including curva-mestra');

      const result = await validator.checkFirebaseAuth();

      expect(result.status).toBe('pass');
      expect(result.message).toBe('Firebase authenticated and project accessible');
      expect(mockExecSync).toHaveBeenCalledWith('firebase projects:list', { encoding: 'utf8', stdio: 'pipe' });
    });

    test('should warn when authenticated but project not found', async () => {
      mockExecSync.mockReturnValue('Project list without curva-mestra');

      const result = await validator.checkFirebaseAuth();

      expect(result.status).toBe('warn');
      expect(result.message).toContain('curva-mestra project not found');
    });

    test('should fail when not authenticated', async () => {
      mockExecSync.mockImplementation(() => {
        const error = new Error('Authentication required');
        error.message = 'not authenticated';
        throw error;
      });

      const result = await validator.checkFirebaseAuth();

      expect(result.status).toBe('fail');
      expect(result.message).toContain('Run: firebase login');
    });
  });

  describe('Configuration Files Check', () => {
    test('should pass when all required files exist', async () => {
      // Create required files
      await fs.mkdir('.kiro', { recursive: true });
      await fs.writeFile('.kiro/system-config.json', '{}');
      await fs.writeFile('firebase.json', '{}');
      await fs.writeFile('package.json', '{}');

      const result = await validator.checkConfigurationFiles();

      expect(result.status).toBe('pass');
      expect(result.message).toBe('All required configuration files found');
      expect(result.files.required.every(f => f.exists)).toBe(true);
    });

    test('should fail when required files are missing', async () => {
      // Only create some files
      await fs.writeFile('package.json', '{}');

      const result = await validator.checkConfigurationFiles();

      expect(result.status).toBe('fail');
      expect(result.message).toContain('Missing required files');
      expect(result.files.required.some(f => !f.exists)).toBe(true);
    });

    test('should check optional files', async () => {
      // Create required files
      await fs.mkdir('.kiro', { recursive: true });
      await fs.writeFile('.kiro/system-config.json', '{}');
      await fs.writeFile('firebase.json', '{}');
      await fs.writeFile('package.json', '{}');

      // Create some optional files
      await fs.mkdir('.kiro/config', { recursive: true });
      await fs.writeFile('.kiro/config/test.json', '{}');
      await fs.writeFile('firestore.rules', 'rules_version = "2";');

      const result = await validator.checkConfigurationFiles();

      expect(result.status).toBe('pass');
      expect(result.files.optional.some(f => f.exists)).toBe(true);
    });
  });

  describe('Environment Variables Check', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should pass with valid environment variables', async () => {
      process.env.NODE_ENV = 'test';
      process.env.FIREBASE_PROJECT_ID = 'test-project';

      const result = await validator.checkEnvironmentVariables();

      expect(result.status).toBe('pass');
      expect(result.message).toBe('Environment variables validated');
      expect(result.variables).toHaveProperty('NODE_ENV', 'test');
      expect(result.variables).toHaveProperty('FIREBASE_PROJECT_ID', 'test-project');
    });

    test('should handle missing environment variables', async () => {
      delete process.env.NODE_ENV;
      delete process.env.FIREBASE_PROJECT_ID;

      const result = await validator.checkEnvironmentVariables();

      expect(result.variables.NODE_ENV).toBe('not set');
      expect(result.variables.FIREBASE_PROJECT_ID).toBe('not set');
    });

    test('should fail when configuration validation fails', async () => {
      // Mock ConfigManager to throw validation error
      const ConfigManager = require('../configManager');
      const mockConfigManager = new ConfigManager();
      mockConfigManager.validateConfiguration.mockRejectedValue(new Error('Missing required variables'));
      validator.configManager = mockConfigManager;

      const result = await validator.checkEnvironmentVariables();

      expect(result.status).toBe('fail');
      expect(result.message).toContain('Missing required variables');
    });
  });

  describe('Project Structure Check', () => {
    test('should pass with complete project structure', async () => {
      // Create required directories
      await fs.mkdir('frontend', { recursive: true });
      await fs.mkdir('backend', { recursive: true });
      await fs.mkdir('functions', { recursive: true });
      await fs.mkdir('scripts', { recursive: true });
      await fs.mkdir('.kiro', { recursive: true });

      const result = await validator.checkProjectStructure();

      expect(result.status).toBe('pass');
      expect(result.message).toBe('Project structure validated');
      expect(result.directories.every(d => d.exists)).toBe(true);
    });

    test('should fail with missing directories', async () => {
      // Create only some directories
      await fs.mkdir('frontend', { recursive: true });
      await fs.mkdir('scripts', { recursive: true });

      const result = await validator.checkProjectStructure();

      expect(result.status).toBe('fail');
      expect(result.message).toContain('Missing directories');
      expect(result.directories.some(d => !d.exists)).toBe(true);
    });
  });

  describe('Dependencies Check', () => {
    test('should pass when all dependencies are installed', async () => {
      // Create package.json files and node_modules directories
      await fs.writeFile('package.json', '{}');
      await fs.mkdir('node_modules', { recursive: true });

      await fs.mkdir('frontend', { recursive: true });
      await fs.writeFile('frontend/package.json', '{}');
      await fs.mkdir('frontend/node_modules', { recursive: true });

      await fs.mkdir('backend', { recursive: true });
      await fs.writeFile('backend/package.json', '{}');
      await fs.mkdir('backend/node_modules', { recursive: true });

      await fs.mkdir('functions', { recursive: true });
      await fs.writeFile('functions/package.json', '{}');
      await fs.mkdir('functions/node_modules', { recursive: true });

      await fs.mkdir('scripts', { recursive: true });
      await fs.writeFile('scripts/package.json', '{}');
      await fs.mkdir('scripts/node_modules', { recursive: true });

      const result = await validator.checkDependencies();

      expect(result.status).toBe('pass');
      expect(result.message).toBe('All dependencies installed');
      expect(result.packages.every(p => p.installed)).toBe(true);
    });

    test('should warn when some dependencies are missing', async () => {
      // Create package.json files but not all node_modules
      await fs.writeFile('package.json', '{}');
      await fs.mkdir('node_modules', { recursive: true });

      await fs.mkdir('frontend', { recursive: true });
      await fs.writeFile('frontend/package.json', '{}');
      // Missing frontend/node_modules

      const result = await validator.checkDependencies();

      expect(result.status).toBe('warn');
      expect(result.message).toContain('Dependencies not installed for');
      expect(result.packages.some(p => !p.installed)).toBe(true);
    });
  });

  describe('File Permissions Check', () => {
    test('should pass when all scripts are readable', async () => {
      // Create script files
      await fs.mkdir('scripts', { recursive: true });
      await fs.writeFile('scripts/systemOrchestrator.js', 'console.log("test");');
      await fs.writeFile('scripts/documentationManager.js', 'console.log("test");');
      await fs.writeFile('scripts/deployPipeline.js', 'console.log("test");');

      const result = await validator.checkFilePermissions();

      expect(result.status).toBe('pass');
      expect(result.message).toBe('File permissions validated');
      expect(result.files.every(f => f.readable)).toBe(true);
    });

    test('should fail when scripts are not readable', async () => {
      // Create scripts directory but not all files
      await fs.mkdir('scripts', { recursive: true });
      await fs.writeFile('scripts/systemOrchestrator.js', 'console.log("test");');
      // Missing other script files

      const result = await validator.checkFilePermissions();

      expect(result.status).toBe('fail');
      expect(result.message).toContain('Unreadable files');
      expect(result.files.some(f => !f.readable)).toBe(true);
    });
  });

  describe('Complete Environment Validation', () => {
    test('should perform complete validation successfully', async () => {
      // Setup complete environment
      await setupCompleteEnvironment();

      // Mock all external commands
      mockExecSync
        .mockReturnValueOnce('9.5.0') // npm --version
        .mockReturnValueOnce('git version 2.39.0') // git --version
        .mockReturnValueOnce('John Doe') // git config user.name
        .mockReturnValueOnce('john@example.com') // git config user.email
        .mockReturnValueOnce('12.4.0') // firebase --version
        .mockReturnValueOnce('Project list including curva-mestra'); // firebase projects:list

      const results = await validator.validateEnvironment();

      expect(results.overall.passed).toBe(true);
      expect(results.overall.score).toBeGreaterThan(0);
      expect(results.checks).toHaveProperty('Node.js Version');
      expect(results.checks).toHaveProperty('NPM Version');
      expect(results.checks).toHaveProperty('Git Configuration');
      expect(results.checks).toHaveProperty('Firebase CLI');
      expect(results.checks).toHaveProperty('Firebase Authentication');
    });

    test('should handle validation failures gracefully', async () => {
      // Setup minimal environment (missing many components)
      await fs.writeFile('package.json', '{}');

      // Mock failing commands
      mockExecSync.mockImplementation((command) => {
        if (command.includes('firebase')) {
          throw new Error('Command not found');
        }
        if (command.includes('git')) {
          throw new Error('Command not found');
        }
        return 'output';
      });

      const results = await validator.validateEnvironment();

      expect(results.overall.passed).toBe(false);
      expect(results.overall.score).toBeLessThan(results.overall.total);
      expect(Object.values(results.checks).some(check => check.status === 'fail')).toBe(true);
    });

    test('should provide helpful recommendations for failures', async () => {
      // Mock Firebase CLI missing
      mockExecSync.mockImplementation((command) => {
        if (command.includes('firebase')) {
          throw new Error('Command not found');
        }
        return 'output';
      });

      const results = await validator.validateEnvironment();

      expect(results.overall.passed).toBe(false);
      expect(results.checks['Firebase CLI'].status).toBe('fail');
    });

    async function setupCompleteEnvironment() {
      // Create all required directories
      await fs.mkdir('frontend', { recursive: true });
      await fs.mkdir('backend', { recursive: true });
      await fs.mkdir('functions', { recursive: true });
      await fs.mkdir('scripts', { recursive: true });
      await fs.mkdir('.kiro/config', { recursive: true });

      // Create all required files
      await fs.writeFile('.kiro/system-config.json', '{}');
      await fs.writeFile('firebase.json', '{}');
      await fs.writeFile('package.json', '{}');
      await fs.writeFile('.kiro/config/test.json', '{}');

      // Create script files
      await fs.writeFile('scripts/systemOrchestrator.js', 'console.log("test");');
      await fs.writeFile('scripts/documentationManager.js', 'console.log("test");');
      await fs.writeFile('scripts/deployPipeline.js', 'console.log("test");');

      // Create node_modules directories
      await fs.mkdir('node_modules', { recursive: true });
      await fs.mkdir('frontend/node_modules', { recursive: true });
      await fs.mkdir('backend/node_modules', { recursive: true });
      await fs.mkdir('functions/node_modules', { recursive: true });
      await fs.mkdir('scripts/node_modules', { recursive: true });

      // Create package.json files
      await fs.writeFile('frontend/package.json', '{}');
      await fs.writeFile('backend/package.json', '{}');
      await fs.writeFile('functions/package.json', '{}');
      await fs.writeFile('scripts/package.json', '{}');
    }
  });

  describe('Error Handling', () => {
    test('should handle unexpected errors during validation', async () => {
      // Mock fs.stat to throw error
      const originalStat = fs.stat;
      fs.stat = jest.fn().mockRejectedValue(new Error('File system error'));

      const result = await validator.checkProjectStructure();

      expect(result.status).toBe('fail');
      expect(result.message).toContain('Missing directories');

      // Restore original function
      fs.stat = originalStat;
    });

    test('should handle command execution timeouts', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command timed out');
      });

      const result = await validator.checkFirebaseCLI();

      expect(result.status).toBe('fail');
      expect(result.message).toContain('Install with: npm install -g firebase-tools');
    });
  });

  describe('Verbose Output', () => {
    test('should provide detailed output in verbose mode', async () => {
      validator.verbose = true;
      
      // Mock console.log to capture output
      const originalLog = console.log;
      const logOutput = [];
      console.log = jest.fn((...args) => logOutput.push(args.join(' ')));

      await validator.checkNodeVersion();

      expect(console.log).toHaveBeenCalled();

      // Restore console.log
      console.log = originalLog;
    });
  });
});