const request = require('supertest');
const express = require('express');
const { Invoice, Product, User } = require('../../src/models');
const invoiceController = require('../../src/controllers/invoiceController');
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

// Setup routes for testing - specific routes must come before parameterized routes
app.get('/invoices/reports/purchases', invoiceController.getPurchaseReport);
app.get('/invoices/:id/products', invoiceController.getInvoiceProducts);
app.get('/invoices/:id', invoiceController.getInvoiceById);
app.put('/invoices/:id', invoiceController.updateInvoice);
app.delete('/invoices/:id', invoiceController.deleteInvoice);
app.get('/invoices', invoiceController.getInvoices);
app.post('/invoices', invoiceController.createInvoice);

describe('Invoice Controller', () => {
  let testUser;
  let testInvoice;
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

    // Create test invoice
    testInvoice = await Invoice.create({
      number: 'INV-001',
      supplier: 'Test Supplier',
      issueDate: '2024-01-15',
      receiptDate: '2024-01-16',
      totalValue: 1500.00,
      userId: testUser.id
    });
  });

  describe('GET /invoices', () => {
    test('should get all invoices with pagination', async () => {
      const response = await request(app)
        .get('/invoices')
        .expect(200);

      expect(response.body.invoices).toHaveLength(1);
      expect(response.body.invoices[0].number).toBe('INV-001');
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.currentPage).toBe(1);
    });

    test('should filter invoices by supplier', async () => {
      await Invoice.create({
        number: 'INV-002',
        supplier: 'Different Supplier',
        issueDate: '2024-01-20',
        receiptDate: '2024-01-21',
        totalValue: 800.00,
        userId: testUser.id
      });

      const response = await request(app)
        .get('/invoices?supplier=Test Supplier')
        .expect(200);

      expect(response.body.invoices).toHaveLength(1);
      expect(response.body.invoices[0].supplier).toBe('Test Supplier');
    });

    test('should filter invoices by date range', async () => {
      const response = await request(app)
        .get('/invoices?startDate=2024-01-01&endDate=2024-01-31')
        .expect(200);

      expect(response.body.invoices).toHaveLength(1);
      expect(response.body.invoices[0].number).toBe('INV-001');
    });

    test('should search invoices by number', async () => {
      const response = await request(app)
        .get('/invoices?search=INV-001')
        .expect(200);

      expect(response.body.invoices).toHaveLength(1);
      expect(response.body.invoices[0].number).toBe('INV-001');
    });
  });

  describe('GET /invoices/:id', () => {
    test('should get invoice by ID', async () => {
      const response = await request(app)
        .get(`/invoices/${testInvoice.id}`)
        .expect(200);

      expect(response.body.invoice.id).toBe(testInvoice.id);
      expect(response.body.invoice.number).toBe('INV-001');
      expect(response.body.invoice.supplier).toBe('Test Supplier');
    });

    test('should return 404 for non-existent invoice', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .get(`/invoices/${fakeId}`)
        .expect(404);

      expect(response.body.error).toBe('Nota fiscal não encontrada');
      expect(response.body.code).toBe('INVOICE_NOT_FOUND');
    });
  });

  describe('POST /invoices', () => {
    test('should create new invoice successfully', async () => {
      const invoiceData = {
        number: 'INV-003',
        supplier: 'New Supplier',
        issueDate: '2024-02-01',
        receiptDate: '2024-02-02',
        totalValue: 2000.00
      };

      const response = await request(app)
        .post('/invoices')
        .send(invoiceData)
        .expect(201);

      expect(response.body.message).toBe('Nota fiscal criada com sucesso');
      expect(response.body.invoice.number).toBe('INV-003');
      expect(response.body.invoice.supplier).toBe('New Supplier');
      expect(response.body.invoice.totalValue).toBe('2000.00');
    });

    test('should validate uniqueness of invoice number', async () => {
      const invoiceData = {
        number: 'INV-001', // Duplicate number
        supplier: 'Another Supplier',
        issueDate: '2024-02-01',
        receiptDate: '2024-02-02',
        totalValue: 1000.00
      };

      const response = await request(app)
        .post('/invoices')
        .send(invoiceData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.code).toBe('DUPLICATE_INVOICE_NUMBER');
    });

    test('should require all mandatory fields', async () => {
      const invoiceData = {
        number: 'INV-004',
        supplier: 'Test Supplier'
        // Missing required fields
      };

      const response = await request(app)
        .post('/invoices')
        .send(invoiceData)
        .expect(400);

      expect(response.body.error).toBe('Dados de entrada inválidos');
      expect(response.body.details).toBeDefined();
    });

    test('should validate date format', async () => {
      const invoiceData = {
        number: 'INV-005',
        supplier: 'Test Supplier',
        issueDate: 'invalid-date',
        receiptDate: '2024-02-02',
        totalValue: 1000.00
      };

      const response = await request(app)
        .post('/invoices')
        .send(invoiceData)
        .expect(400);

      expect(response.body.error).toBe('Dados de entrada inválidos');
    });

    test('should validate that receipt date is not before issue date', async () => {
      const invoiceData = {
        number: 'INV-006',
        supplier: 'Test Supplier',
        issueDate: '2024-02-05',
        receiptDate: '2024-02-01', // Before issue date
        totalValue: 1000.00
      };

      const response = await request(app)
        .post('/invoices')
        .send(invoiceData)
        .expect(400);

      expect(response.body.error).toBe('Dados de entrada inválidos');
    });
  });

  describe('PUT /invoices/:id', () => {
    test('should update invoice successfully', async () => {
      const updateData = {
        supplier: 'Updated Supplier',
        totalValue: 1800.00
      };

      const response = await request(app)
        .put(`/invoices/${testInvoice.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Nota fiscal atualizada com sucesso');
      expect(response.body.invoice.supplier).toBe('Updated Supplier');
      expect(response.body.invoice.totalValue).toBe('1800.00');
    });

    test('should prevent updating invoice number to duplicate', async () => {
      // Create another invoice
      await Invoice.create({
        number: 'INV-007',
        supplier: 'Another Supplier',
        issueDate: '2024-02-01',
        receiptDate: '2024-02-02',
        totalValue: 1000.00,
        userId: testUser.id
      });

      const updateData = {
        number: 'INV-007' // Duplicate number
      };

      const response = await request(app)
        .put(`/invoices/${testInvoice.id}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.code).toBe('DUPLICATE_INVOICE_NUMBER');
    });

    test('should return 404 for non-existent invoice', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const updateData = { supplier: 'Updated Supplier' };

      const response = await request(app)
        .put(`/invoices/${fakeId}`)
        .send(updateData)
        .expect(404);

      expect(response.body.error).toBe('Nota fiscal não encontrada');
    });
  });

  describe('DELETE /invoices/:id', () => {
    test('should delete invoice with no associated products', async () => {
      const response = await request(app)
        .delete(`/invoices/${testInvoice.id}`)
        .expect(200);

      expect(response.body.message).toBe('Nota fiscal excluída com sucesso');

      // Verify invoice was deleted
      const deletedInvoice = await Invoice.findByPk(testInvoice.id);
      expect(deletedInvoice).toBeNull();
    });

    test('should prevent deletion of invoice with associated products', async () => {
      // Create product associated with invoice
      await Product.create({
        name: 'Test Product',
        category: 'Test Category',
        currentStock: 10,
        expirationDate: '2025-12-31',
        invoiceNumber: testInvoice.number,
        entryUserId: testUser.id
      });

      const response = await request(app)
        .delete(`/invoices/${testInvoice.id}`)
        .expect(400);

      expect(response.body.error).toBe('Não é possível excluir nota fiscal com produtos associados');
      expect(response.body.code).toBe('INVOICE_HAS_PRODUCTS');
    });

    test('should return 404 for non-existent invoice', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      const response = await request(app)
        .delete(`/invoices/${fakeId}`)
        .expect(404);

      expect(response.body.error).toBe('Nota fiscal não encontrada');
    });
  });

  describe('GET /invoices/:id/products', () => {
    test('should get products associated with invoice', async () => {
      // Create products associated with invoice
      await Product.create({
        name: 'Product 1',
        category: 'Category 1',
        currentStock: 10,
        expirationDate: '2025-12-31',
        invoiceNumber: testInvoice.number,
        entryUserId: testUser.id
      });

      await Product.create({
        name: 'Product 2',
        category: 'Category 2',
        currentStock: 5,
        expirationDate: '2025-06-30',
        invoiceNumber: testInvoice.number,
        entryUserId: testUser.id
      });

      const response = await request(app)
        .get(`/invoices/${testInvoice.id}/products`)
        .expect(200);

      expect(response.body.products).toHaveLength(2);
      expect(response.body.invoice.number).toBe(testInvoice.number);
      expect(response.body.totalProducts).toBe(2);
    });

    test('should return empty array for invoice with no products', async () => {
      const response = await request(app)
        .get(`/invoices/${testInvoice.id}/products`)
        .expect(200);

      expect(response.body.products).toHaveLength(0);
      expect(response.body.totalProducts).toBe(0);
    });

    test('should return 404 for non-existent invoice', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      const response = await request(app)
        .get(`/invoices/${fakeId}/products`)
        .expect(404);

      expect(response.body.error).toBe('Nota fiscal não encontrada');
    });
  });

  describe('GET /invoices/reports/purchases', () => {
    test('should generate purchase report for date range', async () => {
      // Create additional invoices for testing
      await Invoice.create({
        number: 'INV-008',
        supplier: 'Supplier A',
        issueDate: '2024-01-10',
        receiptDate: '2024-01-11',
        totalValue: 500.00,
        userId: testUser.id
      });

      await Invoice.create({
        number: 'INV-009',
        supplier: 'Supplier B',
        issueDate: '2024-01-20',
        receiptDate: '2024-01-21',
        totalValue: 750.00,
        userId: testUser.id
      });

      const response = await request(app)
        .get('/invoices/reports/purchases?startDate=2024-01-01&endDate=2024-01-31')
        .expect(200);

      expect(response.body.invoices).toHaveLength(3);
      expect(response.body.summary.totalInvoices).toBe(3);
      expect(response.body.summary.totalValue).toBe('2750.00');
      expect(response.body.summary.supplierCount).toBe(3);
    });

    test('should filter report by supplier', async () => {
      await Invoice.create({
        number: 'INV-010',
        supplier: 'Test Supplier',
        issueDate: '2024-01-25',
        receiptDate: '2024-01-26',
        totalValue: 300.00,
        userId: testUser.id
      });

      const response = await request(app)
        .get('/invoices/reports/purchases?startDate=2024-01-01&endDate=2024-01-31&supplier=Test Supplier')
        .expect(200);

      expect(response.body.invoices).toHaveLength(2);
      expect(response.body.summary.totalValue).toBe('1800.00');
    });

    test('should require date range for report', async () => {
      const response = await request(app)
        .get('/invoices/reports/purchases')
        .expect(400);

      expect(response.body.error).toBe('Período é obrigatório para o relatório');
    });

    test('should validate date range', async () => {
      const response = await request(app)
        .get('/invoices/reports/purchases?startDate=2024-02-01&endDate=2024-01-01')
        .expect(400);

      expect(response.body.error).toBe('Data inicial deve ser anterior à data final');
    });
  });
});