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
exports.monitorResourceUsage = exports.optimizeIndexes = exports.recordQueryMetrics = exports.analyzeQueryPerformance = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
/**
 * Analisa performance das consultas Firestore
 */
exports.analyzeQueryPerformance = (0, https_1.onCall)(async (request) => {
    if (!request.auth || !request.auth.token.role || request.auth.token.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Apenas admins podem analisar performance');
    }
    const data = request.data;
    const { clinicId, timeRange = 24 } = data; // timeRange em horas
    const startTime = new Date(Date.now() - timeRange * 60 * 60 * 1000);
    try {
        // Buscar métricas de performance dos últimos X horas
        const metricsSnapshot = await db
            .collection('system/performance/queries')
            .where('clinicId', '==', clinicId)
            .where('timestamp', '>=', startTime)
            .orderBy('timestamp', 'desc')
            .get();
        const metrics = metricsSnapshot.docs.map(doc => (Object.assign({}, doc.data())));
        // Analisar padrões de performance
        const analysis = analyzePerformancePatterns(metrics);
        // Gerar recomendações
        const recommendations = generateOptimizationRecommendations(analysis);
        return {
            summary: {
                totalQueries: metrics.length,
                averageExecutionTime: analysis.averageExecutionTime,
                slowQueries: analysis.slowQueries.length,
                timeRange: timeRange
            },
            slowQueries: analysis.slowQueries,
            recommendations: recommendations,
            indexSuggestions: analysis.indexSuggestions
        };
    }
    catch (error) {
        logger.error('Erro na análise de performance', { error: error.message, clinicId });
        throw new https_1.HttpsError('internal', 'Erro ao analisar performance');
    }
});
/**
 * Registra métricas de performance de uma consulta
 */
const recordQueryMetrics = async (queryName, collection, filters, executionTime, resultCount, clinicId) => {
    const metric = {
        queryName,
        collection,
        filters,
        executionTime,
        resultCount,
        timestamp: new Date(),
        clinicId
    };
    // Salvar métrica (com TTL de 30 dias)
    await db.collection('system/performance/queries').add(Object.assign(Object.assign({}, metric), { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
     }));
    // Log se consulta for lenta (> 2 segundos)
    if (executionTime > 2000) {
        logger.warn('Consulta lenta detectada', {
            queryName,
            collection,
            executionTime,
            resultCount,
            clinicId
        });
    }
};
exports.recordQueryMetrics = recordQueryMetrics;
/**
 * Analisa padrões de performance
 */
function analyzePerformancePatterns(metrics) {
    const totalQueries = metrics.length;
    const totalExecutionTime = metrics.reduce((sum, m) => sum + m.executionTime, 0);
    const averageExecutionTime = totalQueries > 0 ? totalExecutionTime / totalQueries : 0;
    // Consultas lentas (> 1 segundo)
    const slowQueries = metrics
        .filter(m => m.executionTime > 1000)
        .sort((a, b) => b.executionTime - a.executionTime)
        .slice(0, 10); // Top 10 mais lentas
    // Agrupar por coleção para análise
    const collectionStats = metrics.reduce((stats, metric) => {
        if (!stats[metric.collection]) {
            stats[metric.collection] = {
                count: 0,
                totalTime: 0,
                averageTime: 0,
                maxTime: 0,
                queries: []
            };
        }
        const stat = stats[metric.collection];
        stat.count++;
        stat.totalTime += metric.executionTime;
        stat.averageTime = stat.totalTime / stat.count;
        stat.maxTime = Math.max(stat.maxTime, metric.executionTime);
        stat.queries.push(metric);
        return stats;
    }, {});
    // Sugestões de índices baseadas em consultas lentas
    const indexSuggestions = generateIndexSuggestions(slowQueries);
    return {
        totalQueries,
        averageExecutionTime,
        slowQueries,
        collectionStats,
        indexSuggestions
    };
}
/**
 * Gera sugestões de índices baseadas em consultas lentas
 */
function generateIndexSuggestions(slowQueries) {
    const suggestions = [];
    for (const query of slowQueries) {
        if (query.filters && query.filters.length > 1) {
            // Sugerir índice composto para múltiplos filtros
            const fields = query.filters.map(f => ({
                fieldPath: f.field,
                order: f.operator === '==' ? 'ASCENDING' : 'DESCENDING'
            }));
            suggestions.push({
                collection: query.collection,
                fields: fields,
                reason: `Consulta lenta com múltiplos filtros (${query.executionTime}ms)`,
                queryName: query.queryName
            });
        }
    }
    return suggestions;
}
/**
 * Gera recomendações de otimização
 */
