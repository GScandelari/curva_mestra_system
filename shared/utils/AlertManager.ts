import { 
  Alert, 
  AlertRule, 
  AlertType, 
  AlertSeverity, 
  AlertCondition,
  AlertAction,
  AlertManager as IAlertManager,
  Metric 
} from '../types/monitoringTypes';

export class AlertManager implements IAlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertCooldowns: Map<string, Date> = new Map();
  private checkTimer?: NodeJS.Timeout;
  private checkInterval: number;

  constructor(checkInterval: number = 30000) { // 30 seconds default
    this.checkInterval = checkInterval;
    this.initializeDefaultRules();
  }

  // Start alert monitoring
  startMonitoring(): void {
    this.checkTimer = setInterval(() => {
      // This would be called by the metrics collector
      // For now, we'll just clean up expired cooldowns
      this.cleanupExpiredCooldowns();
    }, this.checkInterval);

    console.log(`Alert monitoring started with ${this.checkInterval}ms interval`);
  }

  // Stop alert monitoring
  stopMonitoring(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
      console.log('Alert monitoring stopped');
    }
  }

  // Check metrics against alert rules
  async checkRules(metrics: Metric[]): Promise<Alert[]> {
    const triggeredAlerts: Alert[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check if rule is in cooldown
      if (this.isInCooldown(rule.id)) continue;

      // Find relevant metrics for this rule
      const relevantMetrics = metrics.filter(m => 
        m.component === rule.component && m.name === rule.metric
      );

      if (relevantMetrics.length === 0) continue;

      // Check if rule condition is met
      const latestMetric = relevantMetrics[relevantMetrics.length - 1];
      if (this.evaluateCondition(latestMetric.value, rule.condition, rule.threshold)) {
        const alert = await this.createAlert(rule, latestMetric);
        triggeredAlerts.push(alert);
        
        // Set cooldown
        this.setCooldown(rule.id, rule.cooldownPeriod);
      }
    }

    return triggeredAlerts;
  }

  // Trigger an alert
  async triggerAlert(alert: Alert): Promise<void> {
    // Store the alert
    this.activeAlerts.set(alert.id, alert);

    // Execute alert actions
    for (const action of alert.actions || []) {
      if (action.enabled) {
        await this.executeAlertAction(alert, action);
      }
    }

    console.log(`Alert triggered: ${alert.title} - ${alert.message}`);
  }

  // Resolve an alert
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      console.log(`Alert resolved: ${alert.title}`);
    }
  }

  // Get active alerts
  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  // Get all alerts (including resolved)
  async getAllAlerts(): Promise<Alert[]> {
    return Array.from(this.activeAlerts.values());
  }

  // Add alert rule
  async addRule(rule: AlertRule): Promise<void> {
    this.rules.set(rule.id, rule);
    console.log(`Alert rule added: ${rule.name}`);
  }

  // Remove alert rule
  async removeRule(ruleId: string): Promise<void> {
    this.rules.delete(ruleId);
    console.log(`Alert rule removed: ${ruleId}`);
  }

  // Get all rules
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  // Update rule
  async updateRule(ruleId: string, updates: Partial<AlertRule>): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
      console.log(`Alert rule updated: ${ruleId}`);
    }
  }

  // Enable/disable rule
  async toggleRule(ruleId: string, enabled: boolean): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      console.log(`Alert rule ${enabled ? 'enabled' : 'disabled'}: ${ruleId}`);
    }
  }

  // Private helper methods
  private initializeDefaultRules(): void {
    // High error rate rule
    this.addRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      component: 'system',
      metric: 'error_count',
      condition: AlertCondition.GREATER_THAN,
      threshold: 10,
      severity: AlertSeverity.HIGH,
      enabled: true,
      cooldownPeriod: 15, // 15 minutes
      actions: [
        { type: 'log', target: 'console', enabled: true },
        { type: 'recovery', target: 'auto_recovery', enabled: true }
      ]
    });

    // Slow response time rule
    this.addRule({
      id: 'slow_response_time',
      name: 'Slow Response Time',
      component: 'backend',
      metric: 'response_time',
      condition: AlertCondition.GREATER_THAN,
      threshold: 5000, // 5 seconds
      severity: AlertSeverity.MEDIUM,
      enabled: true,
      cooldownPeriod: 10,
      actions: [
        { type: 'log', target: 'console', enabled: true }
      ]
    });

    // System unavailable rule
    this.addRule({
      id: 'system_unavailable',
      name: 'System Unavailable',
      component: 'system',
      metric: 'availability',
      condition: AlertCondition.LESS_THAN,
      threshold: 0.95, // 95%
      severity: AlertSeverity.CRITICAL,
      enabled: true,
      cooldownPeriod: 5,
      actions: [
        { type: 'log', target: 'console', enabled: true },
        { type: 'recovery', target: 'emergency_recovery', enabled: true }
      ]
    });

    // Authentication failures rule
    this.addRule({
      id: 'auth_failures',
      name: 'Authentication Failures',
      component: 'auth',
      metric: 'auth_failure_count',
      condition: AlertCondition.GREATER_THAN,
      threshold: 5,
      severity: AlertSeverity.HIGH,
      enabled: true,
      cooldownPeriod: 20,
      actions: [
        { type: 'log', target: 'security_log', enabled: true }
      ]
    });

    // Deploy failure rule
    this.addRule({
      id: 'deploy_failure',
      name: 'Deploy Failure',
      component: 'deployment',
      metric: 'deploy_failure',
      condition: AlertCondition.GREATER_THAN,
      threshold: 0,
      severity: AlertSeverity.HIGH,
      enabled: true,
      cooldownPeriod: 30,
      actions: [
        { type: 'log', target: 'deploy_log', enabled: true },
        { type: 'recovery', target: 'rollback', enabled: true }
      ]
    });
  }

  private evaluateCondition(value: number, condition: AlertCondition, threshold: number): boolean {
    switch (condition) {
      case AlertCondition.GREATER_THAN:
        return value > threshold;
      case AlertCondition.LESS_THAN:
        return value < threshold;
      case AlertCondition.EQUALS:
        return value === threshold;
      case AlertCondition.NOT_EQUALS:
        return value !== threshold;
      default:
        return false;
    }
  }

  private async createAlert(rule: AlertRule, metric: Metric): Promise<Alert> {
    const alert: Alert = {
      id: this.generateAlertId(),
      type: this.getAlertTypeFromMetric(metric.name),
      severity: rule.severity,
      title: rule.name,
      message: this.generateAlertMessage(rule, metric),
      component: rule.component,
      metric: rule.metric,
      threshold: rule.threshold,
      currentValue: metric.value,
      timestamp: new Date(),
      resolved: false,
      actions: rule.actions
    };

    return alert;
  }

  private generateAlertMessage(rule: AlertRule, metric: Metric): string {
    const conditionText = this.getConditionText(rule.condition);
    return `${rule.name}: ${metric.name} is ${metric.value} (${conditionText} ${rule.threshold}) for component ${rule.component}`;
  }

  private getConditionText(condition: AlertCondition): string {
    switch (condition) {
      case AlertCondition.GREATER_THAN:
        return 'greater than';
      case AlertCondition.LESS_THAN:
        return 'less than';
      case AlertCondition.EQUALS:
        return 'equal to';
      case AlertCondition.NOT_EQUALS:
        return 'not equal to';
      default:
        return 'compared to';
    }
  }

  private getAlertTypeFromMetric(metricName: string): AlertType {
    if (metricName.includes('error')) return AlertType.ERROR_RATE;
    if (metricName.includes('response_time')) return AlertType.RESPONSE_TIME;
    if (metricName.includes('availability')) return AlertType.AVAILABILITY;
    if (metricName.includes('deploy')) return AlertType.DEPLOY_FAILURE;
    return AlertType.SYSTEM_ERROR;
  }

  private async executeAlertAction(alert: Alert, action: AlertAction): Promise<void> {
    try {
      switch (action.type) {
        case 'log':
          this.logAlert(alert, action.target);
          break;
        case 'webhook':
          await this.sendWebhook(alert, action.target);
          break;
        case 'email':
          await this.sendEmail(alert, action.target);
          break;
        case 'recovery':
          await this.triggerRecovery(alert, action.target);
          break;
        default:
          console.warn(`Unknown alert action type: ${action.type}`);
      }
    } catch (error) {
      console.error(`Error executing alert action ${action.type}:`, error);
    }
  }

  private logAlert(alert: Alert, target: string): void {
    const logMessage = `[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`;
    
    switch (target) {
      case 'console':
        console.log(logMessage);
        break;
      case 'security_log':
        console.log(`[SECURITY] ${logMessage}`);
        break;
      case 'deploy_log':
        console.log(`[DEPLOY] ${logMessage}`);
        break;
      default:
        console.log(logMessage);
    }
  }

  private async sendWebhook(alert: Alert, webhookUrl: string): Promise<void> {
    // Implementation would send HTTP POST to webhook URL
    console.log(`Webhook alert sent to ${webhookUrl}: ${alert.title}`);
  }

  private async sendEmail(alert: Alert, emailAddress: string): Promise<void> {
    // Implementation would send email notification
    console.log(`Email alert sent to ${emailAddress}: ${alert.title}`);
  }

  private async triggerRecovery(alert: Alert, recoveryType: string): Promise<void> {
    // Implementation would trigger recovery actions
    console.log(`Recovery triggered (${recoveryType}) for alert: ${alert.title}`);
  }

  private isInCooldown(ruleId: string): boolean {
    const cooldownEnd = this.alertCooldowns.get(ruleId);
    if (!cooldownEnd) return false;
    
    return new Date() < cooldownEnd;
  }

  private setCooldown(ruleId: string, cooldownMinutes: number): void {
    const cooldownEnd = new Date();
    cooldownEnd.setMinutes(cooldownEnd.getMinutes() + cooldownMinutes);
    this.alertCooldowns.set(ruleId, cooldownEnd);
  }

  private cleanupExpiredCooldowns(): void {
    const now = new Date();
    for (const [ruleId, cooldownEnd] of this.alertCooldowns.entries()) {
      if (now >= cooldownEnd) {
        this.alertCooldowns.delete(ruleId);
      }
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}