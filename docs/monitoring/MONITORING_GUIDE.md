# Guia de Monitoramento - Plataforma Curva Mestra

## Visão Geral

Este guia fornece instruções completas para configurar, usar e manter o sistema de monitoramento da plataforma Curva Mestra, incluindo métricas, alertas, dashboards e troubleshooting.

## Arquitetura de Monitoramento

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Coleta de     │    │   Processamento │    │   Visualização  │
│   Métricas      │───►│   e Alertas     │───►│   e Dashboards  │
│                 │    │                 │    │                 │
│ • Frontend      │    │ • Agregação     │    │ • Dashboard     │
│ • Backend       │    │ • Análise       │    │ • Alertas       │
│ • Firebase      │    │ • Correlação    │    │ • Relatórios    │
│ • Infraestrutura│    │ • Alertas       │    │ • Notificações  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Configuração Inicial

### 1. Instalação e Setup

#### Dependências
```bash
# Instalar dependências de monitoramento
npm install --save-dev @types/node
npm install winston prometheus-client prom-client

# Configurar ferramentas de monitoramento
node scripts/setup-monitoring.js
```

#### Configuração Básica
```env
# Configurações de Monitoramento (.env)
ENABLE_MONITORING=true
METRICS_COLLECTION_INTERVAL=60000
METRICS_RETENTION_DAYS=30
ALERT_EMAIL=admin@curvamestra.com
ALERT_WEBHOOK_URL=https://hooks.slack.com/your-webhook
LOG_LEVEL=info
PERFORMANCE_MONITORING=true
ERROR_TRACKING=true
```

### 2. Inicialização do Sistema

#### Script de Inicialização
```javascript
// scripts/initMonitoring.js
const { MonitoringSystem } = require('../shared/utils/MonitoringSystem');

async function initializeMonitoring() {
  console.log('🔧 Inicializando sistema de monitoramento...');
  
  const monitoring = new MonitoringSystem({
    metricsInterval: process.env.METRICS_COLLECTION_INTERVAL || 60000,
    retentionDays: process.env.METRICS_RETENTION_DAYS || 30,
    alertEmail: process.env.ALERT_EMAIL,
    enablePerformanceMonitoring: process.env.PERFORMANCE_MONITORING === 'true'
  });
  
  // Inicializar coleta de métricas
  await monitoring.startMetricsCollection();
  
  // Configurar alertas
  await monitoring.setupAlerts();
  
  // Iniciar health checks
  await monitoring.startHealthChecks();
  
  console.log('✅ Sistema de monitoramento inicializado');
}

initializeMonitoring().catch(console.error);
```

## Métricas Coletadas

### 1. Métricas de Sistema

#### Performance da Aplicação
```javascript
// Métricas coletadas automaticamente
const systemMetrics = {
  // Performance
  responseTime: 'Tempo de resposta médio (ms)',
  throughput: 'Requisições por segundo',
  errorRate: 'Taxa de erro (%)',
  
  // Recursos
  cpuUsage: 'Uso de CPU (%)',
  memoryUsage: 'Uso de memória (MB)',
  diskUsage: 'Uso de disco (%)',
  
  // Rede
  networkLatency: 'Latência de rede (ms)',
  bandwidthUsage: 'Uso de banda (MB/s)',
  
  // Aplicação
  activeUsers: 'Usuários ativos',
  sessionDuration: 'Duração média de sessão (min)',
  pageLoadTime: 'Tempo de carregamento de página (ms)'
};
```

#### Métricas Firebase
```javascript
// Métricas específicas do Firebase
const firebaseMetrics = {
  // Firestore
  firestoreReads: 'Leituras Firestore por minuto',
  firestoreWrites: 'Escritas Firestore por minuto',
  firestoreDeletes: 'Exclusões Firestore por minuto',
  
  // Authentication
  authSignIns: 'Logins por hora',
  authSignUps: 'Registros por hora',
  authErrors: 'Erros de autenticação por hora',
  
  // Functions
  functionInvocations: 'Invocações de Functions',
  functionDuration: 'Duração média de Functions (ms)',
  functionErrors: 'Erros em Functions',
  
  // Hosting
  hostingRequests: 'Requisições de Hosting',
  hostingBandwidth: 'Banda utilizada (GB)',
  hostingCacheHitRate: 'Taxa de acerto do cache (%)'
};
```

### 2. Métricas Customizadas

#### Métricas de Negócio
```javascript
// Definir métricas específicas do negócio
const businessMetrics = {
  // Usuários
  newUserRegistrations: 'Novos registros de usuário',
  userRetentionRate: 'Taxa de retenção de usuários (%)',
  dailyActiveUsers: 'Usuários ativos diários',
  
  // Funcionalidades
  invoicesCreated: 'Faturas criadas',
  reportsGenerated: 'Relatórios gerados',
  patientsRegistered: 'Pacientes cadastrados',
  
  // Performance de Negócio
  averageSessionValue: 'Valor médio por sessão',
  conversionRate: 'Taxa de conversão (%)',
  featureUsageRate: 'Taxa de uso de funcionalidades (%)'
};
```

