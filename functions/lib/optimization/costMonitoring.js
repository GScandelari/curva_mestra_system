"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCostReport = exports.calculateCostEstimate = exports.collectUsageMetrics = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
/**
 * Coleta métricas de uso em tempo real
 */
exports.collectUsageMetrics = (0, scheduler_1.onSchedule)({
    schedule: '0 * * * *', // A cada hora
    timeZone: 'America/Sao_Paulo'
}, async (event) => {
    try {
        // Obter todas as clínicas
        const clinicsSnapshot = await db.collection('clinics').get();
        for (const clinicDoc of clinicsSnapshot.docs) {
            const clinicId = clinicDoc.id;
            // Coletar métricas da última hora
            const metrics = await collectClinicMetrics(clinicId);
            // Salvar métricas
            await db.collection('system/usage/metrics').add(Object.assign(Object.assign({}, metrics), { timestamp: admin.firestore.FieldValue.serverTimestamp(), expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 dias
             }));
            // Verificar se há alertas de custo
            await checkCostAlerts(clinicId, metrics);
        }
        logger.info('Métricas de uso coletadas com sucesso');
    }
    catch (error) {
        logger.error('Erro ao coletar métricas de uso', { error: error.message });
    }
});
/**
 * Coleta métricas específicas de uma clínica
 */
async function collectClinicMetrics(clinicId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    // Contar operações Firestore (aproximação baseada em logs)
    const firestoreReads = await estimateFirestoreReads(clinicId, oneHourAgo);
    const firestoreWrites = await estimateFirestoreWrites(clinicId, oneHourAgo);
    const firestoreDeletes = await estimateFirestoreDeletes(clinicId, oneHourAgo);
    // Contar invocações de Functions
    const functionMetrics = await estimateFunctionUsage(clinicId, oneHourAgo);
    // Estimar uso de storage
    const storageUsage = await estimateStorageUsage(clinicId);
    return {
        clinicId,
        timestamp: new Date(),
        firestoreReads,
        firestoreWrites,
        firestoreDeletes,
        functionInvocations: functionMetrics.invocations,
        functionExecutionTime: functionMetrics.executionTime,
        hostingBandwidth: 0, // Difícil de medir diretamente
        storageUsage
    };
}
/**
 * Estima reads do Firestore baseado em atividade
 */
async function estimateFirestoreReads(clinicId, since) {
    // Contar documentos acessados recentemente (aproximação)
    const collections = ['products', 'requests', 'patients', 'invoices'];
    let totalReads = 0;
    for (const collection of collections) {
        try {
            const snapshot = await db
                .collection(`clinics/${clinicId}/${collection}`)
                .where('lastAccessed', '>=', since)
                .get();
            // Estimar reads baseado em documentos acessados
            totalReads += snapshot.size * 2; // Multiplicar por fator estimado
        }
        catch (error) {
            // Se campo lastAccessed não existir, usar estimativa baseada no tamanho da coleção
            const snapshot = await db.collection(`clinics/${clinicId}/${collection}`).get();
            totalReads += Math.min(snapshot.size, 100); // Máximo 100 reads estimados por coleção
        }
    }
    return totalReads;
}
/**
 * Estima writes do Firestore baseado em atividade
 */
async function estimateFirestoreWrites(clinicId, since) {
    let totalWrites = 0;
    // Contar audit logs da última hora como proxy para writes
    const auditSnapshot = await db
        .collection(`clinics/${clinicId}/auditLogs`)
        .where('timestamp', '>=', since)
        .get();
    totalWrites = auditSnapshot.size;
    return totalWrites;
}
/**
 * Estima deletes do Firestore
 */
async function estimateFirestoreDeletes(clinicId, since) {
    // Contar operações de delete nos audit logs
    const deleteSnapshot = await db
        .collection(`clinics/${clinicId}/auditLogs`)
        .where('action', '==', 'DELETE')
        .where('timestamp', '>=', since)
        .get();
    return deleteSnapshot.size;
}
/**
 * Estima uso de Functions
 */
async function estimateFunctionUsage(clinicId, since) {
    // Contar logs de functions (se disponível)
    // Por simplicidade, usar uma estimativa baseada em atividade
    const activitySnapshot = await db
        .collection(`clinics/${clinicId}/auditLogs`)
        .where('timestamp', '>=', since)
        .get();
    const invocations = activitySnapshot.size * 1.5; // Fator estimado
    const executionTime = invocations * 200; // 200ms médio por invocação
    return { invocations, executionTime };
}
/**
 * Estima uso de storage
 */
