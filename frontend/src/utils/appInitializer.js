/**
 * Application Initializer
 * Handles application startup validation and initialization
 */

import logger, { LogCategory, ErrorType } from './logger.js';
import configValidator from './configValidator.js';

/**
 * Application initialization result
 */
class InitializationResult {
  constructor() {
    this.success = true;
    this.errors = [];
    this.warnings = [];
    this.configValidation = null;
    this.startupTime = null;
  }

  addError(message, category = 'GENERAL') {
    this.success = false;
    this.errors.push({ message, category });
  }

  addWarning(message, category = 'GENERAL') {
    this.warnings.push({ message, category });
  }
}

/**
 * Main application initializer class
 */
class AppInitializer {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    // Prevent multiple initialization attempts
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  /**
   * Perform the actual initialization
   */
  async _performInitialization() {
    const startTime = Date.now();
    const result = new InitializationResult();

    try {
      logger.info('Starting application initialization', {
        category: LogCategory.SYSTEM,
        timestamp: new Date().toISOString()
      });

      // Step 1: Validate configuration
      await this._validateConfiguration(result);

      // Step 2: Initialize Firebase services
      await this._initializeFirebaseServices(result);

      // Step 3: Setup error handlers
      this._setupGlobalErrorHandlers(result);

      // Step 4: Initialize performance monitoring
      this._initializePerformanceMonitoring(result);

      // Step 5: Setup development tools
      if (import.meta.env.DEV) {
        this._setupDevelopmentTools(result);
      }

      const endTime = Date.now();
      result.startupTime = endTime - startTime;

      if (result.success) {
        this.initialized = true;
        logger.info('Application initialization completed successfully', {
          category: LogCategory.SYSTEM,
          startupTime: result.startupTime,
          warnings: result.warnings.length
        });
      } else {
        logger.error('Application initialization failed', {
          category: LogCategory.SYSTEM,
          errorType: ErrorType.SYSTEM,
          errors: result.errors.length,
          warnings: result.warnings.length,
          startupTime: result.startupTime
        });
      }

      return result;
    } catch (error) {
      const endTime = Date.now();
      result.startupTime = endTime - startTime;
      result.addError(`Initialization failed: ${error.message}`, 'INITIALIZATION');

      logger.critical('Critical error during application initialization', {
        category: LogCategory.SYSTEM,
        errorType: ErrorType.SYSTEM,
        error: error.message,
        stack: error.stack,
        startupTime: result.startupTime
      });

      return result;
    }
  }

  /**
   * Validate application configuration
   */
  async _validateConfiguration(result) {
    try {
      logger.debug('Validating application configuration', {
        category: LogCategory.SYSTEM
      });

      const configResult = await configValidator.validateConfiguration();
      result.configValidation = configResult;

      if (!configResult.isValid) {
        result.addError('Configuration validation failed', 'CONFIGURATION');
        
        // Add specific configuration errors
        configResult.errors.forEach(error => {
          result.addError(`Config: ${error.message}`, 'CONFIGURATION');
        });

        configResult.missingRequired.forEach(key => {
          result.addError(`Missing required config: ${key}`, 'CONFIGURATION');
        });

        configResult.invalidFormat.forEach(invalid => {
          result.addError(`Invalid config format: ${invalid.key}`, 'CONFIGURATION');
        });
      }

      // Add warnings
      configResult.warnings.forEach(warning => {
        result.addWarning(`Config: ${warning.message}`, 'CONFIGURATION');
      });

      configResult.placeholderValues.forEach(placeholder => {
        const message = `Placeholder value detected: ${placeholder.key}`;
        if (import.meta.env.PROD) {
          result.addError(message, 'CONFIGURATION');
        } else {
          result.addWarning(message, 'CONFIGURATION');
        }
      });

    } catch (error) {
      result.addError(`Configuration validation error: ${error.message}`, 'CONFIGURATION');
      logger.error('Error during configuration validation', {
        category: LogCategory.SYSTEM,
        errorType: ErrorType.CONFIGURATION,
        error: error.message
      });
    }
  }

