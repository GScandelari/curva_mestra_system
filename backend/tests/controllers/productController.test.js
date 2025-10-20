const request = require('supertest');
const express = require('express');
const { Product, User, StockMovement } = require('../../src/models');
const productController = require('../../src/controllers/productController');
const { authenticate, authorize } = require('../../src/middleware/auth');
const { generateAccessToken } = require('../../src/utils/jwt');

// Mock middleware for testing
jest.mock('../../src/middleware/auth');

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

// Setup routes for testing - specific routes must come before parameterized routes
app.get('/products/alerts/summary', productController.getAlertSummary);
app.get('/products/alerts', productController.getAlerts);
app.get('/products/expiring', productController.getExpiringProducts);
app.get('/products/low-stock', productController.getLowStockProducts);
app.get('/products/invoice/:invoiceNumber', productController.getProductsByInvoice);
app.get('/products/:id/movements', productController.getProductMovements);
app.post('/products/:id/adjust-stock', productController.adjustStock);
app.get('/products/:id', productController.getProductById);
app.put('/products/:id', productController.updateProduct);
app.delete('/products/:id', productController.deleteProduct);
app.get('/products', productController.getProducts);
app.post('/products', productController.createProduct);

describe('Product Controller', () => {
  let testUser;
  let testProduct;
  let authToken;

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'password123',
      role: 'admin'
    });

    // Generate auth token
    authToken = generateAccessToken({ id: testUser.id });

    // Update the middleware to use the actual user ID
    app._router.stack.forEach(layer => {
      if (layer.handle && layer.handle.length === 3) {
        // This is our middleware
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

    // Create test product
    testProduct = await Product.create({
      name: 'Test Product',
      description: 'Test description',
      category: 'Test Category',
      unit: 'unidade',
      minimumStock: 5,
      currentStock: 10,
      expirationDate: '2025-12-31',
      invoiceNumber: 'INV-001',
      entryUserId: testUser.id
    });
  });

  describe('GET /products', () => {
    test('should get all products with pagination', async () => {
      const response = await request(app)
        .get('/products')
        .expect(200);

      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].name).toBe('Test Product');
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.currentPage).toBe(1);
    });

    test('should filter products by category', async () => {
      await Product.create({
        name: 'Another Product',
        category: 'Different Category',
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-002',
        entryUserId: testUser.id
      });

      const response = await request(app)
        .get('/products?category=Test Category')
        .expect(200);

      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].category).toBe('Test Category');
    });

    test('should filter products by invoice number', async () => {
      const response = await request(app)
        .get('/products?invoiceNumber=INV-001')
        .expect(200);

      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].invoiceNumber).toBe('INV-001');
    });

    test('should search products by name', async () => {
      const response = await request(app)
        .get('/products?search=Test')
        .expect(200);

      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].name).toContain('Test');
    });
  }); 
 describe('GET /products/:id', () => {
    test('should get product by ID', async () => {
      const response = await request(app)
        .get(`/products/${testProduct.id}`)
        .expect(200);

      expect(response.body.product.id).toBe(testProduct.id);
      expect(response.body.product.name).toBe('Test Product');
    });

    test('should return 404 for non-existent product', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .get(`/products/${fakeId}`)
        .expect(404);

      expect(response.body.error).toBe('Produto não encontrado');
      expect(response.body.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('POST /products', () => {
    test('should create new product successfully', async () => {
      const productData = {
        name: 'New Product',
        description: 'New description',
        category: 'New Category',
        unit: 'ml',
        minimumStock: 3,
        quantity: 15,
        expirationDate: '2025-06-30',
        invoiceNumber: 'INV-003'
      };

      const response = await request(app)
        .post('/products')
        .send(productData)
        .expect(201);

      expect(response.body.message).toBe('Produto criado com sucesso');
      expect(response.body.product.name).toBe('New Product');
      expect(response.body.product.currentStock).toBe(15);

      // Verify stock movement was created
      const movements = await StockMovement.findAll({
        where: { productId: response.body.product.id }
      });
      expect(movements).toHaveLength(1);
      expect(movements[0].movementType).toBe('entry');
      expect(movements[0].quantity).toBe(15);
    });

    test('should require invoice number', async () => {
      const productData = {
        name: 'New Product',
        category: 'New Category',
        quantity: 15,
        expirationDate: '2025-06-30'
        // Missing invoiceNumber
      };

      const response = await request(app)
        .post('/products')
        .send(productData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('should require valid expiration date', async () => {
      const productData = {
        name: 'New Product',
        category: 'New Category',
        quantity: 15,
        expirationDate: '2020-01-01', // Past date
        invoiceNumber: 'INV-003'
      };

      const response = await request(app)
        .post('/products')
        .send(productData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('PUT /products/:id', () => {
    test('should update product successfully', async () => {
      const updateData = {
        name: 'Updated Product',
        description: 'Updated description',
        minimumStock: 8
      };

      const response = await request(app)
        .put(`/products/${testProduct.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Produto atualizado com sucesso');
      expect(response.body.product.name).toBe('Updated Product');
      expect(response.body.product.minimumStock).toBe(8);
    });

    test('should return 404 for non-existent product', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = { name: 'Updated Product' };

      const response = await request(app)
        .put(`/products/${fakeId}`)
        .send(updateData)
        .expect(404);

      expect(response.body.error).toBe('Produto não encontrado');
    });
  }); 
 describe('POST /products/:id/adjust-stock', () => {
    test('should add stock successfully', async () => {
      const adjustmentData = {
        quantity: 5,
        movementType: 'entry',
        notes: 'Additional stock'
      };

      const response = await request(app)
        .post(`/products/${testProduct.id}/adjust-stock`)
        .send(adjustmentData)
        .expect(200);

      expect(response.body.message).toBe('Estoque ajustado com sucesso');
      expect(response.body.product.currentStock).toBe(15); // 10 + 5

      // Verify stock movement was created
      const movements = await StockMovement.findAll({
        where: { productId: testProduct.id }
      });
      expect(movements).toHaveLength(1);
      expect(movements[0].movementType).toBe('entry');
      expect(movements[0].quantity).toBe(5);
    });

    test('should remove stock successfully', async () => {
      const adjustmentData = {
        quantity: 3,
        movementType: 'exit',
        notes: 'Used in procedure'
      };

      const response = await request(app)
        .post(`/products/${testProduct.id}/adjust-stock`)
        .send(adjustmentData)
        .expect(200);

      expect(response.body.message).toBe('Estoque ajustado com sucesso');
      expect(response.body.product.currentStock).toBe(7); // 10 - 3

      // Verify stock movement was created
      const movements = await StockMovement.findAll({
        where: { productId: testProduct.id }
      });
      expect(movements).toHaveLength(1);
      expect(movements[0].movementType).toBe('exit');
      expect(movements[0].quantity).toBe(-3);
    });

    test('should prevent removing more stock than available', async () => {
      const adjustmentData = {
        quantity: 15, // More than current stock (10)
        movementType: 'exit'
      };

      const response = await request(app)
        .post(`/products/${testProduct.id}/adjust-stock`)
        .send(adjustmentData)
        .expect(400);

      expect(response.body.error).toBe('Estoque insuficiente');
      expect(response.body.code).toBe('INSUFFICIENT_STOCK');
    });

    test('should prevent using expired products', async () => {
      // Create expired product
      const expiredProduct = await Product.create({
        name: 'Expired Product',
        category: 'Test Category',
        currentStock: 5,
        expirationDate: '2020-01-01', // Past date
        invoiceNumber: 'INV-EXPIRED',
        entryUserId: testUser.id
      });

      const adjustmentData = {
        quantity: 2,
        movementType: 'exit'
      };

      const response = await request(app)
        .post(`/products/${expiredProduct.id}/adjust-stock`)
        .send(adjustmentData)
        .expect(400);

      expect(response.body.error).toBe('Produto vencido');
      expect(response.body.code).toBe('PRODUCT_EXPIRED');
    });
  });

  describe('GET /products/invoice/:invoiceNumber', () => {
    test('should get products by invoice number', async () => {
      // Create another product with same invoice
      await Product.create({
        name: 'Another Product',
        category: 'Test Category',
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001', // Same invoice
        entryUserId: testUser.id
      });

      const response = await request(app)
        .get('/products/invoice/INV-001')
        .expect(200);

      expect(response.body.invoiceNumber).toBe('INV-001');
      expect(response.body.products).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    test('should return empty array for non-existent invoice', async () => {
      const response = await request(app)
        .get('/products/invoice/NON-EXISTENT')
        .expect(200);

      expect(response.body.products).toHaveLength(0);
      expect(response.body.count).toBe(0);
    });
  });  describe(
'GET /products/expiring', () => {
    test('should get products expiring soon', async () => {
      // Create product expiring in 15 days
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      
      await Product.create({
        name: 'Expiring Product',
        category: 'Test Category',
        currentStock: 5,
        expirationDate: futureDate.toISOString().split('T')[0],
        invoiceNumber: 'INV-EXPIRING',
        entryUserId: testUser.id
      });

      const response = await request(app)
        .get('/products/expiring')
        .expect(200);

      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].name).toBe('Expiring Product');
      expect(response.body.daysFilter).toBe(30);
    });

    test('should filter by custom days parameter', async () => {
      const response = await request(app)
        .get('/products/expiring?days=60')
        .expect(200);

      expect(response.body.daysFilter).toBe(60);
    });

    test('should not include products with zero stock', async () => {
      // Create expiring product with zero stock
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      
      await Product.create({
        name: 'Zero Stock Product',
        category: 'Test Category',
        currentStock: 0, // Zero stock
        expirationDate: futureDate.toISOString().split('T')[0],
        invoiceNumber: 'INV-ZERO',
        entryUserId: testUser.id
      });

      const response = await request(app)
        .get('/products/expiring')
        .expect(200);

      expect(response.body.products).toHaveLength(0);
    });
  });

  describe('GET /products/low-stock', () => {
    test('should get products with low stock', async () => {
      // Create low stock product
      await Product.create({
        name: 'Low Stock Product',
        category: 'Test Category',
        minimumStock: 10,
        currentStock: 5, // Below minimum
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-LOW',
        entryUserId: testUser.id
      });

      const response = await request(app)
        .get('/products/low-stock')
        .expect(200);

      expect(response.body.products).toHaveLength(1);
      expect(response.body.products[0].name).toBe('Low Stock Product');
      expect(response.body.count).toBe(1);
    });

    test('should not include products with adequate stock', async () => {
      // Update test product to have adequate stock
      await testProduct.update({
        minimumStock: 5,
        currentStock: 10 // Above minimum
      });

      const response = await request(app)
        .get('/products/low-stock')
        .expect(200);

      expect(response.body.products).toHaveLength(0);
    });
  });

  describe('GET /products/:id/movements', () => {
    test('should get product stock movements', async () => {
      // Create some stock movements
      await StockMovement.create({
        productId: testProduct.id,
        movementType: 'entry',
        quantity: 5,
        userId: testUser.id,
        notes: 'Test movement'
      });

      const response = await request(app)
        .get(`/products/${testProduct.id}/movements`)
        .expect(200);

      expect(response.body.movements).toHaveLength(1);
      expect(response.body.movements[0].movementType).toBe('entry');
      expect(response.body.movements[0].quantity).toBe(5);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('GET /products/alerts', () => {
    test('should get active alerts', async () => {
      // Create products that trigger alerts
      
      // Expiring product
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      await Product.create({
        name: 'Expiring Product',
        category: 'Test Category',
        currentStock: 5,
        expirationDate: futureDate.toISOString().split('T')[0],
        invoiceNumber: 'INV-EXPIRING',
        entryUserId: testUser.id
      });

      // Low stock product
      await Product.create({
        name: 'Low Stock Product',
        category: 'Test Category',
        minimumStock: 10,
        currentStock: 3,
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-LOW',
        entryUserId: testUser.id
      });

      // Expired product
      await Product.create({
        name: 'Expired Product',
        category: 'Test Category',
        currentStock: 2,
        expirationDate: '2020-01-01',
        invoiceNumber: 'INV-EXPIRED',
        entryUserId: testUser.id
      });

      const response = await request(app)
        .get('/products/alerts')
        .expect(200);

      expect(response.body.alerts).toHaveLength(3);
      
      const alertTypes = response.body.alerts.map(alert => alert.type);
      expect(alertTypes).toContain('expiring_products');
      expect(alertTypes).toContain('low_stock');
      expect(alertTypes).toContain('expired_products');
    });

    test('should return empty alerts when no issues', async () => {
      // Update test product to have good conditions
      await testProduct.update({
        minimumStock: 5,
        currentStock: 15,
        expirationDate: '2025-12-31'
      });

      const response = await request(app)
        .get('/products/alerts')
        .expect(200);

      expect(response.body.alerts).toHaveLength(0);
    });
  });

  describe('GET /products/alerts/summary', () => {
    test('should get alert summary', async () => {
      // Create products that trigger alerts
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      
      await Product.create({
        name: 'Expiring Product',
        category: 'Test Category',
        currentStock: 5,
        expirationDate: futureDate.toISOString().split('T')[0],
        invoiceNumber: 'INV-EXPIRING',
        entryUserId: testUser.id
      });

      const response = await request(app)
        .get('/products/alerts/summary')
        .expect(200);

      expect(response.body.summary).toBeDefined();
      expect(response.body.summary.expiring).toBeDefined();
      expect(response.body.summary.lowStock).toBeDefined();
      expect(response.body.summary.expired).toBeDefined();
      expect(response.body.summary.total).toBeDefined();
    });
  });

  describe('DELETE /products/:id', () => {
    test('should delete product with no movements', async () => {
      const response = await request(app)
        .delete(`/products/${testProduct.id}`)
        .expect(200);

      expect(response.body.message).toBe('Produto excluído com sucesso');

      // Verify product was deleted
      const deletedProduct = await Product.findByPk(testProduct.id);
      expect(deletedProduct).toBeNull();
    });

    test('should prevent deletion of product with movements', async () => {
      // Create stock movements
      await StockMovement.create({
        productId: testProduct.id,
        movementType: 'entry',
        quantity: 5,
        userId: testUser.id
      });

      await StockMovement.create({
        productId: testProduct.id,
        movementType: 'exit',
        quantity: -2,
        userId: testUser.id
      });

      const response = await request(app)
        .delete(`/products/${testProduct.id}`)
        .expect(400);

      expect(response.body.error).toBe('Não é possível excluir produto com movimentações');
    });

    test('should return 404 for non-existent product', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      const response = await request(app)
        .delete(`/products/${fakeId}`)
        .expect(404);

      expect(response.body.error).toBe('Produto não encontrado');
    });
  });
});