async function estimateStorageUsage(clinicId) {
    const collections = ['products', 'requests', 'patients', 'invoices', 'auditLogs'];
    let totalDocuments = 0;
    for (const collection of collections) {
        const snapshot = await db.collection(`clinics/${clinicId}/${collection}`).get();
        totalDocuments += snapshot.size;
    }
    // Estimar tamanho baseado no número de documentos (aproximação)
    const averageDocSize = 2; // KB por documento
    return (totalDocuments * averageDocSize) / 1024; // Converter para MB
}
/**
 * Calcula estimativa de custos
 */
exports.calculateCostEstimate = (0, https_1.onCall)(async (request) => {
    if (!request.auth || !request.auth.token.role || request.auth.token.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Apenas admins podem ver estimativas de custo');
    }
    const data = request.data;
    const { clinicId, period = 'month' } = data;
    try {
        const days = period === 'week' ? 7 : period === 'month' ? 30 : 1;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        // Buscar métricas do período
        const metricsSnapshot = await db
            .collection('system/usage/metrics')
            .where('clinicId', '==', clinicId)
            .where('timestamp', '>=', startDate)
            .get();
        const metrics = metricsSnapshot.docs.map(doc => doc.data());
        // Calcular totais
        const totals = metrics.reduce((acc, metric) => ({
            firestoreReads: acc.firestoreReads + metric.firestoreReads,
            firestoreWrites: acc.firestoreWrites + metric.firestoreWrites,
            firestoreDeletes: acc.firestoreDeletes + metric.firestoreDeletes,
            functionInvocations: acc.functionInvocations + metric.functionInvocations,
            functionExecutionTime: acc.functionExecutionTime + metric.functionExecutionTime,
            hostingBandwidth: acc.hostingBandwidth + metric.hostingBandwidth,
            storageUsage: Math.max(acc.storageUsage, metric.storageUsage) // Usar máximo para storage
        }), {
            firestoreReads: 0,
            firestoreWrites: 0,
            firestoreDeletes: 0,
            functionInvocations: 0,
            functionExecutionTime: 0,
            hostingBandwidth: 0,
            storageUsage: 0
        });
        // Calcular custos
        const costEstimate = calculateCosts(totals, period);
        // Gerar recomendações
        const recommendations = generateCostRecommendations(totals, costEstimate);
        return {
            period,
            usage: totals,
            costs: costEstimate,
            recommendations,
            projectedMonthly: period !== 'month' ? projectToMonthly(costEstimate, days) : costEstimate
        };
    }
    catch (error) {
        logger.error('Erro ao calcular estimativa de custos', { error: error.message, clinicId });
        throw new https_1.HttpsError('internal', 'Erro ao calcular custos');
    }
});
/**
 * Calcula custos baseado nas métricas
 */
function calculateCosts(totals, period) {
    // Preços do Firebase (USD)
    const pricing = {
        firestore: {
            reads: 0.00036 / 1000, // Por 1000 reads
            writes: 0.00108 / 1000, // Por 1000 writes
            deletes: 0.00012 / 1000, // Por 1000 deletes
            storage: 0.18 // Por GB/mês
        },
        functions: {
            invocations: 0.0000004, // Por invocação
            compute: 0.0000025, // Por GB-segundo
            networking: 0.12 // Por GB
        },
        hosting: {
            bandwidth: 0.15 // Por GB (após 10GB gratuitos)
        }
    };
    const firestore = {
        reads: totals.firestoreReads * pricing.firestore.reads,
        writes: totals.firestoreWrites * pricing.firestore.writes,
        deletes: totals.firestoreDeletes * pricing.firestore.deletes,
        storage: (totals.storageUsage / 1024) * pricing.firestore.storage * (period === 'month' ? 1 : period === 'week' ? 0.25 : 1 / 30),
        total: 0
    };
    firestore.total = firestore.reads + firestore.writes + firestore.deletes + firestore.storage;
    const functions = {
        invocations: totals.functionInvocations * pricing.functions.invocations,
        compute: (totals.functionExecutionTime / 1000) * (128 / 1024) * pricing.functions.compute, // 128MB padrão
        networking: 0, // Difícil de estimar
        total: 0
    };
    functions.total = functions.invocations + functions.compute + functions.networking;
    const hosting = {
        bandwidth: Math.max(0, (totals.hostingBandwidth / 1024) - 10) * pricing.hosting.bandwidth, // 10GB gratuitos
        total: 0
    };
    hosting.total = hosting.bandwidth;
    return {
        firestore,
        functions,
        hosting,
        totalEstimated: firestore.total + functions.total + hosting.total
    };
}
/**
 * Projeta custos para mensal
 */
