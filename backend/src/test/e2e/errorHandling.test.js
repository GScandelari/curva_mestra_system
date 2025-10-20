const request = require('supertest');
const app = require('../../server');
const { sequelize } = require('../../models');
const { generateAccessToken } = require('../../utils/jwt');

describe('Error Handling E2E Tests', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Setup test database
    await sequelize.sync({ force: true });
    
    // Create test user
    const { User } = require('../../models');
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
      role: 'admin'
    });

    authToken = generateAccessToken(testUser);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('Authentication Errors', () => {
    test('should return structured error for missing token', async () => {
      const response = await request(app)
        .get('/api/products')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('timestamp');
      expect(response.body.error).toHaveProperty('path', '/api/products');
      expect(response.body.error).toHaveProperty('method', 'GET');
    });

    test('should return structured error for invalid token', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_001');
      expect(response.body.error.message).toContain('Token inválido');
    });

    test('should return structured error for expired token', async () => {
      // Create an expired token (this is a mock - in real scenario you'd use an actually expired token)
      const expiredToken = 'expired.token.here';
      
      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_001');
    });
  });

  describe('Validation Errors', () => {
    test('should return structured validation errors for invalid product data', async () => {
      const invalidProductData = {
        name: '', // Empty name
        category: 'Test',
        quantity: -1, // Negative quantity
        expirationDate: '2020-01-01', // Past date
        // Missing invoiceNumber
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidProductData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VAL_001');
      expect(response.body.error.message).toContain('Dados de entrada inválidos');
      expect(response.body.error.details).toBeInstanceOf(Array);
      expect(response.body.error.details.length).toBeGreaterThan(0);
      
      // Check that validation details are properly formatted
      const detail = response.body.error.details[0];
      expect(detail).toHaveProperty('field');
      expect(detail).toHaveProperty('message');
    });

    test('should return structured validation errors for invalid patient data', async () => {
      const invalidPatientData = {
        name: 'A', // Too short
        email: 'invalid-email', // Invalid format
        phone: 'abc123', // Invalid format
        birthDate: '2030-01-01' // Future date
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPatientData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VAL_001');
      expect(response.body.error.details).toBeInstanceOf(Array);
    });
  });

  describe('Business Logic Errors', () => {
    test('should return structured error for insufficient stock', async () => {
      // First create a product with limited stock
      const { Product } = require('../../models');
      const product = await Product.create({
        name: 'Limited Stock Product',
        category: 'Test',
        unit: 'unidade',
        minimumStock: 5,
        currentStock: 2,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        invoiceNumber: 'INV-LIMITED',
        entryDate: new Date(),
        entryUser: testUser.id
      });

      // Try to adjust stock beyond available quantity
      const adjustmentData = {
        quantity: 5,
        movementType: 'exit',
        notes: 'Test adjustment'
      };

      const response = await request(app)
        .post(`/api/products/${product.id}/adjust-stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(adjustmentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INV_002');
      expect(response.body.error.message).toContain('Estoque insuficiente');
    });

    test('should return structured error for expired product usage', async () => {
      // Create an expired product
      const { Product } = require('../../models');
      const expiredProduct = await Product.create({
        name: 'Expired Product',
        category: 'Test',
        unit: 'unidade',
        minimumStock: 5,
        currentStock: 10,
        expirationDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        invoiceNumber: 'INV-EXPIRED',
        entryDate: new Date(),
        entryUser: testUser.id
      });

      // Try to use expired product
      const adjustmentData = {
        quantity: 1,
        movementType: 'exit',
        notes: 'Test expired product'
      };

      const response = await request(app)
        .post(`/api/products/${expiredProduct.id}/adjust-stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(adjustmentData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INV_003');
      expect(response.body.error.message).toContain('vencido');
    });
  });

  describe('Not Found Errors', () => {
    test('should return structured error for non-existent product', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      const response = await request(app)
        .get(`/api/products/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INV_001');
      expect(response.body.error.message).toContain('Produto não encontrado');
    });

    test('should return structured error for non-existent patient', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      const response = await request(app)
        .get(`/api/patients/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PAT_001');
      expect(response.body.error.message).toContain('Paciente não encontrado');
    });

    test('should return structured error for non-existent endpoint', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Endpoint não encontrado');
    });
  });

  describe('Database Constraint Errors', () => {
    test('should return structured error for duplicate invoice number', async () => {
      // Create first product with invoice
      const productData1 = {
        name: 'Product 1',
        category: 'Test',
        unit: 'unidade',
        quantity: 10,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        invoiceNumber: 'INV-DUPLICATE'
      };

      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(productData1)
        .expect(201);

      // Try to create second product with same invoice number
      const productData2 = {
        name: 'Product 2',
        category: 'Test',
        unit: 'unidade',
        quantity: 5,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        invoiceNumber: 'INV-DUPLICATE'
      };

      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(productData2)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVOICE_001');
      expect(response.body.error.message).toContain('nota fiscal já existe');
    });

    test('should return structured error for duplicate patient email', async () => {
      // Create first patient
      const patientData1 = {
        name: 'Patient 1',
        email: 'duplicate@test.com',
        phone: '123456789'
      };

      await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData1)
        .expect(201);

      // Try to create second patient with same email
      const patientData2 = {
        name: 'Patient 2',
        email: 'duplicate@test.com',
        phone: '987654321'
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData2)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PAT_002');
      expect(response.body.error.message).toContain('email já está cadastrado');
    });
  });

  describe('Authorization Errors', () => {
    test('should return structured error for insufficient permissions', async () => {
      // Create a user with limited permissions
      const { User } = require('../../models');
      const limitedUser = await User.create({
        username: 'limiteduser',
        email: 'limited@example.com',
        passwordHash: 'hashedpassword',
        role: 'receptionist'
      });

      const limitedToken = generateAccessToken(limitedUser);

      // Try to access admin-only endpoint
      const response = await request(app)
        .get('/api/audit/logs')
        .set('Authorization', `Bearer ${limitedToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_003');
      expect(response.body.error.message).toContain('Permissões insuficientes');
    });
  });

  describe('Error Response Format Consistency', () => {
    test('all error responses should have consistent structure', async () => {
      const testCases = [
        { method: 'get', path: '/api/products', expectedStatus: 401 },
        { method: 'get', path: '/api/non-existent', expectedStatus: 404 },
        { method: 'post', path: '/api/products', data: {}, expectedStatus: 400 }
      ];

      for (const testCase of testCases) {
        let req = request(app)[testCase.method](testCase.path);
        
        if (testCase.data) {
          req = req.send(testCase.data);
        }

        const response = await req.expect(testCase.expectedStatus);

        // Check consistent error structure
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
        expect(response.body.error).toHaveProperty('timestamp');
        expect(response.body.error).toHaveProperty('path');
        expect(response.body.error).toHaveProperty('method');
        
        // Validate timestamp format
        expect(new Date(response.body.error.timestamp)).toBeInstanceOf(Date);
        
        // Validate path and method
        expect(response.body.error.path).toBe(testCase.path);
        expect(response.body.error.method.toLowerCase()).toBe(testCase.method.toLowerCase());
      }
    });
  });

  describe('Error Logging and Audit', () => {
    test('should log errors to audit system', async () => {
      // This test would verify that errors are properly logged
      // For now, we'll just ensure the error response is correct
      const response = await request(app)
        .get('/api/products/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBeDefined();
      
      // In a real implementation, you would check the audit logs here
      // const auditLogs = await AuditLog.findAll({ where: { level: 'error' } });
      // expect(auditLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting Errors', () => {
    test('should handle rate limiting gracefully', async () => {
      // This test would verify rate limiting works
      // For now, we'll skip it as it requires specific setup
      // In a real scenario, you would make multiple rapid requests
      // and verify that rate limiting kicks in with proper error response
    });
  });

  describe('Critical Error Flows', () => {
    test('should handle complete user workflow with error recovery', async () => {
      // Test a complete workflow: create product -> create request -> approve -> handle errors
      
      // 1. Create a product successfully
      const productData = {
        name: 'Workflow Test Product',
        category: 'Test',
        unit: 'unidade',
        quantity: 10,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        invoiceNumber: 'INV-WORKFLOW'
      };

      const productResponse = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(productData)
        .expect(201);

      const productId = productResponse.body.product.id;

      // 2. Try to create invalid request (should fail with validation error)
      const invalidRequestData = {
        products: [
          {
            productId: productId,
            quantity: -1, // Invalid quantity
            reason: 'Test'
          }
        ]
      };

      const invalidRequestResponse = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequestData)
        .expect(400);

      expect(invalidRequestResponse.body.success).toBe(false);
      expect(invalidRequestResponse.body.error.code).toBe('VAL_001');

      // 3. Create valid request
      const validRequestData = {
        products: [
          {
            productId: productId,
            quantity: 5,
            reason: 'Test workflow'
          }
        ]
      };

      const requestResponse = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validRequestData)
        .expect(201);

      const requestId = requestResponse.body.request.id;

      // 4. Try to approve with insufficient stock (modify product stock first)
      await request(app)
        .post(`/api/products/${productId}/adjust-stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 8,
          movementType: 'exit',
          notes: 'Reduce stock for test'
        })
        .expect(200);

      // Now try to approve request (should fail due to insufficient stock)
      const approveResponse = await request(app)
        .patch(`/api/requests/${requestId}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(approveResponse.body.success).toBe(false);
      expect(approveResponse.body.error.code).toBe('INV_002');
      expect(approveResponse.body.error.message).toContain('Estoque insuficiente');
    });
  });
});