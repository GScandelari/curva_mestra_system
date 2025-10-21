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
exports.getErrorStats = exports.resolveError = exports.generateDailyErrorReport = exports.reportError = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore = admin.firestore();
/**
 * Função para receber relatórios de erro do frontend
 */
exports.reportError = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    try {
        const errorReport = {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            userId: (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid,
            clinicId: (_c = (_b = context.auth) === null || _b === void 0 ? void 0 : _b.token) === null || _c === void 0 ? void 0 : _c.clinicId,
            errorType: data.errorType || 'unknown',
            errorMessage: data.errorMessage || 'No message provided',
            stackTrace: data.stackTrace,
            userAgent: data.userAgent,
            url: data.url,
            severity: data.severity || 'medium',
            resolved: false,
            metadata: data.metadata || {}
        };
        // Salvar erro no Firestore
        const errorRef = await firestore.collection('system').doc('errors').collection('reports').add(errorReport);
        // Verificar se é erro crítico e enviar alerta
        if (errorReport.severity === 'critical') {
            await sendCriticalErrorAlert(errorRef.id, errorReport);
        }
        // Incrementar contador de erros
        await incrementErrorCounter(errorReport.errorType, errorReport.severity);
        return { success: true, errorId: errorRef.id };
    }
    catch (error) {
        console.error('Erro ao processar relatório de erro:', error);
        throw new functions.https.HttpsError('internal', 'Erro ao processar relatório');
    }
});
/**
 * Função para enviar alerta de erro crítico
 */
async function sendCriticalErrorAlert(errorId, errorReport) {
    try {
        // Criar notificação para admins
        const adminsSnapshot = await firestore.collectionGroup('users')
            .where('role', '==', 'admin')
            .get();
        const batch = firestore.batch();
        adminsSnapshot.docs.forEach(adminDoc => {
            const notificationRef = firestore
                .collection(`clinics/${adminDoc.data().clinicId}/notifications`)
                .doc();
            batch.set(notificationRef, {
                type: 'critical_error',
                title: 'Erro Crítico Detectado',
                message: `Erro crítico: ${errorReport.errorMessage}`,
                errorId: errorId,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
                priority: 'high'
            });
        });
        await batch.commit();
        // Log para monitoramento externo
        console.error('CRITICAL ERROR ALERT:', {
            errorId,
            message: errorReport.errorMessage,
            userId: errorReport.userId,
            clinicId: errorReport.clinicId
        });
    }
    catch (error) {
        console.error('Erro ao enviar alerta crítico:', error);
    }
}
/**
 * Função para incrementar contadores de erro
 */