function projectToMonthly(costs, days) {
    const factor = 30 / days;
    return {
        firestore: {
            reads: costs.firestore.reads * factor,
            writes: costs.firestore.writes * factor,
            deletes: costs.firestore.deletes * factor,
            storage: costs.firestore.storage, // Storage já é mensal
            total: (costs.firestore.total - costs.firestore.storage) * factor + costs.firestore.storage
        },
        functions: {
            invocations: costs.functions.invocations * factor,
            compute: costs.functions.compute * factor,
            networking: costs.functions.networking * factor,
            total: costs.functions.total * factor
        },
        hosting: {
            bandwidth: costs.hosting.bandwidth * factor,
            total: costs.hosting.total * factor
        },
        totalEstimated: costs.totalEstimated * factor
    };
}
/**
 * Gera recomendações de otimização de custos
 */
function generateCostRecommendations(totals, costs) {
    const recommendations = [];
    // Recomendações para Firestore
    if (costs.firestore.reads > 10) { // > $10 em reads
        recommendations.push({
            type: 'firestore_reads',
            priority: 'high',
            title: 'Otimizar consultas Firestore',
            description: `Você está gastando $${costs.firestore.reads.toFixed(2)} em reads. Considere implementar cache.`,
            potentialSavings: `$${(costs.firestore.reads * 0.5).toFixed(2)}`,
            actions: [
                'Implementar cache local com TTL de 5-10 minutos',
                'Usar listeners em tempo real para dados frequentes',
                'Otimizar consultas para retornar menos documentos'
            ]
        });
    }
    if (costs.firestore.writes > 5) { // > $5 em writes
        recommendations.push({
            type: 'firestore_writes',
            priority: 'medium',
            title: 'Otimizar operações de escrita',
            description: `Você está gastando $${costs.firestore.writes.toFixed(2)} em writes.`,
            potentialSavings: `$${(costs.firestore.writes * 0.3).toFixed(2)}`,
            actions: [
                'Usar batch writes para operações múltiplas',
                'Evitar writes desnecessários (verificar se dados mudaram)',
                'Implementar debounce em formulários'
            ]
        });
    }
    // Recomendações para Functions
    if (costs.functions.total > 2) { // > $2 em functions
        recommendations.push({
            type: 'functions',
            priority: 'medium',
            title: 'Otimizar Firebase Functions',
            description: `Você está gastando $${costs.functions.total.toFixed(2)} em Functions.`,
            potentialSavings: `$${(costs.functions.total * 0.2).toFixed(2)}`,
            actions: [
                'Otimizar código para reduzir tempo de execução',
                'Usar menos memória quando possível',
                'Implementar cache em Functions'
            ]
        });
    }
    // Recomendação geral se custo total for alto
    if (costs.totalEstimated > 50) { // > $50 total
        recommendations.push({
            type: 'general',
            priority: 'high',
            title: 'Revisar arquitetura geral',
            description: `Custo total estimado de $${costs.totalEstimated.toFixed(2)} está alto para uma clínica.`,
            potentialSavings: `$${(costs.totalEstimated * 0.4).toFixed(2)}`,
            actions: [
                'Revisar necessidade de todas as consultas',
                'Implementar paginação agressiva',
                'Considerar arquivar dados antigos',
                'Otimizar índices do Firestore'
            ]
        });
    }
    return recommendations;
}
/**
 * Verifica alertas de custo
 */
