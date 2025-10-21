"use strict";
/**
 * Firebase Functions for Notification System
 *
 * This module contains all notification-related Cloud Functions including:
 * - Scheduled alerts for expiring products
 * - Triggers for low stock alerts
 * - Real-time notification management
 */
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
exports.markNotificationAsRead = exports.getNotifications = exports.createSystemAlerts = exports.onStockMovement = exports.checkLowStock = exports.checkExpiringProducts = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const db = admin.firestore();
/**
 * Scheduled function to check for expiring products
 * Runs daily at 9 AM
 */
exports.checkExpiringProducts = (0, scheduler_1.onSchedule)({
    schedule: '0 9 * * *',
    timeZone: 'America/Sao_Paulo'
}, async (event) => {
    logger.info('Starting expiring products check...');
    try {
        // Get all clinics
        const clinicsSnapshot = await db.collection('clinics').get();
        for (const clinicDoc of clinicsSnapshot.docs) {
            const clinicId = clinicDoc.id;
            logger.info(`Checking expiring products for clinic: ${clinicId}`);
            // Check for products expiring in the next 30 days
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
            const expiringProductsSnapshot = await db
                .collection(`clinics/${clinicId}/products`)
                .where('expirationDate', '<=', admin.firestore.Timestamp.fromDate(thirtyDaysFromNow))
                .where('expirationDate', '>', admin.firestore.Timestamp.now())
                .where('currentStock', '>', 0)
                .get();
            if (!expiringProductsSnapshot.empty) {
                const expiringProducts = expiringProductsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
                // Create notification for expiring products
                await createNotification(clinicId, {
                    type: 'expiring_products',
                    title: 'Produtos Vencendo',
                    message: `${expiringProducts.length} produto(s) vencendo nos próximos 30 dias`,
                    data: {
                        count: expiringProducts.length,
                        products: expiringProducts.map((p) => ({
                            id: p.id,
                            name: p.name,
                            expirationDate: p.expirationDate,
                            currentStock: p.currentStock
                        }))
                    },
                    priority: 'high'
                });
                logger.info(`Created expiring products notification for clinic ${clinicId}: ${expiringProducts.length} products`);
            }
        }
        logger.info('Expiring products check completed successfully');
    }
    catch (error) {
        logger.error('Error checking expiring products:', error);
        throw error;
    }
});
/**
 * Trigger function for low stock alerts
 * Runs when a product's stock is updated
 */
exports.checkLowStock = (0, firestore_1.onDocumentUpdated)('clinics/{clinicId}/products/{productId}', async (event) => {
    var _a, _b;
    const { clinicId, productId } = event.params;
    const newData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after.data();
    const oldData = (_b = event.data) === null || _b === void 0 ? void 0 : _b.before.data();
    logger.info(`Stock update detected for product ${productId} in clinic ${clinicId}`);
    try {
        // Check if stock decreased and is now below minimum
        if (newData && oldData &&
            newData.currentStock < newData.minimumStock &&
            oldData.currentStock >= oldData.minimumStock) {
            logger.info(`Low stock detected: ${newData.name} (${newData.currentStock}/${newData.minimumStock})`);
            // Create low stock notification
            await createNotification(clinicId, {
                type: 'low_stock',
                title: 'Estoque Baixo',
                message: `${newData.name} está com estoque baixo (${newData.currentStock} unidades)`,
                data: {
                    productId: productId,
                    productName: newData.name,
                    currentStock: newData.currentStock,
                    minimumStock: newData.minimumStock,
                    category: newData.category
                },
                priority: 'high'
            });
            logger.info(`Created low stock notification for product: ${newData.name}`);
        }
    }
    catch (error) {
        logger.error('Error checking low stock:', error);
        throw error;
    }
});
/**
 * Trigger function for stock movement alerts
 * Runs when a new stock movement is created
 */
exports.onStockMovement = (0, firestore_1.onDocumentCreated)('clinics/{clinicId}/products/{productId}/movements/{movementId}', async (event) => {
    var _a;
    const { clinicId, productId } = event.params;
    const movementData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    try {
        // Get product data
        const productDoc = await db.doc(`clinics/${clinicId}/products/${productId}`).get();
        if (!productDoc.exists) {
            logger.error(`Product ${productId} not found`);
            return;
        }
        const productData = productDoc.data();
        // Create notification for significant stock movements
        if (movementData && Math.abs(movementData.quantity) >= 10) {
            const movementType = movementData.quantity > 0 ? 'entrada' : 'saída';
            await createNotification(clinicId, {
                type: 'stock_movement',
                title: `Movimentação de Estoque - ${movementType}`,
                message: `${productData === null || productData === void 0 ? void 0 : productData.name}: ${movementType} de ${Math.abs(movementData.quantity)} unidades`,
                data: {
                    productId: productId,
                    productName: productData === null || productData === void 0 ? void 0 : productData.name,
                    movementType: movementType,
                    quantity: Math.abs(movementData.quantity),
                    reason: movementData.reason,
                    userId: movementData.userId
                },
                priority: 'medium'
            });
            logger.info(`Created stock movement notification for product: ${productData === null || productData === void 0 ? void 0 : productData.name}`);
        }
    }
    catch (error) {
        logger.error('Error processing stock movement:', error);
        throw error;
    }
});
/**
 * HTTP function to create system alerts manually
 */
