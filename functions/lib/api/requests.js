"use strict";
/**
 * Firebase Functions for Request Management
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
exports.fulfillRequest = exports.rejectRequest = exports.approveRequest = exports.getUserRequests = exports.getRequestById = exports.getRequests = exports.createRequest = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const auth_1 = require("../middleware/auth");
const db = admin.firestore();
// interface RequestedProduct {
//   productId: string;
//   productName: string;
//   quantity: number;
//   unitPrice: number;
//   totalPrice: number;
// }
/**
 * Create new product request
 */
exports.createRequest = (0, https_1.onCall)(async (request) => {
    var _a;
    try {
        const authRequest = (0, auth_1.verifyAuth)(request);
        // Rate limiting
        (0, auth_1.rateLimit)({ maxRequests: 10, windowMs: 60000 })(authRequest);
        const { products, patientId, notes } = request.data;
        // Validate required fields
        (0, auth_1.validateInput)(request.data, ['products']);
        if (!Array.isArray(products) || products.length === 0) {
            throw new Error('Lista de produtos é obrigatória');
        }
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        // Validate that all products exist and have sufficient stock
        const productValidations = await Promise.all(products.map(async (item) => {
            const productDoc = await db
                .collection(`clinics/${clinicId}/products`)
                .doc(item.productId)
                .get();
            if (!productDoc.exists) {
                throw new Error(`Produto não encontrado: ${item.productId}`);
            }
            const productData = productDoc.data();
            if (productData.currentStock < item.quantity) {
                throw new Error(`Estoque insuficiente para ${productData.name}. Disponível: ${productData.currentStock}, Solicitado: ${item.quantity}`);
            }
            return {
                productId: item.productId,
                productName: productData.name,
                quantity: item.quantity,
                unitPrice: productData.unitPrice,
                totalPrice: productData.unitPrice * item.quantity
            };
        }));
        // Validate patient if provided
        if (patientId) {
            const patientDoc = await db
                .collection(`clinics/${clinicId}/patients`)
                .doc(patientId)
                .get();
            if (!patientDoc.exists) {
                throw new Error('Paciente não encontrado');
            }
        }
        // Create request using transaction
        const result = await db.runTransaction(async (transaction) => {
            // Create main request document
            const requestRef = db.collection(`clinics/${clinicId}/requests`).doc();
            const requestData = {
                requesterId: authRequest.auth.uid,
                patientId: patientId || null,
                status: 'pending',
                notes: notes || '',
                createdAt: admin.firestore.Timestamp.now(),
                clinicId
            };
            transaction.set(requestRef, requestData);
            // Create requested products subcollection
            productValidations.forEach((product, index) => {
                const productRef = db
                    .collection(`clinics/${clinicId}/requests/${requestRef.id}/products`)
                    .doc();
                transaction.set(productRef, product);
            });
            return {
                requestId: requestRef.id,
                products: productValidations
            };
        });
        logger.info('Request created', {
            requestId: result.requestId,
            requesterId: authRequest.auth.uid,
            productsCount: products.length,
            clinicId
        });
        return {
            success: true,
            message: 'Solicitação criada com sucesso',
            requestId: result.requestId,
            products: result.products
        };
    }
    catch (error) {
        (0, auth_1.logError)('createRequest', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            data: request.data
        });
        if (error.message.includes('não encontrado') || error.message.includes('Estoque insuficiente')) {
            throw new Error('invalid-argument');
        }
        throw new Error('internal');
    }
});
/**
 * Get requests with filtering and pagination
 */
exports.getRequests = (0, https_1.onCall)(async (request) => {
    var _a;
    try {
        const authRequest = (0, auth_1.authorize)(['admin', 'manager'])(request);
        // Rate limiting
        (0, auth_1.rateLimit)({ maxRequests: 30, windowMs: 60000 })(authRequest);
        const { page = 1, limit = 10, status, requesterId, startDate, endDate } = request.data || {};
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        let query = db.collection(`clinics/${clinicId}/requests`);
        // Apply filters
        if (status) {
            query = query.where('status', '==', status);
        }
        if (requesterId) {
            query = query.where('requesterId', '==', requesterId);
        }
        if (startDate) {
            const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(startDate));
            query = query.where('createdAt', '>=', startTimestamp);
        }
        if (endDate) {
            const endTimestamp = admin.firestore.Timestamp.fromDate(new Date(endDate));
            query = query.where('createdAt', '<=', endTimestamp);
        }
        // Apply pagination and ordering
        query = query.orderBy('createdAt', 'desc').limit(limit);
        const snapshot = await query.get();
        // Get requests with their products
        const requests = await Promise.all(snapshot.docs.map(async (doc) => {
            const requestData = Object.assign({ id: doc.id }, doc.data());
            // Get products for this request
            const productsSnapshot = await db
                .collection(`clinics/${clinicId}/requests/${doc.id}/products`)
                .get();
            const products = productsSnapshot.docs.map(productDoc => (Object.assign({ id: productDoc.id }, productDoc.data())));
            return Object.assign(Object.assign({}, requestData), { products });
        }));
        return {
            success: true,
            requests,
            pagination: {
                currentPage: page,
                totalItems: requests.length,
                itemsPerPage: limit,
                hasMore: snapshot.docs.length === limit
            }
        };
    }
    catch (error) {
        (0, auth_1.logError)('getRequests', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            data: request.data
        });
        throw new Error('internal');
    }
});
/**
 * Get request by ID
 */
