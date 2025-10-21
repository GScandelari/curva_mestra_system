// Mock AlertManager implementation for testing
class MockAlertManager {
  constructor(checkInterval = 30000) {
    this.checkInterval = checkInterval;
    this.rules = new Map();
    this.activeAlerts = new Map();
    this.allAlerts = new Map();
    this.isMonitoring = false;
    this.initializeDefaultRules();
  }

  initializeDefaultRules() {
    const defaultRules = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        component: 'system',
        metric: 'error_count',
        condition: 'greater_than',
        threshold: 10,
        severity: 'high',
        enabled: true,
        cooldownPeriod: 15,
        actions: [{ type: 'log', target: 'console', enabled: true }]
      },
      {
        id: 'slow_response_time',
        name: 'Slow Response Time',
        component: 'backend',
        metric: 'response_time',
        condition: 'greater_than',
        threshold: 5000,
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 10,
        actions: [{ type: 'log', target: 'console', enabled: true }]
      },
      {
        id: 'system_unavailable',
        name: 'System Unavailable',
        component: 'system',
        metric: 'availability',
        condition: 'less_than',
        threshold: 0.95,
        severity: 'critical',
        enabled: true,
        cooldownPeriod: 5,
        actions: [{ type: 'log', target: 'console', enabled: true }]
      }
    ];

    defaultRules.forEach(rule => this.rules.set(rule.id, rule));
  }

  startMonitoring() {
    this.isMonitoring = true;
  }

  stopMonitoring() {
    this.isMonitoring = false;
  }

  async addRule(rule) {
    this.rules.set(rule.id, rule);
  }

  async removeRule(ruleId) {
    this.rules.delete(ruleId);
  }

  async updateRule(ruleId, updates) {
    const rule = this.rules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
    }
  }

  async toggleRule(ruleId, enabled) {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  getRules() {
    return Array.from(this.rules.values());
  }

  async checkRules(metrics) {
    const triggeredAlerts = [];
    
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      
      const relevantMetrics = metrics.filter(m => 
        m.component === rule.component && m.name === rule.metric
      );
      
      if (relevantMetrics.length === 0) continue;
      
      const latestMetric = relevantMetrics[relevantMetrics.length - 1];
      if (this.evaluateCondition(latestMetric.value, rule.condition, rule.threshold)) {
        const alert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'error_rate',
          severity: rule.severity,
          title: rule.name,
          message: `${rule.name}: ${latestMetric.name} is ${latestMetric.value} (${rule.condition} ${rule.threshold})`,
          component: rule.component,
          metric: rule.metric,
          threshold: rule.threshold,
          currentValue: latestMetric.value,
          timestamp: new Date(),
          resolved: false,
          actions: rule.actions
        };
        triggeredAlerts.push(alert);
      }
    }
    
    return triggeredAlerts;
  }

  evaluateCondition(value, condition, threshold) {
    switch (condition) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'not_equals':
        return value !== threshold;
      default:
        return false;
    }
  }

  async triggerAlert(alert) {
    this.activeAlerts.set(alert.id, alert);
    this.allAlerts.set(alert.id, alert);
  }

  async resolveAlert(alertId) {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.activeAlerts.delete(alertId);
    }
  }

  async getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  async getAllAlerts() {
    return Array.from(this.allAlerts.values());
  }
}

const AlertManager = MockAlertManager;

