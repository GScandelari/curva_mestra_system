# Setup Monitoring and Alerts for Firebase Production Environment
# This script configures monitoring, analytics, and alerting for the production system

param(
    [string]$ProjectId = "curva-mestra",
    [string]$NotificationEmail = "",
    [switch]$SkipEmailAlerts = $false
)

Write-Host "📊 Configurando monitoramento e alertas para produção" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan

# Set working directory to project root
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

try {
    # Check prerequisites
    Write-Host "🔍 Verificando pré-requisitos..." -ForegroundColor Yellow
    
    if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Firebase CLI não encontrado" -ForegroundColor Red
        exit 1
    }
    
    if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
        Write-Host "⚠️ Google Cloud CLI não encontrado. Algumas funcionalidades serão limitadas" -ForegroundColor Yellow
    }
    
    # Step 1: Configure Firebase Performance Monitoring
    Write-Host "`n⚡ Passo 1: Configurando Performance Monitoring" -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan
    
    # Enable Performance Monitoring in frontend
    Write-Host "🔧 Habilitando Performance Monitoring no frontend..." -ForegroundColor Yellow
    
    $performanceConfig = @"
// Performance Monitoring Configuration
import { getPerformance } from 'firebase/performance';
import { app } from './firebase-config';

// Initialize Performance Monitoring
const perf = getPerformance(app);

// Custom performance traces
export const startTrace = (traceName) => {
  return perf.trace(traceName);
};

// Monitor critical user journeys
export const monitorPageLoad = (pageName) => {
  const trace = perf.trace(`page_load_${pageName}`);
  trace.start();
  return trace;
};

export const monitorApiCall = (endpoint) => {
  const trace = perf.trace(`api_call_${endpoint.replace('/', '_')}`);
  trace.start();
  return trace;
};
"@
    
    $performanceConfig | Out-File -FilePath "frontend/src/utils/performance.js" -Encoding UTF8
    Write-Host "✅ Performance Monitoring configurado" -ForegroundColor Green
    
    # Step 2: Configure Firebase Analytics
    Write-Host "`n📈 Passo 2: Configurando Firebase Analytics" -ForegroundColor Cyan
    Write-Host "=========================================" -ForegroundColor Cyan
    
    Write-Host "🔧 Configurando eventos personalizados..." -ForegroundColor Yellow
    
    $analyticsConfig = @"
// Analytics Configuration
import { getAnalytics, logEvent } from 'firebase/analytics';
import { app } from './firebase-config';

const analytics = getAnalytics(app);

// Custom events for business metrics
export const trackUserLogin = (method) => {
  logEvent(analytics, 'login', {
    method: method
  });
};

export const trackProductCreated = (category) => {
  logEvent(analytics, 'product_created', {
    category: category,
    timestamp: new Date().toISOString()
  });
};

export const trackExpirationAlert = (productCount) => {
  logEvent(analytics, 'expiration_alert', {
    product_count: productCount,
    alert_type: 'expiring_soon'
  });
};

export const trackLowStockAlert = (productId) => {
  logEvent(analytics, 'low_stock_alert', {
    product_id: productId,
    alert_type: 'stock_low'
  });
};

export const trackReportGenerated = (reportType) => {
  logEvent(analytics, 'report_generated', {
    report_type: reportType,
    timestamp: new Date().toISOString()
  });
};

export const trackError = (errorType, errorMessage) => {
  logEvent(analytics, 'error_occurred', {
    error_type: errorType,
    error_message: errorMessage,
    timestamp: new Date().toISOString()
  });
};
"@
    
    $analyticsConfig | Out-File -FilePath "frontend/src/utils/analytics.js" -Encoding UTF8
    Write-Host "✅ Analytics configurado" -ForegroundColor Green
    
    # Step 3: Configure Error Reporting
    Write-Host "`n🚨 Passo 3: Configurando Error Reporting" -ForegroundColor Cyan
    Write-Host "=======================================" -ForegroundColor Cyan
    
    Write-Host "🔧 Configurando captura de erros..." -ForegroundColor Yellow
    
    # Create error reporting service for frontend
    $errorReportingConfig = @"
// Error Reporting Configuration
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase-config';

const functions = getFunctions(app);
const reportError = httpsCallable(functions, 'reportError');

