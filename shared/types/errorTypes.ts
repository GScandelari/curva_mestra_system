/**
 * Unified Error Handling System - Type Definitions
 * Shared types for frontend, backend, and Firebase Functions
 */

// Error Types for classification
export enum ErrorType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization', 
  VALIDATION = 'validation',
  NETWORK = 'network',
  DATABASE = 'database',
  BUSINESS_LOGIC = 'business_logic',
  CONFIGURATION = 'configuration',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

// Error Severity levels
export enum ErrorSeverity {
  LOW = 'low',        // Non-critical, doesn't affect core functionality
  MEDIUM = 'medium',  // Affects specific functionality
  HIGH = 'high',      // Affects critical functionality
  CRITICAL = 'critical' // System inaccessible or data loss risk
}

// Error Context interface
export interface ErrorContext {
  component: string;
  action: string;
  userId?: string;
  timestamp: Date;
  environment: 'development' | 'production';
  additionalData?: Record<string, any>;
  requestId?: string;
  sessionId?: string;
}

// Processed Error interface
export interface ProcessedError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError: Error;
  context: ErrorContext;
  recoverable: boolean;
  retryable: boolean;
  userMessage?: string;
  technicalDetails?: Record<string, any>;
}

// Recovery Strategy interface
export interface RecoveryStrategy {
  name: string;
  canHandle(error: ProcessedError): boolean;
  execute(error: ProcessedError): Promise<RecoveryResult>;
  maxRetries: number;
  backoffStrategy: BackoffStrategy;
}

// Recovery Result interface
export interface RecoveryResult {
  success: boolean;
  message: string;
  retryAfter?: number;
  fallbackRequired?: boolean;
  data?: any;
}

// Backoff Strategy enum
export enum BackoffStrategy {
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  FIXED = 'fixed'
}

// Error Handler Configuration
export interface ErrorHandlerConfig {
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  enableRetry: boolean;
  maxRetries: number;
  enableFallback: boolean;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

// Circuit Breaker State
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

// Circuit Breaker interface
export interface CircuitBreaker {
  state: CircuitBreakerState;
  failureCount: number;
  lastFailureTime?: Date;
  execute<T>(operation: () => Promise<T>): Promise<T>;
  reset(): void;
}

// Recovery Manager interface
export interface IRecoveryManager {
  registerStrategy(errorType: ErrorType, strategy: RecoveryStrategy): void;
  executeRecovery(error: ProcessedError): Promise<RecoveryResult>;
  executeFallback(error: ProcessedError): Promise<void>;
  getRegisteredStrategies(errorType: ErrorType): RecoveryStrategy[];
  clearStrategies(errorType?: ErrorType): void;
}

// Fallback Handler interface
export interface FallbackHandler {
  name: string;
  canHandle(error: ProcessedError): boolean;
  execute(error: ProcessedError): Promise<void>;
}