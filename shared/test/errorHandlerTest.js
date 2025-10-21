/**
 * Simple test for the Unified Error Handling System
 * Verifies basic functionality of error capture and processing
 */

import { ErrorHandler } from '../utils/ErrorHandler.js';
import { AuthErrorStrategy } from '../strategies/AuthErrorStrategy.js';
import { NetworkErrorStrategy } from '../strategies/NetworkErrorStrategy.js';
import { ValidationErrorStrategy } from '../strategies/ValidationErrorStrategy.js';
import { FallbackStrategy } from '../strategies/FallbackStrategy.js';
import { ErrorType } from '../types/errorTypes.js';

// Test function
async function testErrorHandlingSystem() {
  console.log('Testing Unified Error Handling System...');

  // Initialize error handler
  const errorHandler = new ErrorHandler({
    logLevel: 'debug',
    enableRetry: true,
    maxRetries: 3
  });

  // Register strategies
  errorHandler.registerStrategy(ErrorType.AUTHENTICATION, new AuthErrorStrategy());
  errorHandler.registerStrategy(ErrorType.NETWORK, new NetworkErrorStrategy());
  errorHandler.registerStrategy(ErrorType.VALIDATION, new ValidationErrorStrategy());
  errorHandler.registerStrategy(ErrorType.UNKNOWN, new FallbackStrategy());

  // Test 1: Authentication Error
  console.log('\n1. Testing Authentication Error...');
  try {
    const authError = new Error('Invalid credentials');
    authError.code = 'auth/invalid-credential';
    
    const context = {
      component: 'login-form',
      action: 'authenticate',
      timestamp: new Date(),
      environment: 'development'
    };

    const processedError = errorHandler.captureError(authError, context);
    console.log('✓ Authentication error processed:', {
      id: processedError.id,
      type: processedError.type,
      severity: processedError.severity,
      recoverable: processedError.recoverable
    });

    const strategy = errorHandler.getRecoveryStrategy(processedError);
    if (strategy) {
      console.log('✓ Recovery strategy found:', strategy.name);
    }
  } catch (error) {
    console.error('✗ Authentication error test failed:', error.message);
  }

  // Test 2: Network Error
  console.log('\n2. Testing Network Error...');
  try {
    const networkError = new Error('Connection timeout');
    networkError.code = 'ECONNABORTED';
    
    const context = {
      component: 'api-client',
      action: 'fetch-data',
      timestamp: new Date(),
      environment: 'development'
    };

    const processedError = errorHandler.captureError(networkError, context);
    console.log('✓ Network error processed:', {
      id: processedError.id,
      type: processedError.type,
      severity: processedError.severity,
      retryable: processedError.retryable
    });

    const strategy = errorHandler.getRecoveryStrategy(processedError);
    if (strategy) {
      console.log('✓ Recovery strategy found:', strategy.name);
    }
  } catch (error) {
    console.error('✗ Network error test failed:', error.message);
  }

  // Test 3: Validation Error
  console.log('\n3. Testing Validation Error...');
  try {
    const validationError = new Error('Email format is invalid');
    
    const context = {
      component: 'user-form',
      action: 'validate-email',
      timestamp: new Date(),
      environment: 'development'
    };

    const processedError = errorHandler.captureError(validationError, context);
    console.log('✓ Validation error processed:', {
      id: processedError.id,
      type: processedError.type,
      severity: processedError.severity,
      userMessage: processedError.userMessage
    });

    const strategy = errorHandler.getRecoveryStrategy(processedError);
    if (strategy) {
      console.log('✓ Recovery strategy found:', strategy.name);
      
      // Test recovery execution
      const recoveryResult = await errorHandler.executeRecovery(strategy, processedError);
      console.log('✓ Recovery executed:', {
        success: recoveryResult.success,
        message: recoveryResult.message
      });
    }
  } catch (error) {
    console.error('✗ Validation error test failed:', error.message);
  }

  // Test 4: Unknown Error (Fallback)
  console.log('\n4. Testing Unknown Error (Fallback)...');
  try {
    const unknownError = new Error('Something unexpected happened');
    
    const context = {
      component: 'unknown-component',
      action: 'unknown-action',
      timestamp: new Date(),
      environment: 'development'
    };

    const processedError = errorHandler.captureError(unknownError, context);
    console.log('✓ Unknown error processed:', {
      id: processedError.id,
      type: processedError.type,
      severity: processedError.severity,
      userMessage: processedError.userMessage
    });

    const strategy = errorHandler.getRecoveryStrategy(processedError);
    if (strategy) {
      console.log('✓ Fallback strategy found:', strategy.name);
    }
  } catch (error) {
    console.error('✗ Unknown error test failed:', error.message);
  }

  console.log('\n✓ Error Handling System tests completed!');
}

// Run tests if this file is executed directly
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  testErrorHandlingSystem().catch(console.error);
}

export { testErrorHandlingSystem };