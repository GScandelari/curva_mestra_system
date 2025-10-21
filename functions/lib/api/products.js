"use strict";
/**
 * Firebase Functions for Product Management
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExpiringProducts = exports.getLowStockProducts = exports.deleteProduct = exports.adjustStock = exports.updateProduct = exports.getProductById = exports.getProducts = exports.createProduct = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const auth_1 = require("../middleware/auth");
const db = admin.firestore();
/**
 * Create new product
 */
exports.createProduct = (0, https_1.onCall)(async (request) => {
    var _a;
    try {
        const authRequest = (0, auth_1.authorize)(['admin', 'manager'])(request);
        // Rate limiting
        (0, auth_1.rateLimit)({ maxRequests: 10, windowMs: 60000 })(authRequest);
        const { name, description, category, invoiceNumber, supplier, currentStock, minimumStock, unitPrice, expirationDate } = request.data;
        // Validate required fields
        (0, auth_1.validateInput)(request.data, [
            'name', 'category', 'invoiceNumber', 'supplier',
            'currentStock', 'minimumStock', 'unitPrice', 'expirationDate'
        ]);
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        // Check if invoice number already exists
        const existingProduct = await db
            .collection(`clinics/${clinicId}/products`)
            .where('invoiceNumber', '==', invoiceNumber)
            .limit(1)
            .get();
        if (!existingProduct.empty) {
            throw new Error('Nota fiscal já cadastrada');
        }
        // Convert expiration date
        const expirationTimestamp = admin.firestore.Timestamp.fromDate(new Date(expirationDate));
        const now = admin.firestore.Timestamp.now();
        // Check if product is expired
        const isExpired = expirationTimestamp.toDate() < new Date();
        const productData = {
            name,
            description: description || '',
            category,
            invoiceNumber,
            supplier,
            currentStock: Number(currentStock),
            minimumStock: Number(minimumStock),
            unitPrice: Number(unitPrice),
            expirationDate: expirationTimestamp,
            entryDate: now,
            isExpired,
            createdAt: now,
            createdBy: authRequest.auth.uid,
            clinicId
        };
        const docRef = await db.collection(`clinics/${clinicId}/products`).add(productData);
        // Create initial stock movement
        await db.collection(`clinics/${clinicId}/products/${docRef.id}/movements`).add({
            type: 'ENTRY',
            quantity: currentStock,
            reason: 'Entrada inicial do produto',
            performedBy: authRequest.auth.uid,
            performedAt: now,
            previousStock: 0,
            newStock: currentStock
        });
        logger.info('Product created', {
            productId: docRef.id,
            name,
            clinicId,
            createdBy: authRequest.auth.uid
        });
        return {
            success: true,
            message: 'Produto criado com sucesso',
            productId: docRef.id,
            product: Object.assign({ id: docRef.id }, productData)
        };
    }
    catch (error) {
        (0, auth_1.logError)('createProduct', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            data: request.data
        });
        if (error.message === 'Nota fiscal já cadastrada') {
            throw new Error('already-exists');
        }
        throw new Error('internal');
    }
});
/**
 * Get products with filtering and pagination
 */
exports.getProducts = (0, https_1.onCall)(async (request) => {
    var _a;
    try {
        const authRequest = (0, auth_1.verifyAuth)(request);
        // Rate limiting
        (0, auth_1.rateLimit)({ maxRequests: 30, windowMs: 60000 })(authRequest);
        const { page = 1, limit = 10, category, invoiceNumber, lowStock, expiringSoon, search } = request.data || {};
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        let query = db.collection(`clinics/${clinicId}/products`);
        // Apply filters
        if (category) {
            query = query.where('category', '==', category);
        }
        if (invoiceNumber) {
            query = query.where('invoiceNumber', '==', invoiceNumber);
        }
        if (lowStock === true) {
            // Note: Firestore doesn't support field comparisons directly
            // This would need to be handled client-side or with a different approach
            logger.warn('Low stock filter not fully supported in Firestore');
        }
        if (expiringSoon === true) {
            const thirtyDaysFromNow = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
            query = query.where('expirationDate', '<=', thirtyDaysFromNow);
        }
        // Apply pagination
        const offset = (page - 1) * limit;
        query = query.orderBy('createdAt', 'desc').limit(limit);
        if (offset > 0) {
            // For proper pagination, we'd need to use cursor-based pagination
            // This is a simplified version
            logger.warn('Offset pagination not optimal in Firestore');
        }
        const snapshot = await query.get();
        const products = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        // Filter by search term if provided (client-side filtering)
        let filteredProducts = products;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredProducts = products.filter((product) => {
                var _a, _b;
                return ((_a = product.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchLower)) ||
                    ((_b = product.description) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(searchLower));
            });
        }
        // Filter low stock products if requested
        if (lowStock === true) {
            filteredProducts = filteredProducts.filter((product) => product.currentStock <= product.minimumStock);
        }
        return {
            success: true,
            products: filteredProducts,
            pagination: {
                currentPage: page,
                totalItems: filteredProducts.length,
                itemsPerPage: limit,
                hasMore: snapshot.docs.length === limit
            }
        };
    }
    catch (error) {
        (0, auth_1.logError)('getProducts', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            data: request.data
        });
        throw new Error('internal');
    }
});
/**
 * Get product by ID
 */