## Dashboards

### 1. Dashboard Principal

#### Visão Geral do Sistema
```javascript
// Configuração do dashboard principal
const mainDashboard = {
  title: 'Curva Mestra - Visão Geral',
  refreshInterval: 30000, // 30 segundos
  
  widgets: [
    {
      type: 'metric',
      title: 'Status do Sistema',
      metric: 'system.health',
      thresholds: {
        good: 95,
        warning: 85,
        critical: 70
      }
    },
    {
      type: 'chart',
      title: 'Tempo de Resposta',
      metric: 'performance.responseTime',
      timeRange: '1h',
      chartType: 'line'
    },
    {
      type: 'chart',
      title: 'Taxa de Erro',
      metric: 'errors.rate',
      timeRange: '24h',
      chartType: 'area'
    },
    {
      type: 'table',
      title: 'Componentes Críticos',
      data: 'components.health',
      columns: ['component', 'status', 'lastCheck']
    }
  ]
};
```

### 2. Dashboard de Performance

#### Métricas de Performance Detalhadas
```javascript
const performanceDashboard = {
  title: 'Performance - Análise Detalhada',
  
  sections: [
    {
      title: 'Frontend Performance',
      widgets: [
        'frontend.loadTime',
        'frontend.renderTime',
        'frontend.bundleSize',
        'frontend.cacheHitRate'
      ]
    },
    {
      title: 'Backend Performance',
      widgets: [
        'backend.responseTime',
        'backend.throughput',
        'backend.queueLength',
        'backend.dbConnectionPool'
      ]
    },
    {
      title: 'Firebase Performance',
      widgets: [
        'firebase.functionDuration',
        'firebase.firestoreLatency',
        'firebase.authLatency',
        'firebase.quotaUsage'
      ]
    }
  ]
};
```

### 3. Dashboard de Erros

#### Monitoramento de Erros e Problemas
```javascript
const errorDashboard = {
  title: 'Monitoramento de Erros',
  
  widgets: [
    {
      type: 'alert-summary',
      title: 'Alertas Ativos',
      showCritical: true,
      showWarning: true
    },
    {
      type: 'error-trends',
      title: 'Tendência de Erros',
      timeRange: '7d',
      groupBy: 'errorType'
    },
    {
      type: 'error-details',
      title: 'Erros Recentes',
      limit: 50,
      showStackTrace: true
    },
    {
      type: 'recovery-status',
      title: 'Status de Recuperação',
      showAutoRecovery: true,
      showManualActions: true
    }
  ]
};
```

## Sistema de Alertas

### 1. Configuração de Alertas

#### Regras de Alerta
```javascript
// Configuração de alertas
const alertRules = [
  {
    name: 'High Error Rate',
    condition: 'errors.rate > 5%',
    severity: 'critical',
    duration: '5m',
    actions: ['email', 'slack', 'auto-recovery']
  },
  {
    name: 'Slow Response Time',
    condition: 'performance.responseTime > 2000ms',
    severity: 'warning',
    duration: '10m',
    actions: ['email']
  },
  {
    name: 'System Down',
    condition: 'system.health < 50%',
    severity: 'critical',
    duration: '1m',
    actions: ['email', 'slack', 'sms', 'auto-recovery']
  },
  {
    name: 'High Memory Usage',
    condition: 'system.memoryUsage > 85%',
    severity: 'warning',
    duration: '15m',
    actions: ['email', 'cleanup']
  },
  {
    name: 'Firebase Quota Near Limit',
    condition: 'firebase.quotaUsage > 90%',
    severity: 'warning',
    duration: '1h',
    actions: ['email', 'optimize']
  }
];
```

### 2. Canais de Notificação

#### Email
```javascript
// Configuração de alertas por email
const emailConfig = {
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.ALERT_EMAIL_USER,
      pass: process.env.ALERT_EMAIL_PASS
    }
  },
  templates: {
    critical: 'templates/alert-critical.html',
    warning: 'templates/alert-warning.html',
    recovery: 'templates/alert-recovery.html'
  },
  recipients: {
    critical: ['admin@curvamestra.com', 'dev@curvamestra.com'],
    warning: ['admin@curvamestra.com'],
    info: ['logs@curvamestra.com']
  }
};
```