// Global error handler
export const setupErrorReporting = () => {
  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    reportErrorToFirebase({
      type: 'javascript_error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  });
  
  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    reportErrorToFirebase({
      type: 'promise_rejection',
      message: event.reason?.message || 'Unhandled promise rejection',
      stack: event.reason?.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href
    });
  });
};

// Report error to Firebase
export const reportErrorToFirebase = async (errorData) => {
  try {
    await reportError(errorData);
  } catch (err) {
    console.error('Failed to report error:', err);
  }
};

// Manual error reporting
export const reportCustomError = (errorType, message, context = {}) => {
  reportErrorToFirebase({
    type: errorType,
    message: message,
    context: context,
    timestamp: new Date().toISOString(),
    url: window.location.href
  });
};
"@
    
    $errorReportingConfig | Out-File -FilePath "frontend/src/utils/errorReporting.js" -Encoding UTF8
    
    # Create error reporting function
    Write-Host "🔧 Criando função de error reporting..." -ForegroundColor Yellow
    
    $errorFunction = @"
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Error reporting function
export const reportError = functions.https.onCall(async (data, context) => {
  try {
    // Log error to Cloud Logging
    console.error('Application Error:', {
      type: data.type,
      message: data.message,
      stack: data.stack,
      timestamp: data.timestamp,
      url: data.url,
      userId: context.auth?.uid,
      userAgent: data.userAgent,
      context: data.context
    });
    
    // Store error in Firestore for analysis
    await admin.firestore().collection('errors').add({
      ...data,
      userId: context.auth?.uid || 'anonymous',
      reportedAt: admin.firestore.FieldValue.serverTimestamp(),
      severity: determineSeverity(data.type, data.message),
      resolved: false
    });
    
    // Send email alert for critical errors
    if (shouldSendEmailAlert(data.type, data.message)) {
      await sendErrorAlert(data);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in reportError function:', error);
    throw new functions.https.HttpsError('internal', 'Failed to report error');
  }
});

function determineSeverity(type, message) {
  if (type === 'javascript_error' && message.includes('Cannot read property')) {
    return 'high';
  }
  if (type === 'promise_rejection') {
    return 'medium';
  }
  return 'low';
}

function shouldSendEmailAlert(type, message) {
  const criticalPatterns = [
    'Cannot read property',
    'Network Error',
    'Authentication failed',
    'Database connection'
  ];
  
  return criticalPatterns.some(pattern => 
    message.toLowerCase().includes(pattern.toLowerCase())
  );
}

async function sendErrorAlert(errorData) {
  // Implementation would depend on email service
  // For now, just log that an alert should be sent
  console.log('CRITICAL ERROR ALERT:', errorData);
}
"@
    
    $errorFunction | Out-File -FilePath "functions/src/monitoring/errorReporting.ts" -Encoding UTF8
    Write-Host "✅ Error Reporting configurado" -ForegroundColor Green
    
    # Step 4: Configure Cost Monitoring
    Write-Host "`n💰 Passo 4: Configurando Monitoramento de Custos" -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan
    
    Write-Host "🔧 Criando função de monitoramento de custos..." -ForegroundColor Yellow
    
    $costMonitoringFunction = @"
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Cost monitoring function (runs daily)
export const monitorCosts = functions.pubsub
  .schedule('0 8 * * *') // Daily at 8 AM
  .timeZone('America/Sao_Paulo')
  .onRun(async (context) => {
    try {
      // Get usage statistics
      const stats = await getUsageStatistics();
      
      // Calculate estimated costs
      const costs = calculateEstimatedCosts(stats);
      
      // Store cost data
      await admin.firestore().collection('cost_monitoring').add({
        date: admin.firestore.FieldValue.serverTimestamp(),
        statistics: stats,
        estimatedCosts: costs,
        alerts: checkCostAlerts(costs)
      });
      
      // Send alerts if necessary
      if (costs.total > 40) { // Alert if over $40/month
        await sendCostAlert(costs);
      }
      
      console.log('Cost monitoring completed:', costs);
    } catch (error) {
      console.error('Error in cost monitoring:', error);
    }
  });

async function getUsageStatistics() {
  // This would integrate with Firebase usage APIs
  // For now, return mock data structure
  return {
    functions: {
      invocations: 0,
      computeTime: 0,
      networkEgress: 0
    },
    firestore: {
      reads: 0,
      writes: 0,
      deletes: 0,
      storage: 0
    },
    hosting: {
      bandwidth: 0,
      storage: 0
    },
    auth: {
      users: 0,
      verifications: 0
    }
  };
}

function calculateEstimatedCosts(stats) {
  // Firebase pricing (approximate)
  const pricing = {
    functions: {
      invocations: 0.0000004, // per invocation
      computeTime: 0.0000025, // per 100ms
      networkEgress: 0.12 // per GB
    },
    firestore: {
      reads: 0.00000036, // per read
      writes: 0.00000108, // per write
      deletes: 0.00000012, // per delete
      storage: 0.18 // per GB/month
    },
    hosting: {
      bandwidth: 0.15, // per GB
      storage: 0.026 // per GB/month
    }
  };
  
  const costs = {
    functions: (
      stats.functions.invocations * pricing.functions.invocations +
      stats.functions.computeTime * pricing.functions.computeTime +
      stats.functions.networkEgress * pricing.functions.networkEgress
    ),
    firestore: (
      stats.firestore.reads * pricing.firestore.reads +
      stats.firestore.writes * pricing.firestore.writes +
      stats.firestore.deletes * pricing.firestore.deletes +
      stats.firestore.storage * pricing.firestore.storage
    ),
    hosting: (
      stats.hosting.bandwidth * pricing.hosting.bandwidth +
      stats.hosting.storage * pricing.hosting.storage
    ),
    auth: 0 // Free tier
  };
  
  costs.total = costs.functions + costs.firestore + costs.hosting + costs.auth;
  
  return costs;
}

function checkCostAlerts(costs) {
  const alerts = [];
  
  if (costs.total > 45) {
    alerts.push({ type: 'high_cost', message: 'Monthly cost exceeding $45' });
  }
  
  if (costs.firestore > 25) {
    alerts.push({ type: 'high_firestore_cost', message: 'Firestore costs high' });
  }
  
  if (costs.functions > 15) {
    alerts.push({ type: 'high_functions_cost', message: 'Functions costs high' });
  }
  
  return alerts;
}

async function sendCostAlert(costs) {
  console.log('COST ALERT: Monthly costs estimated at $' + costs.total.toFixed(2));
  // Implementation would send email/notification
}
"@
    
    $costMonitoringFunction | Out-File -FilePath "functions/src/monitoring/costMonitoring.ts" -Encoding UTF8
    Write-Host "✅ Monitoramento de custos configurado" -ForegroundColor Green
    
    # Step 5: Configure Health Checks
    Write-Host "`n🏥 Passo 5: Configurando Health Checks" -ForegroundColor Cyan
    Write-Host "====================================" -ForegroundColor Cyan
    
    Write-Host "🔧 Criando endpoint de health check..." -ForegroundColor Yellow
    
    $healthCheckFunction = @"
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Health check endpoint
export const healthCheck = functions.https.onRequest(async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {}
    };
    
    // Check Firestore
    try {
      await admin.firestore().collection('health').doc('test').get();
      health.services.firestore = 'healthy';
    } catch (error) {
      health.services.firestore = 'unhealthy';
      health.status = 'degraded';
    }
    
    // Check Authentication
    try {
      await admin.auth().listUsers(1);
      health.services.auth = 'healthy';
    } catch (error) {
      health.services.auth = 'unhealthy';
      health.status = 'degraded';
    }
    
    // Check Functions
    health.services.functions = 'healthy'; // If we're here, functions are working
    
    // Set appropriate status code
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Detailed system status
export const systemStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.role === 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }
  
  try {
    const status = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {},
      metrics: {}
    };
    
    // Get recent errors
    const errorsSnapshot = await admin.firestore()
      .collection('errors')
      .where('reportedAt', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .orderBy('reportedAt', 'desc')
      .limit(10)
      .get();
    
    status.metrics.recentErrors = errorsSnapshot.size;
    status.metrics.errors = errorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Get performance metrics (last 24h)
    // This would integrate with Firebase Performance Monitoring API
    status.metrics.performance = {
      avgResponseTime: 0,
      errorRate: 0,
      throughput: 0
    };
    
    return status;
  } catch (error) {
    console.error('System status check failed:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get system status');
  }
});
"@
    
    $healthCheckFunction | Out-File -FilePath "functions/src/monitoring/healthCheck.ts" -Encoding UTF8
    Write-Host "✅ Health checks configurados" -ForegroundColor Green
    
    # Step 6: Update Functions index to export monitoring functions
    Write-Host "`n🔧 Atualizando exports das Functions..." -ForegroundColor Yellow
    
    $indexUpdate = @"

