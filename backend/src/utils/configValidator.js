/**
 * Backend Configuration Validator
 * Validates Firebase and application configuration on startup
 */

const logger = require('./logger');
const { LogCategory, ErrorType } = require('./logger');
const fs = require('fs');
const path = require('path');

// Required environment variables for different environments
const REQUIRED_CONFIG = {
  development: {
    server: ['PORT', 'NODE_ENV'],
    database: ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'],
    firebase: ['FIREBASE_PROJECT_ID'],
    security: ['JWT_SECRET']
  },
  production: {
    server: ['PORT', 'NODE_ENV'],
    database: ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'],
    firebase: ['FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT_PATH'],
    security: ['JWT_SECRET'],
    email: ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASSWORD']
  }
};

// Configuration validation patterns
const VALIDATION_PATTERNS = {
  PORT: /^\d{4,5}$/,
  NODE_ENV: /^(development|production|test)$/,
  DB_PORT: /^\d{4,5}$/,
  FIREBASE_PROJECT_ID: /^[a-z0-9-]+$/,
  EMAIL_PORT: /^\d{2,4}$/,
  BCRYPT_ROUNDS: /^\d{1,2}$/,
  MAX_LOGIN_ATTEMPTS: /^\d+$/,
  LOCKOUT_TIME: /^\d+$/,
  MAX_FILE_SIZE: /^\d+$/
};

// Placeholder values that should not be used in production
const PLACEHOLDER_VALUES = [
  'your-super-secret-jwt-key-change-this-in-production',
  'password',
  'your-email@gmail.com',
  'your-app-password',
  'change-this',
  'placeholder',
  'example',
  'test',
  'demo'
];

/**
 * Configuration validation result
 */
class ConfigValidationResult {
  constructor() {
    this.isValid = true;
    this.errors = [];
    this.warnings = [];
    this.missingRequired = [];
    this.invalidFormat = [];
    this.placeholderValues = [];
    this.recommendations = [];
    this.securityIssues = [];
  }

  addError(message, key = null) {
    this.isValid = false;
    this.errors.push({ message, key });
  }

  addWarning(message, key = null) {
    this.warnings.push({ message, key });
  }

  addMissing(key) {
    this.isValid = false;
    this.missingRequired.push(key);
  }

  addInvalidFormat(key, value) {
    this.isValid = false;
    this.invalidFormat.push({ key, value });
  }

  addPlaceholder(key, value) {
    this.placeholderValues.push({ key, value });
    if (process.env.NODE_ENV === 'production') {
      this.isValid = false;
    }
  }

  addRecommendation(message) {
    this.recommendations.push(message);
  }

  addSecurityIssue(message, key = null) {
    this.securityIssues.push({ message, key });
    if (process.env.NODE_ENV === 'production') {
      this.isValid = false;
    }
  }
}

/**
 * Main configuration validator class
 */