exports.createSystemAlerts = (0, https_1.onCall)(async (request) => {
    // Verify authentication
    if (!request.auth) {
        throw new Error('Usuário não autenticado');
    }
    const clinicId = request.auth.token.clinicId;
    if (!clinicId) {
        throw new Error('Usuário não associado a uma clínica');
    }
    try {
        const alerts = [];
        // Check for expiring products
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const expiringProductsSnapshot = await db
            .collection(`clinics/${clinicId}/products`)
            .where('expirationDate', '<=', admin.firestore.Timestamp.fromDate(thirtyDaysFromNow))
            .where('expirationDate', '>', admin.firestore.Timestamp.now())
            .where('currentStock', '>', 0)
            .get();
        if (!expiringProductsSnapshot.empty) {
            alerts.push({
                type: 'expiring_products',
                count: expiringProductsSnapshot.size,
                products: expiringProductsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name,
                    expirationDate: doc.data().expirationDate
                }))
            });
        }
        // Check for low stock products
        const lowStockSnapshot = await db
            .collection(`clinics/${clinicId}/products`)
            .where('currentStock', '<=', 'minimumStock')
            .get();
        const lowStockProducts = [];
        for (const doc of lowStockSnapshot.docs) {
            const data = doc.data();
            if (data.currentStock <= data.minimumStock) {
                lowStockProducts.push({
                    id: doc.id,
                    name: data.name,
                    currentStock: data.currentStock,
                    minimumStock: data.minimumStock
                });
            }
        }
        if (lowStockProducts.length > 0) {
            alerts.push({
                type: 'low_stock',
                count: lowStockProducts.length,
                products: lowStockProducts
            });
        }
        // Create notifications for each alert type
        for (const alert of alerts) {
            if (alert.type === 'expiring_products') {
                await createNotification(clinicId, {
                    type: 'expiring_products',
                    title: 'Produtos Vencendo',
                    message: `${alert.count} produto(s) vencendo nos próximos 30 dias`,
                    data: alert,
                    priority: 'high'
                });
            }
            else if (alert.type === 'low_stock') {
                await createNotification(clinicId, {
                    type: 'low_stock',
                    title: 'Estoque Baixo',
                    message: `${alert.count} produto(s) com estoque baixo`,
                    data: alert,
                    priority: 'high'
                });
            }
        }
        return {
            success: true,
            alertsCreated: alerts.length,
            alerts: alerts
        };
    }
    catch (error) {
        logger.error('Error creating system alerts:', error);
        throw new Error('Erro ao criar alertas do sistema');
    }
});
/**
 * HTTP function to get notifications for a user
 */
exports.getNotifications = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new Error('Usuário não autenticado');
    }
    const clinicId = request.auth.token.clinicId;
    const data = request.data;
    try {
        let query = db.collection(`clinics/${clinicId}/notifications`)
            .orderBy('createdAt', 'desc');
        // Apply filters
        if (data.unread === true) {
            query = query.where('read', '==', false);
        }
        if (data.type) {
            query = query.where('type', '==', data.type);
        }
        if (data.limit) {
            query = query.limit(data.limit);
        }
        const snapshot = await query.get();
        const notifications = snapshot.docs.map(doc => {
            var _a, _b;
            return (Object.assign(Object.assign({ id: doc.id }, doc.data()), { createdAt: ((_b = (_a = doc.data().createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || doc.data().createdAt }));
        });
        return {
            success: true,
            notifications: notifications,
            total: notifications.length
        };
    }
    catch (error) {
        logger.error('Error getting notifications:', error);
        throw new Error('Erro ao buscar notificações');
    }
});
/**
 * HTTP function to mark notification as read
 */
exports.markNotificationAsRead = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new Error('Usuário não autenticado');
    }
    const { notificationId } = request.data;
    if (!notificationId) {
        throw new Error('ID da notificação é obrigatório');
    }
    const clinicId = request.auth.token.clinicId;
    try {
        await db.doc(`clinics/${clinicId}/notifications/${notificationId}`).update({
            read: true,
            readAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return {
            success: true,
            message: 'Notificação marcada como lida'
        };
    }
    catch (error) {
        logger.error('Error marking notification as read:', error);
        throw new Error('Erro ao marcar notificação como lida');
    }
});
/**
 * Helper function to create a notification
 */
async function createNotification(clinicId, notificationData) {
    const notification = {
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data || {},
        priority: notificationData.priority || 'medium',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        userId: notificationData.userId || null // null means notification is for all users in clinic
    };
    await db.collection(`clinics/${clinicId}/notifications`).add(notification);
}
//# sourceMappingURL=index.js.map