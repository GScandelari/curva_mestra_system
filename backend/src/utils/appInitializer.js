/**
 * Backend Application Initializer
 * Handles backend startup validation and initialization
 */

const logger = require('./logger');
const { LogCategory, ErrorType } = require('./logger');
const configValidator = require('./configValidator');

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
 * Main backend application initializer class
 */
class AppInitializer {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize the backend application
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
      logger.info('Starting backend application initialization', {
        category: LogCategory.SYSTEM,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform
      });

      // Step 1: Validate configuration
      await this._validateConfiguration(result);

      // Step 2: Initialize Firebase Admin SDK
      await this._initializeFirebaseAdmin(result);

      // Step 3: Test database connection
      await this._testDatabaseConnection(result);

      // Step 4: Setup process handlers
      this._setupProcessHandlers(result);

      // Step 5: Initialize middleware and services
      await this._initializeServices(result);

      const endTime = Date.now();
      result.startupTime = endTime - startTime;

      if (result.success) {
        this.initialized = true;
        logger.info('Backend application initialization completed successfully', {
          category: LogCategory.SYSTEM,
          startupTime: result.startupTime,
          warnings: result.warnings.length
        });
      } else {
        logger.error('Backend application initialization failed', {
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

      logger.critical('Critical error during backend initialization', {
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
      logger.debug('Validating backend configuration', {
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

      configResult.securityIssues.forEach(issue => {
        const message = `Security: ${issue.message}`;
        if (process.env.NODE_ENV === 'production') {
          result.addError(message, 'SECURITY');
        } else {
          result.addWarning(message, 'SECURITY');
        }
      });

      configResult.placeholderValues.forEach(placeholder => {
        const message = `Placeholder value detected: ${placeholder.key}`;
        if (process.env.NODE_ENV === 'production') {
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
   * Initialize Firebase Admin SDK
   */
  async _initializeFirebaseAdmin(result) {
    try {
      logger.debug('Initializing Firebase Admin SDK', {
        category: LogCategory.SYSTEM
      });

      const admin = require('firebase-admin');
      const projectId = process.env.FIREBASE_PROJECT_ID;

      if (!projectId) {
        result.addError('Firebase project ID not configured', 'FIREBASE');
        return;
      }

      // Check if already initialized
      if (admin.apps.length > 0) {
        logger.debug('Firebase Admin SDK already initialized', {
          category: LogCategory.SYSTEM
        });
        return;
      }

      let serviceAccount = null;

      // Try to load service account from file first
      if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        try {
          const fs = require('fs');
          const path = require('path');
          const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
          serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
          
          logger.debug('Loaded Firebase service account from file', {
            category: LogCategory.SYSTEM,
            path: serviceAccountPath
          });
        } catch (fileError) {
          logger.warn('Failed to load service account from file', {
            category: LogCategory.SYSTEM,
            error: fileError.message,
            path: process.env.FIREBASE_SERVICE_ACCOUNT_PATH
          });
        }
      }

      // Try to load service account from environment variable
      if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          
          logger.debug('Loaded Firebase service account from environment variable', {
            category: LogCategory.SYSTEM
          });
        } catch (parseError) {
          logger.warn('Failed to parse service account from environment variable', {
            category: LogCategory.SYSTEM,
            error: parseError.message
          });
        }
      }

      // Initialize Firebase Admin
      if (serviceAccount) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: projectId
        });

        logger.info('Firebase Admin SDK initialized with service account', {
          category: LogCategory.SYSTEM,
          projectId: serviceAccount.project_id
        });
      } else if (process.env.NODE_ENV === 'development') {
        // In development, try to use default credentials or emulator
        try {
          admin.initializeApp({
            projectId: projectId
          });

          logger.info('Firebase Admin SDK initialized with default credentials', {
            category: LogCategory.SYSTEM,
            projectId: projectId
          });
        } catch (defaultError) {
          result.addWarning(`Firebase Admin initialization with default credentials failed: ${defaultError.message}`, 'FIREBASE');
        }
      } else {
        result.addError('Firebase service account not configured for production', 'FIREBASE');
        return;
      }

      // Test Firebase Admin functionality
      try {
        const auth = admin.auth();
        await auth.listUsers(1); // Test with minimal query
        
        logger.debug('Firebase Admin Auth test successful', {
          category: LogCategory.SYSTEM
        });
      } catch (testError) {
        if (testError.code === 'auth/insufficient-permission') {
          result.addWarning('Firebase Admin has limited permissions', 'FIREBASE');
        } else {
          result.addError(`Firebase Admin test failed: ${testError.message}`, 'FIREBASE');
        }
      }

    } catch (error) {
      result.addError(`Firebase Admin initialization error: ${error.message}`, 'FIREBASE');
      logger.error('Error during Firebase Admin initialization', {
        category: LogCategory.SYSTEM,
        errorType: ErrorType.SYSTEM,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Test database connection
   */
  async _testDatabaseConnection(result) {
    try {
      logger.debug('Testing database connection', {
        category: LogCategory.DATABASE
      });

      // Try to import and test database connection
      try {
        const { sequelize } = require('../config/database');
        
        await sequelize.authenticate();
        
        logger.info('Database connection test successful', {
          category: LogCategory.DATABASE,
          host: process.env.DB_HOST,
          database: process.env.DB_NAME
        });

        // Test basic query
        const [results] = await sequelize.query('SELECT 1 as test');
        if (results && results.length > 0) {
          logger.debug('Database query test successful', {
            category: LogCategory.DATABASE
          });
        }

      } catch (dbError) {
        result.addError(`Database connection failed: ${dbError.message}`, 'DATABASE');
        logger.error('Database connection test failed', {
          category: LogCategory.DATABASE,
          errorType: ErrorType.DATABASE,
          error: dbError.message,
          host: process.env.DB_HOST,
          database: process.env.DB_NAME
        });
      }

    } catch (error) {
      result.addError(`Database test error: ${error.message}`, 'DATABASE');
      logger.error('Error during database testing', {
        category: LogCategory.DATABASE,
        errorType: ErrorType.DATABASE,
        error: error.message
      });
    }
  }

  /**
   * Setup process handlers
   */
  _setupProcessHandlers(result) {
    try {
      logger.debug('Setting up process handlers', {
        category: LogCategory.SYSTEM
      });

      // Graceful shutdown handler
      const gracefulShutdown = (signal) => {
        logger.info(`Received ${signal}, starting graceful shutdown`, {
          category: LogCategory.SYSTEM,
          signal
        });

        // Give processes time to finish
        setTimeout(() => {
          logger.info('Graceful shutdown completed', {
            category: LogCategory.SYSTEM
          });
          process.exit(0);
        }, 5000);
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

      // Memory usage monitoring
      if (process.env.NODE_ENV === 'development') {
        setInterval(() => {
          const memUsage = process.memoryUsage();
          const memUsageMB = {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
          };

          if (memUsageMB.heapUsed > 100) { // Log if heap usage > 100MB
            logger.debug('Memory usage check', {
              category: LogCategory.PERFORMANCE,
              memoryUsage: memUsageMB
            });
          }
        }, 60000); // Check every minute
      }

      logger.debug('Process handlers set up successfully', {
        category: LogCategory.SYSTEM
      });

    } catch (error) {
      result.addWarning(`Process handlers setup failed: ${error.message}`, 'PROCESS');
      logger.warn('Error setting up process handlers', {
        category: LogCategory.SYSTEM,
        error: error.message
      });
    }
  }

  /**
   * Initialize services and middleware
   */
  async _initializeServices(result) {
    try {
      logger.debug('Initializing services and middleware', {
        category: LogCategory.SYSTEM
      });

      // Initialize email service
      try {
        const emailService = require('../services/emailService');
        if (emailService.isConfigured) {
          logger.debug('Email service initialized successfully', {
            category: LogCategory.SYSTEM
          });
        } else {
          result.addWarning('Email service not configured', 'EMAIL');
        }
      } catch (emailError) {
        result.addWarning(`Email service initialization failed: ${emailError.message}`, 'EMAIL');
      }

      // Initialize notification service
      try {
        const notificationService = require('../services/notificationService');
        logger.debug('Notification service initialized successfully', {
          category: LogCategory.SYSTEM
        });
      } catch (notificationError) {
        result.addWarning(`Notification service initialization failed: ${notificationError.message}`, 'NOTIFICATION');
      }

      // Initialize audit service
      try {
        const auditService = require('../services/auditService');
        logger.debug('Audit service initialized successfully', {
          category: LogCategory.SYSTEM
        });
      } catch (auditError) {
        result.addWarning(`Audit service initialization failed: ${auditError.message}`, 'AUDIT');
      }

      logger.debug('Services and middleware initialized successfully', {
        category: LogCategory.SYSTEM
      });

    } catch (error) {
      result.addWarning(`Services initialization failed: ${error.message}`, 'SERVICES');
      logger.warn('Error initializing services', {
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
      hasInitializationPromise: !!this.initializationPromise,
      environment: process.env.NODE_ENV,
      uptime: process.uptime()
    };
  }

  /**
   * Force re-initialization (for testing or recovery)
   */
  async reinitialize() {
    logger.info('Forcing backend application re-initialization', {
      category: LogCategory.SYSTEM
    });

    this.initialized = false;
    this.initializationPromise = null;
    
    return this.initialize();
  }

  /**
   * Health check for the application
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      initialized: this.initialized,
      checks: {}
    };

    try {
      // Check database
      try {
        const { sequelize } = require('../config/database');
        await sequelize.authenticate();
        health.checks.database = 'healthy';
      } catch (dbError) {
        health.checks.database = 'unhealthy';
        health.status = 'degraded';
      }

      // Check Firebase Admin
      try {
        const admin = require('firebase-admin');
        if (admin.apps.length > 0) {
          health.checks.firebase = 'healthy';
        } else {
          health.checks.firebase = 'not_initialized';
          health.status = 'degraded';
        }
      } catch (firebaseError) {
        health.checks.firebase = 'unhealthy';
        health.status = 'degraded';
      }

      // Check memory usage
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      if (heapUsedMB > 500) { // Alert if heap usage > 500MB
        health.checks.memory = 'high_usage';
        health.status = 'degraded';
      } else {
        health.checks.memory = 'healthy';
      }

      logger.debug('Health check completed', {
        category: LogCategory.SYSTEM,
        status: health.status,
        checks: health.checks
      });

    } catch (error) {
      health.status = 'unhealthy';
      health.error = error.message;
      
      logger.error('Health check failed', {
        category: LogCategory.SYSTEM,
        errorType: ErrorType.SYSTEM,
        error: error.message
      });
    }

    return health;
  }
}

// Create singleton instance
const appInitializer = new AppInitializer();

module.exports = appInitializer;
module.exports.AppInitializer = AppInitializer;
module.exports.InitializationResult = InitializationResult;