#### Slack
```javascript
// Configuração de alertas Slack
const slackConfig = {
  webhookUrl: process.env.SLACK_WEBHOOK_URL,
  channels: {
    critical: '#alerts-critical',
    warning: '#alerts-warning',
    info: '#monitoring'
  },
  messageFormat: {
    critical: '🚨 *CRÍTICO*: {title}\n{description}\n*Ação:* {action}',
    warning: '⚠️ *AVISO*: {title}\n{description}',
    recovery: '✅ *RECUPERADO*: {title}\n{description}'
  }
};
```

## Health Checks

### 1. Health Checks Automáticos

#### Verificações de Sistema
```javascript
// Health checks configurados
const healthChecks = [
  {
    name: 'Frontend Accessibility',
    type: 'http',
    url: 'https://curvamestra.com/health',
    interval: '30s',
    timeout: '10s',
    expectedStatus: 200
  },
  {
    name: 'API Endpoints',
    type: 'http',
    url: 'https://api.curvamestra.com/health',
    interval: '1m',
    timeout: '15s',
    expectedStatus: 200
  },
  {
    name: 'Firebase Connectivity',
    type: 'custom',
    function: 'checkFirebaseConnectivity',
    interval: '2m',
    timeout: '30s'
  },
  {
    name: 'Database Performance',
    type: 'custom',
    function: 'checkDatabasePerformance',
    interval: '5m',
    timeout: '1m'
  }
];
```

### 2. Health Checks Customizados

#### Verificações Específicas
```javascript
// Implementação de health checks customizados
class CustomHealthChecks {
  
  async checkFirebaseConnectivity() {
    try {
      // Testar Firestore
      await admin.firestore().collection('health').doc('test').get();
      
      // Testar Auth
      await admin.auth().listUsers(1);
      
      // Testar Functions
      const response = await fetch('https://us-central1-project.cloudfunctions.net/health');
      
      return {
        status: 'healthy',
        details: {
          firestore: 'ok',
          auth: 'ok',
          functions: response.ok ? 'ok' : 'degraded'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
  
  async checkDatabasePerformance() {
    const startTime = Date.now();
    
    try {
      // Executar query de teste
      await admin.firestore()
        .collection('performance_test')
        .limit(10)
        .get();
      
      const duration = Date.now() - startTime;
      
      return {
        status: duration < 1000 ? 'healthy' : 'degraded',
        responseTime: duration,
        threshold: 1000
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}
```

## Logs e Auditoria

### 1. Configuração de Logs

#### Estrutura de Logs
```javascript
// Configuração do sistema de logs
const logConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: 'json',
  
  transports: [
    // Console (desenvolvimento)
    {
      type: 'console',
      level: 'debug',
      format: 'simple'
    },
    
    // Arquivo (produção)
    {
      type: 'file',
      filename: 'logs/app.log',
      level: 'info',
      maxSize: '10MB',
      maxFiles: 5,
      format: 'json'
    },
    
    // Arquivo de erros
    {
      type: 'file',
      filename: 'logs/error.log',
      level: 'error',
      maxSize: '10MB',
      maxFiles: 10,
      format: 'json'
    }
  ],
  
  // Campos padrão em todos os logs
  defaultMeta: {
    service: 'curva-mestra',
    version: process.env.APP_VERSION,
    environment: process.env.NODE_ENV
  }
};
```

### 2. Auditoria de Ações

#### Log de Auditoria
```javascript
// Sistema de auditoria
class AuditLogger {
  
  logUserAction(userId, action, details) {
    this.log('audit', {
      type: 'user_action',
      userId,
      action,
      details,
      timestamp: new Date().toISOString(),
      ip: details.ip,
      userAgent: details.userAgent
    });
  }
  
  logSystemEvent(event, details) {
    this.log('audit', {
      type: 'system_event',
      event,
      details,
      timestamp: new Date().toISOString(),
      component: details.component
    });
  }
  
  logSecurityEvent(event, details) {
    this.log('security', {
      type: 'security_event',
      event,
      details,
      timestamp: new Date().toISOString(),
      severity: details.severity || 'medium'
    });
  }
}
```

## Ferramentas de Monitoramento

### 1. CLI de Monitoramento

#### Comandos Disponíveis
```bash
# Status geral do sistema
node scripts/monitoring/status.js

# Métricas em tempo real
node scripts/monitoring/metrics.js --live

# Verificar alertas ativos
node scripts/monitoring/alerts.js --active

# Executar health checks
node scripts/monitoring/health.js --all

# Gerar relatório
node scripts/monitoring/report.js --period=24h

# Limpar dados antigos
node scripts/monitoring/cleanup.js --older-than=30d
```

### 2. Interface Web