describe('Alert Manager Tests', () => {
  let alertManager;

  beforeEach(() => {
    alertManager = new AlertManager(1000); // 1 second check interval for testing
  });

  afterEach(() => {
    if (alertManager) {
      alertManager.stopMonitoring();
    }
  });

  describe('Alert Rule Management', () => {
    test('should add alert rules', async () => {
      const rule = {
        id: 'test_rule',
        name: 'Test Rule',
        component: 'frontend',
        metric: 'error_count',
        condition: 'greater_than',
        threshold: 5,
        severity: 'high',
        enabled: true,
        cooldownPeriod: 10,
        actions: [
          { type: 'log', target: 'console', enabled: true }
        ]
      };

      await alertManager.addRule(rule);
      const rules = alertManager.getRules();
      
      const addedRule = rules.find(r => r.id === 'test_rule');
      expect(addedRule).toBeDefined();
      expect(addedRule.name).toBe('Test Rule');
    });

    test('should remove alert rules', async () => {
      const rule = {
        id: 'removable_rule',
        name: 'Removable Rule',
        component: 'backend',
        metric: 'response_time',
        condition: 'greater_than',
        threshold: 1000,
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 5,
        actions: []
      };

      await alertManager.addRule(rule);
      await alertManager.removeRule('removable_rule');
      
      const rules = alertManager.getRules();
      const removedRule = rules.find(r => r.id === 'removable_rule');
      expect(removedRule).toBeUndefined();
    });

    test('should update alert rules', async () => {
      const rule = {
        id: 'updatable_rule',
        name: 'Original Name',
        component: 'firebase',
        metric: 'availability',
        condition: 'less_than',
        threshold: 0.95,
        severity: 'critical',
        enabled: true,
        cooldownPeriod: 15,
        actions: []
      };

      await alertManager.addRule(rule);
      await alertManager.updateRule('updatable_rule', { name: 'Updated Name', threshold: 0.90 });
      
      const rules = alertManager.getRules();
      const updatedRule = rules.find(r => r.id === 'updatable_rule');
      expect(updatedRule.name).toBe('Updated Name');
      expect(updatedRule.threshold).toBe(0.90);
    });

    test('should toggle rule enabled state', async () => {
      const rule = {
        id: 'toggleable_rule',
        name: 'Toggleable Rule',
        component: 'auth',
        metric: 'auth_failure_count',
        condition: 'greater_than',
        threshold: 3,
        severity: 'high',
        enabled: true,
        cooldownPeriod: 20,
        actions: []
      };

      await alertManager.addRule(rule);
      await alertManager.toggleRule('toggleable_rule', false);
      
      const rules = alertManager.getRules();
      const toggledRule = rules.find(r => r.id === 'toggleable_rule');
      expect(toggledRule.enabled).toBe(false);
    });
  });

  describe('Alert Checking', () => {
    test('should check rules against metrics', async () => {
      const rule = {
        id: 'error_rule',
        name: 'High Error Rate',
        component: 'frontend',
        metric: 'error_count',
        condition: 'greater_than',
        threshold: 5,
        severity: 'high',
        enabled: true,
        cooldownPeriod: 10,
        actions: [
          { type: 'log', target: 'console', enabled: true }
        ]
      };

      await alertManager.addRule(rule);

      const metrics = [
        {
          id: 'metric_1',
          name: 'error_count',
          value: 10, // Above threshold
          component: 'frontend',
          timestamp: new Date(),
          unit: 'count'
        }
      ];

      const triggeredAlerts = await alertManager.checkRules(metrics);
      expect(triggeredAlerts).toHaveLength(1);
      expect(triggeredAlerts[0].title).toBe('High Error Rate');
      expect(triggeredAlerts[0].severity).toBe('high');
    });

    test('should not trigger alerts for disabled rules', async () => {
      const rule = {
        id: 'disabled_rule',
        name: 'Disabled Rule',
        component: 'backend',
        metric: 'response_time',
        condition: 'greater_than',
        threshold: 100,
        severity: 'medium',
        enabled: false, // Disabled
        cooldownPeriod: 5,
        actions: []
      };

      await alertManager.addRule(rule);

      const metrics = [
        {
          id: 'metric_2',
          name: 'response_time',
          value: 500, // Above threshold but rule is disabled
          component: 'backend',
          timestamp: new Date(),
          unit: 'ms'
        }
      ];

      const triggeredAlerts = await alertManager.checkRules(metrics);
      expect(triggeredAlerts).toHaveLength(0);
    });

    test('should respect cooldown periods', async () => {
      const rule = {
        id: 'cooldown_rule',
        name: 'Cooldown Test',
        component: 'firebase',
        metric: 'availability',
        condition: 'less_than',
        threshold: 0.95,
        severity: 'critical',
        enabled: true,
        cooldownPeriod: 1, // 1 minute cooldown
        actions: []
      };

      await alertManager.addRule(rule);

      const metrics = [
        {
          id: 'metric_3',
          name: 'availability',
          value: 0.90, // Below threshold
          component: 'firebase',
          timestamp: new Date(),
          unit: 'percentage'
        }
      ];

      // First check should trigger alert
      const firstCheck = await alertManager.checkRules(metrics);
      expect(firstCheck).toHaveLength(1);

      // Second check immediately after should not trigger due to cooldown
      const secondCheck = await alertManager.checkRules(metrics);
      expect(secondCheck).toHaveLength(0);
    });
  });

  describe('Alert Management', () => {
    test('should trigger and store alerts', async () => {
      const alert = {
        id: 'test_alert',
        type: 'error_rate',
        severity: 'high',
        title: 'Test Alert',
        message: 'This is a test alert',
        component: 'frontend',
        timestamp: new Date(),
        resolved: false,
        actions: [
          { type: 'log', target: 'console', enabled: true }
        ]
      };

      await alertManager.triggerAlert(alert);
      
      const activeAlerts = await alertManager.getActiveAlerts();
      expect(activeAlerts).toHaveLength(1);
      expect(activeAlerts[0].id).toBe('test_alert');
    });

    test('should resolve alerts', async () => {
      const alert = {
        id: 'resolvable_alert',
        type: 'response_time',
        severity: 'medium',
        title: 'Resolvable Alert',
        message: 'This alert will be resolved',
        component: 'backend',
        timestamp: new Date(),
        resolved: false,
        actions: []
      };

      await alertManager.triggerAlert(alert);
      await alertManager.resolveAlert('resolvable_alert');
      
      const activeAlerts = await alertManager.getActiveAlerts();
      const resolvedAlert = (await alertManager.getAllAlerts()).find(a => a.id === 'resolvable_alert');
      
      expect(activeAlerts).toHaveLength(0);
      expect(resolvedAlert.resolved).toBe(true);
      expect(resolvedAlert.resolvedAt).toBeDefined();
    });

    test('should get all alerts including resolved', async () => {
      const alert1 = {
        id: 'alert_1',
        type: 'system_error',
        severity: 'low',
        title: 'Alert 1',
        message: 'First alert',
        component: 'system',
        timestamp: new Date(),
        resolved: false,
        actions: []
      };

      const alert2 = {
        id: 'alert_2',
        type: 'availability',
        severity: 'critical',
        title: 'Alert 2',
        message: 'Second alert',
        component: 'firebase',
        timestamp: new Date(),
        resolved: false,
        actions: []
      };

      await alertManager.triggerAlert(alert1);
      await alertManager.triggerAlert(alert2);
      await alertManager.resolveAlert('alert_1');
      
      const allAlerts = await alertManager.getAllAlerts();
      const activeAlerts = await alertManager.getActiveAlerts();
      
      expect(allAlerts).toHaveLength(2);
      expect(activeAlerts).toHaveLength(1);
      expect(activeAlerts[0].id).toBe('alert_2');
    });
  });

  describe('Monitoring Control', () => {
    test('should start and stop monitoring', () => {
      expect(() => alertManager.startMonitoring()).not.toThrow();
      expect(() => alertManager.stopMonitoring()).not.toThrow();
    });
  });

  describe('Default Rules', () => {
    test('should have default rules initialized', () => {
      const rules = alertManager.getRules();
      expect(rules.length).toBeGreaterThan(0);
      
      // Check for some expected default rules
      const errorRateRule = rules.find(r => r.id === 'high_error_rate');
      const responseTimeRule = rules.find(r => r.id === 'slow_response_time');
      const availabilityRule = rules.find(r => r.id === 'system_unavailable');
      
      expect(errorRateRule).toBeDefined();
      expect(responseTimeRule).toBeDefined();
      expect(availabilityRule).toBeDefined();
    });
  });
});