  /**
   * Initialize Firebase services
   */
  async _initializeFirebaseServices(result) {
    try {
      logger.debug('Initializing Firebase services', {
        category: LogCategory.SYSTEM
      });

      // Import Firebase services to trigger initialization
      const { auth, db, functions } = await import('../config/firebase.js');

      // Test Firebase Auth
      if (!auth || !auth.app) {
        result.addError('Firebase Auth initialization failed', 'FIREBASE');
      } else {
        logger.debug('Firebase Auth initialized successfully', {
          category: LogCategory.SYSTEM
        });
      }

      // Test Firestore
      if (!db || !db.app) {
        result.addError('Firestore initialization failed', 'FIREBASE');
      } else {
        logger.debug('Firestore initialized successfully', {
          category: LogCategory.SYSTEM
        });
      }

      // Test Functions (optional)
      if (!functions || !functions.app) {
        result.addWarning('Firebase Functions initialization failed', 'FIREBASE');
      } else {
        logger.debug('Firebase Functions initialized successfully', {
          category: LogCategory.SYSTEM
        });
      }

    } catch (error) {
      result.addError(`Firebase initialization error: ${error.message}`, 'FIREBASE');
      logger.error('Error during Firebase initialization', {
        category: LogCategory.SYSTEM,
        errorType: ErrorType.SYSTEM,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Setup global error handlers
   */
  _setupGlobalErrorHandlers(result) {
    try {
      logger.debug('Setting up global error handlers', {
        category: LogCategory.SYSTEM
      });

      // These are already set up in the logger, but we can add additional handlers here
      
      // Setup React error boundary fallback
      window.addEventListener('error', (event) => {
        logger.error('Global JavaScript error caught', {
          category: LogCategory.ERROR,
          errorType: ErrorType.SYSTEM,
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        });
      });

      // Setup unhandled promise rejection handler
      window.addEventListener('unhandledrejection', (event) => {
        logger.error('Unhandled promise rejection caught', {
          category: LogCategory.ERROR,
          errorType: ErrorType.SYSTEM,
          reason: event.reason?.toString(),
          stack: event.reason?.stack
        });
      });

      logger.debug('Global error handlers set up successfully', {
        category: LogCategory.SYSTEM
      });

    } catch (error) {
      result.addWarning(`Error handler setup failed: ${error.message}`, 'ERROR_HANDLING');
      logger.warn('Error setting up global error handlers', {
        category: LogCategory.SYSTEM,
        error: error.message
      });
    }
  }

  /**
   * Initialize performance monitoring
   */
  _initializePerformanceMonitoring(result) {
    try {
      logger.debug('Initializing performance monitoring', {
        category: LogCategory.PERFORMANCE
      });

      // Initialize performance service if available
      import('../services/performanceService.js')
        .then(({ default: performanceService }) => {
          if (performanceService && performanceService.isEnabled) {
            logger.info('Performance monitoring initialized', {
              category: LogCategory.PERFORMANCE
            });
          } else {
            logger.debug('Performance monitoring not available', {
              category: LogCategory.PERFORMANCE
            });
          }
        })
        .catch(error => {
          logger.warn('Performance monitoring initialization failed', {
            category: LogCategory.PERFORMANCE,
            error: error.message
          });
        });

    } catch (error) {
      result.addWarning(`Performance monitoring setup failed: ${error.message}`, 'PERFORMANCE');
      logger.warn('Error initializing performance monitoring', {
        category: LogCategory.PERFORMANCE,
        error: error.message
      });
    }
  }

  /**
   * Setup development tools
   */
  _setupDevelopmentTools(result) {
    try {
      logger.debug('Setting up development tools', {
        category: LogCategory.SYSTEM
      });

      // Add development utilities to window object
      window.devTools = {
        logger,
        configValidator,
        clearLogs: () => logger.clearLogs(),
        exportLogs: () => logger.exportLogs(),
        getConfigSummary: () => configValidator.getConfigSummary(),
        validateConfig: () => configValidator.validateConfiguration()
      };

      // Add helpful console messages
      console.log('%c🚀 Curva Mestra System - Development Mode', 'color: #2196F3; font-size: 16px; font-weight: bold;');
      console.log('%cDevelopment tools available at window.devTools', 'color: #4CAF50; font-size: 12px;');
      console.log('%cUse window.devTools.exportLogs() to export error logs', 'color: #FF9800; font-size: 12px;');

      logger.debug('Development tools set up successfully', {
        category: LogCategory.SYSTEM
      });

    } catch (error) {
      result.addWarning(`Development tools setup failed: ${error.message}`, 'DEVELOPMENT');
      logger.warn('Error setting up development tools', {
        category: LogCategory.SYSTEM,
        error: error.message
      });
    }
  }

  /**
   * Check if application is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get initialization status
   */
  getInitializationStatus() {
    return {
      initialized: this.initialized,
      hasInitializationPromise: !!this.initializationPromise
    };
  }

  /**
   * Force re-initialization (for testing or recovery)
   */
  async reinitialize() {
    logger.info('Forcing application re-initialization', {
      category: LogCategory.SYSTEM
    });

    this.initialized = false;
    this.initializationPromise = null;
    
    return this.initialize();
  }
}

// Create singleton instance
const appInitializer = new AppInitializer();

export default appInitializer;
export { AppInitializer, InitializationResult };