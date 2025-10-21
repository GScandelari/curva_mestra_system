"use strict";
/**
 * Firebase Functions for Invoice Management
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
exports.getPurchaseReport = exports.deleteInvoice = exports.updateInvoice = exports.createInvoice = exports.getInvoiceProducts = exports.getInvoiceById = exports.getInvoices = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const auth_1 = require("../middleware/auth");
const db = admin.firestore();
/**
 * Get all invoices with filtering and pagination
 */
exports.getInvoices = (0, https_1.onCall)(async (request) => {
    var _a;
    try {
        const authRequest = (0, auth_1.verifyAuth)(request);
        // Rate limiting
        (0, auth_1.rateLimit)({ maxRequests: 30, windowMs: 60000 })(authRequest);
        const { page = 1, limit = 10, supplier, startDate, endDate, search } = request.data || {};
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        let query = db.collection(`clinics/${clinicId}/invoices`);
        // Apply date filters
        if (startDate) {
            const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(startDate));
            query = query.where('receiptDate', '>=', startTimestamp);
        }
        if (endDate) {
            const endTimestamp = admin.firestore.Timestamp.fromDate(new Date(endDate));
            query = query.where('receiptDate', '<=', endTimestamp);
        }
        // Apply ordering and pagination
        query = query.orderBy('receiptDate', 'desc').limit(limit);
        const snapshot = await query.get();
        let invoices = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        // Apply client-side filters (Firestore limitations)
        if (supplier) {
            const supplierLower = supplier.toLowerCase();
            invoices = invoices.filter((invoice) => { var _a; return (_a = invoice.supplier) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(supplierLower); });
        }
        if (search) {
            const searchLower = search.toLowerCase();
            invoices = invoices.filter((invoice) => {
                var _a, _b;
                return ((_a = invoice.number) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchLower)) ||
                    ((_b = invoice.supplier) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(searchLower));
            });
        }
        return {
            success: true,
            invoices,
            pagination: {
                currentPage: page,
                totalItems: invoices.length,
                itemsPerPage: limit,
                hasMore: snapshot.docs.length === limit
            }
        };
    }
    catch (error) {
        (0, auth_1.logError)('getInvoices', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            data: request.data
        });
        throw new Error('internal');
    }
});
/**
 * Get invoice by ID
 */
exports.getInvoiceById = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        const authRequest = (0, auth_1.verifyAuth)(request);
        const { invoiceId } = request.data;
        (0, auth_1.validateInput)(request.data, ['invoiceId']);
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        const invoiceDoc = await db
            .collection(`clinics/${clinicId}/invoices`)
            .doc(invoiceId)
            .get();
        if (!invoiceDoc.exists) {
            throw new Error('Nota fiscal não encontrada');
        }
        return {
            success: true,
            invoice: Object.assign({ id: invoiceDoc.id }, invoiceDoc.data())
        };
    }
    catch (error) {
        (0, auth_1.logError)('getInvoiceById', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            invoiceId: (_b = request.data) === null || _b === void 0 ? void 0 : _b.invoiceId
        });
        if (error.message === 'Nota fiscal não encontrada') {
            throw new Error('not-found');
        }
        throw new Error('internal');
    }
});
/**
 * Get products associated with invoice
 */
exports.getInvoiceProducts = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        const authRequest = (0, auth_1.verifyAuth)(request);
        const { invoiceId } = request.data;
        (0, auth_1.validateInput)(request.data, ['invoiceId']);
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        // First verify invoice exists
        const invoiceDoc = await db
            .collection(`clinics/${clinicId}/invoices`)
            .doc(invoiceId)
            .get();
        if (!invoiceDoc.exists) {
            throw new Error('Nota fiscal não encontrada');
        }
        const invoiceData = invoiceDoc.data();
        // Get products associated with this invoice number
        const productsSnapshot = await db
            .collection(`clinics/${clinicId}/products`)
            .where('invoiceNumber', '==', invoiceData.number)
            .orderBy('createdAt', 'desc')
            .get();
        const products = productsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        // Calculate summary
        const totalProducts = products.length;
        const totalValue = products.reduce((sum, product) => sum + (product.unitPrice * product.currentStock), 0);
        return {
            success: true,
            invoice: Object.assign({ id: invoiceDoc.id }, invoiceData),
            products,
            summary: {
                totalProducts,
                totalValue
            }
        };
    }
    catch (error) {
        (0, auth_1.logError)('getInvoiceProducts', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            invoiceId: (_b = request.data) === null || _b === void 0 ? void 0 : _b.invoiceId
        });
        if (error.message === 'Nota fiscal não encontrada') {
            throw new Error('not-found');
        }
        throw new Error('internal');
    }
});
/**
 * Create new invoice
 */