function generateOptimizationRecommendations(analysis) {
    const recommendations = [];
    // Recomendação de índices
    if (analysis.indexSuggestions.length > 0) {
        recommendations.push({
            type: 'index',
            priority: 'high',
            description: `Criar ${analysis.indexSuggestions.length} índices compostos para otimizar consultas lentas`,
            impact: 'Redução de 50-80% no tempo de consultas com múltiplos filtros',
            implementation: 'Adicionar índices ao firestore.indexes.json e fazer deploy'
        });
    }
    // Recomendação de cache
    if (analysis.averageExecutionTime > 500) {
        recommendations.push({
            type: 'cache',
            priority: 'medium',
            description: 'Implementar cache para consultas frequentes',
            impact: 'Redução de 70-90% no tempo de resposta para dados frequentemente acessados',
            implementation: 'Implementar cache no frontend com TTL de 5-10 minutos'
        });
    }
    // Recomendação de paginação
    const largeResultQueries = analysis.slowQueries.filter((q) => q.resultCount > 100);
    if (largeResultQueries.length > 0) {
        recommendations.push({
            type: 'pagination',
            priority: 'medium',
            description: 'Implementar paginação para consultas que retornam muitos resultados',
            impact: 'Redução significativa no tempo de carregamento inicial',
            implementation: 'Usar startAfter() e limit() para paginação cursor-based'
        });
    }
    return recommendations;
}
/**
 * Otimiza índices baseado no uso real
 */
exports.optimizeIndexes = (0, https_1.onCall)(async (request) => {
    if (!request.auth || !request.auth.token.role || request.auth.token.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Apenas admins podem otimizar índices');
    }
    const data = request.data;
    const { clinicId } = data;
    try {
        // Analisar consultas dos últimos 7 dias
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const metricsSnapshot = await db
            .collection('system/performance/queries')
            .where('clinicId', '==', clinicId)
            .where('timestamp', '>=', weekAgo)
            .get();
        const metrics = metricsSnapshot.docs.map(doc => doc.data());
        // Identificar padrões de consulta mais comuns
        const queryPatterns = analyzeQueryPatterns(metrics);
        // Gerar configuração de índices otimizada
        const optimizedIndexes = generateOptimizedIndexConfig(queryPatterns);
        return {
            currentIndexes: await getCurrentIndexes(),
            recommendedIndexes: optimizedIndexes,
            potentialImpact: calculateIndexImpact(metrics, optimizedIndexes)
        };
    }
    catch (error) {
        logger.error('Erro na otimização de índices', { error: error.message, clinicId });
        throw new https_1.HttpsError('internal', 'Erro ao otimizar índices');
    }
});
/**
 * Analisa padrões de consulta
 */
function analyzeQueryPatterns(metrics) {
    const patterns = new Map();
    for (const metric of metrics) {
        const key = `${metric.collection}_${JSON.stringify(metric.filters)}`;
        if (!patterns.has(key)) {
            patterns.set(key, {
                collection: metric.collection,
                filters: metric.filters,
                count: 0,
                totalTime: 0,
                averageTime: 0
            });
        }
        const pattern = patterns.get(key);
        pattern.count++;
        pattern.totalTime += metric.executionTime;
        pattern.averageTime = pattern.totalTime / pattern.count;
    }
    return Array.from(patterns.values())
        .sort((a, b) => b.count - a.count) // Ordenar por frequência
        .slice(0, 20); // Top 20 padrões mais comuns
}
/**
 * Gera configuração otimizada de índices
 */
function generateOptimizedIndexConfig(queryPatterns) {
    const indexes = [];
    for (const pattern of queryPatterns) {
        if (pattern.filters && pattern.filters.length > 1 && pattern.averageTime > 500) {
            // Criar índice composto para consultas lentas e frequentes
            const fields = pattern.filters.map((filter) => ({
                fieldPath: filter.field,
                order: determineOptimalOrder(filter)
            }));
            indexes.push({
                collectionGroup: pattern.collection,
                queryScope: 'COLLECTION',
                fields: fields
            });
        }
    }
    return indexes;
}
/**
 * Determina ordem ótima para campos no índice
 */
function determineOptimalOrder(filter) {
    // Campos de igualdade primeiro, depois ordenação
    if (filter.operator === '==')
        return 'ASCENDING';
    if (filter.operator === '>' || filter.operator === '>=')
        return 'ASCENDING';
    if (filter.operator === '<' || filter.operator === '<=')
        return 'DESCENDING';
    return 'ASCENDING';
}
/**
 * Obtém índices atuais do Firestore
 */
async function getCurrentIndexes() {
    // Esta função precisaria usar a Admin API para listar índices
    // Por simplicidade, retornamos um placeholder
    return {
        message: 'Use Firebase Console para ver índices atuais',
        url: 'https://console.firebase.google.com/project/curva-mestra/firestore/indexes'
    };
}
/**
 * Calcula impacto potencial dos novos índices
 */
