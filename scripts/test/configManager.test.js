const fs = require('fs').promises;
const path = require('path');
const ConfigManager = require('../configManager');

// Mock crypto for encryption tests
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue(Buffer.from('mock-random-bytes')),
  createCipher: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnValue('encrypted-data'),
    final: jest.fn().mockReturnValue(''),
    getAuthTag: jest.fn().mockReturnValue(Buffer.from('auth-tag'))
  }),
  createDecipher: jest.fn().mockReturnValue({
    setAuthTag: jest.fn(),
    update: jest.fn().mockReturnValue('decrypted-data'),
    final: jest.fn().mockReturnValue('')
  })
}));

// Mock child_process for credential checks
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

describe('ConfigManager', () => {
  let configManager;
  let testDir;
  let originalCwd;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = path.join(__dirname, 'temp-config-test');
    await fs.mkdir(testDir, { recursive: true });
    process.chdir(testDir);

    configManager = new ConfigManager({
      baseConfigPath: '.kiro/test-config.json',
      environmentConfigDir: '.kiro/config',
      environment: 'test',
      encryptionKey: 'test-encryption-key',
      verbose: false
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

  describe('Configuration Loading', () => {
    test('should load base configuration successfully', async () => {
      const baseConfig = {
        admin: { defaultUID: 'test-uid' },
        deployment: { targets: ['hosting'] }
      };

      await fs.mkdir('.kiro', { recursive: true });
      await fs.writeFile('.kiro/test-config.json', JSON.stringify(baseConfig), 'utf8');

      const config = await configManager.loadBaseConfiguration();
      
      expect(config).toEqual(baseConfig);
    });

    test('should throw error for missing base configuration', async () => {
      await expect(configManager.loadBaseConfiguration()).rejects.toThrow('Base configuration file not found');
    });

    test('should throw error for invalid JSON in base configuration', async () => {
      await fs.mkdir('.kiro', { recursive: true });
      await fs.writeFile('.kiro/test-config.json', 'invalid json', 'utf8');

      await expect(configManager.loadBaseConfiguration()).rejects.toThrow('Failed to parse base configuration');
    });

    test('should load environment configuration successfully', async () => {
      const envConfig = {
        firebase: { projectId: 'test-project' },
        deployment: { autoRollback: false }
      };

      await fs.mkdir('.kiro/config', { recursive: true });
      await fs.writeFile('.kiro/config/test.json', JSON.stringify(envConfig), 'utf8');

      const config = await configManager.loadEnvironmentConfiguration();
      
      expect(config).toEqual(envConfig);
    });

    test('should handle missing environment configuration gracefully', async () => {
      const config = await configManager.loadEnvironmentConfiguration();
      
      expect(config).toEqual({});
    });

    test('should merge configurations correctly', async () => {
      const baseConfig = {
        admin: { defaultUID: 'base-uid', defaultEmail: 'base@example.com' },
        deployment: { targets: ['hosting'], autoRollback: true },
        nested: { level1: { level2: 'base-value' } }
      };

      const envConfig = {
        admin: { defaultUID: 'env-uid' },
        deployment: { autoRollback: false },
        nested: { level1: { level2: 'env-value', newProp: 'new' } },
        newSection: { prop: 'value' }
      };

      await fs.mkdir('.kiro/config', { recursive: true });
      await fs.writeFile('.kiro/test-config.json', JSON.stringify(baseConfig), 'utf8');
      await fs.writeFile('.kiro/config/test.json', JSON.stringify(envConfig), 'utf8');

      const merged = await configManager.loadConfiguration();
      
      expect(merged.admin.defaultUID).toBe('env-uid'); // Overridden
      expect(merged.admin.defaultEmail).toBe('base@example.com'); // Preserved
      expect(merged.deployment.targets).toEqual(['hosting']); // Preserved
      expect(merged.deployment.autoRollback).toBe(false); // Overridden
      expect(merged.nested.level1.level2).toBe('env-value'); // Overridden
      expect(merged.nested.level1.newProp).toBe('new'); // Added
      expect(merged.newSection.prop).toBe('value'); // Added
    });
  });

  describe('Configuration Validation', () => {
    test('should validate valid configuration', async () => {
      const validConfig = {
        admin: {
          defaultUID: 'test-uid',
          defaultEmail: 'test@example.com'
        },
        firebase: {
          projectId: 'test-project'
        },
        deployment: {
          targets: ['hosting', 'functions']
        }
      };

      await expect(configManager.validateConfiguration(validConfig)).resolves.not.toThrow();
    });

    test('should reject configuration with missing admin UID', async () => {
      const invalidConfig = {
        admin: {
          defaultEmail: 'test@example.com'
        }
      };

      await expect(configManager.validateConfiguration(invalidConfig)).rejects.toThrow('admin.defaultUID is required');
    });

    test('should reject configuration with missing admin email', async () => {
      const invalidConfig = {
        admin: {
          defaultUID: 'test-uid'
        }
      };

      await expect(configManager.validateConfiguration(invalidConfig)).rejects.toThrow('admin.defaultEmail is required');
    });

    test('should reject configuration with invalid deployment targets', async () => {
      const invalidConfig = {
        admin: {
          defaultUID: 'test-uid',
          defaultEmail: 'test@example.com'
        },
        deployment: {
          targets: ['hosting', 'invalid-target']
        }
      };

      await expect(configManager.validateConfiguration(invalidConfig)).rejects.toThrow('Invalid deployment target: invalid-target');
    });

    test('should reject configuration with non-array deployment targets', async () => {
      const invalidConfig = {
        admin: {
          defaultUID: 'test-uid',
          defaultEmail: 'test@example.com'
        },
        deployment: {
          targets: 'hosting'
        }
      };

      await expect(configManager.validateConfiguration(invalidConfig)).rejects.toThrow('deployment.targets must be an array');
    });
  });

  describe('Environment Variable Validation', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should validate environment variables for production', async () => {
      configManager.environment = 'production';
      
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/credentials.json';
      
      const config = {
        admin: { defaultUID: 'test-uid', defaultEmail: 'test@example.com' },
        firebase: { projectId: 'test-project' }
      };

      await expect(configManager.validateConfiguration(config)).resolves.not.toThrow();
    });

    test('should require GOOGLE_APPLICATION_CREDENTIALS in production', async () => {
      configManager.environment = 'production';
      
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      const config = {
        admin: { defaultUID: 'test-uid', defaultEmail: 'test@example.com' }
      };

      await expect(configManager.validateConfiguration(config)).rejects.toThrow('GOOGLE_APPLICATION_CREDENTIALS');
    });

    test('should require encryption key when encryption is enabled', async () => {
      configManager.encryptionKey = null;
      
      const config = {
        admin: { defaultUID: 'test-uid', defaultEmail: 'test@example.com' },
        security: { encryptSensitiveData: true }
      };

      await expect(configManager.validateConfiguration(config)).rejects.toThrow('CONFIG_ENCRYPTION_KEY');
    });

    test('should require SMTP settings when email notifications are enabled', async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      
      const config = {
        admin: { defaultUID: 'test-uid', defaultEmail: 'test@example.com' },
        notifications: { email: { enabled: true } }
      };

      await expect(configManager.validateConfiguration(config)).rejects.toThrow('SMTP_HOST');
    });
  });

  describe('Configuration Persistence', () => {
    test('should save configuration to file', async () => {
      const config = {
        admin: { defaultUID: 'test-uid', defaultEmail: 'test@example.com' },
        deployment: { targets: ['hosting'] }
      };

      await configManager.saveConfiguration(config);

      const savedData = await fs.readFile('.kiro/test-config.json', 'utf8');
      const savedConfig = JSON.parse(savedData);
      
      expect(savedConfig).toEqual(config);
    });

    test('should create directory structure when saving', async () => {
      const config = { test: 'value' };
      
      await configManager.saveConfiguration(config);

      const dirExists = await fs.access('.kiro').then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    });

    test('should create environment-specific configuration', async () => {
      const envConfig = {
        firebase: { projectId: 'env-project' },
        deployment: { autoRollback: false }
      };

      await configManager.createEnvironmentConfig('staging', envConfig);

      const savedData = await fs.readFile('.kiro/config/staging.json', 'utf8');
      const savedConfig = JSON.parse(savedData);
      
      expect(savedConfig).toEqual(envConfig);
    });
  });

  describe('Configuration Path Operations', () => {
    test('should get configuration value by path', () => {
      const config = {
        admin: {
          defaultUID: 'test-uid',
          permissions: ['read', 'write']
        },
        nested: {
          deep: {
            value: 'found'
          }
        }
      };

      expect(configManager.getConfigValue(config, 'admin.defaultUID')).toBe('test-uid');
      expect(configManager.getConfigValue(config, 'admin.permissions')).toEqual(['read', 'write']);
      expect(configManager.getConfigValue(config, 'nested.deep.value')).toBe('found');
      expect(configManager.getConfigValue(config, 'nonexistent.path', 'default')).toBe('default');
    });

    test('should set configuration value by path', () => {
      const config = {};

      configManager.setConfigValue(config, 'admin.defaultUID', 'new-uid');
      configManager.setConfigValue(config, 'nested.deep.value', 'set-value');

      expect(config.admin.defaultUID).toBe('new-uid');
      expect(config.nested.deep.value).toBe('set-value');
    });

    test('should overwrite existing values when setting', () => {
      const config = {
        admin: { defaultUID: 'old-uid' }
      };

      configManager.setConfigValue(config, 'admin.defaultUID', 'new-uid');
      configManager.setConfigValue(config, 'admin.newProp', 'new-value');

      expect(config.admin.defaultUID).toBe('new-uid');
      expect(config.admin.newProp).toBe('new-value');
    });
  });

  describe('Encryption and Security', () => {
    test('should encrypt sensitive configuration data', () => {
      const config = {
        notifications: {
          email: {
            smtpConfig: {
              password: 'secret-password'
            }
          },
          slack: {
            webhookUrl: 'https://hooks.slack.com/secret'
          }
        }
      };

      configManager.encryptSensitiveData(config);

      expect(config.notifications.email.smtpConfig.password).toMatch(/^encrypted:/);
      expect(config.notifications.slack.webhookUrl).toMatch(/^encrypted:/);
    });

    test('should decrypt sensitive configuration data', () => {
      const config = {
        notifications: {
          email: {
            smtpConfig: {
              password: 'encrypted:mock-iv:mock-tag:encrypted-data'
            }
          }
        }
      };

      configManager.decryptSensitiveData(config);

      expect(config.notifications.email.smtpConfig.password).toBe('decrypted-data');
    });

    test('should handle decryption errors gracefully', () => {
      const config = {
        notifications: {
          email: {
            smtpConfig: {
              password: 'encrypted:invalid-format'
            }
          }
        }
      };

      // Should not throw, just warn
      expect(() => configManager.decryptSensitiveData(config)).not.toThrow();
    });

    test('should generate secure credentials information', async () => {
      const mockExecSync = require('child_process').execSync;
      mockExecSync
        .mockReturnValueOnce('John Doe') // git config user.name
        .mockReturnValueOnce('john@example.com'); // git config user.email

      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/credentials.json';

      const credentials = await configManager.generateSecureCredentials();

      expect(credentials).toHaveProperty('generated');
      expect(credentials.firebase.status).toBe('configured');
      expect(credentials.git.status).toBe('configured');
      expect(credentials.git.user).toBe('John Doe');
      expect(credentials.git.email).toBe('john@example.com');
    });

    test('should detect missing credentials', async () => {
      const mockExecSync = require('child_process').execSync;
      mockExecSync.mockImplementation(() => {
        throw new Error('Not configured');
      });

      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      const credentials = await configManager.generateSecureCredentials();

      expect(credentials.firebase.status).toBe('missing');
      expect(credentials.git.status).toBe('missing');
    });
  });

  describe('Environment Management', () => {
    test('should get current environment', () => {
      expect(configManager.getCurrentEnvironment()).toBe('test');
    });

    test('should list available environments', async () => {
      await fs.mkdir('.kiro/config', { recursive: true });
      await fs.writeFile('.kiro/config/development.json', '{}', 'utf8');
      await fs.writeFile('.kiro/config/production.json', '{}', 'utf8');
      await fs.writeFile('.kiro/config/staging.json', '{}', 'utf8');
      await fs.writeFile('.kiro/config/not-config.txt', 'ignore', 'utf8');

      const environments = await configManager.listEnvironments();

      expect(environments).toContain('development');
      expect(environments).toContain('production');
      expect(environments).toContain('staging');
      expect(environments).not.toContain('not-config');
    });

    test('should handle missing config directory when listing environments', async () => {
      const environments = await configManager.listEnvironments();
      
      expect(environments).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors during configuration loading', async () => {
      // Create a directory where config file should be
      await fs.mkdir('.kiro/test-config.json', { recursive: true });

      await expect(configManager.loadConfiguration()).rejects.toThrow();
    });

    test('should handle encryption without key', () => {
      configManager.encryptionKey = null;
      const config = { test: 'value' };

      expect(() => configManager.encryptSensitiveData(config)).toThrow('Encryption key not provided');
    });

    test('should handle decryption without key', () => {
      configManager.encryptionKey = null;
      const config = { test: 'encrypted:value' };

      expect(() => configManager.decryptSensitiveData(config)).toThrow('Encryption key not provided');
    });

    test('should validate encryption format', () => {
      expect(() => configManager.decrypt('invalid-format')).toThrow('Invalid encrypted text format');
      expect(() => configManager.decrypt('encrypted:invalid')).toThrow('Invalid encrypted text format');
    });
  });

  describe('Integration with SystemOrchestrator', () => {
    test('should provide configuration compatible with orchestrator', async () => {
      const baseConfig = {
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
      };

      await fs.mkdir('.kiro', { recursive: true });
      await fs.writeFile('.kiro/test-config.json', JSON.stringify(baseConfig), 'utf8');

      const config = await configManager.loadConfiguration();

      // Verify all required sections exist
      expect(config).toHaveProperty('admin');
      expect(config).toHaveProperty('documentation');
      expect(config).toHaveProperty('deployment');

      // Verify admin configuration
      expect(config.admin.defaultUID).toBe('test-uid');
      expect(config.admin.defaultEmail).toBe('test@example.com');
      expect(config.admin.autoInitialize).toBe(true);

      // Verify documentation configuration
      expect(config.documentation.autoOrganize).toBe(true);
      expect(config.documentation.createBackup).toBe(true);

      // Verify deployment configuration
      expect(config.deployment.targets).toEqual(['hosting', 'functions']);
      expect(config.deployment.autoRollback).toBe(true);
    });
  });
});