class ConfigValidator {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.isProduction = this.environment === 'production';
    this.isDevelopment = this.environment === 'development';
  }

  /**
   * Validate all configuration
   */
  async validateConfiguration() {
    const result = new ConfigValidationResult();

    try {
      logger.info('Starting backend configuration validation', {
        category: LogCategory.SYSTEM,
        environment: this.environment,
        isProduction: this.isProduction
      });

      // Validate environment variables
      this.validateEnvironmentVariables(result);

      // Validate Firebase configuration
      await this.validateFirebaseConfig(result);

      // Validate database configuration
      this.validateDatabaseConfig(result);

      // Validate security configuration
      this.validateSecurityConfig(result);

      // Validate file system permissions
      this.validateFileSystemConfig(result);

      // Security checks
      this.performSecurityChecks(result);

      // Log validation results
      this.logValidationResults(result);

      return result;
    } catch (error) {
      logger.error('Error during backend configuration validation', {
        category: LogCategory.SYSTEM,
        errorType: ErrorType.CONFIGURATION,
        error: error.message,
        stack: error.stack
      });

      result.addError('Configuration validation failed', 'VALIDATION_ERROR');
      return result;
    }
  }

  /**
   * Validate environment variables
   */
  validateEnvironmentVariables(result) {
    const requiredConfig = REQUIRED_CONFIG[this.environment] || REQUIRED_CONFIG.development;
    
    // Check all required categories
    Object.entries(requiredConfig).forEach(([category, keys]) => {
      keys.forEach(key => {
        const value = process.env[key];
        
        if (!value) {
          result.addMissing(key);
          return;
        }

        // Check for placeholder values
        if (this.isPlaceholderValue(value)) {
          result.addPlaceholder(key, value);
        }

        // Validate format
        if (VALIDATION_PATTERNS[key] && !VALIDATION_PATTERNS[key].test(value)) {
          result.addInvalidFormat(key, value);
        }
      });
    });

    // Check optional but recommended variables
    const optionalKeys = ['LOG_LEVEL', 'LOG_FILE', 'BCRYPT_ROUNDS', 'MAX_LOGIN_ATTEMPTS'];
    optionalKeys.forEach(key => {
      const value = process.env[key];
      if (value && VALIDATION_PATTERNS[key] && !VALIDATION_PATTERNS[key].test(value)) {
        result.addInvalidFormat(key, value);
      }
    });
  }

  /**
   * Validate Firebase configuration
   */
  async validateFirebaseConfig(result) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (!projectId) {
      result.addError('Firebase project ID is required', 'FIREBASE_PROJECT_ID');
      return;
    }

    // In production, we need either service account file or key
    if (this.isProduction) {
      if (!serviceAccountPath && !serviceAccountKey) {
        result.addError('Firebase service account configuration is required in production', 'FIREBASE_SERVICE_ACCOUNT');
        return;
      }

      // Validate service account file if path is provided
      if (serviceAccountPath) {
        try {
          const fullPath = path.resolve(serviceAccountPath);
          if (!fs.existsSync(fullPath)) {
            result.addError(`Firebase service account file not found: ${fullPath}`, 'FIREBASE_SERVICE_ACCOUNT_PATH');
          } else {
            // Try to parse the service account file
            try {
              const serviceAccount = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
              
              if (!serviceAccount.project_id || serviceAccount.project_id !== projectId) {
                result.addError('Service account project ID does not match FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT');
              }

              if (!serviceAccount.private_key || !serviceAccount.client_email) {
                result.addError('Invalid service account file format', 'FIREBASE_SERVICE_ACCOUNT');
              }

              result.addRecommendation('Firebase service account file validated successfully');
            } catch (parseError) {
              result.addError(`Invalid service account file format: ${parseError.message}`, 'FIREBASE_SERVICE_ACCOUNT');
            }
          }
        } catch (error) {
          result.addError(`Error validating service account file: ${error.message}`, 'FIREBASE_SERVICE_ACCOUNT');
        }
      }

      // Validate service account key if provided
      if (serviceAccountKey) {
        try {
          const serviceAccount = JSON.parse(serviceAccountKey);
          
          if (!serviceAccount.project_id || serviceAccount.project_id !== projectId) {
            result.addError('Service account project ID does not match FIREBASE_PROJECT_ID', 'FIREBASE_SERVICE_ACCOUNT_KEY');
          }

          if (!serviceAccount.private_key || !serviceAccount.client_email) {
            result.addError('Invalid service account key format', 'FIREBASE_SERVICE_ACCOUNT_KEY');
          }

          result.addRecommendation('Firebase service account key validated successfully');
        } catch (parseError) {
          result.addError(`Invalid service account key format: ${parseError.message}`, 'FIREBASE_SERVICE_ACCOUNT_KEY');
        }
      }
    }

    // Check emulator configuration in development
    if (this.isDevelopment) {
      const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
      if (authEmulatorHost) {
        result.addRecommendation(`Firebase Auth emulator configured: ${authEmulatorHost}`);
      }
    }
  }

  /**
   * Validate database configuration
   */
  validateDatabaseConfig(result) {
    const dbHost = process.env.DB_HOST;
    const dbPort = process.env.DB_PORT;
    const dbName = process.env.DB_NAME;
    const dbUser = process.env.DB_USER;
    const dbPassword = process.env.DB_PASSWORD;

    // Check for localhost in production
    if (this.isProduction && dbHost === 'localhost') {
      result.addWarning('Database host should not be localhost in production', 'DB_HOST');
    }

    // Check for default/weak passwords
    if (dbPassword && ['password', 'admin', '123456', 'postgres'].includes(dbPassword.toLowerCase())) {
      result.addSecurityIssue('Database password appears to be weak or default', 'DB_PASSWORD');
    }

    // Validate port range
    if (dbPort) {
      const port = parseInt(dbPort);
      if (port < 1024 || port > 65535) {
        result.addWarning('Database port should be between 1024 and 65535', 'DB_PORT');
      }
    }
  }

  /**
   * Validate security configuration
   */
  validateSecurityConfig(result) {
    const jwtSecret = process.env.JWT_SECRET;
    const bcryptRounds = process.env.BCRYPT_ROUNDS;
    const maxLoginAttempts = process.env.MAX_LOGIN_ATTEMPTS;
    const lockoutTime = process.env.LOCKOUT_TIME;

    // Validate JWT secret
    if (jwtSecret) {
      if (jwtSecret.length < 32) {
        result.addSecurityIssue('JWT secret should be at least 32 characters long', 'JWT_SECRET');
      }

      if (this.isPlaceholderValue(jwtSecret)) {
        result.addSecurityIssue('JWT secret appears to be a placeholder value', 'JWT_SECRET');
      }
    }

    // Validate bcrypt rounds
    if (bcryptRounds) {
      const rounds = parseInt(bcryptRounds);
      if (rounds < 10) {
        result.addSecurityIssue('Bcrypt rounds should be at least 10 for security', 'BCRYPT_ROUNDS');
      } else if (rounds > 15) {
        result.addWarning('Bcrypt rounds above 15 may impact performance', 'BCRYPT_ROUNDS');
      }
    }

    // Validate login attempt limits
    if (maxLoginAttempts) {
      const attempts = parseInt(maxLoginAttempts);
      if (attempts > 10) {
        result.addWarning('Max login attempts seems high, consider lowering for security', 'MAX_LOGIN_ATTEMPTS');
      }
    }

    if (lockoutTime) {
      const time = parseInt(lockoutTime);
      if (time < 5) {
        result.addWarning('Lockout time seems short, consider increasing for security', 'LOCKOUT_TIME');
      }
    }
  }

  /**
   * Validate file system configuration
   */
  validateFileSystemConfig(result) {
    const uploadPath = process.env.UPLOAD_PATH || 'uploads/';
    const logFile = process.env.LOG_FILE;

    // Check upload directory
    try {
      const uploadDir = path.resolve(uploadPath);
      if (!fs.existsSync(uploadDir)) {
        try {
          fs.mkdirSync(uploadDir, { recursive: true });
          result.addRecommendation(`Created upload directory: ${uploadDir}`);
        } catch (createError) {
          result.addError(`Cannot create upload directory: ${createError.message}`, 'UPLOAD_PATH');
        }
      } else {
        // Check write permissions
        try {
          fs.accessSync(uploadDir, fs.constants.W_OK);
          result.addRecommendation('Upload directory is writable');
        } catch (accessError) {
          result.addError('Upload directory is not writable', 'UPLOAD_PATH');
        }
      }
    } catch (error) {
      result.addError(`Error validating upload directory: ${error.message}`, 'UPLOAD_PATH');
    }

    // Check log file directory
    if (logFile) {
      try {
        const logDir = path.dirname(path.resolve(logFile));
        if (!fs.existsSync(logDir)) {
          try {
            fs.mkdirSync(logDir, { recursive: true });
            result.addRecommendation(`Created log directory: ${logDir}`);
          } catch (createError) {
            result.addError(`Cannot create log directory: ${createError.message}`, 'LOG_FILE');
          }
        }
      } catch (error) {
        result.addError(`Error validating log directory: ${error.message}`, 'LOG_FILE');
      }
    }
  }

  /**
   * Perform security checks
   */
  performSecurityChecks(result) {
    // Check for development settings in production
    if (this.isProduction) {
      // Check for emulator configuration in production
      if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
        result.addSecurityIssue('Firebase Auth emulator should not be configured in production', 'SECURITY');
      }

      // Check for debug settings
      if (process.env.DEBUG === 'true' || process.env.LOG_LEVEL === 'debug') {
        result.addWarning('Debug logging should be disabled in production', 'SECURITY');
      }

      // Check for development database
      if (process.env.DB_NAME && process.env.DB_NAME.includes('test')) {
        result.addWarning('Database name suggests test/development database in production', 'SECURITY');
      }
    }

    // Check for insecure configurations
    const port = process.env.PORT;
    if (port && parseInt(port) < 1024 && process.getuid && process.getuid() !== 0) {
      result.addWarning('Running on privileged port without root privileges may fail', 'PORT');
    }

    // Check email configuration security
    if (process.env.EMAIL_PASSWORD && process.env.EMAIL_PASSWORD.length < 8) {
      result.addSecurityIssue('Email password appears to be weak', 'EMAIL_PASSWORD');
    }
  }

  /**
   * Check if value is a placeholder
   */
  isPlaceholderValue(value) {
    if (!value || typeof value !== 'string') return false;
    
    const lowerValue = value.toLowerCase();
    return PLACEHOLDER_VALUES.some(placeholder => 
      lowerValue.includes(placeholder.toLowerCase())
    );
  }

  /**
   * Log validation results
   */
  logValidationResults(result) {
    if (result.isValid) {
      logger.info('Backend configuration validation passed', {
        category: LogCategory.SYSTEM,
        warnings: result.warnings.length,
        recommendations: result.recommendations.length,
        securityIssues: result.securityIssues.length
      });
    } else {
      logger.error('Backend configuration validation failed', {
        category: LogCategory.SYSTEM,
        errorType: ErrorType.CONFIGURATION,
        errors: result.errors.length,
        missingRequired: result.missingRequired.length,
        invalidFormat: result.invalidFormat.length,
        placeholderValues: result.placeholderValues.length,
        securityIssues: result.securityIssues.length
      });
    }

    // Log specific issues
    result.errors.forEach(error => {
      logger.error(`Config Error: ${error.message}`, {
        category: LogCategory.SYSTEM,
        errorType: ErrorType.CONFIGURATION,
        key: error.key
      });
    });

    result.warnings.forEach(warning => {
      logger.warn(`Config Warning: ${warning.message}`, {
        category: LogCategory.SYSTEM,
        key: warning.key
      });
    });

    result.securityIssues.forEach(issue => {
      const logLevel = this.isProduction ? 'error' : 'warn';
      logger[logLevel](`Security Issue: ${issue.message}`, {
        category: LogCategory.SECURITY,
        errorType: ErrorType.CONFIGURATION,
        key: issue.key
      });
    });

    result.missingRequired.forEach(key => {
      logger.error(`Missing required configuration: ${key}`, {
        category: LogCategory.SYSTEM,
        errorType: ErrorType.CONFIGURATION,
        key
      });
    });

    result.invalidFormat.forEach(invalid => {
      logger.error(`Invalid configuration format: ${invalid.key}`, {
        category: LogCategory.SYSTEM,
        errorType: ErrorType.CONFIGURATION,
        key: invalid.key
      });
    });

    result.placeholderValues.forEach(placeholder => {
      const logLevel = this.isProduction ? 'error' : 'warn';
      logger[logLevel](`Placeholder value detected: ${placeholder.key}`, {
        category: LogCategory.SYSTEM,
        errorType: ErrorType.CONFIGURATION,
        key: placeholder.key
      });
    });
  }

  /**
   * Get configuration summary for debugging
   */
  getConfigSummary() {
    const summary = {
      environment: this.environment,
      isProduction: this.isProduction,
      server: {
        port: process.env.PORT,
        nodeEnv: process.env.NODE_ENV
      },
      database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        name: process.env.DB_NAME,
        user: process.env.DB_USER,
        hasPassword: !!process.env.DB_PASSWORD
      },
      firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        hasServiceAccountPath: !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
        hasServiceAccountKey: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
        authEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST
      },
      security: {
        hasJwtSecret: !!process.env.JWT_SECRET,
        bcryptRounds: process.env.BCRYPT_ROUNDS,
        maxLoginAttempts: process.env.MAX_LOGIN_ATTEMPTS,
        lockoutTime: process.env.LOCKOUT_TIME
      },
      email: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USER,
        hasPassword: !!process.env.EMAIL_PASSWORD
      },
      logging: {
        level: process.env.LOG_LEVEL,
        file: process.env.LOG_FILE
      }
    };

    logger.debug('Backend configuration summary', {
      category: LogCategory.SYSTEM,
      summary
    });

    return summary;
  }
}

// Create singleton instance
const configValidator = new ConfigValidator();

module.exports = configValidator;
module.exports.ConfigValidator = ConfigValidator;
module.exports.ConfigValidationResult = ConfigValidationResult;