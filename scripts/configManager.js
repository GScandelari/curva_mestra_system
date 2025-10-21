const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Configuration Manager
 * Handles environment-specific configurations, validation, and secure credential management
 */
class ConfigManager {
  constructor(options = {}) {
    this.baseConfigPath = options.baseConfigPath || '.kiro/system-config.json';
    this.environmentConfigDir = options.environmentConfigDir || '.kiro/config';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.encryptionKey = options.encryptionKey || process.env.CONFIG_ENCRYPTION_KEY;
    this.verbose = options.verbose || false;
  }

  /**
   * Load and merge configurations
   * @returns {Promise<object>} Merged configuration object
   */
  async loadConfiguration() {
    try {
      // Load base configuration
      const baseConfig = await this.loadBaseConfiguration();
      
      // Load environment-specific configuration
      const envConfig = await this.loadEnvironmentConfiguration();
      
      // Merge configurations (environment overrides base)
      const mergedConfig = this.mergeConfigurations(baseConfig, envConfig);
      
      // Validate configuration
      await this.validateConfiguration(mergedConfig);
      
      // Decrypt sensitive data if encryption is enabled
      if (mergedConfig.security?.encryptSensitiveData) {
        this.decryptSensitiveData(mergedConfig);
      }
      
      return mergedConfig;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  /**
   * Load base configuration file
   * @returns {Promise<object>} Base configuration
   */
  async loadBaseConfiguration() {
    try {
      const configData = await fs.readFile(this.baseConfigPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Base configuration file not found: ${this.baseConfigPath}`);
      }
      throw new Error(`Failed to parse base configuration: ${error.message}`);
    }
  }

  /**
   * Load environment-specific configuration
   * @returns {Promise<object>} Environment configuration
   */
  async loadEnvironmentConfiguration() {
    const envConfigPath = path.join(this.environmentConfigDir, `${this.environment}.json`);
    
    try {
      const configData = await fs.readFile(envConfigPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`Environment configuration not found: ${envConfigPath}, using base configuration only`);
        return {};
      }
      throw new Error(`Failed to parse environment configuration: ${error.message}`);
    }
  }

  /**
   * Deep merge two configuration objects
   * @param {object} base Base configuration
   * @param {object} override Override configuration
   * @returns {object} Merged configuration
   */
  mergeConfigurations(base, override) {
    const merged = JSON.parse(JSON.stringify(base)); // Deep clone base
    
    const merge = (target, source) => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    };
    
    merge(merged, override);
    return merged;
  }

  /**
   * Validate configuration against required fields and constraints
   * @param {object} config Configuration to validate
   * @returns {Promise<void>}
   */
  async validateConfiguration(config) {
    const errors = [];
    
    // Validate admin configuration
    if (!config.admin?.defaultUID) {
      errors.push('admin.defaultUID is required');
    }
    
    if (!config.admin?.defaultEmail) {
      errors.push('admin.defaultEmail is required');
    }
    
    // Validate Firebase configuration
    if (config.firebase?.projectId && typeof config.firebase.projectId !== 'string') {
      errors.push('firebase.projectId must be a string');
    }
    
    // Validate deployment targets
    if (config.deployment?.targets && !Array.isArray(config.deployment.targets)) {
      errors.push('deployment.targets must be an array');
    }
    
    const validTargets = ['hosting', 'functions', 'firestore', 'storage'];
    if (config.deployment?.targets) {
      for (const target of config.deployment.targets) {
        if (!validTargets.includes(target)) {
          errors.push(`Invalid deployment target: ${target}`);
        }
      }
    }
    
    // Validate environment variables
    await this.validateEnvironmentVariables(config);
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Validate required environment variables
   * @param {object} config Configuration object
   * @returns {Promise<void>}
   */
  async validateEnvironmentVariables(config) {
    const requiredEnvVars = [];
    
    // Firebase project ID (can be from config or env)
    if (!config.firebase?.projectId && !process.env.FIREBASE_PROJECT_ID) {
      requiredEnvVars.push('FIREBASE_PROJECT_ID (or firebase.projectId in config)');
    }
    
    // Google Application Credentials for production
    if (this.environment === 'production' && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      requiredEnvVars.push('GOOGLE_APPLICATION_CREDENTIALS');
    }
    
    // Encryption key if encryption is enabled
    if (config.security?.encryptSensitiveData && !this.encryptionKey) {
      requiredEnvVars.push('CONFIG_ENCRYPTION_KEY');
    }
    
    // Email configuration if notifications are enabled
    if (config.notifications?.email?.enabled) {
      if (!process.env.SMTP_HOST) requiredEnvVars.push('SMTP_HOST');
      if (!process.env.SMTP_USER) requiredEnvVars.push('SMTP_USER');
      if (!process.env.SMTP_PASS) requiredEnvVars.push('SMTP_PASS');
    }
    
    // Slack webhook if Slack notifications are enabled
    if (config.notifications?.slack?.enabled && !process.env.SLACK_WEBHOOK_URL) {
      requiredEnvVars.push('SLACK_WEBHOOK_URL');
    }
    
    if (requiredEnvVars.length > 0) {
      throw new Error(`Missing required environment variables:\n${requiredEnvVars.join('\n')}`);
    }
  }

  /**
   * Save configuration to file
   * @param {object} config Configuration to save
   * @param {string} filePath Optional file path (defaults to base config path)
   * @returns {Promise<void>}
   */
  async saveConfiguration(config, filePath = null) {
    const targetPath = filePath || this.baseConfigPath;
    
    try {
      // Encrypt sensitive data if encryption is enabled
      const configToSave = JSON.parse(JSON.stringify(config)); // Deep clone
      if (config.security?.encryptSensitiveData) {
        this.encryptSensitiveData(configToSave);
      }
      
      // Ensure directory exists
      const configDir = path.dirname(targetPath);
      await this.ensureDirectoryExists(configDir);
      
      // Write configuration
      await fs.writeFile(targetPath, JSON.stringify(configToSave, null, 2), 'utf8');
      
      if (this.verbose) {
        console.log(`Configuration saved to: ${targetPath}`);
      }
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  /**
   * Create environment-specific configuration file
   * @param {string} environment Environment name
   * @param {object} config Environment configuration
   * @returns {Promise<void>}
   */
  async createEnvironmentConfig(environment, config) {
    const envConfigPath = path.join(this.environmentConfigDir, `${environment}.json`);
    await this.saveConfiguration(config, envConfigPath);
  }

  /**
   * Get configuration value by path (dot notation)
   * @param {object} config Configuration object
   * @param {string} path Configuration path (e.g., 'firebase.projectId')
   * @param {*} defaultValue Default value if path not found
   * @returns {*} Configuration value
   */
  getConfigValue(config, path, defaultValue = null) {
    const keys = path.split('.');
    let current = config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }

  /**
   * Set configuration value by path (dot notation)
   * @param {object} config Configuration object
   * @param {string} path Configuration path
   * @param {*} value Value to set
   * @returns {void}
   */
  setConfigValue(config, path, value) {
    const keys = path.split('.');
    let current = config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Encrypt sensitive configuration data
   * @param {object} config Configuration object (modified in place)
   * @returns {void}
   */
  encryptSensitiveData(config) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not provided');
    }
    
    const sensitiveFields = [
      'notifications.email.smtpConfig.password',
      'notifications.slack.webhookUrl',
      'security.apiKeys',
      'firebase.serviceAccountKey'
    ];
    
    for (const field of sensitiveFields) {
      const value = this.getConfigValue(config, field);
      if (value && typeof value === 'string') {
        const encrypted = this.encrypt(value);
        this.setConfigValue(config, field, encrypted);
      }
    }
  }

  /**
   * Decrypt sensitive configuration data
   * @param {object} config Configuration object (modified in place)
   * @returns {void}
   */
  decryptSensitiveData(config) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not provided');
    }
    
    const sensitiveFields = [
      'notifications.email.smtpConfig.password',
      'notifications.slack.webhookUrl',
      'security.apiKeys',
      'firebase.serviceAccountKey'
    ];
    
    for (const field of sensitiveFields) {
      const value = this.getConfigValue(config, field);
      if (value && typeof value === 'string' && value.startsWith('encrypted:')) {
        try {
          const decrypted = this.decrypt(value);
          this.setConfigValue(config, field, decrypted);
        } catch (error) {
          console.warn(`Failed to decrypt field ${field}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Encrypt a string value
   * @param {string} text Text to encrypt
   * @returns {string} Encrypted text with prefix
   */
  encrypt(text) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `encrypted:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt a string value
   * @param {string} encryptedText Encrypted text with prefix
   * @returns {string} Decrypted text
   */
  decrypt(encryptedText) {
    if (!encryptedText.startsWith('encrypted:')) {
      throw new Error('Invalid encrypted text format');
    }
    
    const parts = encryptedText.substring(10).split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    const algorithm = 'aes-256-gcm';
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Generate secure credentials for Firebase and Git
   * @returns {Promise<object>} Generated credentials info
   */
  async generateSecureCredentials() {
    const credentials = {
      generated: new Date().toISOString(),
      firebase: {},
      git: {},
      encryption: {}
    };
    
    // Generate encryption key if not provided
    if (!this.encryptionKey) {
      credentials.encryption.key = crypto.randomBytes(32).toString('hex');
      console.log('Generated new encryption key. Set CONFIG_ENCRYPTION_KEY environment variable.');
    }
    
    // Check Firebase credentials
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      credentials.firebase.serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      credentials.firebase.status = 'configured';
    } else {
      credentials.firebase.status = 'missing';
      credentials.firebase.instructions = 'Set GOOGLE_APPLICATION_CREDENTIALS environment variable';
    }
    
    // Check Git credentials
    try {
      const { execSync } = require('child_process');
      const gitUser = execSync('git config user.name', { encoding: 'utf8' }).trim();
      const gitEmail = execSync('git config user.email', { encoding: 'utf8' }).trim();
      
      credentials.git.user = gitUser;
      credentials.git.email = gitEmail;
      credentials.git.status = 'configured';
    } catch (error) {
      credentials.git.status = 'missing';
      credentials.git.instructions = 'Configure git user.name and user.email';
    }
    
    return credentials;
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
   * Get current environment
   * @returns {string} Current environment name
   */
  getCurrentEnvironment() {
    return this.environment;
  }

  /**
   * List available environment configurations
   * @returns {Promise<string[]>} Array of environment names
   */
  async listEnvironments() {
    try {
      const files = await fs.readdir(this.environmentConfigDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));
    } catch (error) {
      return [];
    }
  }
}

module.exports = ConfigManager;