async function incrementErrorCounter(errorType, severity) {
    const today = new Date().toISOString().split('T')[0];
    const counterRef = firestore.collection('system').doc('errors').collection('counters').doc(today);
    await counterRef.set({
        date: today,
        [`${errorType}_${severity}`]: admin.firestore.FieldValue.increment(1),
        [`total_${severity}`]: admin.firestore.FieldValue.increment(1),
        total: admin.firestore.FieldValue.increment(1),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}
/**
 * Função para gerar relatório diário de erros
 */
exports.generateDailyErrorReport = functions.pubsub
    .schedule('0 8 * * *') // Todo dia às 8:00 AM
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        // Buscar contador de erros de ontem
        const counterDoc = await firestore
            .collection('system')
            .doc('errors')
            .collection('counters')
            .doc(yesterdayStr)
            .get();
        if (!counterDoc.exists) {
            console.log('Nenhum erro registrado ontem');
            return;
        }
        const errorCounts = counterDoc.data();
        const totalErrors = (errorCounts === null || errorCounts === void 0 ? void 0 : errorCounts.total) || 0;
        // Se houver muitos erros, criar alerta
        if (totalErrors > 50) {
            await createHighErrorVolumeAlert(yesterdayStr, errorCounts);
        }
        // Buscar erros críticos não resolvidos
        const unresolvedCriticalErrors = await firestore
            .collection('system')
            .doc('errors')
            .collection('reports')
            .where('severity', '==', 'critical')
            .where('resolved', '==', false)
            .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(yesterday))
            .get();
        if (!unresolvedCriticalErrors.empty) {
            await createUnresolvedCriticalErrorsAlert(unresolvedCriticalErrors.size);
        }
        // Salvar relatório diário
        await firestore.collection('system').doc('errors').collection('daily_reports').doc(yesterdayStr).set({
            date: yesterdayStr,
            totalErrors: totalErrors,
            criticalErrors: (errorCounts === null || errorCounts === void 0 ? void 0 : errorCounts.total_critical) || 0,
            highErrors: (errorCounts === null || errorCounts === void 0 ? void 0 : errorCounts.total_high) || 0,
            mediumErrors: (errorCounts === null || errorCounts === void 0 ? void 0 : errorCounts.total_medium) || 0,
            lowErrors: (errorCounts === null || errorCounts === void 0 ? void 0 : errorCounts.total_low) || 0,
            unresolvedCritical: unresolvedCriticalErrors.size,
            generatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Relatório diário de erros gerado para ${yesterdayStr}`);
    }
    catch (error) {
        console.error('Erro ao gerar relatório diário:', error);
    }
});
/**
 * Criar alerta para alto volume de erros
 */
async function createHighErrorVolumeAlert(date, errorCounts) {
    const adminsSnapshot = await firestore.collectionGroup('users')
        .where('role', '==', 'admin')
        .get();
    const batch = firestore.batch();
    adminsSnapshot.docs.forEach(adminDoc => {
        const notificationRef = firestore
            .collection(`clinics/${adminDoc.data().clinicId}/notifications`)
            .doc();
        batch.set(notificationRef, {
            type: 'high_error_volume',
            title: 'Alto Volume de Erros Detectado',
            message: `${errorCounts.total} erros registrados em ${date}`,
            date: date,
            errorCounts: errorCounts,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
            priority: 'high'
        });
    });
    await batch.commit();
}
/**
 * Criar alerta para erros críticos não resolvidos
 */
async function createUnresolvedCriticalErrorsAlert(count) {
    const adminsSnapshot = await firestore.collectionGroup('users')
        .where('role', '==', 'admin')
        .get();
    const batch = firestore.batch();
    adminsSnapshot.docs.forEach(adminDoc => {
        const notificationRef = firestore
            .collection(`clinics/${adminDoc.data().clinicId}/notifications`)
            .doc();
        batch.set(notificationRef, {
            type: 'unresolved_critical_errors',
            title: 'Erros Críticos Não Resolvidos',
            message: `${count} erros críticos aguardando resolução`,
            count: count,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
            priority: 'critical'
        });
    });
    await batch.commit();
}
/**
 * Função para marcar erro como resolvido
 */
exports.resolveError = functions.https.onCall(async (data, context) => {
    // Verificar se é admin
    if (!context.auth || !context.auth.token.role || context.auth.token.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Apenas admins podem resolver erros');
    }
    const { errorId, resolution } = data;
    if (!errorId) {
        throw new functions.https.HttpsError('invalid-argument', 'ID do erro é obrigatório');
    }
    try {
        await firestore
            .collection('system')
            .doc('errors')
            .collection('reports')
            .doc(errorId)
            .update({
            resolved: true,
            resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            resolvedBy: context.auth.uid,
            resolution: resolution || 'Resolvido pelo administrador'
        });
        return { success: true };
    }
    catch (error) {
        console.error('Erro ao resolver erro:', error);
        throw new functions.https.HttpsError('internal', 'Erro ao resolver erro');
    }
});
/**
 * Função para buscar estatísticas de erros
 */
exports.getErrorStats = functions.https.onCall(async (data, context) => {
    // Verificar se é admin
    if (!context.auth || !context.auth.token.role || context.auth.token.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Apenas admins podem ver estatísticas');
    }
    try {
        const { days = 7 } = data;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        // Buscar relatórios diários
        const reportsSnapshot = await firestore
            .collection('system')
            .doc('errors')
            .collection('daily_reports')
            .where('date', '>=', startDate.toISOString().split('T')[0])
            .where('date', '<=', endDate.toISOString().split('T')[0])
            .orderBy('date', 'desc')
            .get();
        const reports = reportsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        // Calcular totais
        const totals = reports.reduce((acc, report) => ({
            totalErrors: acc.totalErrors + (report.totalErrors || 0),
            criticalErrors: acc.criticalErrors + (report.criticalErrors || 0),
            highErrors: acc.highErrors + (report.highErrors || 0),
            mediumErrors: acc.mediumErrors + (report.mediumErrors || 0),
            lowErrors: acc.lowErrors + (report.lowErrors || 0)
        }), {
            totalErrors: 0,
            criticalErrors: 0,
            highErrors: 0,
            mediumErrors: 0,
            lowErrors: 0
        });
        return {
            reports,
            totals,
            period: {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                days
            }
        };
    }
    catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        throw new functions.https.HttpsError('internal', 'Erro ao buscar estatísticas');
    }
});
//# sourceMappingURL=errorReporting.js.map