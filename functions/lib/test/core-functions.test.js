"use strict";
/**
 * Core Firebase Functions Tests
 * Tests for essential Firebase Functions without complex dependencies
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
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin for testing
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'curva-mestra-test'
    });
}
const db = admin.firestore();
// Mock data for testing
const mockClinicId = 'test-clinic-123';
const mockUserId = 'test-user-123';
const mockProduct = {
    name: 'Produto Teste',
    category: 'medicamento',
    invoiceNumber: 'NF-12345',
    currentStock: 100,
    minimumStock: 10,
    unitPrice: 25.50,
    expirationDate: new Date('2025-12-31'),
    entryDate: new Date(),
    supplier: 'Fornecedor Teste'
};
describe('Core Firebase Functions', () => {
    beforeEach(async () => {
        // Clean test data
        await clearTestData();
    });
    afterAll(async () => {
        // Cleanup
        await clearTestData();
    });
    describe('Firestore Operations', () => {
        test('should create and read product document', async () => {
            var _a, _b;
            const productData = Object.assign(Object.assign({}, mockProduct), { createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: mockUserId, clinicId: mockClinicId });
            const docRef = await db.collection(`clinics/${mockClinicId}/products`).add(productData);
            expect(docRef.id).toBeDefined();
            // Verify product was created
            const doc = await docRef.get();
            expect(doc.exists).toBe(true);
            expect((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.name).toBe(mockProduct.name);
            expect((_b = doc.data()) === null || _b === void 0 ? void 0 : _b.clinicId).toBe(mockClinicId);
        });
        test('should update product stock', async () => {
            var _a;
            // Create product
            const docRef = await db.collection(`clinics/${mockClinicId}/products`).add(mockProduct);
            // Update stock
            const newStock = 75;
            await docRef.update({
                currentStock: newStock,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
            // Verify update
            const updatedDoc = await docRef.get();
            expect((_a = updatedDoc.data()) === null || _a === void 0 ? void 0 : _a.currentStock).toBe(newStock);
        });
        test('should handle batch operations', async () => {
            const batch = db.batch();
            // Create multiple products in batch
            for (let i = 0; i < 5; i++) {
                const productRef = db.doc(`clinics/${mockClinicId}/products/product-${i}`);
                batch.set(productRef, Object.assign(Object.assign({}, mockProduct), { name: `Product ${i}`, invoiceNumber: `NF-${i}`, createdAt: admin.firestore.FieldValue.serverTimestamp() }));
            }
            await batch.commit();
            // Verify products were created
            const productsSnapshot = await db.collection(`clinics/${mockClinicId}/products`).get();
            expect(productsSnapshot.size).toBe(5);
        });
        test('should handle transactions', async () => {
            var _a, _b;
            // Create product with initial stock
            const productRef = await db.collection(`clinics/${mockClinicId}/products`).add(Object.assign(Object.assign({}, mockProduct), { currentStock: 100 }));
            // Create request
            const requestRef = await db.collection(`clinics/${mockClinicId}/requests`).add({
                productId: productRef.id,
                requesterId: mockUserId,
                quantity: 10,
                status: 'pending'
            });
            // Simulate approval transaction
            await db.runTransaction(async (transaction) => {
                var _a, _b;
                const productDoc = await transaction.get(productRef);
                const requestDoc = await transaction.get(requestRef);
                if (productDoc.exists && requestDoc.exists) {
                    const currentStock = ((_a = productDoc.data()) === null || _a === void 0 ? void 0 : _a.currentStock) || 0;
                    const requestedQuantity = ((_b = requestDoc.data()) === null || _b === void 0 ? void 0 : _b.quantity) || 0;
                    // Update product stock
                    transaction.update(productRef, {
                        currentStock: currentStock - requestedQuantity
                    });
                    // Update request status
                    transaction.update(requestRef, {
                        status: 'approved',
                        approvedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            });
            // Verify changes
            const updatedProduct = await productRef.get();
            const updatedRequest = await requestRef.get();
            expect((_a = updatedProduct.data()) === null || _a === void 0 ? void 0 : _a.currentStock).toBe(90);
            expect((_b = updatedRequest.data()) === null || _b === void 0 ? void 0 : _b.status).toBe('approved');
        });
    });
    describe('Data Validation', () => {
        test('should validate required fields', async () => {
            const invalidProduct = {
                category: 'medicamento'
                // Missing required fields like name, currentStock, etc.
            };
            // This test simulates validation that would happen in actual functions
            const isValid = validateProduct(invalidProduct);
            expect(isValid).toBe(false);
            const validProduct = {
                name: 'Valid Product',
                category: 'medicamento',
                currentStock: 100,
                minimumStock: 10,
                invoiceNumber: 'NF-VALID'
            };
            const isValidProduct = validateProduct(validProduct);
            expect(isValidProduct).toBe(true);
        });
        test('should validate data types', async () => {
            const invalidProduct = {
                name: 'Test Product',
                category: 'medicamento',
                currentStock: 'not-a-number', // Should be number
                minimumStock: 10,
                invoiceNumber: 'NF-12345'
            };
            const isValid = validateProduct(invalidProduct);
            expect(isValid).toBe(false);
        });
    });
    describe('Query Operations', () => {
        test('should filter products by category', async () => {
            // Create test products
            await db.collection(`clinics/${mockClinicId}/products`).add(Object.assign(Object.assign({}, mockProduct), { category: 'medicamento' }));
            await db.collection(`clinics/${mockClinicId}/products`).add(Object.assign(Object.assign({}, mockProduct), { name: 'Produto 2', category: 'equipamento', invoiceNumber: 'NF-67890' }));
            // Test category filter
            const medicamentos = await db
                .collection(`clinics/${mockClinicId}/products`)
                .where('category', '==', 'medicamento')
                .get();
            expect(medicamentos.size).toBe(1);
            expect(medicamentos.docs[0].data().category).toBe('medicamento');
        });
        test('should find low stock products', async () => {
            // Create products with different stock levels
            await db.collection(`clinics/${mockClinicId}/products`).add(Object.assign(Object.assign({}, mockProduct), { name: 'Low Stock Product', currentStock: 5, minimumStock: 10 }));
            await db.collection(`clinics/${mockClinicId}/products`).add(Object.assign(Object.assign({}, mockProduct), { name: 'Normal Stock Product', currentStock: 50, minimumStock: 10, invoiceNumber: 'NF-NORMAL' }));
            // Find low stock products
            const lowStockProducts = await db
                .collection(`clinics/${mockClinicId}/products`)
                .where('currentStock', '<=', 10)
                .get();
            expect(lowStockProducts.size).toBe(1);
            expect(lowStockProducts.docs[0].data().name).toBe('Low Stock Product');
        });
    });
    describe('Notification System', () => {
        test('should create low stock notification', async () => {
            var _a, _b;
            const productRef = await db.collection(`clinics/${mockClinicId}/products`).add(Object.assign(Object.assign({}, mockProduct), { currentStock: 5, minimumStock: 10 }));
            // Simulate low stock notification creation
            const notificationData = {
                type: 'low_stock',
                productId: productRef.id,
                productName: mockProduct.name,
                currentStock: 5,
                minimumStock: 10,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
                clinicId: mockClinicId
            };
            const notificationRef = await db
                .collection(`clinics/${mockClinicId}/notifications`)
                .add(notificationData);
            expect(notificationRef.id).toBeDefined();
            const doc = await notificationRef.get();
            expect(doc.exists).toBe(true);
            expect((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.type).toBe('low_stock');
            expect((_b = doc.data()) === null || _b === void 0 ? void 0 : _b.currentStock).toBe(5);
        });
        test('should create expiring products notification', async () => {
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
            // Create product expiring soon
            await db.collection(`clinics/${mockClinicId}/products`).add(Object.assign(Object.assign({}, mockProduct), { expirationDate: thirtyDaysFromNow, isExpired: false }));
            // Simulate expiring products check
            const expiringProducts = await db
                .collection(`clinics/${mockClinicId}/products`)
                .where('expirationDate', '<=', thirtyDaysFromNow)
                .where('isExpired', '==', false)
                .get();
            expect(expiringProducts.size).toBeGreaterThan(0);
            // Create notification
            if (!expiringProducts.empty) {
                const notificationRef = await db
                    .collection(`clinics/${mockClinicId}/notifications`)
                    .add({
                    type: 'expiring_products',
                    count: expiringProducts.size,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false,
                    clinicId: mockClinicId
                });
                expect(notificationRef.id).toBeDefined();
            }
        });
    });
});
// Helper function to validate product data
function validateProduct(product) {
    const requiredFields = ['name', 'category', 'currentStock', 'minimumStock', 'invoiceNumber'];
    // Check required fields
    for (const field of requiredFields) {
        if (!product[field]) {
            return false;
        }
    }
    // Check data types
    if (typeof product.currentStock !== 'number' || typeof product.minimumStock !== 'number') {
        return false;
    }
    return true;
}
// Helper function to clear test data
async function clearTestData() {
    try {
        const collections = ['products', 'requests', 'patients', 'notifications'];
        for (const collectionName of collections) {
            const snapshot = await db.collection(`clinics/${mockClinicId}/${collectionName}`).get();
            const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);
        }
    }
    catch (error) {
        console.error('Error clearing test data:', error);
    }
}
//# sourceMappingURL=core-functions.test.js.map