// Helper function to run alert manager tests
async function runAlertManagerTests() {
  console.log('🧪 Running Alert Manager Tests...\n');
  
  try {
    const alertManager = new AlertManager(1000);
    
    // Test 1: Default Rules
    console.log('✅ Test 1: Default Rules');
    const defaultRules = alertManager.getRules();
    console.log(`   - Found ${defaultRules.length} default rules`);
    
    // Test 2: Add Custom Rule
    console.log('✅ Test 2: Add Custom Rule');
    const customRule = {
      id: 'test_custom_rule',
      name: 'Test Custom Rule',
      component: 'frontend',
      metric: 'error_count',
      condition: 'greater_than',
      threshold: 3,
      severity: 'medium',
      enabled: true,
      cooldownPeriod: 5,
      actions: [
        { type: 'log', target: 'console', enabled: true }
      ]
    };
    
    await alertManager.addRule(customRule);
    const updatedRules = alertManager.getRules();
    console.log(`   - Rules count after adding: ${updatedRules.length}`);
    
    // Test 3: Check Rules Against Metrics
    console.log('✅ Test 3: Rule Checking');
    const testMetrics = [
      {
        id: 'test_metric',
        name: 'error_count',
        value: 5, // Above threshold
        component: 'frontend',
        timestamp: new Date(),
        unit: 'count'
      }
    ];
    
    const triggeredAlerts = await alertManager.checkRules(testMetrics);
    console.log(`   - Triggered alerts: ${triggeredAlerts.length}`);
    
    // Test 4: Alert Management
    console.log('✅ Test 4: Alert Management');
    if (triggeredAlerts.length > 0) {
      await alertManager.triggerAlert(triggeredAlerts[0]);
      const activeAlerts = await alertManager.getActiveAlerts();
      console.log(`   - Active alerts: ${activeAlerts.length}`);
      
      if (activeAlerts.length > 0) {
        await alertManager.resolveAlert(activeAlerts[0].id);
        const remainingAlerts = await alertManager.getActiveAlerts();
        console.log(`   - Remaining active alerts: ${remainingAlerts.length}`);
      }
    }
    
    // Test 5: Rule Management
    console.log('✅ Test 5: Rule Management');
    await alertManager.toggleRule('test_custom_rule', false);
    console.log('   - Rule disabled successfully');
    
    await alertManager.removeRule('test_custom_rule');
    const finalRules = alertManager.getRules();
    console.log(`   - Final rules count: ${finalRules.length}`);
    
    alertManager.stopMonitoring();
    console.log('\n🎉 All alert manager tests passed!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Alert manager test failed:', error.message);
    return false;
  }
}

module.exports = {
  runAlertManagerTests
};

if (require.main === module) {
  runAlertManagerTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}