function calculateIndexImpact(metrics, newIndexes) {
    const affectedQueries = metrics.filter(metric => newIndexes.some(index => index.collectionGroup === metric.collection &&
        metric.filters && metric.filters.length > 1));
    const currentAverageTime = affectedQueries.reduce((sum, m) => sum + m.executionTime, 0) / affectedQueries.length;
    const estimatedImprovement = 0.7; // 70% de melhoria estimada
    return {
        affectedQueries: affectedQueries.length,
        currentAverageTime: Math.round(currentAverageTime),
        estimatedNewTime: Math.round(currentAverageTime * (1 - estimatedImprovement)),
        estimatedImprovement: `${Math.round(estimatedImprovement * 100)}%`
    };
}
/**
 * Monitora custos e uso de recursos
 */
exports.monitorResourceUsage = (0, https_1.onCall)(async (request) => {
    if (!request.auth || !request.auth.token.role || request.auth.token.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Apenas admins podem monitorar recursos');
    }
    const data = request.data;
    const { clinicId, period = 'week' } = data;
    try {
        const timeRange = period === 'week' ? 7 : period === 'month' ? 30 : 1;
        const startTime = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
        // Buscar métricas de uso
        const usageSnapshot = await db
            .collection('system/usage/metrics')
            .where('clinicId', '==', clinicId)
            .where('timestamp', '>=', startTime)
            .orderBy('timestamp', 'desc')
            .get();
        const usageMetrics = usageSnapshot.docs.map(doc => doc.data());
        // Calcular estatísticas
        const stats = calculateUsageStats(usageMetrics);
        // Gerar recomendações de otimização de custos
        const costOptimizations = generateCostOptimizations(stats);
        return {
            period: period,
            stats: stats,
            optimizations: costOptimizations,
            projectedMonthlyCost: calculateProjectedCost(stats)
        };
    }
    catch (error) {
        logger.error('Erro no monitoramento de recursos', { error: error.message, clinicId });
        throw new https_1.HttpsError('internal', 'Erro ao monitorar recursos');
    }
});
/**
 * Calcula estatísticas de uso
 */
function calculateUsageStats(metrics) {
    const totalReads = metrics.reduce((sum, m) => sum + (m.firestoreReads || 0), 0);
    const totalWrites = metrics.reduce((sum, m) => sum + (m.firestoreWrites || 0), 0);
    const totalFunctionInvocations = metrics.reduce((sum, m) => sum + (m.functionInvocations || 0), 0);
    const totalStorageGB = metrics.reduce((sum, m) => sum + (m.storageGB || 0), 0) / metrics.length; // Média
    return {
        firestore: {
            reads: totalReads,
            writes: totalWrites,
            storage: totalStorageGB
        },
        functions: {
            invocations: totalFunctionInvocations,
            averageExecutionTime: metrics.reduce((sum, m) => sum + (m.avgExecutionTime || 0), 0) / metrics.length
        },
        hosting: {
            bandwidth: metrics.reduce((sum, m) => sum + (m.hostingBandwidth || 0), 0)
        }
    };
}
/**
 * Gera recomendações de otimização de custos
 */
function generateCostOptimizations(stats) {
    const optimizations = [];
    // Otimização de reads
    if (stats.firestore.reads > 100000) {
        optimizations.push({
            type: 'cache',
            priority: 'high',
            description: 'Implementar cache agressivo para reduzir reads do Firestore',
            potentialSavings: '$' + Math.round(stats.firestore.reads * 0.00036 * 0.5),
            implementation: 'Cache local com TTL de 10-15 minutos para dados menos críticos'
        });
    }
    // Otimização de writes
    if (stats.firestore.writes > 50000) {
        optimizations.push({
            type: 'batch',
            priority: 'medium',
            description: 'Usar batch writes para operações múltiplas',
            potentialSavings: '$' + Math.round(stats.firestore.writes * 0.00108 * 0.3),
            implementation: 'Agrupar writes relacionados em batches'
        });
    }
    return optimizations;
}
/**
 * Calcula custo mensal projetado
 */
function calculateProjectedCost(stats) {
    const firestoreCost = (stats.firestore.reads * 0.00036) +
        (stats.firestore.writes * 0.00108) +
        (stats.firestore.storage * 0.18);
    const functionsCost = stats.functions.invocations * 0.0000004;
    return {
        firestore: Math.round(firestoreCost * 100) / 100,
        functions: Math.round(functionsCost * 100) / 100,
        total: Math.round((firestoreCost + functionsCost) * 100) / 100
    };
}
//# sourceMappingURL=performanceAnalyzer.js.map