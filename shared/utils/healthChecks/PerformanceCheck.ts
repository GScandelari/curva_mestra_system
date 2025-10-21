/**
 * Performance Health Check
 * Monitors system performance metrics and component response times
 */

import {
  HealthCheck,
  HealthResult,
  HealthStatus
} from '../../types/diagnosticTypes.js';

interface PerformanceMetrics {
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
  uptime?: number;
  loadAverage?: number[];
  responseTime?: number;
  throughput?: number;
}

export class PerformanceCheck implements HealthCheck {
  name = 'performance-check';
  component = 'system-performance';
  timeout = 3000;
  retryCount = 1;
  enabled = true;

  private thresholds = {
    memory: {
      warning: 0.8,  // 80% of available memory
      critical: 0.95 // 95% of available memory
    },
    responseTime: {
      warning: 1000,  // 1 second
      critical: 3000  // 3 seconds
    },
    cpu: {
      warning: 0.7,   // 70% CPU usage
      critical: 0.9   // 90% CPU usage
    }
  };

  constructor(
    private customThresholds?: Partial<typeof PerformanceCheck.prototype.thresholds>
  ) {
    if (customThresholds) {
      this.thresholds = { ...this.thresholds, ...customThresholds };
    }
  }

  async execute(): Promise<HealthResult> {
    const startTime = Date.now();
    const metrics: Record<string, any> = {};
    const issues: string[] = [];
    const warnings: string[] = [];

    try {
      // Collect performance metrics
      const performanceMetrics = await this.collectMetrics();
      
      // Memory analysis
      if (performanceMetrics.memoryUsage) {
        const memory = performanceMetrics.memoryUsage;
        const memoryUsageRatio = memory.heapUsed / memory.heapTotal;
        
        metrics.memoryUsage = {
          heapUsed: Math.round(memory.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memory.heapTotal / 1024 / 1024), // MB
          rss: Math.round(memory.rss / 1024 / 1024), // MB
          external: Math.round(memory.external / 1024 / 1024), // MB
          usageRatio: Math.round(memoryUsageRatio * 100) / 100
        };

        if (memoryUsageRatio >= this.thresholds.memory.critical) {
          issues.push(`Critical memory usage: ${Math.round(memoryUsageRatio * 100)}%`);
        } else if (memoryUsageRatio >= this.thresholds.memory.warning) {
          warnings.push(`High memory usage: ${Math.round(memoryUsageRatio * 100)}%`);
        }
      }

      // CPU analysis (Node.js only)
      if (performanceMetrics.cpuUsage && typeof process !== 'undefined') {
        const cpu = performanceMetrics.cpuUsage;
        const cpuUsagePercent = (cpu.user + cpu.system) / 1000000; // Convert to seconds
        
        metrics.cpuUsage = {
          user: cpu.user,
          system: cpu.system,
          percent: Math.round(cpuUsagePercent * 100) / 100
        };

        if (cpuUsagePercent >= this.thresholds.cpu.critical) {
          issues.push(`Critical CPU usage: ${Math.round(cpuUsagePercent * 100)}%`);
        } else if (cpuUsagePercent >= this.thresholds.cpu.warning) {
          warnings.push(`High CPU usage: ${Math.round(cpuUsagePercent * 100)}%`);
        }
      }

      // Uptime analysis
      if (performanceMetrics.uptime) {
        const uptimeHours = performanceMetrics.uptime / 3600;
        metrics.uptime = {
          seconds: performanceMetrics.uptime,
          hours: Math.round(uptimeHours * 100) / 100,
          formatted: this.formatUptime(performanceMetrics.uptime)
        };
      }

      // Load average analysis (Unix systems only)
      if (performanceMetrics.loadAverage) {
        const [load1, load5, load15] = performanceMetrics.loadAverage;
        metrics.loadAverage = {
          '1min': Math.round(load1 * 100) / 100,
          '5min': Math.round(load5 * 100) / 100,
          '15min': Math.round(load15 * 100) / 100
        };

        // High load average indicates system stress
        if (load1 > 2.0) {
          warnings.push(`High system load: ${Math.round(load1 * 100) / 100}`);
        }
      }

      // Response time analysis
      const responseTime = Date.now() - startTime;
      metrics.responseTime = responseTime;

      if (responseTime >= this.thresholds.responseTime.critical) {
        issues.push(`Critical response time: ${responseTime}ms`);
      } else if (responseTime >= this.thresholds.responseTime.warning) {
        warnings.push(`Slow response time: ${responseTime}ms`);
      }

      // Browser-specific metrics
      if (typeof window !== 'undefined' && window.performance) {
        const navigation = window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          metrics.browserPerformance = {
            domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart),
            loadComplete: Math.round(navigation.loadEventEnd - navigation.loadEventStart),
            firstPaint: this.getFirstPaint(),
            firstContentfulPaint: this.getFirstContentfulPaint()
          };
        }

        // Check for memory leaks (if available)
        if ((window.performance as any).memory) {
          const memory = (window.performance as any).memory;
          metrics.browserMemory = {
            usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
            totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
            jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) // MB
          };

          const memoryRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
          if (memoryRatio > 0.9) {
            warnings.push(`High browser memory usage: ${Math.round(memoryRatio * 100)}%`);
          }
        }
      }

      // Determine overall status
      let status: HealthStatus;
      let message: string;

      if (issues.length > 0) {
        status = HealthStatus.UNHEALTHY;
        message = `Performance issues detected: ${issues.join(', ')}`;
      } else if (warnings.length > 0) {
        status = HealthStatus.DEGRADED;
        message = `Performance warnings: ${warnings.join(', ')}`;
      } else {
        status = HealthStatus.HEALTHY;
        message = 'System performance is optimal';
      }

      if (issues.length > 0) {
        metrics.issues = issues;
      }
      if (warnings.length > 0) {
        metrics.warnings = warnings;
      }

      return {
        status,
        message,
        timestamp: new Date(),
        responseTime,
        metrics
      };

    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: `Performance check failed: ${error.message}`,
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error)),
        metrics
      };
    }
  }

  /**
   * Collect performance metrics from available sources
   */
  private async collectMetrics(): Promise<PerformanceMetrics> {
    const metrics: PerformanceMetrics = {};

    try {
      // Node.js metrics
      if (typeof process !== 'undefined') {
        metrics.memoryUsage = process.memoryUsage();
        metrics.cpuUsage = process.cpuUsage();
        metrics.uptime = process.uptime();

        // Load average (Unix systems only)
        if (typeof require !== 'undefined') {
          try {
            const os = require('os');
            metrics.loadAverage = os.loadavg();
          } catch (osError) {
            // OS module not available or not supported
          }
        }
      }

      // Browser metrics
      if (typeof window !== 'undefined' && window.performance) {
        // Performance timing is handled in the main execute method
      }

      // Simulate some async work to measure response time
      await new Promise(resolve => setTimeout(resolve, 10));

    } catch (error) {
      // Metrics collection failed, but we can still return partial data
      console.warn('Failed to collect some performance metrics:', error);
    }

    return metrics;
  }

  /**
   * Get First Paint timing (browser only)
   */
  private getFirstPaint(): number | undefined {
    if (typeof window === 'undefined' || !window.performance) return undefined;

    const paintEntries = window.performance.getEntriesByType('paint');
    const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
    return firstPaint ? Math.round(firstPaint.startTime) : undefined;
  }

  /**
   * Get First Contentful Paint timing (browser only)
   */
  private getFirstContentfulPaint(): number | undefined {
    if (typeof window === 'undefined' || !window.performance) return undefined;

    const paintEntries = window.performance.getEntriesByType('paint');
    const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    return firstContentfulPaint ? Math.round(firstContentfulPaint.startTime) : undefined;
  }

  /**
   * Format uptime in human-readable format
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(newThresholds: Partial<typeof PerformanceCheck.prototype.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }
}