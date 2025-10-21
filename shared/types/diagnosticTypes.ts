/**
 * Diagnostic System - Type Definitions
 * Types for automated system health monitoring and diagnostics
 */

// Health Status enumeration
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded', 
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

// Component Report interface
export interface ComponentReport {
  name: string;
  status: HealthStatus;
  responseTime?: number;
  errorRate?: number;
  issues: Issue[];
  metrics: Record<string, any>;
  lastChecked: Date;
  details?: string;
}

// Issue interface
export interface Issue {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  component: string;
  timestamp: Date;
  resolved: boolean;
  recommendation?: string;
}

// Recommendation interface
export interface Recommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  action: string;
  component: string;
  estimatedImpact: string;
}

// Diagnostic Report interface
export interface DiagnosticReport {
  id: string;
  timestamp: Date;
  overallHealth: HealthStatus;
  components: ComponentReport[];
  recommendations: Recommendation[];
  criticalIssues: Issue[];
  summary: string;
  executionTime: number;
}

// Health Check interface
export interface HealthCheck {
  name: string;
  component: string;
  execute(): Promise<HealthResult>;
  timeout: number;
  retryCount: number;
  enabled: boolean;
  interval?: number;
}

// Health Result interface
export interface HealthResult {
  status: HealthStatus;
  message: string;
  metrics?: Record<string, any>;
  timestamp: Date;
  responseTime: number;
  error?: Error;
}

// Diagnostic Session interface
export interface DiagnosticSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  triggeredBy: 'manual' | 'automatic' | 'error';
  report?: DiagnosticReport;
  actionsPerformed: DiagnosticAction[];
  status: 'running' | 'completed' | 'failed' | 'cancelled';
}

// Diagnostic Action interface
export interface DiagnosticAction {
  timestamp: Date;
  action: string;
  component: string;
  result: 'success' | 'failure' | 'warning';
  details: string;
  duration: number;
}

// Diagnostic Configuration interface
export interface DiagnosticConfig {
  enableRealTimeMonitoring: boolean;
  monitoringInterval: number;
  healthCheckTimeout: number;
  maxRetries: number;
  enableAutoRemediation: boolean;
  criticalThreshold: number;
  warningThreshold: number;
  components: string[];
}

// Metric interface
export interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  component: string;
  threshold?: {
    warning: number;
    critical: number;
  };
}

// System Health Summary interface
export interface SystemHealthSummary {
  overallStatus: HealthStatus;
  totalComponents: number;
  healthyComponents: number;
  degradedComponents: number;
  unhealthyComponents: number;
  criticalIssues: number;
  lastUpdate: Date;
  uptime: number;
}