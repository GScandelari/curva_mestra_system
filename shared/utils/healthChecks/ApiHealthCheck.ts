/**
 * API Health Check
 * Verifies backend API endpoints are responding correctly
 */

import {
  HealthCheck,
  HealthResult,
  HealthStatus
} from '../../types/diagnosticTypes.js';

export class ApiHealthCheck implements HealthCheck {
  name = 'api-health';
  component = 'backend-api';
  timeout = 5000;
  retryCount = 2;
  enabled = true;

  constructor(
    private baseUrl: string,
    private endpoints: string[] = ['/health', '/api/health'],
    private authToken?: string
  ) {}

  async execute(): Promise<HealthResult> {
    const startTime = Date.now();
    const metrics: Record<string, any> = {};
    const endpointResults: Array<{endpoint: string, status: string, responseTime: number}> = [];

    try {
      if (!this.baseUrl) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: 'API base URL not configured',
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          error: new Error('Base URL missing')
        };
      }

      let healthyEndpoints = 0;
      let totalResponseTime = 0;
      let errors: string[] = [];

      // Test each endpoint
      for (const endpoint of this.endpoints) {
        const endpointStartTime = Date.now();
        
        try {
          const url = `${this.baseUrl}${endpoint}`;
          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };

          if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
          }

          const response = await this.fetchWithTimeout(url, {
            method: 'GET',
            headers
          }, this.timeout);

          const endpointResponseTime = Date.now() - endpointStartTime;
          totalResponseTime += endpointResponseTime;

          if (response.ok) {
            healthyEndpoints++;
            endpointResults.push({
              endpoint,
              status: 'healthy',
              responseTime: endpointResponseTime
            });

            // Try to parse response for additional health info
            try {
              const data = await response.json();
              if (data.status) {
                metrics[`${endpoint}_status`] = data.status;
              }
              if (data.version) {
                metrics[`${endpoint}_version`] = data.version;
              }
              if (data.uptime) {
                metrics[`${endpoint}_uptime`] = data.uptime;
              }
            } catch (parseError) {
              // Response might not be JSON, that's okay
            }
          } else {
            endpointResults.push({
              endpoint,
              status: 'unhealthy',
              responseTime: endpointResponseTime
            });
            errors.push(`${endpoint}: HTTP ${response.status}`);
          }

        } catch (endpointError) {
          const endpointResponseTime = Date.now() - endpointStartTime;
          endpointResults.push({
            endpoint,
            status: 'error',
            responseTime: endpointResponseTime
          });
          
          const errorMessage = endpointError instanceof Error ? endpointError.message : String(endpointError);
          errors.push(`${endpoint}: ${errorMessage}`);
        }
      }

      // Calculate metrics
      const totalEndpoints = this.endpoints.length;
      const healthyRatio = healthyEndpoints / totalEndpoints;
      const avgResponseTime = totalEndpoints > 0 ? totalResponseTime / totalEndpoints : 0;

      metrics.totalEndpoints = totalEndpoints;
      metrics.healthyEndpoints = healthyEndpoints;
      metrics.healthyRatio = healthyRatio;
      metrics.averageResponseTime = avgResponseTime;
      metrics.endpointResults = endpointResults;

      // Determine status
      let status: HealthStatus;
      let message: string;

      if (healthyRatio === 1) {
        status = HealthStatus.HEALTHY;
        message = `All ${totalEndpoints} API endpoints are healthy`;
      } else if (healthyRatio >= 0.5) {
        status = HealthStatus.DEGRADED;
        message = `${healthyEndpoints}/${totalEndpoints} API endpoints are healthy`;
      } else {
        status = HealthStatus.UNHEALTHY;
        message = `Only ${healthyEndpoints}/${totalEndpoints} API endpoints are healthy`;
      }

      // Add performance warnings
      if (avgResponseTime > 3000) {
        status = status === HealthStatus.HEALTHY ? HealthStatus.DEGRADED : status;
        message += ` (slow response time: ${avgResponseTime.toFixed(0)}ms)`;
      }

      if (errors.length > 0) {
        metrics.errors = errors;
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
        message: `API health check failed: ${error.message}`,
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error)),
        metrics
      };
    }
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(
    url: string, 
    options: RequestInit, 
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }
}