exports.getProductById = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        const authRequest = (0, auth_1.verifyAuth)(request);
        const { productId } = request.data;
        (0, auth_1.validateInput)(request.data, ['productId']);
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        const productDoc = await db
            .collection(`clinics/${clinicId}/products`)
            .doc(productId)
            .get();
        if (!productDoc.exists) {
            throw new Error('Produto não encontrado');
        }
        return {
            success: true,
            product: Object.assign({ id: productDoc.id }, productDoc.data())
        };
    }
    catch (error) {
        (0, auth_1.logError)('getProductById', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            productId: (_b = request.data) === null || _b === void 0 ? void 0 : _b.productId
        });
        if (error.message === 'Produto não encontrado') {
            throw new Error('not-found');
        }
        throw new Error('internal');
    }
});
/**
 * Update product
 */
exports.updateProduct = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        const authRequest = (0, auth_1.authorize)(['admin', 'manager'])(request);
        // Rate limiting
        (0, auth_1.rateLimit)({ maxRequests: 10, windowMs: 60000 })(authRequest);
        const _c = request.data, { productId } = _c, updateData = __rest(_c, ["productId"]);
        (0, auth_1.validateInput)(request.data, ['productId']);
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        const productRef = db.collection(`clinics/${clinicId}/products`).doc(productId);
        const productDoc = await productRef.get();
        if (!productDoc.exists) {
            throw new Error('Produto não encontrado');
        }
        // Prepare update data
        const updates = Object.assign(Object.assign({}, updateData), { updatedAt: admin.firestore.Timestamp.now(), updatedBy: authRequest.auth.uid });
        // Handle expiration date conversion if provided
        if (updateData.expirationDate) {
            updates.expirationDate = admin.firestore.Timestamp.fromDate(new Date(updateData.expirationDate));
            updates.isExpired = updates.expirationDate.toDate() < new Date();
        }
        await productRef.update(updates);
        logger.info('Product updated', {
            productId,
            clinicId,
            updatedBy: authRequest.auth.uid,
            updatedFields: Object.keys(updateData)
        });
        return {
            success: true,
            message: 'Produto atualizado com sucesso',
            productId
        };
    }
    catch (error) {
        (0, auth_1.logError)('updateProduct', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            productId: (_b = request.data) === null || _b === void 0 ? void 0 : _b.productId
        });
        if (error.message === 'Produto não encontrado') {
            throw new Error('not-found');
        }
        throw new Error('internal');
    }
});
/**
 * Adjust product stock
 */
