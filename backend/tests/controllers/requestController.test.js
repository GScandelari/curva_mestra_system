const request = require('supertest');
const express = require('express');
const { 
  ProductRequest, 
  RequestedProduct, 
  Product, 
  User, 
  Patient, 
  StockMovement 
} = require('../../src/models');
const requestController = require('../../src/controllers/requestController');
const { generateAccessToken } = require('../../src/utils/jwt');

const app = express();
app.use(express.json());

// Add middleware to set user in request
app.use((req, res, next) => {
  req.user = {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin'
  };
  next();
});

// Setup routes for testing
app.get('/requests/user/:userId', requestController.getUserRequests);
app.patch('/requests/:id/fulfill', requestController.fulfillRequest);
app.patch('/requests/:id/reject', requestController.rejectRequest);
app.patch('/requests/:id/approve', requestController.approveRequest);
app.get('/requests/:id', requestController.getRequestById);
app.get('/requests', requestController.getRequests);
app.post('/requests', requestController.createRequest);

describe('Request Controller', () => {
  let testUser;
  let testManager;
  let testProduct;
  let testPatient;
  let testRequest;

  beforeEach(async () => {
    // Create test users
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'password123',
      role: 'doctor'
    });

    testManager = await User.create({
      username: 'manager',
      email: 'manager@example.com',
      passwordHash: 'password123',
      role: 'manager'
    });

    // Create test product
    testProduct = await Product.create({
      name: 'Test Product',
      description: 'Test description',
      category: 'Test Category',
      unit: 'unidade',
      minimumStock: 5,
      currentStock: 20,
      expirationDate: '2025-12-31',
      invoiceNumber: 'INV-001',
      entryUserId: testUser.id
    });

    // Create test patient
    testPatient = await Patient.create({
      name: 'Test Patient',
      email: 'patient@example.com',
      phone: '123456789',
      birthDate: '1990-01-01'
    });

    // Update middleware to use actual user ID
    app._router.stack.forEach(layer => {
      if (layer.handle && layer.handle.length === 3) {
        layer.handle = (req, res, next) => {
          req.user = {
            id: testUser.id,
            username: testUser.username,
            email: testUser.email,
            role: testUser.role
          };
          next();
        };
      }
    });
  });

  describe('POST /requests', () => {
    test('should create new request successfully', async () => {
      const requestData = {
        products: [
          {
            productId: testProduct.id,
            quantity: 5,
            reason: 'For patient treatment'
          }
        ],
        patientId: testPatient.id,
        notes: 'Urgent request'
      };

      const response = await request(app)
        .post('/requests')
        .send(requestData)
        .expect(201);

      expect(response.body.message).toBe('Solicitação criada com sucesso');
      expect(response.body.request.status).toBe('pending');
      expect(response.body.request.requesterId).toBe(testUser.id);
      expect(response.body.request.patientId).toBe(testPatient.id);
      expect(response.body.request.requestedProducts).toHaveLength(1);
      expect(response.body.request.requestedProducts[0].quantity).toBe(5);
    });

    test('should create request without patient', async () => {
      const requestData = {
        products: [
          {
            productId: testProduct.id,
            quantity: 3,
            reason: 'General use'
          }
        ],
        notes: 'General request'
      };

      const response = await request(app)
        .post('/requests')
        .send(requestData)
        .expect(201);

      expect(response.body.request.patientId).toBeNull();
      expect(response.body.request.requestedProducts).toHaveLength(1);
    });

    test('should require at least one product', async () => {
      const requestData = {
        products: [],
        notes: 'Empty request'
      };

      const response = await request(app)
        .post('/requests')
        .send(requestData)
        .expect(400);

      expect(response.body.error).toBe('Dados de solicitação inválidos');
    });

    test('should validate product exists', async () => {
      const fakeProductId = '123e4567-e89b-12d3-a456-426614174000';
      const requestData = {
        products: [
          {
            productId: fakeProductId,
            quantity: 5,
            reason: 'Test'
          }
        ]
      };

      const response = await request(app)
        .post('/requests')
        .send(requestData)
        .expect(404);

      expect(response.body.error).toContain('Produto não encontrado');
    });

    test('should validate sufficient stock', async () => {
      const requestData = {
        products: [
          {
            productId: testProduct.id,
            quantity: 25, // More than available (20)
            reason: 'Too much'
          }
        ]
      };

      const response = await request(app)
        .post('/requests')
        .send(requestData)
        .expect(400);

      expect(response.body.error).toContain('Estoque insuficiente');
    });

    test('should prevent requesting expired products', async () => {
      // Create expired product
      const expiredProduct = await Product.create({
        name: 'Expired Product',
        category: 'Test Category',
        currentStock: 10,
        expirationDate: '2020-01-01',
        invoiceNumber: 'INV-EXPIRED',
        entryUserId: testUser.id
      });

      const requestData = {
        products: [
          {
            productId: expiredProduct.id,
            quantity: 5,
            reason: 'Test'
          }
        ]
      };

      const response = await request(app)
        .post('/requests')
        .send(requestData)
        .expect(400);

      expect(response.body.error).toContain('está vencido');
    });

    test('should validate patient exists if provided', async () => {
      const fakePatientId = '123e4567-e89b-12d3-a456-426614174000';
      const requestData = {
        products: [
          {
            productId: testProduct.id,
            quantity: 5,
            reason: 'Test'
          }
        ],
        patientId: fakePatientId
      };

      const response = await request(app)
        .post('/requests')
        .send(requestData)
        .expect(404);

      expect(response.body.error).toBe('Paciente não encontrado');
    });
  });

  describe('GET /requests', () => {
    beforeEach(async () => {
      // Create test request
      testRequest = await ProductRequest.create({
        requesterId: testUser.id,
        patientId: testPatient.id,
        status: 'pending',
        notes: 'Test request'
      });

      await RequestedProduct.create({
        requestId: testRequest.id,
        productId: testProduct.id,
        quantity: 5,
        reason: 'Test reason'
      });

      // Update middleware to use manager role for this test
      app._router.stack.forEach(layer => {
        if (layer.handle && layer.handle.length === 3) {
          layer.handle = (req, res, next) => {
            req.user = {
              id: testManager.id,
              username: testManager.username,
              email: testManager.email,
              role: testManager.role
            };
            next();
          };
        }
      });
    });

    test('should get all requests with pagination', async () => {
      const response = await request(app)
        .get('/requests')
        .expect(200);

      expect(response.body.requests).toHaveLength(1);
      expect(response.body.requests[0].id).toBe(testRequest.id);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.currentPage).toBe(1);
    });

    test('should filter requests by status', async () => {
      // Create approved request
      await ProductRequest.create({
        requesterId: testUser.id,
        status: 'approved',
        approverId: testManager.id,
        approvalDate: new Date()
      });

      const response = await request(app)
        .get('/requests?status=pending')
        .expect(200);

      expect(response.body.requests).toHaveLength(1);
      expect(response.body.requests[0].status).toBe('pending');
    });

    test('should filter requests by requester', async () => {
      const response = await request(app)
        .get(`/requests?requesterId=${testUser.id}`)
        .expect(200);

      expect(response.body.requests).toHaveLength(1);
      expect(response.body.requests[0].requesterId).toBe(testUser.id);
    });

    test('should filter requests by patient', async () => {
      const response = await request(app)
        .get(`/requests?patientId=${testPatient.id}`)
        .expect(200);

      expect(response.body.requests).toHaveLength(1);
      expect(response.body.requests[0].patientId).toBe(testPatient.id);
    });
  });

  describe('GET /requests/:id', () => {
    beforeEach(async () => {
      testRequest = await ProductRequest.create({
        requesterId: testUser.id,
        patientId: testPatient.id,
        status: 'pending',
        notes: 'Test request'
      });

      await RequestedProduct.create({
        requestId: testRequest.id,
        productId: testProduct.id,
        quantity: 5,
        reason: 'Test reason'
      });
    });

    test('should get request by ID', async () => {
      const response = await request(app)
        .get(`/requests/${testRequest.id}`)
        .expect(200);

      expect(response.body.request.id).toBe(testRequest.id);
      expect(response.body.request.requester).toBeDefined();
      expect(response.body.request.patient).toBeDefined();
      expect(response.body.request.requestedProducts).toHaveLength(1);
    });

    test('should return 404 for non-existent request', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .get(`/requests/${fakeId}`)
        .expect(404);

      expect(response.body.error).toBe('Solicitação não encontrada');
    });
  });

  describe('PATCH /requests/:id/approve', () => {
    beforeEach(async () => {
      testRequest = await ProductRequest.create({
        requesterId: testUser.id,
        patientId: testPatient.id,
        status: 'pending',
        notes: 'Test request'
      });

      await RequestedProduct.create({
        requestId: testRequest.id,
        productId: testProduct.id,
        quantity: 5,
        reason: 'Test reason'
      });

      // Update middleware to use manager role
      app._router.stack.forEach(layer => {
        if (layer.handle && layer.handle.length === 3) {
          layer.handle = (req, res, next) => {
            req.user = {
              id: testManager.id,
              username: testManager.username,
              email: testManager.email,
              role: testManager.role
            };
            next();
          };
        }
      });
    });

    test('should approve request and deduct stock', async () => {
      const initialStock = testProduct.currentStock;

      const response = await request(app)
        .patch(`/requests/${testRequest.id}/approve`)
        .expect(200);

      expect(response.body.message).toBe('Solicitação aprovada com sucesso');
      expect(response.body.request.status).toBe('approved');
      expect(response.body.request.approverId).toBe(testManager.id);
      expect(response.body.request.approvalDate).toBeDefined();

      // Verify stock was deducted
      await testProduct.reload();
      expect(testProduct.currentStock).toBe(initialStock - 5);

      // Verify stock movement was created
      const movements = await StockMovement.findAll({
        where: { requestId: testRequest.id }
      });
      expect(movements).toHaveLength(1);
      expect(movements[0].movementType).toBe('exit');
      expect(movements[0].quantity).toBe(-5);
      expect(movements[0].userId).toBe(testManager.id);
    });

    test('should return 404 for non-existent request', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .patch(`/requests/${fakeId}/approve`)
        .expect(404);

      expect(response.body.error).toBe('Solicitação não encontrada');
    });

    test('should prevent approving already processed request', async () => {
      // Update request to approved
      await testRequest.update({ status: 'approved' });

      const response = await request(app)
        .patch(`/requests/${testRequest.id}/approve`)
        .expect(400);

      expect(response.body.error).toContain('já foi processada');
    });

    test('should require manager or admin role', async () => {
      // Update middleware to use doctor role
      app._router.stack.forEach(layer => {
        if (layer.handle && layer.handle.length === 3) {
          layer.handle = (req, res, next) => {
            req.user = {
              id: testUser.id,
              username: testUser.username,
              email: testUser.email,
              role: 'doctor'
            };
            next();
          };
        }
      });

      const response = await request(app)
        .patch(`/requests/${testRequest.id}/approve`)
        .expect(403);

      expect(response.body.error).toBe('Permissão insuficiente para aprovar solicitações');
    });

    test('should validate stock availability at approval time', async () => {
      // Reduce product stock to less than requested
      await testProduct.update({ currentStock: 3 });

      const response = await request(app)
        .patch(`/requests/${testRequest.id}/approve`)
        .expect(400);

      expect(response.body.error).toContain('Estoque insuficiente');
    });
  });

  describe('PATCH /requests/:id/reject', () => {
    beforeEach(async () => {
      testRequest = await ProductRequest.create({
        requesterId: testUser.id,
        status: 'pending',
        notes: 'Test request'
      });

      // Update middleware to use manager role
      app._router.stack.forEach(layer => {
        if (layer.handle && layer.handle.length === 3) {
          layer.handle = (req, res, next) => {
            req.user = {
              id: testManager.id,
              username: testManager.username,
              email: testManager.email,
              role: testManager.role
            };
            next();
          };
        }
      });
    });

    test('should reject request successfully', async () => {
      const rejectData = {
        reason: 'Not needed anymore'
      };

      const response = await request(app)
        .patch(`/requests/${testRequest.id}/reject`)
        .send(rejectData)
        .expect(200);

      expect(response.body.message).toBe('Solicitação rejeitada com sucesso');
      expect(response.body.request.status).toBe('rejected');
      expect(response.body.request.approverId).toBe(testManager.id);
      expect(response.body.request.approvalDate).toBeDefined();
    });

    test('should require rejection reason', async () => {
      const response = await request(app)
        .patch(`/requests/${testRequest.id}/reject`)
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('should prevent rejecting already processed request', async () => {
      await testRequest.update({ status: 'approved' });

      const rejectData = {
        reason: 'Test rejection'
      };

      const response = await request(app)
        .patch(`/requests/${testRequest.id}/reject`)
        .send(rejectData)
        .expect(400);

      expect(response.body.error).toContain('já foi processada');
    });
  });

  describe('PATCH /requests/:id/fulfill', () => {
    beforeEach(async () => {
      testRequest = await ProductRequest.create({
        requesterId: testUser.id,
        status: 'approved',
        approverId: testManager.id,
        approvalDate: new Date()
      });
    });

    test('should mark request as fulfilled', async () => {
      const response = await request(app)
        .patch(`/requests/${testRequest.id}/fulfill`)
        .expect(200);

      expect(response.body.message).toBe('Solicitação marcada como atendida');
      expect(response.body.request.status).toBe('fulfilled');
    });

    test('should only allow fulfilling approved requests', async () => {
      await testRequest.update({ status: 'pending' });

      const response = await request(app)
        .patch(`/requests/${testRequest.id}/fulfill`)
        .expect(400);

      expect(response.body.error).toContain('Apenas solicitações aprovadas');
    });
  });

  describe('GET /requests/user/:userId', () => {
    beforeEach(async () => {
      testRequest = await ProductRequest.create({
        requesterId: testUser.id,
        status: 'pending',
        notes: 'User request'
      });

      await RequestedProduct.create({
        requestId: testRequest.id,
        productId: testProduct.id,
        quantity: 3,
        reason: 'Test'
      });
    });

    test('should get user own requests', async () => {
      const response = await request(app)
        .get(`/requests/user/${testUser.id}`)
        .expect(200);

      expect(response.body.requests).toHaveLength(1);
      expect(response.body.requests[0].requesterId).toBe(testUser.id);
      expect(response.body.pagination).toBeDefined();
    });

    test('should prevent accessing other user requests without permission', async () => {
      // Update middleware to use different user
      const otherUser = await User.create({
        username: 'otheruser',
        email: 'other@example.com',
        passwordHash: 'password123',
        role: 'doctor'
      });

      app._router.stack.forEach(layer => {
        if (layer.handle && layer.handle.length === 3) {
          layer.handle = (req, res, next) => {
            req.user = {
              id: otherUser.id,
              username: otherUser.username,
              email: otherUser.email,
              role: otherUser.role
            };
            next();
          };
        }
      });

      const response = await request(app)
        .get(`/requests/user/${testUser.id}`)
        .expect(403);

      expect(response.body.error).toBe('Permissão insuficiente para acessar solicitações de outro usuário');
    });

    test('should allow admin to access any user requests', async () => {
      // Update middleware to use admin role
      app._router.stack.forEach(layer => {
        if (layer.handle && layer.handle.length === 3) {
          layer.handle = (req, res, next) => {
            req.user = {
              id: testManager.id,
              username: testManager.username,
              email: testManager.email,
              role: 'admin'
            };
            next();
          };
        }
      });

      const response = await request(app)
        .get(`/requests/user/${testUser.id}`)
        .expect(200);

      expect(response.body.requests).toHaveLength(1);
    });

    test('should filter user requests by status', async () => {
      // Create approved request
      await ProductRequest.create({
        requesterId: testUser.id,
        status: 'approved',
        approverId: testManager.id
      });

      const response = await request(app)
        .get(`/requests/user/${testUser.id}?status=pending`)
        .expect(200);

      expect(response.body.requests).toHaveLength(1);
      expect(response.body.requests[0].status).toBe('pending');
    });
  });
});