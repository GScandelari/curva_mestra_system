/**
 * Simple Integration Tests
 * Tests for critical user flows without complex Firebase Functions setup
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin for testing
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'curva-mestra-test'
  });
}

const db = admin.firestore();

// Test data
const testClinicId = 'integration-test-clinic';
const testUsers = {
  admin: {
    uid: 'admin-integration-test',
    role: 'admin'
  },
  doctor: {
    uid: 'doctor-integration-test',
    role: 'doctor'
  }
};

describe('Integration Tests - Critical Flows', () => {
  beforeEach(async () => {
    await clearAllTestData();
  });

  afterAll(async () => {
    await clearAllTestData();
  });

  describe('Product Management Flow', () => {
    test('should handle complete product lifecycle', async () => {
      // Step 1: Create a product
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
      expect(createdProduct.data()?.name).toBe(productData.name);

      // Step 2: Create a request for the product
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

      // Step 3: Approve the request and update stock
      await db.runTransaction(async (transaction) => {
        const productDoc = await transaction.get(productRef);
        const requestDoc = await transaction.get(requestRef);

        if (productDoc.exists && requestDoc.exists) {
          const currentStock = productDoc.data()?.currentStock || 0;
          const requestedQuantity = requestDoc.data()?.quantity || 0;

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

      expect(updatedProduct.data()?.currentStock).toBe(45); // 50 - 5
      expect(updatedRequest.data()?.status).toBe('approved');

      // Step 4: Check if low stock notification should be created
      const currentStock = updatedProduct.data()?.currentStock || 0;
      const minimumStock = updatedProduct.data()?.minimumStock || 0;

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
        const productDoc = await transaction.get(productRef);

        if (productDoc.exists) {
          const currentStock = productDoc.data()?.currentStock || 0;
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
      expect(updatedProduct.data()?.currentStock).toBe(22); // 2 + 20

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
    test('should handle patient treatment workflow', async () => {
      // Step 1: Create patient record
      const patientData = {
        name: 'Maria Silva',
        email: 'maria.silva@email.com',
        phone: '11999999999',
        birthDate: new Date('1985-03-15'),
        address: 'Rua das Flores, 123',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: testUsers.doctor.uid,
        clinicId: testClinicId
      };

      const patientRef = await db.collection(`clinics/${testClinicId}/patients`).add(patientData);
      expect(patientRef.id).toBeDefined();

      // Step 2: Create products needed for treatment
      const productData = {
        name: 'Ácido Hialurônico 1ml',
        category: 'medicamento',
        invoiceNumber: 'NF-2024-004',
        currentStock: 30,
        minimumStock: 5,
        unitPrice: 120.00,
        expirationDate: new Date('2025-12-31'),
        entryDate: new Date(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: testUsers.admin.uid,
        clinicId: testClinicId
      };

      const productRef = await db.collection(`clinics/${testClinicId}/products`).add(productData);

      // Step 3: Create treatment record
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
            productId: productRef.id,
            productName: productData.name,
            quantityUsed: 2
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
        const treatmentDoc = await transaction.get(treatmentRef);

        if (treatmentDoc.exists) {
          const productsUsed = treatmentDoc.data()?.productsUsed || [];

          // Update stock for each product used
          for (const productUsed of productsUsed) {
            const productDocRef = db.doc(`clinics/${testClinicId}/products/${productUsed.productId}`);
            const productDoc = await transaction.get(productDocRef);

            if (productDoc.exists) {
              const currentStock = productDoc.data()?.currentStock || 0;
              const newStock = currentStock - productUsed.quantityUsed;

              transaction.update(productDocRef, {
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
      expect(completedTreatment.data()?.status).toBe('completed');

      // Verify stock was updated
      const updatedProduct = await productRef.get();
      expect(updatedProduct.data()?.currentStock).toBe(28); // 30 - 2

      // Verify movement was recorded
      const movements = await db
        .collection(`clinics/${testClinicId}/products/${productRef.id}/movements`)
        .get();

      expect(movements.size).toBe(1);
      expect(movements.docs[0].data().reason).toBe('Used in treatment');
    });
  });

  describe('Error Handling', () => {
    test('should handle insufficient stock gracefully', async () => {
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
          const productDoc = await transaction.get(productRef);
          const requestDoc = await transaction.get(requestRef);

          if (productDoc.exists && requestDoc.exists) {
            const currentStock = productDoc.data()?.currentStock || 0;
            const requestedQuantity = requestDoc.data()?.quantity || 0;

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
      } catch (error) {
        transactionError = error;
      }

      expect(transactionError).toBeDefined();
      expect((transactionError as Error)?.message).toBe('Insufficient stock');

      // Verify that no changes were made
      const unchangedProduct = await productRef.get();
      const unchangedRequest = await requestRef.get();

      expect(unchangedProduct.data()?.currentStock).toBe(3);
      expect(unchangedRequest.data()?.status).toBe('pending');
    });
  });
});

// Helper function to clear all test data
async function clearAllTestData() {
  try {
    const collections = ['products', 'requests', 'patients', 'notifications'];
    
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
  } catch (error) {
    console.error('Error clearing test data:', error);
  }
}