exports.adjustStock = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        const authRequest = (0, auth_1.authorize)(['admin', 'manager', 'doctor'])(request);
        // Rate limiting
        (0, auth_1.rateLimit)({ maxRequests: 20, windowMs: 60000 })(authRequest);
        const { productId, quantity, reason, type } = request.data;
        (0, auth_1.validateInput)(request.data, ['productId', 'quantity', 'reason', 'type']);
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        const productRef = db.collection(`clinics/${clinicId}/products`).doc(productId);
        // Use transaction for stock adjustment
        const result = await db.runTransaction(async (transaction) => {
            const productDoc = await transaction.get(productRef);
            if (!productDoc.exists) {
                throw new Error('Produto não encontrado');
            }
            const productData = productDoc.data();
            const previousStock = productData.currentStock;
            let newStock;
            // Calculate new stock based on movement type
            switch (type) {
                case 'ENTRY':
                    newStock = previousStock + Number(quantity);
                    break;
                case 'EXIT':
                    newStock = previousStock - Number(quantity);
                    if (newStock < 0) {
                        throw new Error('Estoque insuficiente');
                    }
                    break;
                case 'ADJUSTMENT':
                    newStock = Number(quantity);
                    break;
                default:
                    throw new Error('Tipo de movimento inválido');
            }
            // Update product stock
            transaction.update(productRef, {
                currentStock: newStock,
                updatedAt: admin.firestore.Timestamp.now(),
                updatedBy: authRequest.auth.uid
            });
            // Create stock movement record
            const movementRef = db.collection(`clinics/${clinicId}/products/${productId}/movements`).doc();
            transaction.set(movementRef, {
                type,
                quantity: Number(quantity),
                reason,
                performedBy: authRequest.auth.uid,
                performedAt: admin.firestore.Timestamp.now(),
                previousStock,
                newStock
            });
            return { previousStock, newStock, movementId: movementRef.id };
        });
        logger.info('Stock adjusted', {
            productId,
            type,
            quantity,
            previousStock: result.previousStock,
            newStock: result.newStock,
            clinicId,
            performedBy: authRequest.auth.uid
        });
        return {
            success: true,
            message: 'Estoque ajustado com sucesso',
            previousStock: result.previousStock,
            newStock: result.newStock,
            movementId: result.movementId
        };
    }
    catch (error) {
        (0, auth_1.logError)('adjustStock', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            productId: (_b = request.data) === null || _b === void 0 ? void 0 : _b.productId
        });
        if (error.message === 'Produto não encontrado') {
            throw new Error('not-found');
        }
        if (error.message === 'Estoque insuficiente') {
            throw new Error('failed-precondition');
        }
        throw new Error('internal');
    }
});
/**
 * Delete product
 */
exports.deleteProduct = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        const authRequest = (0, auth_1.authorize)(['admin'])(request);
        const { productId } = request.data;
        (0, auth_1.validateInput)(request.data, ['productId']);
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        const productRef = db.collection(`clinics/${clinicId}/products`).doc(productId);
        const productDoc = await productRef.get();
        if (!productDoc.exists) {
            throw new Error('Produto não encontrado');
        }
        // Check if product has movements (soft delete if it does)
        const movementsSnapshot = await db
            .collection(`clinics/${clinicId}/products/${productId}/movements`)
            .limit(1)
            .get();
        if (!movementsSnapshot.empty) {
            // Soft delete - mark as inactive
            await productRef.update({
                isActive: false,
                deletedAt: admin.firestore.Timestamp.now(),
                deletedBy: authRequest.auth.uid
            });
        }
        else {
            // Hard delete if no movements
            await productRef.delete();
        }
        logger.info('Product deleted', {
            productId,
            clinicId,
            deletedBy: authRequest.auth.uid,
            softDelete: !movementsSnapshot.empty
        });
        return {
            success: true,
            message: 'Produto removido com sucesso',
            productId
        };
    }
    catch (error) {
        (0, auth_1.logError)('deleteProduct', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            productId: (_b = request.data) === null || _b === void 0 ? void 0 : _b.productId
        });
        if (error.message === 'Produto não encontrado') {
            throw new Error('not-found');
        }
        throw new Error('internal');
    }
});
/**
 * Get products with low stock
 */
exports.getLowStockProducts = (0, https_1.onCall)(async (request) => {
    var _a;
    try {
        const authRequest = (0, auth_1.verifyAuth)(request);
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        // Get all products and filter client-side (Firestore limitation)
        const snapshot = await db
            .collection(`clinics/${clinicId}/products`)
            .where('isActive', '!=', false)
            .get();
        const lowStockProducts = snapshot.docs
            .map(doc => (Object.assign({ id: doc.id }, doc.data())))
            .filter((product) => product.currentStock <= product.minimumStock);
        return {
            success: true,
            products: lowStockProducts,
            count: lowStockProducts.length
        };
    }
    catch (error) {
        (0, auth_1.logError)('getLowStockProducts', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid
        });
        throw new Error('internal');
    }
});
/**
 * Get expiring products
 */
exports.getExpiringProducts = (0, https_1.onCall)(async (request) => {
    var _a;
    try {
        const authRequest = (0, auth_1.verifyAuth)(request);
        const { days = 30 } = request.data || {};
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        const expirationDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
        const snapshot = await db
            .collection(`clinics/${clinicId}/products`)
            .where('expirationDate', '<=', expirationDate)
            .where('isExpired', '==', false)
            .orderBy('expirationDate', 'asc')
            .get();
        const expiringProducts = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        return {
            success: true,
            products: expiringProducts,
            count: expiringProducts.length
        };
    }
    catch (error) {
        (0, auth_1.logError)('getExpiringProducts', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid
        });
        throw new Error('internal');
    }
});
//# sourceMappingURL=products.js.map