import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const firestore = admin.firestore();

/**
 * Interface para métricas de custo
 */
interface CostMetrics {
  date: string;
  firestoreReads: number;
  firestoreWrites: number;
  firestoreDeletes: number;
  functionsInvocations: number;
  functionsGbSeconds: number;
  hostingBandwidth: number;
  authOperations: number;
  storageBytes: number;
  estimatedCost: number;
  timestamp: admin.firestore.Timestamp;
}

/**
 * Função para coletar métricas de uso diário
 */
export const collectDailyUsageMetrics = functions.pubsub
  .schedule('0 1 * * *') // Todo dia à 1:00 AM
  .timeZone('America/Sao_Paulo')
  .onRun(async (context) => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      // Coletar métricas do dia anterior
      const metrics = await collectUsageMetrics(dateStr);
      
      // Calcular custo estimado
      const estimatedCost = calculateEstimatedCost(metrics);
      
      // Salvar métricas no Firestore
      await firestore.collection('system').doc('costs').collection('daily_metrics').doc(dateStr).set({
        ...metrics,
        date: dateStr,
        estimatedCost,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Verificar se excedeu limites de custo
      await checkCostThresholds(estimatedCost, dateStr);

      console.log(`Métricas de custo coletadas para ${dateStr}: $${estimatedCost.toFixed(2)}`);
    } catch (error) {
      console.error('Erro ao coletar métricas de custo:', error);
    }
  });

/**
 * Coletar métricas de uso (simulado - em produção seria integrado com APIs do Google Cloud)
 */
async function collectUsageMetrics(date: string): Promise<Omit<CostMetrics, 'date' | 'estimatedCost' | 'timestamp'>> {
  // Em produção, estas métricas viriam das APIs do Google Cloud Monitoring
  // Por enquanto, vamos simular baseado na atividade do Firestore
  
  try {
    // Contar operações do Firestore do dia anterior
    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');

    // Buscar logs de atividade (se disponíveis)
    const activitySnapshot = await firestore
      .collection('system')
      .doc('activity')
      .collection('logs')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
      .where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
      .get();

    // Calcular métricas baseadas na atividade
    let firestoreReads = 0;
    let firestoreWrites = 0;
    let firestoreDeletes = 0;
    let functionsInvocations = 0;

    activitySnapshot.docs.forEach(doc => {
      const data = doc.data();
      switch (data.operation) {
        case 'read':
          firestoreReads += data.count || 1;
          break;
        case 'write':
        case 'create':
        case 'update':
          firestoreWrites += data.count || 1;
          break;
        case 'delete':
          firestoreDeletes += data.count || 1;
          break;
        case 'function_call':
          functionsInvocations += data.count || 1;
          break;
      }
    });

    // Estimar outras métricas
    const functionsGbSeconds = functionsInvocations * 0.1; // Estimativa
    const hostingBandwidth = firestoreReads * 0.001; // Estimativa em GB
    const authOperations = Math.floor(firestoreReads * 0.1); // Estimativa
    const storageBytes = await estimateStorageUsage();

    return {
      firestoreReads,
      firestoreWrites,
      firestoreDeletes,
      functionsInvocations,
      functionsGbSeconds,
      hostingBandwidth,
      authOperations,
      storageBytes
    };
  } catch (error) {
    console.error('Erro ao coletar métricas:', error);
    // Retornar métricas zeradas em caso de erro
    return {
      firestoreReads: 0,
      firestoreWrites: 0,
      firestoreDeletes: 0,
      functionsInvocations: 0,
      functionsGbSeconds: 0,
      hostingBandwidth: 0,
      authOperations: 0,
      storageBytes: 0
    };
  }
}

/**
 * Estimar uso de storage
 */
async function estimateStorageUsage(): Promise<number> {
  try {
    // Contar documentos principais para estimar storage
    const collections = ['clinics'];
    let totalDocs = 0;

    for (const collection of collections) {
      const snapshot = await firestore.collection(collection).get();
      totalDocs += snapshot.size;
    }

    // Estimar bytes (média de 2KB por documento)
    return totalDocs * 2048;
  } catch (error) {
    console.error('Erro ao estimar storage:', error);
    return 0;
  }
}

