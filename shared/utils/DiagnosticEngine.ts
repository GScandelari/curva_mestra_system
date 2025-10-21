/**
 * Diagnostic Engine - Automated System Health Monitoring
 * Executes health checks and generates diagnostic reports
 */

import {
  HealthStatus,
  ComponentReport,
  DiagnosticReport,
  DiagnosticSession,
  DiagnosticAction,
  DiagnosticConfig,
  HealthCheck,
  HealthResult,
  Issue,
  Recommendation,
  SystemHealthSummary
} from '../types/diagnosticTypes.js';

export class DiagnosticEngine {
  private healthChecks: Map<string, HealthCheck> = new Map();
  private config: DiagnosticConfig;
  private currentSession?: DiagnosticSession;
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  constructor(config: Partial<DiagnosticConfig> = {}) {
    this.config = {
      enableRealTimeMonitoring: false,
      monitoringInterval: 60000, // 1 minute
      healthCheckTimeout: 10000, // 10 seconds
      maxRetries: 3,
      enableAutoRemediation: false,
      criticalThreshold: 0.8,
      warningThreshold: 0.6,
      components: [],
      ...config
    };
  }

  /**
   * Register a health check
   */
  registerHealthCheck(healthCheck: HealthCheck): void {
    this.healthChecks.set(healthCheck.name, healthCheck);
  }

  /**
   * Unregister a health check
   */
  unregisterHealthCheck(name: string): void {
    this.healthChecks.delete(name);
  }

  /**
   * Get all registered health checks
   */
  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Run full diagnostic
   */
  async runFullDiagnostic(): Promise<DiagnosticReport> {
    const session = this.startSession('manual');
    
    try {
      const startTime = Date.now();
      const components: ComponentReport[] = [];
      const allIssues: Issue[] = [];
      
      // Execute all health checks
      for (const [name, healthCheck] of this.healthChecks) {
        if (!healthCheck.enabled) continue;

        const action: DiagnosticAction = {
          timestamp: new Date(),
          action: 'health_check',
          component: healthCheck.component,
          result: 'success',
          details: `Executing health check: ${name}`,
          duration: 0
        };

        try {
          const actionStart = Date.now();
          const componentReport = await this.runComponentDiagnostic(healthCheck.component);
          action.duration = Date.now() - actionStart;
          
          components.push(componentReport);
          allIssues.push(...componentReport.issues);
          
          session.actionsPerformed.push(action);
        } catch (error) {
          const actionStart = Date.now();
          action.result = 'failure';
          action.details = `Health check failed: ${error instanceof Error ? error.message : String(error)}`;
          action.duration = Date.now() - actionStart;
          
          session.actionsPerformed.push(action);
          
          // Create error component report
          const errorReport: ComponentReport = {
            name: healthCheck.component,
            status: HealthStatus.UNHEALTHY,
            issues: [{
              id: this.generateId(),
              severity: 'critical',
              message: `Health check execution failed: ${error instanceof Error ? error.message : String(error)}`,
              component: healthCheck.component,
              timestamp: new Date(),
              resolved: false,
              recommendation: 'Check component configuration and dependencies'
            }],
            metrics: {},
            lastChecked: new Date(),
            details: 'Health check execution failed'
          };
          
          components.push(errorReport);
          allIssues.push(...errorReport.issues);
        }
      }

      const executionTime = Date.now() - startTime;
      const overallHealth = this.calculateOverallHealth(components);
      const criticalIssues = allIssues.filter(issue => issue.severity === 'critical');
      const recommendations = this.generateRecommendations(components, allIssues);

      const report: DiagnosticReport = {
        id: this.generateId(),
        timestamp: new Date(),
        overallHealth,
        components,
        recommendations,
        criticalIssues,
        summary: this.generateSummary(overallHealth, components, criticalIssues),
        executionTime
      };

      session.report = report;
      session.status = 'completed';
      session.endTime = new Date();

      return report;
    } catch (error) {
      session.status = 'failed';
      session.endTime = new Date();
      throw error;
    }
  }