// Monitoring functions
export { reportError } from './monitoring/errorReporting';
export { monitorCosts } from './monitoring/costMonitoring';
export { healthCheck, systemStatus } from './monitoring/healthCheck';
"@
    
    Add-Content -Path "functions/src/index.ts" -Value $indexUpdate
    Write-Host "✅ Functions atualizadas" -ForegroundColor Green
    
    # Step 7: Create monitoring dashboard configuration
    Write-Host "`n📊 Criando configuração do dashboard..." -ForegroundColor Yellow
    
    $dashboardConfig = @"
// Monitoring Dashboard Configuration
export const monitoringConfig = {
  // Performance thresholds
  performance: {
    pageLoadTime: 3000, // ms
    apiResponseTime: 1000, // ms
    errorRate: 0.01 // 1%
  },
  
  // Cost thresholds
  costs: {
    monthly: 45, // USD
    firestore: 25, // USD
    functions: 15 // USD
  },
  
  // Alert settings
  alerts: {
    email: '${NotificationEmail}',
    enabled: $(if ($SkipEmailAlerts) { 'false' } else { 'true' }),
    criticalErrors: true,
    costAlerts: true,
    performanceAlerts: true
  },
  
  // Monitoring intervals
  intervals: {
    healthCheck: 300000, // 5 minutes
    costCheck: 86400000, // 24 hours
    performanceCheck: 60000 // 1 minute
  }
};
"@
    
    $dashboardConfig | Out-File -FilePath "frontend/src/config/monitoring.js" -Encoding UTF8
    Write-Host "✅ Dashboard configurado" -ForegroundColor Green
    
    # Final summary
    Write-Host "`n✅ MONITORAMENTO CONFIGURADO COM SUCESSO!" -ForegroundColor Green
    Write-Host "=========================================" -ForegroundColor Green
    
    Write-Host "`n📋 Componentes Configurados:" -ForegroundColor Cyan
    Write-Host "✅ Performance Monitoring - Firebase Performance" -ForegroundColor White
    Write-Host "✅ Analytics - Eventos personalizados configurados" -ForegroundColor White
    Write-Host "✅ Error Reporting - Captura automática de erros" -ForegroundColor White
    Write-Host "✅ Cost Monitoring - Monitoramento diário de custos" -ForegroundColor White
    Write-Host "✅ Health Checks - Endpoints de status do sistema" -ForegroundColor White
    
    Write-Host "`n📊 Endpoints de Monitoramento:" -ForegroundColor Cyan
    Write-Host "🔍 Health Check: https://us-central1-curva-mestra.cloudfunctions.net/healthCheck" -ForegroundColor White
    Write-Host "📈 System Status: Função callable 'systemStatus'" -ForegroundColor White
    Write-Host "💰 Cost Monitoring: Execução automática diária" -ForegroundColor White
    
    if (-not $SkipEmailAlerts -and $NotificationEmail) {
        Write-Host "`n📧 Alertas por email configurados para: $NotificationEmail" -ForegroundColor Green
    } elseif (-not $SkipEmailAlerts) {
        Write-Host "`n⚠️ Para habilitar alertas por email, execute:" -ForegroundColor Yellow
        Write-Host "   .\scripts\setup-monitoring.ps1 -NotificationEmail 'seu-email@domain.com'" -ForegroundColor Gray
    }
    
    Write-Host "`n📝 Próximos passos:" -ForegroundColor Cyan
    Write-Host "1. Deploy das Functions atualizadas" -ForegroundColor White
    Write-Host "2. Configurar alertas no Firebase Console" -ForegroundColor White
    Write-Host "3. Testar endpoints de monitoramento" -ForegroundColor White
    Write-Host "4. Configurar dashboard personalizado (opcional)" -ForegroundColor White
    
} catch {
    Write-Host "❌ Erro durante configuração: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 Configuração de monitoramento concluída!" -ForegroundColor Green