/**
 * Calcular custo estimado baseado nas métricas
 */
function calculateEstimatedCost(metrics: Omit<CostMetrics, 'date' | 'estimatedCost' | 'timestamp'>): number {
  // Preços do Firebase (aproximados, em USD)
  const pricing = {
    firestoreRead: 0.06 / 100000, // $0.06 per 100K reads
    firestoreWrite: 0.18 / 100000, // $0.18 per 100K writes
    firestoreDelete: 0.02 / 100000, // $0.02 per 100K deletes
    functionsInvocation: 0.40 / 1000000, // $0.40 per 1M invocations
    functionsGbSecond: 0.0000025, // $0.0000025 per GB-second
    hostingBandwidth: 0.15, // $0.15 per GB
    authOperation: 0.0055 / 1000, // $0.0055 per 1K operations
    storage: 0.18 / (1024 * 1024 * 1024) // $0.18 per GB per month
  };

  const costs = {
    firestore: (
      metrics.firestoreReads * pricing.firestoreRead +
      metrics.firestoreWrites * pricing.firestoreWrite +
      metrics.firestoreDeletes * pricing.firestoreDelete
    ),
    functions: (
      metrics.functionsInvocations * pricing.functionsInvocation +
      metrics.functionsGbSeconds * pricing.functionsGbSecond
    ),
    hosting: metrics.hostingBandwidth * pricing.hostingBandwidth,
    auth: metrics.authOperations * pricing.authOperation,
    storage: (metrics.storageBytes * pricing.storage) / 30 // Custo diário
  };

  return Object.values(costs).reduce((total, cost) => total + cost, 0);
}

/**
 * Verificar se excedeu limites de custo
 */
async function checkCostThresholds(dailyCost: number, date: string) {
  const thresholds = {
    daily: 5.00, // $5 por dia
    weekly: 30.00, // $30 por semana
    monthly: 100.00 // $100 por mês
  };

  // Verificar limite diário
  if (dailyCost > thresholds.daily) {
    await createCostAlert('daily', dailyCost, thresholds.daily, date);
  }

  // Verificar limite semanal
  const weeklyStart = new Date(date);
  weeklyStart.setDate(weeklyStart.getDate() - 6);
  const weeklyCost = await calculatePeriodCost(weeklyStart.toISOString().split('T')[0], date);
  
  if (weeklyCost > thresholds.weekly) {
    await createCostAlert('weekly', weeklyCost, thresholds.weekly, date);
  }

  // Verificar limite mensal
  const monthlyStart = new Date(date);
  monthlyStart.setDate(1);
  const monthlyCost = await calculatePeriodCost(monthlyStart.toISOString().split('T')[0], date);
  
  if (monthlyCost > thresholds.monthly) {
    await createCostAlert('monthly', monthlyCost, thresholds.monthly, date);
  }
}

/**
 * Calcular custo de um período
 */
async function calculatePeriodCost(startDate: string, endDate: string): Promise<number> {
  try {
    const metricsSnapshot = await firestore
      .collection('system')
      .doc('costs')
      .collection('daily_metrics')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    return metricsSnapshot.docs.reduce((total, doc) => {
      return total + (doc.data().estimatedCost || 0);
    }, 0);
  } catch (error) {
    console.error('Erro ao calcular custo do período:', error);
    return 0;
  }
}

/**
 * Criar alerta de custo
 */