exports.createInvoice = (0, https_1.onCall)(async (request) => {
    var _a;
    try {
        const authRequest = (0, auth_1.authorize)(['admin', 'manager'])(request);
        // Rate limiting
        (0, auth_1.rateLimit)({ maxRequests: 10, windowMs: 60000 })(authRequest);
        const { number, supplier, receiptDate, totalValue, notes } = request.data;
        // Validate required fields
        (0, auth_1.validateInput)(request.data, ['number', 'supplier', 'receiptDate', 'totalValue']);
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        // Check if invoice number already exists
        const existingInvoice = await db
            .collection(`clinics/${clinicId}/invoices`)
            .where('number', '==', number)
            .limit(1)
            .get();
        if (!existingInvoice.empty) {
            throw new Error('Número da nota fiscal já existe');
        }
        const invoiceData = {
            number,
            supplier,
            receiptDate: admin.firestore.Timestamp.fromDate(new Date(receiptDate)),
            totalValue: Number(totalValue),
            notes: notes || '',
            isActive: true,
            createdAt: admin.firestore.Timestamp.now(),
            createdBy: authRequest.auth.uid,
            clinicId
        };
        const docRef = await db.collection(`clinics/${clinicId}/invoices`).add(invoiceData);
        logger.info('Invoice created', {
            invoiceId: docRef.id,
            number,
            supplier,
            clinicId,
            createdBy: authRequest.auth.uid
        });
        return {
            success: true,
            message: 'Nota fiscal criada com sucesso',
            invoiceId: docRef.id,
            invoice: Object.assign({ id: docRef.id }, invoiceData)
        };
    }
    catch (error) {
        (0, auth_1.logError)('createInvoice', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            data: request.data
        });
        if (error.message === 'Número da nota fiscal já existe') {
            throw new Error('already-exists');
        }
        throw new Error('internal');
    }
});
/**
 * Update invoice
 */
exports.updateInvoice = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        const authRequest = (0, auth_1.authorize)(['admin', 'manager'])(request);
        // Rate limiting
        (0, auth_1.rateLimit)({ maxRequests: 10, windowMs: 60000 })(authRequest);
        const _c = request.data, { invoiceId } = _c, updateData = __rest(_c, ["invoiceId"]);
        (0, auth_1.validateInput)(request.data, ['invoiceId']);
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        const invoiceRef = db.collection(`clinics/${clinicId}/invoices`).doc(invoiceId);
        const invoiceDoc = await invoiceRef.get();
        if (!invoiceDoc.exists) {
            throw new Error('Nota fiscal não encontrada');
        }
        // Check number uniqueness if number is being updated
        if (updateData.number) {
            const existingInvoice = await db
                .collection(`clinics/${clinicId}/invoices`)
                .where('number', '==', updateData.number)
                .limit(1)
                .get();
            if (!existingInvoice.empty && existingInvoice.docs[0].id !== invoiceId) {
                throw new Error('Número da nota fiscal já existe');
            }
        }
        // Prepare update data
        const updates = Object.assign(Object.assign({}, updateData), { updatedAt: admin.firestore.Timestamp.now(), updatedBy: authRequest.auth.uid });
        // Handle receipt date conversion if provided
        if (updateData.receiptDate) {
            updates.receiptDate = admin.firestore.Timestamp.fromDate(new Date(updateData.receiptDate));
        }
        // Handle total value conversion if provided
        if (updateData.totalValue) {
            updates.totalValue = Number(updateData.totalValue);
        }
        await invoiceRef.update(updates);
        logger.info('Invoice updated', {
            invoiceId,
            clinicId,
            updatedBy: authRequest.auth.uid,
            updatedFields: Object.keys(updateData)
        });
        return {
            success: true,
            message: 'Nota fiscal atualizada com sucesso',
            invoiceId
        };
    }
    catch (error) {
        (0, auth_1.logError)('updateInvoice', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            invoiceId: (_b = request.data) === null || _b === void 0 ? void 0 : _b.invoiceId
        });
        if (error.message === 'Nota fiscal não encontrada') {
            throw new Error('not-found');
        }
        if (error.message === 'Número da nota fiscal já existe') {
            throw new Error('already-exists');
        }
        throw new Error('internal');
    }
});
/**
 * Delete invoice
 */