async function checkCostAlerts(clinicId, metrics) {
    // Definir limites de alerta
    const limits = {
        dailyReads: 50000,
        dailyWrites: 10000,
        dailyCost: 5 // $5 por dia
    };
    // Calcular custo diário estimado
    const dailyCost = (metrics.firestoreReads * 0.00036 / 1000) +
        (metrics.firestoreWrites * 0.00108 / 1000) +
        (metrics.functionInvocations * 0.0000004);
    // Verificar limites
    const alerts = [];
    if (metrics.firestoreReads > limits.dailyReads) {
        alerts.push({
            type: 'high_reads',
            message: `Alto número de reads: ${metrics.firestoreReads} (limite: ${limits.dailyReads})`,
            severity: 'warning'
        });
    }
    if (metrics.firestoreWrites > limits.dailyWrites) {
        alerts.push({
            type: 'high_writes',
            message: `Alto número de writes: ${metrics.firestoreWrites} (limite: ${limits.dailyWrites})`,
            severity: 'warning'
        });
    }
    if (dailyCost > limits.dailyCost) {
        alerts.push({
            type: 'high_cost',
            message: `Custo diário alto: $${dailyCost.toFixed(2)} (limite: $${limits.dailyCost})`,
            severity: 'critical'
        });
    }
    // Salvar alertas se houver
    if (alerts.length > 0) {
        await db.collection(`clinics/${clinicId}/notifications`).add({
            type: 'cost_alert',
            title: 'Alerta de Custo Firebase',
            message: `${alerts.length} alertas de custo detectados`,
            alerts: alerts,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.warn('Alertas de custo gerados', { clinicId, alerts });
    }
}
/**
 * Obtém relatório de custos detalhado
 */
exports.getCostReport = (0, https_1.onCall)(async (request) => {
    if (!request.auth || !request.auth.token.role || request.auth.token.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Apenas admins podem ver relatórios de custo');
    }
    const data = request.data;
    const { clinicId, startDate, endDate } = data;
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        // Buscar métricas do período
        const metricsSnapshot = await db
            .collection('system/usage/metrics')
            .where('clinicId', '==', clinicId)
            .where('timestamp', '>=', start)
            .where('timestamp', '<=', end)
            .orderBy('timestamp', 'asc')
            .get();
        const metrics = metricsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        // Agrupar por dia
        const dailyMetrics = groupMetricsByDay(metrics);
        // Calcular custos diários
        const dailyCosts = dailyMetrics.map(day => ({
            date: day.date,
            usage: day.totals,
            costs: calculateCosts(day.totals, 'day')
        }));
        // Calcular totais do período
        const periodTotals = metrics.reduce((acc, metric) => ({
            firestoreReads: acc.firestoreReads + metric.firestoreReads,
            firestoreWrites: acc.firestoreWrites + metric.firestoreWrites,
            firestoreDeletes: acc.firestoreDeletes + metric.firestoreDeletes,
            functionInvocations: acc.functionInvocations + metric.functionInvocations,
            functionExecutionTime: acc.functionExecutionTime + metric.functionExecutionTime
        }), {
            firestoreReads: 0,
            firestoreWrites: 0,
            firestoreDeletes: 0,
            functionInvocations: 0,
            functionExecutionTime: 0
        });
        return {
            period: { startDate, endDate },
            dailyCosts,
            periodTotals,
            periodCosts: calculateCosts(periodTotals, 'custom'),
            trends: calculateTrends(dailyCosts)
        };
    }
    catch (error) {
        logger.error('Erro ao gerar relatório de custos', { error: error.message, clinicId });
        throw new https_1.HttpsError('internal', 'Erro ao gerar relatório');
    }
});
/**
 * Agrupa métricas por dia
 */
function groupMetricsByDay(metrics) {
    const groups = new Map();
    for (const metric of metrics) {
        const date = new Date(metric.timestamp.toDate()).toISOString().split('T')[0];
        if (!groups.has(date)) {
            groups.set(date, {
                date,
                metrics: [],
                totals: {
                    firestoreReads: 0,
                    firestoreWrites: 0,
                    firestoreDeletes: 0,
                    functionInvocations: 0,
                    functionExecutionTime: 0
                }
            });
        }
        const group = groups.get(date);
        group.metrics.push(metric);
        group.totals.firestoreReads += metric.firestoreReads;
        group.totals.firestoreWrites += metric.firestoreWrites;
        group.totals.firestoreDeletes += metric.firestoreDeletes;
        group.totals.functionInvocations += metric.functionInvocations;
        group.totals.functionExecutionTime += metric.functionExecutionTime;
    }
    return Array.from(groups.values()).sort((a, b) => a.date.localeCompare(b.date));
}
/**
 * Calcula tendências de custo
 */
function calculateTrends(dailyCosts) {
    if (dailyCosts.length < 2)
        return null;
    const recent = dailyCosts.slice(-7); // Últimos 7 dias
    const previous = dailyCosts.slice(-14, -7); // 7 dias anteriores
    const recentAvg = recent.reduce((sum, day) => sum + day.costs.totalEstimated, 0) / recent.length;
    const previousAvg = previous.length > 0
        ? previous.reduce((sum, day) => sum + day.costs.totalEstimated, 0) / previous.length
        : recentAvg;
    const trend = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;
    return {
        recentAverage: recentAvg,
        previousAverage: previousAvg,
        trendPercentage: trend,
        direction: trend > 5 ? 'increasing' : trend < -5 ? 'decreasing' : 'stable'
    };
}
//# sourceMappingURL=costMonitoring.js.map