exports.getRequestById = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        const authRequest = (0, auth_1.verifyAuth)(request);
        const { requestId } = request.data;
        (0, auth_1.validateInput)(request.data, ['requestId']);
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        const requestDoc = await db
            .collection(`clinics/${clinicId}/requests`)
            .doc(requestId)
            .get();
        if (!requestDoc.exists) {
            throw new Error('Solicitação não encontrada');
        }
        const requestData = requestDoc.data();
        // Check if user can access this request
        const userRole = authRequest.auth.token.role;
        if (!['admin', 'manager'].includes(userRole) &&
            requestData.requesterId !== authRequest.auth.uid) {
            throw new Error('Acesso negado a esta solicitação');
        }
        // Get products for this request
        const productsSnapshot = await db
            .collection(`clinics/${clinicId}/requests/${requestId}/products`)
            .get();
        const products = productsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        return {
            success: true,
            request: Object.assign(Object.assign({ id: requestDoc.id }, requestData), { products })
        };
    }
    catch (error) {
        (0, auth_1.logError)('getRequestById', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            requestId: (_b = request.data) === null || _b === void 0 ? void 0 : _b.requestId
        });
        if (error.message === 'Solicitação não encontrada') {
            throw new Error('not-found');
        }
        if (error.message === 'Acesso negado a esta solicitação') {
            throw new Error('permission-denied');
        }
        throw new Error('internal');
    }
});
/**
 * Get user requests
 */
exports.getUserRequests = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        const authRequest = (0, auth_1.verifyAuth)(request);
        const { userId, page = 1, limit = 10 } = request.data || {};
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        // Users can only see their own requests unless they're admin/manager
        const targetUserId = userId || authRequest.auth.uid;
        const userRole = authRequest.auth.token.role;
        if (targetUserId !== authRequest.auth.uid && !['admin', 'manager'].includes(userRole)) {
            throw new Error('Acesso negado');
        }
        const snapshot = await db
            .collection(`clinics/${clinicId}/requests`)
            .where('requesterId', '==', targetUserId)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        // Get requests with their products
        const requests = await Promise.all(snapshot.docs.map(async (doc) => {
            const requestData = Object.assign({ id: doc.id }, doc.data());
            // Get products for this request
            const productsSnapshot = await db
                .collection(`clinics/${clinicId}/requests/${doc.id}/products`)
                .get();
            const products = productsSnapshot.docs.map(productDoc => (Object.assign({ id: productDoc.id }, productDoc.data())));
            return Object.assign(Object.assign({}, requestData), { products });
        }));
        return {
            success: true,
            requests,
            pagination: {
                currentPage: page,
                totalItems: requests.length,
                itemsPerPage: limit,
                hasMore: snapshot.docs.length === limit
            }
        };
    }
    catch (error) {
        (0, auth_1.logError)('getUserRequests', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            targetUserId: (_b = request.data) === null || _b === void 0 ? void 0 : _b.userId
        });
        if (error.message === 'Acesso negado') {
            throw new Error('permission-denied');
        }
        throw new Error('internal');
    }
});
/**
 * Approve request
 */
exports.approveRequest = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        const authRequest = (0, auth_1.authorize)(['admin', 'manager'])(request);
        // Rate limiting
        (0, auth_1.rateLimit)({ maxRequests: 10, windowMs: 60000 })(authRequest);
        const { requestId } = request.data;
        (0, auth_1.validateInput)(request.data, ['requestId']);
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        const requestRef = db.collection(`clinics/${clinicId}/requests`).doc(requestId);
        const requestDoc = await requestRef.get();
        if (!requestDoc.exists) {
            throw new Error('Solicitação não encontrada');
        }
        const requestData = requestDoc.data();
        if (requestData.status !== 'pending') {
            throw new Error('Apenas solicitações pendentes podem ser aprovadas');
        }
        // Update request status
        await requestRef.update({
            status: 'approved',
            approvedBy: authRequest.auth.uid,
            approvedAt: admin.firestore.Timestamp.now()
        });
        logger.info('Request approved', {
            requestId,
            approvedBy: authRequest.auth.uid,
            clinicId
        });
        return {
            success: true,
            message: 'Solicitação aprovada com sucesso',
            requestId
        };
    }
    catch (error) {
        (0, auth_1.logError)('approveRequest', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            requestId: (_b = request.data) === null || _b === void 0 ? void 0 : _b.requestId
        });
        if (error.message.includes('não encontrada') || error.message.includes('pendentes')) {
            throw new Error('invalid-argument');
        }
        throw new Error('internal');
    }
});
/**
 * Reject request
 */
