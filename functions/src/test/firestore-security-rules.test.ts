/**
 * Comprehensive Firestore Security Rules Tests
 * Tests all security rules for different user roles and data access patterns
 */

import { 
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

// Test configuration
const PROJECT_ID = 'curva-mestra-test';
const RULES_FILE = path.join(__dirname, '../../../firestore.rules');

// Test data
const testData = {
  clinicId: 'test-clinic-123',
  otherClinicId: 'other-clinic-456',
  adminUserId: 'admin-user-123',
  doctorUserId: 'doctor-user-123',
  receptionistUserId: 'receptionist-user-123',
  managerUserId: 'manager-user-123',
  productId: 'product-123',
  requestId: 'request-123',
  patientId: 'patient-123',
  invoiceId: 'invoice-123'
};

describe('Firestore Security Rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    // Read security rules
    const rules = fs.readFileSync(RULES_FILE, 'utf8');
    
    // Initialize test environment
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: rules,
        host: 'localhost',
        port: 8080
      }
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    // Clear all data before each test
    await testEnv.clearFirestore();
  });

  describe('Authentication Rules', () => {
    test('should deny access to unauthenticated users', async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      
      await assertFails(
        unauthedDb.collection(`clinics/${testData.clinicId}/products`).get()
      );
      
      await assertFails(
        unauthedDb.collection(`clinics/${testData.clinicId}/requests`).get()
      );
      
      await assertFails(
        unauthedDb.collection(`clinics/${testData.clinicId}/patients`).get()
      );
    });

    test('should allow access to authenticated users with valid clinic', async () => {
      const authedDb = testEnv.authenticatedContext(testData.doctorUserId, {
        role: 'doctor',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        authedDb.collection(`clinics/${testData.clinicId}/products`).get()
      );
      
      await assertSucceeds(
        authedDb.collection(`clinics/${testData.clinicId}/requests`).get()
      );
      
      await assertSucceeds(
        authedDb.collection(`clinics/${testData.clinicId}/patients`).get()
      );
    });

    test('should deny cross-clinic access', async () => {
      const authedDb = testEnv.authenticatedContext(testData.doctorUserId, {
        role: 'doctor',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertFails(
        authedDb.collection(`clinics/${testData.otherClinicId}/products`).get()
      );
      
      await assertFails(
        authedDb.collection(`clinics/${testData.otherClinicId}/requests`).get()
      );
      
      await assertFails(
        authedDb.collection(`clinics/${testData.otherClinicId}/patients`).get()
      );
    });
  });

  describe('Products Collection Rules', () => {
    test('should allow all roles to read products', async () => {
      // Admin can read
      const adminDb = testEnv.authenticatedContext(testData.adminUserId, {
        role: 'admin',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        adminDb.collection(`clinics/${testData.clinicId}/products`).get()
      );

      // Doctor can read
      const doctorDb = testEnv.authenticatedContext(testData.doctorUserId, {
        role: 'doctor',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        doctorDb.collection(`clinics/${testData.clinicId}/products`).get()
      );

      // Receptionist can read
      const receptionistDb = testEnv.authenticatedContext(testData.receptionistUserId, {
        role: 'receptionist',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        receptionistDb.collection(`clinics/${testData.clinicId}/products`).get()
      );

      // Manager can read
      const managerDb = testEnv.authenticatedContext(testData.managerUserId, {
        role: 'manager',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        managerDb.collection(`clinics/${testData.clinicId}/products`).get()
      );
    });

    test('should allow only admin and manager to create products', async () => {
      const productData = {
        name: 'Test Product',
        category: 'medicamento',
        invoiceNumber: 'NF-12345',
        currentStock: 100,
        minimumStock: 10
      };

      // Admin can create
      const adminDb = testEnv.authenticatedContext(testData.adminUserId, {
        role: 'admin',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        adminDb.doc(`clinics/${testData.clinicId}/products/${testData.productId}`).set(productData)
      );

      // Manager can create
      const managerDb = testEnv.authenticatedContext(testData.managerUserId, {
        role: 'manager',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        managerDb.doc(`clinics/${testData.clinicId}/products/product-456`).set(productData)
      );

      // Doctor cannot create
      const doctorDb = testEnv.authenticatedContext(testData.doctorUserId, {
        role: 'doctor',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertFails(
        doctorDb.doc(`clinics/${testData.clinicId}/products/product-789`).set(productData)
      );

      // Receptionist cannot create
      const receptionistDb = testEnv.authenticatedContext(testData.receptionistUserId, {
        role: 'receptionist',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertFails(
        receptionistDb.doc(`clinics/${testData.clinicId}/products/product-101`).set(productData)
      );
    });

    test('should allow admin and manager to update products', async () => {
      // First create a product as admin
      const adminDb = testEnv.authenticatedContext(testData.adminUserId, {
        role: 'admin',
        clinicId: testData.clinicId
      }).firestore();
      
      const productData = {
        name: 'Test Product',
        category: 'medicamento',
        currentStock: 100
      };
      
      await adminDb.doc(`clinics/${testData.clinicId}/products/${testData.productId}`).set(productData);

      // Admin can update
      await assertSucceeds(
        adminDb.doc(`clinics/${testData.clinicId}/products/${testData.productId}`).update({
          currentStock: 90
        })
      );

      // Manager can update
      const managerDb = testEnv.authenticatedContext(testData.managerUserId, {
        role: 'manager',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        managerDb.doc(`clinics/${testData.clinicId}/products/${testData.productId}`).update({
          currentStock: 80
        })
      );

      // Doctor cannot update
      const doctorDb = testEnv.authenticatedContext(testData.doctorUserId, {
        role: 'doctor',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertFails(
        doctorDb.doc(`clinics/${testData.clinicId}/products/${testData.productId}`).update({
          currentStock: 70
        })
      );
    });
  });

  describe('Requests Collection Rules', () => {
    test('should allow all authenticated users to read requests', async () => {
      const doctorDb = testEnv.authenticatedContext(testData.doctorUserId, {
        role: 'doctor',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        doctorDb.collection(`clinics/${testData.clinicId}/requests`).get()
      );
    });

    test('should allow all authenticated users to create requests', async () => {
      const requestData = {
        productId: testData.productId,
        requesterId: testData.doctorUserId,
        quantity: 5,
        reason: 'Test request',
        status: 'pending'
      };

      const doctorDb = testEnv.authenticatedContext(testData.doctorUserId, {
        role: 'doctor',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        doctorDb.doc(`clinics/${testData.clinicId}/requests/${testData.requestId}`).set(requestData)
      );

      const receptionistDb = testEnv.authenticatedContext(testData.receptionistUserId, {
        role: 'receptionist',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        receptionistDb.doc(`clinics/${testData.clinicId}/requests/request-456`).set({
          ...requestData,
          requesterId: testData.receptionistUserId
        })
      );
    });

    test('should allow admin, manager, and request owner to update requests', async () => {
      // Create request as doctor
      const doctorDb = testEnv.authenticatedContext(testData.doctorUserId, {
        role: 'doctor',
        clinicId: testData.clinicId
      }).firestore();
      
      const requestData = {
        productId: testData.productId,
        requesterId: testData.doctorUserId,
        quantity: 5,
        status: 'pending'
      };
      
      await doctorDb.doc(`clinics/${testData.clinicId}/requests/${testData.requestId}`).set(requestData);

      // Admin can update
      const adminDb = testEnv.authenticatedContext(testData.adminUserId, {
        role: 'admin',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        adminDb.doc(`clinics/${testData.clinicId}/requests/${testData.requestId}`).update({
          status: 'approved'
        })
      );

      // Manager can update
      const managerDb = testEnv.authenticatedContext(testData.managerUserId, {
        role: 'manager',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        managerDb.doc(`clinics/${testData.clinicId}/requests/${testData.requestId}`).update({
          status: 'processing'
        })
      );

      // Request owner can update
      await assertSucceeds(
        doctorDb.doc(`clinics/${testData.clinicId}/requests/${testData.requestId}`).update({
          reason: 'Updated reason'
        })
      );

      // Other user cannot update
      const otherDoctorDb = testEnv.authenticatedContext('other-doctor-123', {
        role: 'doctor',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertFails(
        otherDoctorDb.doc(`clinics/${testData.clinicId}/requests/${testData.requestId}`).update({
          status: 'rejected'
        })
      );
    });
  });

  describe('Patients Collection Rules', () => {
    test('should allow all authenticated users to read patients', async () => {
      const receptionistDb = testEnv.authenticatedContext(testData.receptionistUserId, {
        role: 'receptionist',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        receptionistDb.collection(`clinics/${testData.clinicId}/patients`).get()
      );
    });

    test('should allow all authenticated users to create patients', async () => {
      const patientData = {
        name: 'Test Patient',
        email: 'patient@test.com',
        phone: '11999999999',
        birthDate: new Date('1990-01-01')
      };

      const receptionistDb = testEnv.authenticatedContext(testData.receptionistUserId, {
        role: 'receptionist',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        receptionistDb.doc(`clinics/${testData.clinicId}/patients/${testData.patientId}`).set(patientData)
      );

      const doctorDb = testEnv.authenticatedContext(testData.doctorUserId, {
        role: 'doctor',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        doctorDb.doc(`clinics/${testData.clinicId}/patients/patient-456`).set(patientData)
      );
    });

    test('should allow admin and manager to update/delete patients', async () => {
      // Create patient first
      const receptionistDb = testEnv.authenticatedContext(testData.receptionistUserId, {
        role: 'receptionist',
        clinicId: testData.clinicId
      }).firestore();
      
      const patientData = {
        name: 'Test Patient',
        email: 'patient@test.com'
      };
      
      await receptionistDb.doc(`clinics/${testData.clinicId}/patients/${testData.patientId}`).set(patientData);

      // Admin can update
      const adminDb = testEnv.authenticatedContext(testData.adminUserId, {
        role: 'admin',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        adminDb.doc(`clinics/${testData.clinicId}/patients/${testData.patientId}`).update({
          phone: '11888888888'
        })
      );

      // Manager can update
      const managerDb = testEnv.authenticatedContext(testData.managerUserId, {
        role: 'manager',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        managerDb.doc(`clinics/${testData.clinicId}/patients/${testData.patientId}`).update({
          address: 'New Address'
        })
      );
    });
  });

  describe('Notifications Collection Rules', () => {
    test('should allow all authenticated users to read notifications', async () => {
      const doctorDb = testEnv.authenticatedContext(testData.doctorUserId, {
        role: 'doctor',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        doctorDb.collection(`clinics/${testData.clinicId}/notifications`).get()
      );
    });

    test('should allow system to create notifications', async () => {
      // This would typically be done by Cloud Functions
      const adminDb = testEnv.authenticatedContext(testData.adminUserId, {
        role: 'admin',
        clinicId: testData.clinicId
      }).firestore();
      
      const notificationData = {
        type: 'low_stock',
        productId: testData.productId,
        message: 'Product stock is low',
        read: false,
        createdAt: new Date()
      };
      
      await assertSucceeds(
        adminDb.doc(`clinics/${testData.clinicId}/notifications/notification-123`).set(notificationData)
      );
    });

    test('should allow users to mark notifications as read', async () => {
      // Create notification first
      const adminDb = testEnv.authenticatedContext(testData.adminUserId, {
        role: 'admin',
        clinicId: testData.clinicId
      }).firestore();
      
      const notificationData = {
        type: 'low_stock',
        message: 'Test notification',
        read: false
      };
      
      await adminDb.doc(`clinics/${testData.clinicId}/notifications/notification-123`).set(notificationData);

      // User can mark as read
      const doctorDb = testEnv.authenticatedContext(testData.doctorUserId, {
        role: 'doctor',
        clinicId: testData.clinicId
      }).firestore();
      
      await assertSucceeds(
        doctorDb.doc(`clinics/${testData.clinicId}/notifications/notification-123`).update({
          read: true
        })
      );
    });
  });

  describe('Data Validation Rules', () => {
    test('should validate required fields in products', async () => {
      const adminDb = testEnv.authenticatedContext(testData.adminUserId, {
        role: 'admin',
        clinicId: testData.clinicId
      }).firestore();

      // Should fail without required fields
      await assertFails(
        adminDb.doc(`clinics/${testData.clinicId}/products/${testData.productId}`).set({
          category: 'medicamento'
          // Missing name, currentStock, etc.
        })
      );

      // Should succeed with all required fields
      await assertSucceeds(
        adminDb.doc(`clinics/${testData.clinicId}/products/${testData.productId}`).set({
          name: 'Test Product',
          category: 'medicamento',
          currentStock: 100,
          minimumStock: 10,
          invoiceNumber: 'NF-12345'
        })
      );
    });

    test('should validate data types', async () => {
      const adminDb = testEnv.authenticatedContext(testData.adminUserId, {
        role: 'admin',
        clinicId: testData.clinicId
      }).firestore();

      // Should fail with wrong data types
      await assertFails(
        adminDb.doc(`clinics/${testData.clinicId}/products/${testData.productId}`).set({
          name: 'Test Product',
          category: 'medicamento',
          currentStock: 'not-a-number', // Should be number
          minimumStock: 10,
          invoiceNumber: 'NF-12345'
        })
      );
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle batch operations efficiently', async () => {
      const adminDb = testEnv.authenticatedContext(testData.adminUserId, {
        role: 'admin',
        clinicId: testData.clinicId
      }).firestore();

      const batch = adminDb.batch();

      // Create multiple products in batch
      for (let i = 0; i < 10; i++) {
        const productRef = adminDb.doc(`clinics/${testData.clinicId}/products/product-${i}`);
        batch.set(productRef, {
          name: `Product ${i}`,
          category: 'medicamento',
          currentStock: 100,
          minimumStock: 10,
          invoiceNumber: `NF-${i}`
        });
      }

      await assertSucceeds(batch.commit());

      // Verify products were created
      const productsSnapshot = await adminDb.collection(`clinics/${testData.clinicId}/products`).get();
      expect(productsSnapshot.size).toBe(10);
    });

    test('should support complex queries with proper indexes', async () => {
      const adminDb = testEnv.authenticatedContext(testData.adminUserId, {
        role: 'admin',
        clinicId: testData.clinicId
      }).firestore();

      // Create test products
      await adminDb.doc(`clinics/${testData.clinicId}/products/product-1`).set({
        name: 'Product 1',
        category: 'medicamento',
        currentStock: 5,
        minimumStock: 10,
        expirationDate: new Date('2025-01-01'),
        isExpired: false
      });

      await adminDb.doc(`clinics/${testData.clinicId}/products/product-2`).set({
        name: 'Product 2',
        category: 'equipamento',
        currentStock: 15,
        minimumStock: 10,
        expirationDate: new Date('2025-06-01'),
        isExpired: false
      });

      // Test complex query (requires composite index)
      await assertSucceeds(
        adminDb.collection(`clinics/${testData.clinicId}/products`)
          .where('category', '==', 'medicamento')
          .where('currentStock', '<=', 10)
          .get()
      );
    });
  });
});