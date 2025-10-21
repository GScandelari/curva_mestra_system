/**
 * Configuration Validator
 * Validates Firebase and application configuration on startup
 */

import logger, { LogCategory, ErrorType } from './logger.js';

// Required environment variables for different environments
const REQUIRED_CONFIG = {
  development: {
    firebase: [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID'
    ],
    app: [
      'VITE_API_BASE_URL',
      'VITE_APP_NAME'
    ]
  },
  production: {
    firebase: [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID'
    ],
    app: [
      'VITE_API_BASE_URL',
      'VITE_APP_NAME'
    ]
  }
};

// Configuration validation patterns
const VALIDATION_PATTERNS = {
  VITE_FIREBASE_API_KEY: /^AIza[0-9A-Za-z_-]{35}$/,
  VITE_FIREBASE_AUTH_DOMAIN: /^[a-z0-9-]+\.firebaseapp\.com$/,
  VITE_FIREBASE_PROJECT_ID: /^[a-z0-9-]+$/,
  VITE_FIREBASE_STORAGE_BUCKET: /^[a-z0-9-]+\.appspot\.com$/,
  VITE_FIREBASE_MESSAGING_SENDER_ID: /^\d+$/,
  VITE_FIREBASE_APP_ID: /^1:\d+:web:[a-f0-9]+$/,
  VITE_API_BASE_URL: /^https?:\/\/.+/
};

// Placeholder values that should not be used in production
const PLACEHOLDER_VALUES = [
  'your-api-key',
  'your-project-id',
  'your-domain',
  'localhost',
  'example.com',
  'test',
  'demo',
  'placeholder',
  'change-this',
  'AIzaSyBtNXznf7cvdzGCcBym84ux-SjJrrKaSJU', // Example API key from .env.example
  '123456789', // Example sender ID
  '1:123456789:web:abcdef123456' // Example app ID
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
    if (import.meta.env.PROD) {
      this.isValid = false;
    }
  }

  addRecommendation(message) {
    this.recommendations.push(message);
  }
}

/**
 * Main configuration validator class
 */
class ConfigValidator {
  constructor() {
    this.environment = import.meta.env.MODE || 'development';
    this.isProduction = import.meta.env.PROD;
    this.isDevelopment = import.meta.env.DEV;
  }

