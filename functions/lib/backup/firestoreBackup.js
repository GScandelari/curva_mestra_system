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
exports.restoreFirestoreBackup = exports.cleanupOldBackups = exports.dailyFirestoreBackup = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const firestore = admin.firestore();
/**
 * Função para backup automático do Firestore
 * Executa diariamente às 2:00 AM
 */
exports.dailyFirestoreBackup = (0, scheduler_1.onSchedule)({
    schedule: '0 2 * * *',
    timeZone: 'America/Sao_Paulo'
}, async (event) => {
    const projectId = process.env.GCLOUD_PROJECT;
    const timestamp = new Date().toISOString().split('T')[0];
    const bucketName = `${projectId}-firestore-backups`;
    try {
        // Criar backup do Firestore
        const client = new admin.firestore.v1.FirestoreAdminClient();
        const databaseName = client.databasePath(projectId, '(default)');
        const [operation] = await client.exportDocuments({
            name: databaseName,
            outputUriPrefix: `gs://${bucketName}/backup-${timestamp}`,
            collectionIds: [] // Backup de todas as coleções
        });
        logger.info(`Backup iniciado: ${operation.name}`);
        // Registrar backup no Firestore para controle
        await firestore.collection('system').doc('backups').collection('history').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            operationName: operation.name,
            status: 'initiated',
            bucketPath: `gs://${bucketName}/backup-${timestamp}`
        });
        logger.info('Backup concluído com sucesso', { operationName: operation.name });
    }
    catch (error) {
        logger.error('Erro no backup do Firestore:', error);
        // Registrar erro
        await firestore.collection('system').doc('backups').collection('errors').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            error: error.message,
            type: 'backup_failed'
        });
        throw error;
    }
});
/**
 * Função para limpeza de backups antigos
 * Remove backups com mais de 30 dias
 */
exports.cleanupOldBackups = (0, scheduler_1.onSchedule)({
    schedule: '0 3 * * 0', // Todo domingo às 3:00 AM
    timeZone: 'America/Sao_Paulo'
}, async (event) => {
    const projectId = process.env.GCLOUD_PROJECT;
    const bucketName = `${projectId}-firestore-backups`;
    try {
        const { Storage } = require('@google-cloud/storage');
        const storage = new Storage();
        const bucket = storage.bucket(bucketName);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const [files] = await bucket.getFiles({
            prefix: 'backup-'
        });
        const filesToDelete = files.filter((file) => {
            const fileDate = new Date(file.metadata.timeCreated);
            return fileDate < thirtyDaysAgo;
        });
        for (const file of filesToDelete) {
            await file.delete();
            logger.info(`Backup antigo removido: ${file.name}`);
        }
        // Registrar limpeza
        await firestore.collection('system').doc('backups').collection('cleanup').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            filesDeleted: filesToDelete.length,
            cutoffDate: thirtyDaysAgo
        });
        logger.info('Limpeza de backups concluída', { filesDeleted: filesToDelete.length });
    }
    catch (error) {
        logger.error('Erro na limpeza de backups:', error);
        throw error;
    }
});
/**
 * Função para restaurar backup (chamada manual)
 */
exports.restoreFirestoreBackup = (0, https_1.onCall)(async (request) => {
    // Verificar se é admin
    if (!request.auth || !request.auth.token.role || request.auth.token.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Apenas admins podem restaurar backups');
    }
    const { backupPath } = request.data;
    if (!backupPath) {
        throw new https_1.HttpsError('invalid-argument', 'Caminho do backup é obrigatório');
    }
    try {
        const projectId = process.env.GCLOUD_PROJECT;
        const client = new admin.firestore.v1.FirestoreAdminClient();
        const databaseName = client.databasePath(projectId, '(default)');
        const [operation] = await client.importDocuments({
            name: databaseName,
            inputUriPrefix: backupPath,
            collectionIds: [] // Restaurar todas as coleções
        });
        // Registrar restauração
        await firestore.collection('system').doc('backups').collection('restores').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            operationName: operation.name,
            backupPath: backupPath,
            restoredBy: request.auth.uid,
            status: 'initiated'
        });
        return { success: true, operationName: operation.name };
    }
    catch (error) {
        logger.error('Erro na restauração:', error);
        throw new https_1.HttpsError('internal', 'Erro ao restaurar backup');
    }
});
//# sourceMappingURL=firestoreBackup.js.map