  /**
   * Run diagnostic for specific component
   */
  async runComponentDiagnostic(componentName: string): Promise<ComponentReport> {
    const healthChecks = Array.from(this.healthChecks.values())
      .filter(hc => hc.component === componentName && hc.enabled);

    if (healthChecks.length === 0) {
      return {
        name: componentName,
        status: HealthStatus.UNKNOWN,
        issues: [{
          id: this.generateId(),
          severity: 'medium',
          message: 'No health checks configured for this component',
          component: componentName,
          timestamp: new Date(),
          resolved: false,
          recommendation: 'Configure health checks for this component'
        }],
        metrics: {},
        lastChecked: new Date(),
        details: 'No health checks available'
      };
    }

    const results: HealthResult[] = [];
    const issues: Issue[] = [];
    const metrics: Record<string, any> = {};
    let totalResponseTime = 0;
    let errorCount = 0;

    for (const healthCheck of healthChecks) {
      try {
        const result = await this.executeHealthCheckWithTimeout(healthCheck);
        results.push(result);
        
        totalResponseTime += result.responseTime;
        
        if (result.status === HealthStatus.UNHEALTHY || result.status === HealthStatus.DEGRADED) {
          errorCount++;
          
          issues.push({
            id: this.generateId(),
            severity: result.status === HealthStatus.UNHEALTHY ? 'high' : 'medium',
            message: result.message,
            component: componentName,
            timestamp: result.timestamp,
            resolved: false,
            recommendation: this.getRecommendationForHealthCheck(healthCheck.name, result)
          });
        }

        if (result.metrics) {
          Object.assign(metrics, result.metrics);
        }
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        issues.push({
          id: this.generateId(),
          severity: 'critical',
          message: `Health check execution failed: ${errorMessage}`,
          component: componentName,
          timestamp: new Date(),
          resolved: false,
          recommendation: 'Check health check configuration and component availability'
        });
      }
    }

    const avgResponseTime = results.length > 0 ? totalResponseTime / results.length : 0;
    const errorRate = results.length > 0 ? errorCount / results.length : 0;
    const status = this.determineComponentStatus(results, errorRate);

    return {
      name: componentName,
      status,
      responseTime: avgResponseTime,
      errorRate,
      issues,
      metrics,
      lastChecked: new Date(),
      details: `Executed ${results.length} health checks`
    };
  }