exports.deleteInvoice = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    try {
        const authRequest = (0, auth_1.authorize)(['admin'])(request);
        const { invoiceId } = request.data;
        (0, auth_1.validateInput)(request.data, ['invoiceId']);
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        const invoiceRef = db.collection(`clinics/${clinicId}/invoices`).doc(invoiceId);
        const invoiceDoc = await invoiceRef.get();
        if (!invoiceDoc.exists) {
            throw new Error('Nota fiscal não encontrada');
        }
        const invoiceData = invoiceDoc.data();
        // Check if invoice has associated products
        const productsSnapshot = await db
            .collection(`clinics/${clinicId}/products`)
            .where('invoiceNumber', '==', invoiceData.number)
            .limit(1)
            .get();
        if (!productsSnapshot.empty) {
            // Soft delete - mark as inactive
            await invoiceRef.update({
                isActive: false,
                deletedAt: admin.firestore.Timestamp.now(),
                deletedBy: authRequest.auth.uid
            });
        }
        else {
            // Hard delete if no associated products
            await invoiceRef.delete();
        }
        logger.info('Invoice deleted', {
            invoiceId,
            clinicId,
            deletedBy: authRequest.auth.uid,
            softDelete: !productsSnapshot.empty
        });
        return {
            success: true,
            message: 'Nota fiscal removida com sucesso',
            invoiceId
        };
    }
    catch (error) {
        (0, auth_1.logError)('deleteInvoice', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            invoiceId: (_b = request.data) === null || _b === void 0 ? void 0 : _b.invoiceId
        });
        if (error.message === 'Nota fiscal não encontrada') {
            throw new Error('not-found');
        }
        throw new Error('internal');
    }
});
/**
 * Generate purchase report by period
 */
exports.getPurchaseReport = (0, https_1.onCall)(async (request) => {
    var _a;
    try {
        const authRequest = (0, auth_1.verifyAuth)(request);
        const { startDate, endDate, supplier } = request.data || {};
        const clinicId = authRequest.auth.token.clinicId;
        (0, auth_1.validateClinic)(authRequest);
        let query = db.collection(`clinics/${clinicId}/invoices`);
        // Apply date filters
        if (startDate) {
            const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(startDate));
            query = query.where('receiptDate', '>=', startTimestamp);
        }
        if (endDate) {
            const endTimestamp = admin.firestore.Timestamp.fromDate(new Date(endDate));
            query = query.where('receiptDate', '<=', endTimestamp);
        }
        query = query.orderBy('receiptDate', 'desc');
        const snapshot = await query.get();
        let invoices = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        // Apply supplier filter client-side if provided
        if (supplier) {
            const supplierLower = supplier.toLowerCase();
            invoices = invoices.filter((invoice) => { var _a; return (_a = invoice.supplier) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(supplierLower); });
        }
        // Calculate summary statistics
        const totalInvoices = invoices.length;
        const totalValue = invoices.reduce((sum, invoice) => sum + invoice.totalValue, 0);
        // Group by supplier
        const supplierSummary = invoices.reduce((acc, invoice) => {
            const supplier = invoice.supplier;
            if (!acc[supplier]) {
                acc[supplier] = {
                    supplier,
                    invoiceCount: 0,
                    totalValue: 0
                };
            }
            acc[supplier].invoiceCount++;
            acc[supplier].totalValue += invoice.totalValue;
            return acc;
        }, {});
        // Group by month
        const monthlySummary = invoices.reduce((acc, invoice) => {
            const date = invoice.receiptDate.toDate();
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!acc[monthKey]) {
                acc[monthKey] = {
                    month: monthKey,
                    invoiceCount: 0,
                    totalValue: 0
                };
            }
            acc[monthKey].invoiceCount++;
            acc[monthKey].totalValue += invoice.totalValue;
            return acc;
        }, {});
        return {
            success: true,
            report: {
                period: {
                    startDate,
                    endDate
                },
                summary: {
                    totalInvoices,
                    totalValue,
                    averageInvoiceValue: totalInvoices > 0 ? totalValue / totalInvoices : 0
                },
                invoices,
                supplierSummary: Object.values(supplierSummary),
                monthlySummary: Object.values(monthlySummary).sort((a, b) => a.month.localeCompare(b.month))
            }
        };
    }
    catch (error) {
        (0, auth_1.logError)('getPurchaseReport', error, {
            userId: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            data: request.data
        });
        throw new Error('internal');
    }
});
//# sourceMappingURL=invoices.js.map