exports.rejectRequest = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        const authRequest = (0, auth_1.authorize)(['admin', 'manager'])(request);
        // Rate limiting
        (0, auth_1.rateLimit)({ maxRequests: 10, windowMs: 60000 })(authRequest);
        const { requestId, rejectionReason } = request.data;
        (0, auth_1.validateInput)(request.data, ['requestId', 'rejectionReason']);
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        const requestRef = db.collection(`clinics/${clinicId}/requests`).doc(requestId);
        const requestDoc = await requestRef.get();
        if (!requestDoc.exists) {
            throw new Error('Solicitação não encontrada');
        }
        const requestData = requestDoc.data();
        if (requestData.status !== 'pending') {
            throw new Error('Apenas solicitações pendentes podem ser rejeitadas');
        }
        // Update request status
        await requestRef.update({
            status: 'rejected',
            rejectionReason,
            rejectedBy: authRequest.auth.uid,
            rejectedAt: admin.firestore.Timestamp.now()
        });
        logger.info('Request rejected', {
            requestId,
            rejectedBy: authRequest.auth.uid,
            rejectionReason,
            clinicId
        });
        return {
            success: true,
            message: 'Solicitação rejeitada com sucesso',
            requestId
        };
    }
    catch (error) {
        (0, auth_1.logError)('rejectRequest', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            requestId: (_b = request.data) === null || _b === void 0 ? void 0 : _b.requestId
        });
        if (error.message.includes('não encontrada') || error.message.includes('pendentes')) {
            throw new Error('invalid-argument');
        }
        throw new Error('internal');
    }
});
/**
 * Fulfill request (mark as completed and adjust stock)
 */
exports.fulfillRequest = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        const authRequest = (0, auth_1.authorize)(['admin', 'manager', 'doctor'])(request);
        // Rate limiting
        (0, auth_1.rateLimit)({ maxRequests: 10, windowMs: 60000 })(authRequest);
        const { requestId } = request.data;
        (0, auth_1.validateInput)(request.data, ['requestId']);
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        // Use transaction to fulfill request and adjust stock
        const result = await db.runTransaction(async (transaction) => {
            const requestRef = db.collection(`clinics/${clinicId}/requests`).doc(requestId);
            const requestDoc = await transaction.get(requestRef);
            if (!requestDoc.exists) {
                throw new Error('Solicitação não encontrada');
            }
            const requestData = requestDoc.data();
            if (requestData.status !== 'approved') {
                throw new Error('Apenas solicitações aprovadas podem ser atendidas');
            }
            // Get requested products
            const productsSnapshot = await db
                .collection(`clinics/${clinicId}/requests/${requestId}/products`)
                .get();
            // Adjust stock for each product
            const stockAdjustments = [];
            for (const productDoc of productsSnapshot.docs) {
                const requestedProduct = productDoc.data();
                const productRef = db.collection(`clinics/${clinicId}/products`).doc(requestedProduct.productId);
                const productSnapshot = await transaction.get(productRef);
                if (!productSnapshot.exists) {
                    throw new Error(`Produto não encontrado: ${requestedProduct.productId}`);
                }
                const productData = productSnapshot.data();
                const newStock = productData.currentStock - requestedProduct.quantity;
                if (newStock < 0) {
                    throw new Error(`Estoque insuficiente para ${productData.name}`);
                }
                // Update product stock
                transaction.update(productRef, {
                    currentStock: newStock,
                    updatedAt: admin.firestore.Timestamp.now(),
                    updatedBy: authRequest.auth.uid
                });
                // Create stock movement
                const movementRef = db.collection(`clinics/${clinicId}/products/${requestedProduct.productId}/movements`).doc();
                transaction.set(movementRef, {
                    type: 'EXIT',
                    quantity: requestedProduct.quantity,
                    reason: `Atendimento da solicitação ${requestId}`,
                    performedBy: authRequest.auth.uid,
                    performedAt: admin.firestore.Timestamp.now(),
                    previousStock: productData.currentStock,
                    newStock,
                    requestId
                });
                stockAdjustments.push({
                    productId: requestedProduct.productId,
                    productName: requestedProduct.productName,
                    quantity: requestedProduct.quantity,
                    previousStock: productData.currentStock,
                    newStock
                });
            }
            // Update request status
            transaction.update(requestRef, {
                status: 'fulfilled',
                fulfilledBy: authRequest.auth.uid,
                fulfilledAt: admin.firestore.Timestamp.now()
            });
            return stockAdjustments;
        });
        logger.info('Request fulfilled', {
            requestId,
            fulfilledBy: authRequest.auth.uid,
            stockAdjustments: result.length,
            clinicId
        });
        return {
            success: true,
            message: 'Solicitação atendida com sucesso',
            requestId,
            stockAdjustments: result
        };
    }
    catch (error) {
        (0, auth_1.logError)('fulfillRequest', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            requestId: (_b = request.data) === null || _b === void 0 ? void 0 : _b.requestId
        });
        if (error.message.includes('não encontrada') ||
            error.message.includes('aprovadas') ||
            error.message.includes('Estoque insuficiente')) {
            throw new Error('invalid-argument');
        }
        throw new Error('internal');
    }
});
//# sourceMappingURL=requests.js.map