  /**
   * Start real-time monitoring
   */
  startRealTimeMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.runFullDiagnostic();
      } catch (error) {
        console.error('Real-time monitoring error:', error);
      }
    }, this.config.monitoringInterval);
  }

  /**
   * Stop real-time monitoring
   */
  stopRealTimeMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
  }

  /**
   * Get system health summary
   */
  async getSystemHealthSummary(): Promise<SystemHealthSummary> {
    const report = await this.runFullDiagnostic();
    
    const totalComponents = report.components.length;
    const healthyComponents = report.components.filter(c => c.status === HealthStatus.HEALTHY).length;
    const degradedComponents = report.components.filter(c => c.status === HealthStatus.DEGRADED).length;
    const unhealthyComponents = report.components.filter(c => c.status === HealthStatus.UNHEALTHY).length;

    return {
      overallStatus: report.overallHealth,
      totalComponents,
      healthyComponents,
      degradedComponents,
      unhealthyComponents,
      criticalIssues: report.criticalIssues.length,
      lastUpdate: report.timestamp,
      uptime: this.calculateUptime()
    };
  }

  /**
   * Execute health check with timeout
   */
  private async executeHealthCheckWithTimeout(healthCheck: HealthCheck): Promise<HealthResult> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Health check timeout after ${this.config.healthCheckTimeout}ms`));
      }, this.config.healthCheckTimeout);

      healthCheck.execute()
        .then(result => {
          clearTimeout(timeout);
          result.responseTime = Date.now() - startTime;
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Determine component status based on health check results
   */
  private determineComponentStatus(results: HealthResult[], errorRate: number): HealthStatus {
    if (results.length === 0) {
      return HealthStatus.UNKNOWN;
    }

    const unhealthyCount = results.filter(r => r.status === HealthStatus.UNHEALTHY).length;
    const degradedCount = results.filter(r => r.status === HealthStatus.DEGRADED).length;

    if (unhealthyCount > 0 || errorRate >= this.config.criticalThreshold) {
      return HealthStatus.UNHEALTHY;
    }

    if (degradedCount > 0 || errorRate >= this.config.warningThreshold) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }

  /**
   * Calculate overall system health
   */
  private calculateOverallHealth(components: ComponentReport[]): HealthStatus {
    if (components.length === 0) {
      return HealthStatus.UNKNOWN;
    }

    const unhealthyCount = components.filter(c => c.status === HealthStatus.UNHEALTHY).length;
    const degradedCount = components.filter(c => c.status === HealthStatus.DEGRADED).length;
    const totalCount = components.length;

    const unhealthyRatio = unhealthyCount / totalCount;
    const degradedRatio = degradedCount / totalCount;

    if (unhealthyRatio >= this.config.criticalThreshold) {
      return HealthStatus.UNHEALTHY;
    }

    if (unhealthyRatio > 0 || degradedRatio >= this.config.warningThreshold) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }

  /**
   * Generate recommendations based on components and issues
   */
  private generateRecommendations(components: ComponentReport[], issues: Issue[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Critical issues recommendations
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push({
        id: this.generateId(),
        priority: 'critical',
        title: 'Address Critical Issues',
        description: `${criticalIssues.length} critical issues detected that require immediate attention`,
        action: 'Review and resolve critical issues in affected components',
        component: 'system',
        estimatedImpact: 'High - System stability at risk'
      });
    }

    // Performance recommendations
    const slowComponents = components.filter(c => c.responseTime && c.responseTime > 5000);
    if (slowComponents.length > 0) {
      recommendations.push({
        id: this.generateId(),
        priority: 'medium',
        title: 'Optimize Performance',
        description: `${slowComponents.length} components showing slow response times`,
        action: 'Investigate and optimize slow-performing components',
        component: 'performance',
        estimatedImpact: 'Medium - User experience degradation'
      });
    }

    // Error rate recommendations
    const highErrorComponents = components.filter(c => c.errorRate && c.errorRate > 0.1);
    if (highErrorComponents.length > 0) {
      recommendations.push({
        id: this.generateId(),
        priority: 'high',
        title: 'Reduce Error Rates',
        description: `${highErrorComponents.length} components with high error rates`,
        action: 'Investigate and fix components with high error rates',
        component: 'reliability',
        estimatedImpact: 'High - Service reliability affected'
      });
    }

    return recommendations;
  }

  /**
   * Generate diagnostic summary
   */
  private generateSummary(
    overallHealth: HealthStatus,
    components: ComponentReport[],
    criticalIssues: Issue[]
  ): string {
    const totalComponents = components.length;
    const healthyComponents = components.filter(c => c.status === HealthStatus.HEALTHY).length;
    
    let summary = `System Status: ${overallHealth.toUpperCase()}. `;
    summary += `${healthyComponents}/${totalComponents} components healthy. `;
    
    if (criticalIssues.length > 0) {
      summary += `${criticalIssues.length} critical issues require immediate attention.`;
    } else {
      summary += 'No critical issues detected.';
    }

    return summary;
  }

  /**
   * Get recommendation for specific health check failure
   */
  private getRecommendationForHealthCheck(checkName: string, result: HealthResult): string {
    const recommendations: Record<string, string> = {
      'firebase-connectivity': 'Check Firebase configuration and network connectivity',
      'api-health': 'Verify API server status and configuration',
      'database-connection': 'Check database connection and credentials',
      'authentication-service': 'Verify authentication service configuration',
      'environment-config': 'Review environment variables and configuration files'
    };

    return recommendations[checkName] || 'Review component configuration and dependencies';
  }

  /**
   * Start diagnostic session
   */
  private startSession(triggeredBy: 'manual' | 'automatic' | 'error'): DiagnosticSession {
    this.currentSession = {
      id: this.generateId(),
      startTime: new Date(),
      triggeredBy,
      actionsPerformed: [],
      status: 'running'
    };

    return this.currentSession;
  }

  /**
   * Calculate system uptime (placeholder)
   */
  private calculateUptime(): number {
    // This would be implemented based on system start time
    // For now, return a placeholder value
    return Date.now() - (Date.now() - 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `diag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}