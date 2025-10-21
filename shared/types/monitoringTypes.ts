// Monitoring and Metrics Types
export interface Metric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  component: string;
  tags?: Record<string, string>;
}

export interface MetricAggregation {
  component: string;
  metricName: string;
  period: TimePeriod;
  aggregationType: AggregationType;
  value: number;
  count: number;
  timestamp: Date;
}

export interface ComponentMetrics {
  component: string;
  errorRate: number;
  responseTime: number;
  availability: number;
  throughput: number;
  lastUpdated: Date;
  status: ComponentStatus;
}

export interface SystemMetrics {
  timestamp: Date;
  overallHealth: number;
  totalErrors: number;
  averageResponseTime: number;
  systemAvailability: number;
  activeUsers: number;
  components: ComponentMetrics[];
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  component: string;
  metric?: string;
  threshold?: number;
  currentValue?: number;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  actions?: AlertAction[];
}

export interface AlertRule {
  id: string;
  name: string;
  component: string;
  metric: string;
  condition: AlertCondition;
  threshold: number;
  severity: AlertSeverity;
  enabled: boolean;
  cooldownPeriod: number; // minutes
  actions: AlertAction[];
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'log' | 'recovery';
  target: string;
  enabled: boolean;
}

export interface MetricsStorage {
  store(metric: Metric): Promise<void>;
  getMetrics(component: string, period: TimePeriod): Promise<Metric[]>;
  getAggregatedMetrics(component: string, period: TimePeriod, aggregationType: AggregationType): Promise<MetricAggregation[]>;
  cleanup(olderThan: Date): Promise<void>;
}

export interface AlertManager {
  checkRules(metrics: Metric[]): Promise<Alert[]>;
  triggerAlert(alert: Alert): Promise<void>;
  resolveAlert(alertId: string): Promise<void>;
  getActiveAlerts(): Promise<Alert[]>;
  addRule(rule: AlertRule): Promise<void>;
  removeRule(ruleId: string): Promise<void>;
}

export interface MonitoringDashboard {
  getSystemOverview(): Promise<SystemMetrics>;
  getComponentMetrics(component: string, period: TimePeriod): Promise<ComponentMetrics>;
  getErrorTrends(period: TimePeriod): Promise<MetricTrendData[]>;
  getPerformanceTrends(period: TimePeriod): Promise<MetricTrendData[]>;
  getAlertHistory(period: TimePeriod): Promise<Alert[]>;
}

// Enums and utility types
export enum TimePeriod {
  LAST_HOUR = 'last_hour',
  LAST_DAY = 'last_day',
  LAST_WEEK = 'last_week',
  LAST_MONTH = 'last_month'
}

export enum AggregationType {
  SUM = 'sum',
  AVERAGE = 'average',
  MIN = 'min',
  MAX = 'max',
  COUNT = 'count'
}

export enum AlertType {
  ERROR_RATE = 'error_rate',
  RESPONSE_TIME = 'response_time',
  AVAILABILITY = 'availability',
  SYSTEM_ERROR = 'system_error',
  DEPLOY_FAILURE = 'deploy_failure',
  PERFORMANCE_DEGRADATION = 'performance_degradation'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ComponentStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

export enum AlertCondition {
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals'
}

export interface MetricTrendData {
  timestamp: Date;
  value: number;
  component?: string;
}

export interface MetricsCollectorConfig {
  collectionInterval: number; // milliseconds
  retentionPeriod: number; // days
  maxMetricsPerComponent: number;
  enableRealTimeCollection: boolean;
  components: string[];
}

export interface MonitoringConfig {
  metrics: MetricsCollectorConfig;
  alerts: {
    enabled: boolean;
    checkInterval: number; // milliseconds
    defaultCooldown: number; // minutes
  };
  dashboard: {
    refreshInterval: number; // milliseconds
    maxDataPoints: number;
  };
}