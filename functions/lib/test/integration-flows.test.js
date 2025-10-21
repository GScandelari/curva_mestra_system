"use strict";
/**
 * Integration Tests for Critical User Flows
 * Tests end-to-end workflows that span multiple Firebase services
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
const auth = admin.auth();
// Test data
const testClinicId = 'integration-test-clinic';
const testUsers = {
    admin: {
        uid: 'admin-integration-test',
        email: 'admin@integration-test.com',
        role: 'admin'
    },
    doctor: {
        uid: 'doctor-integration-test',
        email: 'doctor@integration-test.com',
        role: 'doctor'
    },
    receptionist: {
        uid: 'receptionist-integration-test',
        email: 'receptionist@integration-test.com',
        role: 'receptionist'
    }
};
describe('Integration Tests - Critical User Flows', () => {
    beforeAll(async () => {
        // Setup test users
        for (const [role, userData] of Object.entries(testUsers)) {
            try {
                await auth.createUser({
                    uid: userData.uid,
                    email: userData.email,
                    displayName: `Test ${role}`,
                    disabled: false
                });
                await auth.setCustomUserClaims(userData.uid, {
                    role: userData.role,
                    clinicId: testClinicId
                });
            }
            catch (error) {
                // User might already exist, update claims
                await auth.setCustomUserClaims(userData.uid, {
                    role: userData.role,
                    clinicId: testClinicId
                });
            }
        }
    });
    afterAll(async () => {
        // Cleanup
        test.cleanup();
        await clearAllTestData();
        // Delete test users
        for (const userData of Object.values(testUsers)) {
            try {
                await auth.deleteUser(userData.uid);
            }
            catch (error) {
                // User might not exist
            }
        }
    });
    beforeEach(async () => {
        await clearAllTestData();
    });
    describe('Complete Product Management Flow', () => {
        test('should handle complete product lifecycle', async () => {
            var _a, _b, _c, _d, _e;
            // Step 1: Admin creates a product
            const productData = {
                name: 'Ácido Hialurônico 2ml',
                category: 'medicamento',
                invoiceNumber: 'NF-2024-001',
                currentStock: 50,
                minimumStock: 10,
                unitPrice: 150.00,
                supplier: 'Fornecedor Teste',
                expirationDate: new Date('2025-12-31'),
                entryDate: new Date(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: testUsers.admin.uid,
                clinicId: testClinicId
            };
            const productRef = await db.collection(`clinics/${testClinicId}/products`).add(productData);
            expect(productRef.id).toBeDefined();
            // Verify product was created
            const createdProduct = await productRef.get();
            expect(createdProduct.exists).toBe(true);
            expect((_a = createdProduct.data()) === null || _a === void 0 ? void 0 : _a.name).toBe(productData.name);
            // Step 2: Doctor creates a request for the product
            const requestData = {
                productId: productRef.id,
                productName: productData.name,
                requesterId: testUsers.doctor.uid,
                requesterName: 'Test Doctor',
                quantity: 5,
                reason: 'Procedimento de harmonização facial',
                status: 'pending',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                clinicId: testClinicId
            };
            const requestRef = await db.collection(`clinics/${testClinicId}/requests`).add(requestData);
            expect(requestRef.id).toBeDefined();
            // Step 3: Admin approves the request and updates stock
            await db.runTransaction(async (transaction) => {
                var _a, _b;
                const productDoc = await transaction.get(productRef);
                const requestDoc = await transaction.get(requestRef);
                if (productDoc.exists && requestDoc.exists) {
                    const currentStock = ((_a = productDoc.data()) === null || _a === void 0 ? void 0 : _a.currentStock) || 0;
                    const requestedQuantity = ((_b = requestDoc.data()) === null || _b === void 0 ? void 0 : _b.quantity) || 0;
                    // Check if there's enough stock
                    if (currentStock >= requestedQuantity) {
                        // Update product stock
                        transaction.update(productRef, {
                            currentStock: currentStock - requestedQuantity,
                            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                        });
                        // Update request status
                        transaction.update(requestRef, {
                            status: 'approved',
                            approvedAt: admin.firestore.FieldValue.serverTimestamp(),
                            approvedBy: testUsers.admin.uid
                        });
                        // Create stock movement record
                        const movementRef = db.collection(`clinics/${testClinicId}/products/${productRef.id}/movements`).doc();
                        transaction.set(movementRef, {
                            type: 'outbound',
                            quantity: requestedQuantity,
                            reason: 'Approved request',
                            requestId: requestRef.id,
                            performedBy: testUsers.admin.uid,
                            timestamp: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
            });
            // Verify the transaction results
            const updatedProduct = await productRef.get();
            const updatedRequest = await requestRef.get();
            expect((_b = updatedProduct.data()) === null || _b === void 0 ? void 0 : _b.currentStock).toBe(45); // 50 - 5
            expect((_c = updatedRequest.data()) === null || _c === void 0 ? void 0 : _c.status).toBe('approved');
            // Step 4: Check if low stock notification should be created
            const currentStock = ((_d = updatedProduct.data()) === null || _d === void 0 ? void 0 : _d.currentStock) || 0;
            const minimumStock = ((_e = updatedProduct.data()) === null || _e === void 0 ? void 0 : _e.minimumStock) || 0;
            if (currentStock <= minimumStock) {
                const notificationRef = await db.collection(`clinics/${testClinicId}/notifications`).add({
                    type: 'low_stock',
                    productId: productRef.id,
                    productName: productData.name,
                    currentStock: currentStock,
                    minimumStock: minimumStock,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false,
                    clinicId: testClinicId
                });
                expect(notificationRef.id).toBeDefined();
            }
            // Step 5: Verify stock movement was recorded
            const movementsSnapshot = await db
                .collection(`clinics/${testClinicId}/products/${productRef.id}/movements`)
                .get();
            expect(movementsSnapshot.size).toBe(1);
            expect(movementsSnapshot.docs[0].data().type).toBe('outbound');
            expect(movementsSnapshot.docs[0].data().quantity).toBe(5);
        });
        test('should handle stock replenishment flow', async () => {
            var _a;
            // Step 1: Create product with low stock
            const productData = {
                name: 'Botox 100U',
                category: 'medicamento',
                invoiceNumber: 'NF-2024-002',
                currentStock: 2,
                minimumStock: 10,
                unitPrice: 800.00,
                supplier: 'Allergan',
                expirationDate: new Date('2025-06-30'),
                entryDate: new Date(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: testUsers.admin.uid,
                clinicId: testClinicId
            };
            const productRef = await db.collection(`clinics/${testClinicId}/products`).add(productData);
            // Step 2: System detects low stock and creates notification
            const notificationRef = await db.collection(`clinics/${testClinicId}/notifications`).add({
                type: 'low_stock',
                productId: productRef.id,
                productName: productData.name,
                currentStock: productData.currentStock,
                minimumStock: productData.minimumStock,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
                clinicId: testClinicId
            });
            // Step 3: Admin receives new stock and updates product
            const newStockQuantity = 20;
            const newInvoiceNumber = 'NF-2024-003';
            await db.runTransaction(async (transaction) => {
                var _a;
                const productDoc = await transaction.get(productRef);
                if (productDoc.exists) {
                    const currentStock = ((_a = productDoc.data()) === null || _a === void 0 ? void 0 : _a.currentStock) || 0;
                    const newTotalStock = currentStock + newStockQuantity;
                    // Update product stock
                    transaction.update(productRef, {
                        currentStock: newTotalStock,
                        lastRestockDate: admin.firestore.FieldValue.serverTimestamp(),
                        lastRestockBy: testUsers.admin.uid
                    });
                    // Create inbound movement record
                    const movementRef = db.collection(`clinics/${testClinicId}/products/${productRef.id}/movements`).doc();
                    transaction.set(movementRef, {
                        type: 'inbound',
                        quantity: newStockQuantity,
                        reason: 'Stock replenishment',
                        invoiceNumber: newInvoiceNumber,
                        performedBy: testUsers.admin.uid,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            });
            // Verify stock was updated
            const updatedProduct = await productRef.get();
            expect((_a = updatedProduct.data()) === null || _a === void 0 ? void 0 : _a.currentStock).toBe(22); // 2 + 20
            // Verify movement was recorded
            const movementsSnapshot = await db
                .collection(`clinics/${testClinicId}/products/${productRef.id}/movements`)
                .get();
            expect(movementsSnapshot.size).toBe(1);
            expect(movementsSnapshot.docs[0].data().type).toBe('inbound');
            expect(movementsSnapshot.docs[0].data().quantity).toBe(20);
        });
    });
    describe('Patient Treatment Flow', () => {
        test('should handle complete patient treatment workflow', async () => {
            var _a, _b, _c;
            // Step 1: Receptionist creates patient record
            const patientData = {
                name: 'Maria Silva',
                email: 'maria.silva@email.com',
                phone: '11999999999',
                birthDate: new Date('1985-03-15'),
                address: 'Rua das Flores, 123',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: testUsers.receptionist.uid,
                clinicId: testClinicId
            };
            const patientRef = await db.collection(`clinics/${testClinicId}/patients`).add(patientData);
            expect(patientRef.id).toBeDefined();
            // Step 2: Create products needed for treatment
            const products = [
                {
                    name: 'Ácido Hialurônico 1ml',
                    category: 'medicamento',
                    invoiceNumber: 'NF-2024-004',
                    currentStock: 30,
                    minimumStock: 5,
                    unitPrice: 120.00
                },
                {
                    name: 'Anestésico Tópico',
                    category: 'medicamento',
                    invoiceNumber: 'NF-2024-005',
                    currentStock: 15,
                    minimumStock: 3,
                    unitPrice: 45.00
                }
            ];
            const productRefs = [];
            for (const productData of products) {
                const productRef = await db.collection(`clinics/${testClinicId}/products`).add(Object.assign(Object.assign({}, productData), { expirationDate: new Date('2025-12-31'), entryDate: new Date(), createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: testUsers.admin.uid, clinicId: testClinicId }));
                productRefs.push(productRef);
            }
            // Step 3: Doctor creates treatment record
            const treatmentData = {
                patientId: patientRef.id,
                patientName: patientData.name,
                doctorId: testUsers.doctor.uid,
                doctorName: 'Test Doctor',
                procedure: 'Preenchimento labial',
                date: new Date(),
                status: 'scheduled',
                productsUsed: [
                    {
                        productId: productRefs[0].id,
                        productName: products[0].name,
                        quantityUsed: 2
                    },
                    {
                        productId: productRefs[1].id,
                        productName: products[1].name,
                        quantityUsed: 1
                    }
                ],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                clinicId: testClinicId
            };
            const treatmentRef = await db
                .collection(`clinics/${testClinicId}/patients/${patientRef.id}/treatments`)
                .add(treatmentData);
            // Step 4: Complete treatment and update stock
            await db.runTransaction(async (transaction) => {
                var _a, _b;
                const treatmentDoc = await transaction.get(treatmentRef);
                if (treatmentDoc.exists) {
                    const productsUsed = ((_a = treatmentDoc.data()) === null || _a === void 0 ? void 0 : _a.productsUsed) || [];
                    // Update stock for each product used
                    for (const productUsed of productsUsed) {
                        const productRef = db.doc(`clinics/${testClinicId}/products/${productUsed.productId}`);
                        const productDoc = await transaction.get(productRef);
                        if (productDoc.exists) {
                            const currentStock = ((_b = productDoc.data()) === null || _b === void 0 ? void 0 : _b.currentStock) || 0;
                            const newStock = currentStock - productUsed.quantityUsed;
                            transaction.update(productRef, {
                                currentStock: newStock,
                                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                            });
                            // Create movement record
                            const movementRef = db
                                .collection(`clinics/${testClinicId}/products/${productUsed.productId}/movements`)
                                .doc();
                            transaction.set(movementRef, {
                                type: 'outbound',
                                quantity: productUsed.quantityUsed,
                                reason: 'Used in treatment',
                                treatmentId: treatmentRef.id,
                                patientId: patientRef.id,
                                performedBy: testUsers.doctor.uid,
                                timestamp: admin.firestore.FieldValue.serverTimestamp()
                            });
                        }
                    }
                    // Update treatment status
                    transaction.update(treatmentRef, {
                        status: 'completed',
                        completedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            });
            // Verify treatment was completed
            const completedTreatment = await treatmentRef.get();
            expect((_a = completedTreatment.data()) === null || _a === void 0 ? void 0 : _a.status).toBe('completed');
            // Verify stock was updated
            const updatedProduct1 = await productRefs[0].get();
            const updatedProduct2 = await productRefs[1].get();
            expect((_b = updatedProduct1.data()) === null || _b === void 0 ? void 0 : _b.currentStock).toBe(28); // 30 - 2
            expect((_c = updatedProduct2.data()) === null || _c === void 0 ? void 0 : _c.currentStock).toBe(14); // 15 - 1
            // Verify movements were recorded
            const movements1 = await db
                .collection(`clinics/${testClinicId}/products/${productRefs[0].id}/movements`)
                .get();
            const movements2 = await db
                .collection(`clinics/${testClinicId}/products/${productRefs[1].id}/movements`)
                .get();
            expect(movements1.size).toBe(1);
            expect(movements2.size).toBe(1);
            expect(movements1.docs[0].data().reason).toBe('Used in treatment');
            expect(movements2.docs[0].data().reason).toBe('Used in treatment');
        });
    });
    describe('Notification System Flow', () => {
        test('should handle expiring products notification flow', async () => {
            var _a;
            // Step 1: Create products with different expiration dates
            const today = new Date();
            const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
            const sixtyDaysFromNow = new Date(today.getTime() + (60 * 24 * 60 * 60 * 1000));
            const expiringProduct = {
                name: 'Produto Vencendo',
                category: 'medicamento',
                invoiceNumber: 'NF-EXPIRING-001',
                currentStock: 10,
                minimumStock: 5,
                expirationDate: thirtyDaysFromNow,
                isExpired: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                clinicId: testClinicId
            };
            const normalProduct = {
                name: 'Produto Normal',
                category: 'medicamento',
                invoiceNumber: 'NF-NORMAL-001',
                currentStock: 20,
                minimumStock: 5,
                expirationDate: sixtyDaysFromNow,
                isExpired: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                clinicId: testClinicId
            };
            await db.collection(`clinics/${testClinicId}/products`).add(expiringProduct);
            await db.collection(`clinics/${testClinicId}/products`).add(normalProduct);
            // Step 2: Simulate scheduled function to check expiring products
            const checkDate = new Date(today.getTime() + (35 * 24 * 60 * 60 * 1000)); // 35 days from now
            const expiringProducts = await db
                .collection(`clinics/${testClinicId}/products`)
                .where('expirationDate', '<=', checkDate)
                .where('isExpired', '==', false)
                .get();
            expect(expiringProducts.size).toBe(1);
            // Step 3: Create notification for expiring products
            if (!expiringProducts.empty) {
                const notificationRef = await db
                    .collection(`clinics/${testClinicId}/notifications`)
                    .add({
                    type: 'expiring_products',
                    count: expiringProducts.size,
                    products: expiringProducts.docs.map(doc => ({
                        id: doc.id,
                        name: doc.data().name,
                        expirationDate: doc.data().expirationDate
                    })),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false,
                    clinicId: testClinicId
                });
                expect(notificationRef.id).toBeDefined();
                // Step 4: User marks notification as read
                await notificationRef.update({
                    read: true,
                    readAt: admin.firestore.FieldValue.serverTimestamp(),
                    readBy: testUsers.admin.uid
                });
                // Verify notification was marked as read
                const readNotification = await notificationRef.get();
                expect((_a = readNotification.data()) === null || _a === void 0 ? void 0 : _a.read).toBe(true);
            }
        });
    });
    describe('Error Handling and Recovery', () => {
        test('should handle transaction failures gracefully', async () => {
            var _a, _b, _c;
            // Create product with limited stock
            const productData = {
                name: 'Limited Stock Product',
                category: 'medicamento',
                invoiceNumber: 'NF-LIMITED-001',
                currentStock: 3,
                minimumStock: 5,
                unitPrice: 100.00,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                clinicId: testClinicId
            };
            const productRef = await db.collection(`clinics/${testClinicId}/products`).add(productData);
            // Try to create request for more stock than available
            const requestData = {
                productId: productRef.id,
                requesterId: testUsers.doctor.uid,
                quantity: 10, // More than available stock (3)
                reason: 'Test request',
                status: 'pending',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                clinicId: testClinicId
            };
            const requestRef = await db.collection(`clinics/${testClinicId}/requests`).add(requestData);
            // Try to approve request (should handle insufficient stock)
            let transactionError = null;
            try {
                await db.runTransaction(async (transaction) => {
                    var _a, _b;
                    const productDoc = await transaction.get(productRef);
                    const requestDoc = await transaction.get(requestRef);
                    if (productDoc.exists && requestDoc.exists) {
                        const currentStock = ((_a = productDoc.data()) === null || _a === void 0 ? void 0 : _a.currentStock) || 0;
                        const requestedQuantity = ((_b = requestDoc.data()) === null || _b === void 0 ? void 0 : _b.quantity) || 0;
                        if (currentStock < requestedQuantity) {
                            throw new Error('Insufficient stock');
                        }
                        // This should not execute due to insufficient stock
                        transaction.update(productRef, {
                            currentStock: currentStock - requestedQuantity
                        });
                        transaction.update(requestRef, {
                            status: 'approved'
                        });
                    }
                });
            }
            catch (error) {
                transactionError = error;
            }
            expect(transactionError).toBeDefined();
            expect(transactionError === null || transactionError === void 0 ? void 0 : transactionError.message).toBe('Insufficient stock');
            // Verify that no changes were made
            const unchangedProduct = await productRef.get();
            const unchangedRequest = await requestRef.get();
            expect((_a = unchangedProduct.data()) === null || _a === void 0 ? void 0 : _a.currentStock).toBe(3);
            expect((_b = unchangedRequest.data()) === null || _b === void 0 ? void 0 : _b.status).toBe('pending');
            // Update request status to rejected
            await requestRef.update({
                status: 'rejected',
                rejectionReason: 'Insufficient stock',
                rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
                rejectedBy: testUsers.admin.uid
            });
            const rejectedRequest = await requestRef.get();
            expect((_c = rejectedRequest.data()) === null || _c === void 0 ? void 0 : _c.status).toBe('rejected');
        });
    });
});
// Helper function to clear all test data
async function clearAllTestData() {
    try {
        const collections = ['products', 'requests', 'patients', 'notifications', 'invoices'];
        for (const collectionName of collections) {
            const snapshot = await db.collection(`clinics/${testClinicId}/${collectionName}`).get();
            const deletePromises = snapshot.docs.map(doc => doc.ref.delete());
            await Promise.all(deletePromises);
            // Also clear subcollections
            if (collectionName === 'products') {
                for (const doc of snapshot.docs) {
                    const movementsSnapshot = await db
                        .collection(`clinics/${testClinicId}/products/${doc.id}/movements`)
                        .get();
                    const movementDeletePromises = movementsSnapshot.docs.map(movementDoc => movementDoc.ref.delete());
                    await Promise.all(movementDeletePromises);
                }
            }
            if (collectionName === 'patients') {
                for (const doc of snapshot.docs) {
                    const treatmentsSnapshot = await db
                        .collection(`clinics/${testClinicId}/patients/${doc.id}/treatments`)
                        .get();
                    const treatmentDeletePromises = treatmentsSnapshot.docs.map(treatmentDoc => treatmentDoc.ref.delete());
                    await Promise.all(treatmentDeletePromises);
                }
            }
        }
    }
    catch (error) {
        console.error('Error clearing test data:', error);
    }
}
//# sourceMappingURL=integration-flows.test.js.map