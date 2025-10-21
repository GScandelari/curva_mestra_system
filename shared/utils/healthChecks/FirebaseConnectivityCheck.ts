/**
 * Firebase Connectivity Health Check
 * Verifies Firebase services connectivity and configuration
 */

import {
  HealthCheck,
  HealthResult,
  HealthStatus
} from '../../types/diagnosticTypes.js';

export class FirebaseConnectivityCheck implements HealthCheck {
  name = 'firebase-connectivity';
  component = 'firebase';
  timeout = 10000;
  retryCount = 3;
  enabled = true;

  constructor(private firebaseConfig?: any) {}

  async execute(): Promise<HealthResult> {
    const startTime = Date.now();
    const metrics: Record<string, any> = {};

    try {
      // Check if Firebase is configured
      if (!this.firebaseConfig) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: 'Firebase configuration not provided',
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          error: new Error('Firebase configuration missing')
        };
      }

      // Validate required Firebase configuration
      const requiredFields = ['projectId', 'apiKey', 'authDomain'];
      const missingFields = requiredFields.filter(field => !this.firebaseConfig[field]);

      if (missingFields.length > 0) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: `Missing Firebase configuration fields: ${missingFields.join(', ')}`,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          error: new Error(`Missing configuration: ${missingFields.join(', ')}`)
        };
      }

      // Check for placeholder values
      const placeholderPatterns = [
        'your-project-id',
        'your-api-key',
        'placeholder',
        'example',
        'test-project'
      ];

      const hasPlaceholders = requiredFields.some(field => {
        const value = this.firebaseConfig[field]?.toLowerCase() || '';
        return placeholderPatterns.some(pattern => value.includes(pattern));
      });

      if (hasPlaceholders) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: 'Firebase configuration contains placeholder values',
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          error: new Error('Placeholder configuration detected')
        };
      }

      // Test Firebase Auth connectivity (if available)
      let authStatus = 'not-tested';
      try {
        // This would be implemented differently in browser vs Node.js
        if (typeof window !== 'undefined' && window.firebase) {
          // Browser environment
          const auth = window.firebase.auth();
          await auth.signInAnonymously();
          await auth.signOut();
          authStatus = 'healthy';
        } else if (typeof require !== 'undefined') {
          // Node.js environment - check if Firebase Admin is available
          try {
            const admin = require('firebase-admin');
            if (admin.apps.length > 0) {
              // Test admin connectivity by getting a user (will fail gracefully)
              try {
                await admin.auth().getUser('test-user-id');
              } catch (error) {
                // Expected error for non-existent user, but confirms connectivity
                if (error.code === 'auth/user-not-found') {
                  authStatus = 'healthy';
                } else {
                  authStatus = 'degraded';
                }
              }
            }
          } catch (adminError) {
            authStatus = 'not-available';
          }
        }
      } catch (authError) {
        authStatus = 'unhealthy';
        metrics.authError = authError.message;
      }

      // Test Firestore connectivity (if available)
      let firestoreStatus = 'not-tested';
      try {
        if (typeof window !== 'undefined' && window.firebase) {
          // Browser environment
          const db = window.firebase.firestore();
          await db.collection('health-check').limit(1).get();
          firestoreStatus = 'healthy';
        } else if (typeof require !== 'undefined') {
          // Node.js environment
          try {
            const admin = require('firebase-admin');
            if (admin.apps.length > 0) {
              const db = admin.firestore();
              await db.collection('health-check').limit(1).get();
              firestoreStatus = 'healthy';
            }
          } catch (adminError) {
            firestoreStatus = 'not-available';
          }
        }
      } catch (firestoreError) {
        firestoreStatus = 'degraded';
        metrics.firestoreError = firestoreError.message;
      }

      // Determine overall status
      let status = HealthStatus.HEALTHY;
      let message = 'Firebase connectivity is healthy';

      if (authStatus === 'unhealthy' || firestoreStatus === 'unhealthy') {
        status = HealthStatus.UNHEALTHY;
        message = 'Firebase services are unhealthy';
      } else if (authStatus === 'degraded' || firestoreStatus === 'degraded') {
        status = HealthStatus.DEGRADED;
        message = 'Firebase services are degraded';
      } else if (authStatus === 'not-available' && firestoreStatus === 'not-available') {
        status = HealthStatus.UNKNOWN;
        message = 'Firebase services status unknown';
      }

      metrics.authStatus = authStatus;
      metrics.firestoreStatus = firestoreStatus;
      metrics.configurationValid = true;

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
        message: `Firebase connectivity check failed: ${error.message}`,
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error)),
        metrics
      };
    }
  }
}