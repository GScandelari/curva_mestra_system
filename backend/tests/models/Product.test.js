const { Product, User } = require('../../src/models');

describe('Product Model', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'password123',
      role: 'admin'
    });
  });

  describe('Validations', () => {
    test('should create a valid product', async () => {
      const productData = {
        name: 'Test Product',
        description: 'Test description',
        category: 'Test Category',
        unit: 'unidade',
        minimumStock: 5,
        currentStock: 10,
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      };

      const product = await Product.create(productData);
      
      expect(product.id).toBeDefined();
      expect(product.name).toBe('Test Product');
      expect(product.category).toBe('Test Category');
      expect(product.minimumStock).toBe(5);
      expect(product.currentStock).toBe(10);
    });

    test('should require name', async () => {
      const productData = {
        category: 'Test Category',
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });

    test('should require category', async () => {
      const productData = {
        name: 'Test Product',
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });

    test('should require expiration date', async () => {
      const productData = {
        name: 'Test Product',
        category: 'Test Category',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });

    test('should require invoice number', async () => {
      const productData = {
        name: 'Test Product',
        category: 'Test Category',
        expirationDate: '2025-12-31',
        entryUserId: testUser.id
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });

    test('should require entry user ID', async () => {
      const productData = {
        name: 'Test Product',
        category: 'Test Category',
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001'
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });

    test('should validate minimum stock is not negative', async () => {
      const productData = {
        name: 'Test Product',
        category: 'Test Category',
        minimumStock: -1,
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });

    test('should validate current stock is not negative', async () => {
      const productData = {
        name: 'Test Product',
        category: 'Test Category',
        currentStock: -1,
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });

    test('should validate name length', async () => {
      const productData = {
        name: '', // Empty name
        category: 'Test Category',
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      };

      await expect(Product.create(productData)).rejects.toThrow();
    });

    test('should default unit to "unidade"', async () => {
      const productData = {
        name: 'Test Product',
        category: 'Test Category',
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      };

      const product = await Product.create(productData);
      expect(product.unit).toBe('unidade');
    });

    test('should default minimum and current stock to 0', async () => {
      const productData = {
        name: 'Test Product',
        category: 'Test Category',
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      };

      const product = await Product.create(productData);
      expect(product.minimumStock).toBe(0);
      expect(product.currentStock).toBe(0);
    });
  });

  describe('Virtual Fields', () => {
    test('should calculate isExpired correctly for expired product', async () => {
      const productData = {
        name: 'Expired Product',
        category: 'Test Category',
        expirationDate: '2020-01-01', // Past date
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      };

      const product = await Product.create(productData);
      expect(product.isExpired).toBe(true);
    });

    test('should calculate isExpired correctly for valid product', async () => {
      const productData = {
        name: 'Valid Product',
        category: 'Test Category',
        expirationDate: '2025-12-31', // Future date
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      };

      const product = await Product.create(productData);
      expect(product.isExpired).toBe(false);
    });

    test('should calculate daysToExpiration correctly', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const productData = {
        name: 'Tomorrow Product',
        category: 'Test Category',
        expirationDate: tomorrowStr,
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      };

      const product = await Product.create(productData);
      expect(product.daysToExpiration).toBe(1);
    });

    test('should calculate isLowStock correctly', async () => {
      const productData = {
        name: 'Low Stock Product',
        category: 'Test Category',
        minimumStock: 10,
        currentStock: 5, // Below minimum
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      };

      const product = await Product.create(productData);
      expect(product.isLowStock).toBe(true);
    });

    test('should calculate isLowStock correctly for adequate stock', async () => {
      const productData = {
        name: 'Good Stock Product',
        category: 'Test Category',
        minimumStock: 10,
        currentStock: 15, // Above minimum
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      };

      const product = await Product.create(productData);
      expect(product.isLowStock).toBe(false);
    });
  });

  describe('Relationships', () => {
    test('should belong to entry user', async () => {
      const productData = {
        name: 'Test Product',
        category: 'Test Category',
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      };

      const product = await Product.create(productData);
      const productWithUser = await Product.findByPk(product.id, {
        include: [{ association: 'entryUser' }]
      });

      expect(productWithUser.entryUser).toBeDefined();
      expect(productWithUser.entryUser.id).toBe(testUser.id);
      expect(productWithUser.entryUser.username).toBe('testuser');
    });
  });
});