async function createCostAlert(period: string, actualCost: number, threshold: number, date: string) {
  try {
    // Buscar todos os admins
    const adminsSnapshot = await firestore.collectionGroup('users')
      .where('role', '==', 'admin')
      .get();

    const batch = firestore.batch();

    adminsSnapshot.docs.forEach(adminDoc => {
      const notificationRef = firestore
        .collection(`clinics/${adminDoc.data().clinicId}/notifications`)
        .doc();

      batch.set(notificationRef, {
        type: 'cost_alert',
        title: `Alerta de Custo ${period.charAt(0).toUpperCase() + period.slice(1)}`,
        message: `Custo ${period} de $${actualCost.toFixed(2)} excedeu o limite de $${threshold.toFixed(2)}`,
        period,
        actualCost,
        threshold,
        date,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
        priority: 'high'
      });
    });

    await batch.commit();

    // Log crítico
    console.warn(`COST ALERT: ${period} cost of $${actualCost.toFixed(2)} exceeded threshold of $${threshold.toFixed(2)}`);
  } catch (error) {
    console.error('Erro ao criar alerta de custo:', error);
  }
}

/**
 * Função para buscar relatório de custos
 */
export const getCostReport = functions.https.onCall(async (data, context) => {
  // Verificar se é admin
  if (!context.auth || !context.auth.token.role || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Apenas admins podem ver relatórios de custo');
  }

  try {
    const { startDate, endDate, period = 'daily' } = data;
    
    let query = firestore
      .collection('system')
      .doc('costs')
      .collection('daily_metrics')
      .orderBy('date', 'desc');

    if (startDate) {
      query = query.where('date', '>=', startDate);
    }
    
    if (endDate) {
      query = query.where('date', '<=', endDate);
    }

    const snapshot = await query.limit(30).get();
    
    const metrics = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calcular totais
    const totals = metrics.reduce((acc, metric) => ({
      totalCost: acc.totalCost + (metric.estimatedCost || 0),
      totalReads: acc.totalReads + (metric.firestoreReads || 0),
      totalWrites: acc.totalWrites + (metric.firestoreWrites || 0),
      totalFunctionCalls: acc.totalFunctionCalls + (metric.functionsInvocations || 0)
    }), {
      totalCost: 0,
      totalReads: 0,
      totalWrites: 0,
      totalFunctionCalls: 0
    });

    // Calcular projeções
    const avgDailyCost = totals.totalCost / Math.max(metrics.length, 1);
    const projections = {
      weekly: avgDailyCost * 7,
      monthly: avgDailyCost * 30,
      yearly: avgDailyCost * 365
    };

    return {
      metrics,
      totals,
      projections,
      period: {
        startDate: startDate || (metrics[metrics.length - 1]?.date),
        endDate: endDate || (metrics[0]?.date),
        days: metrics.length
      }
    };
  } catch (error) {
    console.error('Erro ao buscar relatório de custos:', error);
    throw new functions.https.HttpsError('internal', 'Erro ao buscar relatório de custos');
  }
});

/**
 * Função para configurar limites de custo
 */
export const setCostThresholds = functions.https.onCall(async (data, context) => {
  // Verificar se é admin
  if (!context.auth || !context.auth.token.role || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Apenas admins podem configurar limites');
  }

  const { daily, weekly, monthly } = data;

  if (!daily || !weekly || !monthly) {
    throw new functions.https.HttpsError('invalid-argument', 'Todos os limites são obrigatórios');
  }

  try {
    await firestore.collection('system').doc('costs').collection('settings').doc('thresholds').set({
      daily: parseFloat(daily),
      weekly: parseFloat(weekly),
      monthly: parseFloat(monthly),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: context.auth.uid
    });

    return { success: true };
  } catch (error) {
    console.error('Erro ao configurar limites:', error);
    throw new functions.https.HttpsError('internal', 'Erro ao configurar limites');
  }
});

/**
 * Registrar atividade para métricas
 */
export const logActivity = functions.https.onCall(async (data, context) => {
  if (!context.auth) return;

  const { operation, count = 1, metadata = {} } = data;

  try {
    await firestore.collection('system').doc('activity').collection('logs').add({
      operation,
      count,
      metadata,
      userId: context.auth.uid,
      clinicId: context.auth.token?.clinicId,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Erro ao registrar atividade:', error);
  }
});