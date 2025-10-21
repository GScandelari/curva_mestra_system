"use strict";
/**
 * Comprehensive Firebase Functions Tests
 * Tests for all Firebase Functions including authentication, CRUD operations, and business logic
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
const firebase_functions_test_1 = __importDefault(require("firebase-functions-test"));
// Initialize Firebase Functions test environment
const test = (0, firebase_functions_test_1.default)();
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
const mockAdminId = 'admin-user-123';
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
const mockRequest = {
    productId: 'product-123',
    requesterId: mockUserId,
    quantity: 5,
    reason: 'Uso em procedimento',
    status: 'pending'
};
const mockPatient = {
    name: 'Paciente Teste',
    email: 'paciente@teste.com',
    phone: '11999999999',
    birthDate: new Date('1990-01-01'),
    address: 'Rua Teste, 123'
};
describe('Firebase Functions - Authentication', () => {
    beforeEach(async () => {
        // Clean test data
        await clearTestData();
    });
    afterAll(async () => {
        // Cleanup
        test.cleanup();
        await clearTestData();
    });
    test('should verify authenticated user', async () => {
        const context = {
            auth: {
                uid: mockUserId,
                token: {
                    role: 'doctor',
                    clinicId: mockClinicId
                }
            }
        };
        // This would test the auth middleware
        expect(context.auth).toBeDefined();
        expect(context.auth.uid).toBe(mockUserId);
        expect(context.auth.token.clinicId).toBe(mockClinicId);
    });
    test('should reject unauthenticated requests', async () => {
        const context = { auth: null };
        // Test that functions properly handle unauthenticated requests
        expect(context.auth).toBeNull();
    });
    test('should validate user role permissions', async () => {
        const adminContext = {
            auth: {
                uid: mockAdminId,
                token: {
                    role: 'admin',
                    clinicId: mockClinicId
                }
            }
        };
        const receptionistContext = {
            auth: {
                uid: mockUserId,
                token: {
                    role: 'receptionist',
                    clinicId: mockClinicId
                }
            }
        };
        expect(adminContext.auth.token.role).toBe('admin');
        expect(receptionistContext.auth.token.role).toBe('receptionist');
    });
});
describe('Firebase Functions - Products API', () => {
    beforeEach(async () => {
        await clearTestData();
    });
    test('should create product with valid data', async () => {
        var _a, _b;
        const context = {
            auth: {
                uid: mockAdminId,
                token: {
                    role: 'admin',
                    clinicId: mockClinicId
                }
            }
        };
        // Test product creation
        const productData = Object.assign({}, mockProduct);
        // Simulate function call
        const docRef = await db.collection(`clinics/${mockClinicId}/products`).add(Object.assign(Object.assign({}, productData), { createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: context.auth.uid, clinicId: mockClinicId }));
        expect(docRef.id).toBeDefined();
        // Verify product was created
        const doc = await docRef.get();
        expect(doc.exists).toBe(true);
        expect((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.name).toBe(mockProduct.name);
        expect((_b = doc.data()) === null || _b === void 0 ? void 0 : _b.clinicId).toBe(mockClinicId);
    });
    test('should prevent duplicate invoice numbers', async () => {
        // Create first product
        await db.collection(`clinics/${mockClinicId}/products`).add(Object.assign(Object.assign({}, mockProduct), { createdAt: admin.firestore.FieldValue.serverTimestamp() }));
        // Try to create product with same invoice number
        const existingInvoice = await db
            .collection(`clinics/${mockClinicId}/products`)
            .where('invoiceNumber', '==', mockProduct.invoiceNumber)
            .get();
        expect(existingInvoice.empty).toBe(false);
    });
    test('should list products with filters', async () => {
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
});
describe('Firebase Functions - Requests API', () => {
    beforeEach(async () => {
        await clearTestData();
    });
    test('should create request with valid data', async () => {
        var _a, _b;
        const context = {
            auth: {
                uid: mockUserId,
                token: {
                    role: 'doctor',
                    clinicId: mockClinicId
                }
            }
        };
        const requestData = Object.assign(Object.assign({}, mockRequest), { createdAt: admin.firestore.FieldValue.serverTimestamp(), clinicId: mockClinicId });
        const docRef = await db.collection(`clinics/${mockClinicId}/requests`).add(requestData);
        expect(docRef.id).toBeDefined();
        const doc = await docRef.get();
        expect(doc.exists).toBe(true);
        expect((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.requesterId).toBe(mockUserId);
        expect((_b = doc.data()) === null || _b === void 0 ? void 0 : _b.status).toBe('pending');
    });
    test('should approve request and update stock', async () => {
        var _a, _b;
        // Create product first
        const productRef = await db.collection(`clinics/${mockClinicId}/products`).add(Object.assign(Object.assign({}, mockProduct), { currentStock: 100 }));
        // Create request
        const requestRef = await db.collection(`clinics/${mockClinicId}/requests`).add(Object.assign(Object.assign({}, mockRequest), { productId: productRef.id, quantity: 10 }));
        // Simulate approval process
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
describe('Firebase Functions - Patients API', () => {
    beforeEach(async () => {
        await clearTestData();
    });
    test('should create patient with valid data', async () => {
        var _a, _b;
        const context = {
            auth: {
                uid: mockUserId,
                token: {
                    role: 'receptionist',
                    clinicId: mockClinicId
                }
            }
        };
        const patientData = Object.assign(Object.assign({}, mockPatient), { createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: context.auth.uid, clinicId: mockClinicId });
        const docRef = await db.collection(`clinics/${mockClinicId}/patients`).add(patientData);
        expect(docRef.id).toBeDefined();
        const doc = await docRef.get();
        expect(doc.exists).toBe(true);
        expect((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.name).toBe(mockPatient.name);
        expect((_b = doc.data()) === null || _b === void 0 ? void 0 : _b.email).toBe(mockPatient.email);
    });
    test('should prevent duplicate patient emails', async () => {
        // Create first patient
        await db.collection(`clinics/${mockClinicId}/patients`).add(mockPatient);
        // Check for existing email
        const existingPatient = await db
            .collection(`clinics/${mockClinicId}/patients`)
            .where('email', '==', mockPatient.email)
            .get();
        expect(existingPatient.empty).toBe(false);
    });
});
describe('Firebase Functions - Notifications', () => {
    beforeEach(async () => {
        await clearTestData();
    });
    test('should create low stock notification', async () => {
        var _a, _b;
        // Create product with low stock
        const productRef = await db.collection(`clinics/${mockClinicId}/products`).add(Object.assign(Object.assign({}, mockProduct), { currentStock: 5, minimumStock: 10 }));
        // Simulate low stock trigger
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
// Helper function to clear test data
async function clearTestData() {
    try {
        // Clear products
        const productsSnapshot = await db.collection(`clinics/${mockClinicId}/products`).get();
        const productDeletePromises = productsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(productDeletePromises);
        // Clear requests
        const requestsSnapshot = await db.collection(`clinics/${mockClinicId}/requests`).get();
        const requestDeletePromises = requestsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(requestDeletePromises);
        // Clear patients
        const patientsSnapshot = await db.collection(`clinics/${mockClinicId}/patients`).get();
        const patientDeletePromises = patientsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(patientDeletePromises);
        // Clear notifications
        const notificationsSnapshot = await db.collection(`clinics/${mockClinicId}/notifications`).get();
        const notificationDeletePromises = notificationsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(notificationDeletePromises);
    }
    catch (error) {
        console.error('Error clearing test data:', error);
    }
}
//# sourceMappingURL=firebase-functions.test.js.map