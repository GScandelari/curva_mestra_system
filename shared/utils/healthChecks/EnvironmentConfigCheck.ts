/**
 * Environment Configuration Health Check
 * Verifies environment variables and configuration are properly set
 */

import {
  HealthCheck,
  HealthResult,
  HealthStatus
} from '../../types/diagnosticTypes.js';

interface ConfigRequirement {
  key: string;
  required: boolean;
  pattern?: RegExp;
  description: string;
  environment?: 'development' | 'production' | 'all';
}

export class EnvironmentConfigCheck implements HealthCheck {
  name = 'environment-config';
  component = 'configuration';
  timeout = 2000;
  retryCount = 1;
  enabled = true;

  private requirements: ConfigRequirement[] = [
    // Server configuration
    { key: 'NODE_ENV', required: true, pattern: /^(development|production|test)$/, description: 'Node.js environment', environment: 'all' },
    { key: 'PORT', required: true, pattern: /^\d{4,5}$/, description: 'Server port', environment: 'all' },
    
    // Firebase configuration
    { key: 'FIREBASE_PROJECT_ID', required: true, pattern: /^[a-z0-9-]+$/, description: 'Firebase project ID', environment: 'all' },
    { key: 'FIREBASE_API_KEY', required: false, description: 'Firebase API key', environment: 'all' },
    { key: 'FIREBASE_AUTH_DOMAIN', required: false, description: 'Firebase auth domain', environment: 'all' },
    
    // Database configuration
    { key: 'DB_HOST', required: true, description: 'Database host', environment: 'all' },
    { key: 'DB_PORT', required: true, pattern: /^\d{4,5}$/, description: 'Database port', environment: 'all' },
    { key: 'DB_NAME', required: true, description: 'Database name', environment: 'all' },
    { key: 'DB_USER', required: true, description: 'Database user', environment: 'all' },
    { key: 'DB_PASSWORD', required: true, description: 'Database password', environment: 'all' },
    
    // Security configuration
    { key: 'JWT_SECRET', required: true, description: 'JWT secret key', environment: 'all' },
    { key: 'BCRYPT_ROUNDS', required: false, pattern: /^\d{1,2}$/, description: 'Bcrypt rounds', environment: 'all' },
    
    // Production-specific
    { key: 'FIREBASE_SERVICE_ACCOUNT_PATH', required: false, description: 'Firebase service account file path', environment: 'production' },
    { key: 'EMAIL_HOST', required: false, description: 'Email server host', environment: 'production' },
    { key: 'EMAIL_PORT', required: false, pattern: /^\d{2,4}$/, description: 'Email server port', environment: 'production' },
    { key: 'EMAIL_USER', required: false, description: 'Email username', environment: 'production' },
    { key: 'EMAIL_PASSWORD', required: false, description: 'Email password', environment: 'production' }
  ];

  private placeholderValues = [
    'your-project-id',
    'your-api-key',
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

  constructor(private environment?: string) {
    this.environment = environment || process.env.NODE_ENV || 'development';
  }

  async execute(): Promise<HealthResult> {
    const startTime = Date.now();
    const metrics: Record<string, any> = {};
    const issues: string[] = [];
    const warnings: string[] = [];

    try {
      const currentEnv = this.environment;
      const isProduction = currentEnv === 'production';
      
      metrics.environment = currentEnv;
      metrics.isProduction = isProduction;

      // Check each requirement
      const missingRequired: string[] = [];
      const invalidFormat: string[] = [];
      const placeholderDetected: string[] = [];
      const securityIssues: string[] = [];

      for (const req of this.requirements) {
        // Skip if not applicable to current environment
        if (req.environment && req.environment !== 'all' && req.environment !== currentEnv) {
          continue;
        }

        const value = process.env[req.key];

        // Check if required variable is missing
        if (req.required && !value) {
          missingRequired.push(req.key);
          continue;
        }

        // Skip further checks if value is not set
        if (!value) continue;

        // Check format if pattern is specified
        if (req.pattern && !req.pattern.test(value)) {
          invalidFormat.push(req.key);
        }

        // Check for placeholder values
        if (this.isPlaceholderValue(value)) {
          placeholderDetected.push(req.key);
          if (isProduction) {
            securityIssues.push(`${req.key} contains placeholder value in production`);
          }
        }

        // Security-specific checks
        if (req.key === 'JWT_SECRET') {
          if (value.length < 32) {
            securityIssues.push('JWT secret should be at least 32 characters long');
          }
        }

        if (req.key === 'DB_PASSWORD' && ['password', 'admin', '123456'].includes(value.toLowerCase())) {
          securityIssues.push('Database password appears to be weak or default');
        }

        if (req.key === 'BCRYPT_ROUNDS') {
          const rounds = parseInt(value);
          if (rounds < 10) {
            securityIssues.push('Bcrypt rounds should be at least 10 for security');
          } else if (rounds > 15) {
            warnings.push('Bcrypt rounds above 15 may impact performance');
          }
        }
      }

      // Production-specific checks
      if (isProduction) {
        // Check for development settings in production
        if (process.env.DEBUG === 'true') {
          warnings.push('Debug mode should be disabled in production');
        }

        if (process.env.LOG_LEVEL === 'debug') {
          warnings.push('Debug logging should be disabled in production');
        }

        // Check for Firebase emulator in production
        if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
          securityIssues.push('Firebase Auth emulator should not be configured in production');
        }
      }

      // Compile results
      metrics.missingRequired = missingRequired;
      metrics.invalidFormat = invalidFormat;
      metrics.placeholderDetected = placeholderDetected;
      metrics.securityIssues = securityIssues;
      metrics.warnings = warnings;

      // Add specific issues
      if (missingRequired.length > 0) {
        issues.push(`Missing required configuration: ${missingRequired.join(', ')}`);
      }

      if (invalidFormat.length > 0) {
        issues.push(`Invalid format: ${invalidFormat.join(', ')}`);
      }

      if (placeholderDetected.length > 0) {
        const message = `Placeholder values detected: ${placeholderDetected.join(', ')}`;
        if (isProduction) {
          issues.push(message);
        } else {
          warnings.push(message);
        }
      }

      if (securityIssues.length > 0) {
        issues.push(...securityIssues);
      }

      // Determine status
      let status: HealthStatus;
      let message: string;

      if (issues.length > 0) {
        status = HealthStatus.UNHEALTHY;
        message = `Configuration issues detected: ${issues.length} errors`;
      } else if (warnings.length > 0) {
        status = HealthStatus.DEGRADED;
        message = `Configuration warnings: ${warnings.length} warnings`;
      } else {
        status = HealthStatus.HEALTHY;
        message = 'All configuration requirements satisfied';
      }

      if (issues.length > 0) {
        metrics.issues = issues;
      }

      return {
        status,
        message,
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        metrics
      };

    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: `Environment config check failed: ${error.message}`,
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error)),
        metrics
      };
    }
  }

  /**
   * Check if value appears to be a placeholder
   */
  private isPlaceholderValue(value: string): boolean {
    if (!value || typeof value !== 'string') return false;
    
    const lowerValue = value.toLowerCase();
    return this.placeholderValues.some(placeholder => 
      lowerValue.includes(placeholder.toLowerCase())
    );
  }

  /**
   * Add custom configuration requirement
   */
  addRequirement(requirement: ConfigRequirement): void {
    this.requirements.push(requirement);
  }

  /**
   * Get all requirements for current environment
   */
  getRequirements(): ConfigRequirement[] {
    const currentEnv = this.environment;
    return this.requirements.filter(req => 
      !req.environment || req.environment === 'all' || req.environment === currentEnv
    );
  }
}