  /**
   * Validate all configuration
   */
  async validateConfiguration() {
    const result = new ConfigValidationResult();

    try {
      logger.info('Starting configuration validation', {
        category: LogCategory.SYSTEM,
        environment: this.environment,
        isProduction: this.isProduction
      });

      // Validate environment variables
      this.validateEnvironmentVariables(result);

      // Validate Firebase configuration
      await this.validateFirebaseConfig(result);

      // Validate application configuration
      this.validateAppConfig(result);

      // Security checks
      this.performSecurityChecks(result);

      // Log validation results
      this.logValidationResults(result);

      return result;
    } catch (error) {
      logger.error('Error during configuration validation', {
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
    
    // Check Firebase variables
    for (const key of requiredConfig.firebase) {
      const value = import.meta.env[key];
      
      if (!value) {
        result.addMissing(key);
        continue;
      }

      // Check for placeholder values
      if (this.isPlaceholderValue(value)) {
        result.addPlaceholder(key, value);
      }

      // Validate format
      if (VALIDATION_PATTERNS[key] && !VALIDATION_PATTERNS[key].test(value)) {
        result.addInvalidFormat(key, value);
      }
    }

    // Check application variables
    for (const key of requiredConfig.app) {
      const value = import.meta.env[key];
      
      if (!value) {
        result.addMissing(key);
        continue;
      }

      // Check for placeholder values
      if (this.isPlaceholderValue(value)) {
        result.addPlaceholder(key, value);
      }

      // Validate format
      if (VALIDATION_PATTERNS[key] && !VALIDATION_PATTERNS[key].test(value)) {
        result.addInvalidFormat(key, value);
      }
    }
  }

  /**
   * Validate Firebase configuration
   */
  async validateFirebaseConfig(result) {
    try {
      // Import Firebase config dynamically to avoid circular dependency
      const { auth, db, functions } = await import('../config/firebase.js');

      // Test Firebase Auth
      try {
        if (auth && auth.app) {
          result.addRecommendation('Firebase Auth initialized successfully');
        } else {
          result.addError('Firebase Auth not properly initialized', 'FIREBASE_AUTH');
        }
      } catch (authError) {
        result.addError(`Firebase Auth error: ${authError.message}`, 'FIREBASE_AUTH');
      }

      // Test Firestore
      try {
        if (db && db.app) {
          result.addRecommendation('Firestore initialized successfully');
        } else {
          result.addError('Firestore not properly initialized', 'FIRESTORE');
        }
      } catch (dbError) {
        result.addError(`Firestore error: ${dbError.message}`, 'FIRESTORE');
      }

      // Test Functions
      try {
        if (functions && functions.app) {
          result.addRecommendation('Firebase Functions initialized successfully');
        } else {
          result.addWarning('Firebase Functions not properly initialized', 'FIREBASE_FUNCTIONS');
        }
      } catch (functionsError) {
        result.addWarning(`Firebase Functions error: ${functionsError.message}`, 'FIREBASE_FUNCTIONS');
      }

    } catch (importError) {
      result.addError(`Failed to import Firebase config: ${importError.message}`, 'FIREBASE_IMPORT');
    }
  }

  /**
   * Validate application configuration
   */
  validateAppConfig(result) {
    // Validate API base URL
    const apiUrl = import.meta.env.VITE_API_BASE_URL;
    if (apiUrl) {
      try {
        new URL(apiUrl);
        
        // Check for localhost in production
        if (this.isProduction && apiUrl.includes('localhost')) {
          result.addError('API URL should not use localhost in production', 'VITE_API_BASE_URL');
        }
      } catch (urlError) {
        result.addError('Invalid API base URL format', 'VITE_API_BASE_URL');
      }
    }

    // Validate feature flags
    const enableNotifications = import.meta.env.VITE_ENABLE_NOTIFICATIONS;
    if (enableNotifications && !['true', 'false'].includes(enableNotifications.toLowerCase())) {
      result.addWarning('VITE_ENABLE_NOTIFICATIONS should be true or false', 'VITE_ENABLE_NOTIFICATIONS');
    }

    const enableAnalytics = import.meta.env.VITE_ENABLE_ANALYTICS;
    if (enableAnalytics && !['true', 'false'].includes(enableAnalytics.toLowerCase())) {
      result.addWarning('VITE_ENABLE_ANALYTICS should be true or false', 'VITE_ENABLE_ANALYTICS');
    }

    // Validate numeric configurations
    const itemsPerPage = import.meta.env.VITE_ITEMS_PER_PAGE;
    if (itemsPerPage && (isNaN(itemsPerPage) || parseInt(itemsPerPage) <= 0)) {
      result.addWarning('VITE_ITEMS_PER_PAGE should be a positive number', 'VITE_ITEMS_PER_PAGE');
    }

    const expirationWarningDays = import.meta.env.VITE_EXPIRATION_WARNING_DAYS;
    if (expirationWarningDays && (isNaN(expirationWarningDays) || parseInt(expirationWarningDays) <= 0)) {
      result.addWarning('VITE_EXPIRATION_WARNING_DAYS should be a positive number', 'VITE_EXPIRATION_WARNING_DAYS');
    }
  }

  /**
   * Perform security checks
   */
  performSecurityChecks(result) {
    // Check for development settings in production
    if (this.isProduction) {
      // Check for emulator configuration in production
      if (import.meta.env.REACT_APP_FIREBASE_AUTH_EMULATOR_HOST) {
        result.addError('Firebase Auth emulator should not be configured in production', 'SECURITY');
      }
      
      if (import.meta.env.REACT_APP_FIREBASE_FIRESTORE_EMULATOR_HOST) {
        result.addError('Firestore emulator should not be configured in production', 'SECURITY');
      }

      // Check for debug flags
      if (import.meta.env.VITE_DEBUG === 'true') {
        result.addWarning('Debug mode should be disabled in production', 'SECURITY');
      }
    }

    // Check for secure protocols
    const apiUrl = import.meta.env.VITE_API_BASE_URL;
    if (apiUrl && this.isProduction && !apiUrl.startsWith('https://')) {
      result.addError('API URL should use HTTPS in production', 'SECURITY');
    }

    // Check Firebase Auth domain
    const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
    if (authDomain && !authDomain.endsWith('.firebaseapp.com')) {
      result.addWarning('Firebase Auth domain should end with .firebaseapp.com', 'SECURITY');
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
      logger.info('Configuration validation passed', {
        category: LogCategory.SYSTEM,
        warnings: result.warnings.length,
        recommendations: result.recommendations.length
      });
    } else {
      logger.error('Configuration validation failed', {
        category: LogCategory.SYSTEM,
        errorType: ErrorType.CONFIGURATION,
        errors: result.errors.length,
        missingRequired: result.missingRequired.length,
        invalidFormat: result.invalidFormat.length,
        placeholderValues: result.placeholderValues.length
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
        key: invalid.key,
        value: invalid.value
      });
    });

    result.placeholderValues.forEach(placeholder => {
      const logLevel = this.isProduction ? 'error' : 'warn';
      logger[logLevel](`Placeholder value detected: ${placeholder.key}`, {
        category: LogCategory.SYSTEM,
        errorType: ErrorType.CONFIGURATION,
        key: placeholder.key,
        value: placeholder.value
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
      firebase: {
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        hasApiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
        hasStorageBucket: !!import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        hasMessagingSenderId: !!import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        hasAppId: !!import.meta.env.VITE_FIREBASE_APP_ID
      },
      app: {
        name: import.meta.env.VITE_APP_NAME,
        apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
        enableNotifications: import.meta.env.VITE_ENABLE_NOTIFICATIONS,
        enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS,
        itemsPerPage: import.meta.env.VITE_ITEMS_PER_PAGE,
        expirationWarningDays: import.meta.env.VITE_EXPIRATION_WARNING_DAYS
      },
      emulators: {
        auth: import.meta.env.REACT_APP_FIREBASE_AUTH_EMULATOR_HOST,
        firestore: import.meta.env.REACT_APP_FIREBASE_FIRESTORE_EMULATOR_HOST,
        functions: import.meta.env.REACT_APP_FIREBASE_FUNCTIONS_EMULATOR_HOST
      }
    };

    logger.debug('Configuration summary', {
      category: LogCategory.SYSTEM,
      summary
    });

    return summary;
  }
}

// Create singleton instance
const configValidator = new ConfigValidator();

export default configValidator;
export { ConfigValidator, ConfigValidationResult };