#### Dashboard Web
```javascript
// Servidor do dashboard web
const express = require('express');
const { MonitoringDashboard } = require('../shared/utils/MonitoringDashboard');

const app = express();
const dashboard = new MonitoringDashboard();

// Endpoint para métricas
app.get('/api/metrics', async (req, res) => {
  const metrics = await dashboard.getCurrentMetrics();
  res.json(metrics);
});

// Endpoint para alertas
app.get('/api/alerts', async (req, res) => {
  const alerts = await dashboard.getActiveAlerts();
  res.json(alerts);
});

// Endpoint para health checks
app.get('/api/health', async (req, res) => {
  const health = await dashboard.getSystemHealth();
  res.json(health);
});

// Servir dashboard estático
app.use(express.static('frontend/dist'));

app.listen(3001, () => {
  console.log('📊 Dashboard de monitoramento disponível em http://localhost:3001');
});
```

## Troubleshooting de Monitoramento

### Problemas Comuns

#### 1. Métricas Não Coletadas
```bash
# Verificar se o serviço está rodando
ps aux | grep monitoring

# Verificar logs do sistema de monitoramento
tail -f logs/monitoring.log

# Reiniciar coleta de métricas
node scripts/monitoring/restart.js
```

#### 2. Alertas Não Funcionando
```bash
# Testar configuração de alertas
node scripts/monitoring/test-alerts.js

# Verificar conectividade SMTP/Slack
node scripts/monitoring/test-notifications.js

# Verificar regras de alerta
node scripts/monitoring/validate-rules.js
```

#### 3. Dashboard Não Carregando
```bash
# Verificar se o servidor está rodando
curl http://localhost:3001/api/health

# Verificar logs do dashboard
tail -f logs/dashboard.log

# Reiniciar dashboard
npm run restart:dashboard
```

## Otimização de Performance

### 1. Otimização de Coleta

#### Configurações Otimizadas
```javascript
// Configurações para diferentes ambientes
const optimizedConfig = {
  development: {
    metricsInterval: 30000,    // 30 segundos
    retentionDays: 7,          // 1 semana
    detailedLogging: true
  },
  
  staging: {
    metricsInterval: 60000,    // 1 minuto
    retentionDays: 14,         // 2 semanas
    detailedLogging: false
  },
  
  production: {
    metricsInterval: 300000,   // 5 minutos
    retentionDays: 90,         // 3 meses
    detailedLogging: false,
    compression: true,
    sampling: 0.1              // 10% de amostragem
  }
};
```

### 2. Limpeza Automática

#### Script de Limpeza
```bash
#!/bin/bash
# scripts/monitoring/cleanup.sh

echo "🧹 Limpando dados antigos de monitoramento..."

# Limpar métricas antigas (> 90 dias)
node scripts/monitoring/cleanup.js --metrics --older-than=90d

# Limpar logs antigos (> 30 dias)
find logs/ -name "*.log" -mtime +30 -delete

# Comprimir logs antigos
find logs/ -name "*.log" -mtime +7 -exec gzip {} \;

# Limpar alertas resolvidos (> 7 dias)
node scripts/monitoring/cleanup.js --alerts --resolved --older-than=7d

echo "✅ Limpeza concluída"
```

## Backup de Dados de Monitoramento

### Script de Backup
```bash
#!/bin/bash
# scripts/monitoring/backup.sh

backup_dir="backups/monitoring-$(date +%Y%m%d)"
mkdir -p "$backup_dir"

# Backup de métricas
node scripts/monitoring/export-metrics.js --output="$backup_dir/metrics.json"

# Backup de configurações
cp -r config/monitoring/ "$backup_dir/config/"

# Backup de logs críticos
cp logs/error.log "$backup_dir/"
cp logs/audit.log "$backup_dir/"

# Comprimir backup
tar -czf "$backup_dir.tar.gz" "$backup_dir"
rm -rf "$backup_dir"

echo "✅ Backup de monitoramento salvo: $backup_dir.tar.gz"
```

## Integração com Ferramentas Externas

### 1. Prometheus
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'curva-mestra'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### 2. Grafana
```json
{
  "dashboard": {
    "title": "Curva Mestra Monitoring",
    "panels": [
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "avg(response_time_seconds)",
            "legendFormat": "Average Response Time"
          }
        ]
      }
    ]
  }
}
```

## Checklist de Monitoramento

### ✅ Configuração Inicial
- [ ] Sistema de monitoramento instalado
- [ ] Métricas configuradas
- [ ] Alertas configurados
- [ ] Dashboard funcionando
- [ ] Health checks ativos

### ✅ Operação Diária
- [ ] Verificar alertas ativos
- [ ] Revisar métricas de performance
- [ ] Validar health checks
- [ ] Verificar logs de erro
- [ ] Confirmar backup de dados

### ✅ Manutenção Semanal
- [ ] Limpar dados antigos
- [ ] Revisar regras de alerta
- [ ] Atualizar dashboards
- [ ] Verificar capacidade de armazenamento
- [ ] Testar procedimentos de recuperação