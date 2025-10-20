const { Product, User } = require('../../src/models');
const AlertService = require('../../src/services/alertService');

describe('AlertService', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'password123',
      role: 'admin'
    });
  });

  describe('getActiveAlerts', () => {
    test('should return expiring products alert', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      
      await Product.create({
        name: 'Expiring Product',
        category: 'Test Category',
        currentStock: 5,
        expirationDate: futureDate.toISOString().split('T')[0],
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      });

      const alerts = await AlertService.getActiveAlerts();
      
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('expiring_products');
      expect(alerts[0].severity).toBe('warning');
      expect(alerts[0].count).toBe(1);
    });

    test('should return low stock alert', async () => {
      await Product.create({
        name: 'Low Stock Product',
        category: 'Test Category',
        minimumStock: 10,
        currentStock: 5,
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      });

      const alerts = await AlertService.getActiveAlerts();
      
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('low_stock');
      expect(alerts[0].severity).toBe('warning');
      expect(alerts[0].count).toBe(1);
    });

    test('should return expired products alert', async () => {
      await Product.create({
        name: 'Expired Product',
        category: 'Test Category',
        currentStock: 3,
        expirationDate: '2020-01-01',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      });

      const alerts = await AlertService.getActiveAlerts();
      
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('expired_products');
      expect(alerts[0].severity).toBe('error');
      expect(alerts[0].count).toBe(1);
    });

    test('should return multiple alerts', async () => {
      // Expiring product
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      await Product.create({
        name: 'Expiring Product',
        category: 'Test Category',
        currentStock: 5,
        expirationDate: futureDate.toISOString().split('T')[0],
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      });

      // Low stock product
      await Product.create({
        name: 'Low Stock Product',
        category: 'Test Category',
        minimumStock: 10,
        currentStock: 3,
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-002',
        entryUserId: testUser.id
      });

      const alerts = await AlertService.getActiveAlerts();
      
      expect(alerts).toHaveLength(2);
      const alertTypes = alerts.map(alert => alert.type);
      expect(alertTypes).toContain('expiring_products');
      expect(alertTypes).toContain('low_stock');
    });

    test('should return empty array when no alerts', async () => {
      await Product.create({
        name: 'Good Product',
        category: 'Test Category',
        minimumStock: 5,
        currentStock: 15,
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      });

      const alerts = await AlertService.getActiveAlerts();
      expect(alerts).toHaveLength(0);
    });
  });

  describe('checkProductAlerts', () => {
    test('should detect expired product alert', async () => {
      const product = await Product.create({
        name: 'Expired Product',
        category: 'Test Category',
        currentStock: 5,
        expirationDate: '2020-01-01',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      });

      const alerts = await AlertService.checkProductAlerts(product.id);
      
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('expired');
      expect(alerts[0].severity).toBe('error');
    });

    test('should detect expiring soon alert', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      
      const product = await Product.create({
        name: 'Expiring Product',
        category: 'Test Category',
        currentStock: 5,
        expirationDate: futureDate.toISOString().split('T')[0],
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      });

      const alerts = await AlertService.checkProductAlerts(product.id);
      
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('expiring_soon');
      expect(alerts[0].severity).toBe('warning');
    });

    test('should detect low stock alert', async () => {
      const product = await Product.create({
        name: 'Low Stock Product',
        category: 'Test Category',
        minimumStock: 10,
        currentStock: 5,
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      });

      const alerts = await AlertService.checkProductAlerts(product.id);
      
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('low_stock');
      expect(alerts[0].severity).toBe('warning');
    });

    test('should return empty array for non-existent product', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      const alerts = await AlertService.checkProductAlerts(fakeId);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('getAlertSummary', () => {
    test('should return correct alert counts', async () => {
      // Create expiring product
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      await Product.create({
        name: 'Expiring Product',
        category: 'Test Category',
        currentStock: 5,
        expirationDate: futureDate.toISOString().split('T')[0],
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      });

      // Create low stock product
      await Product.create({
        name: 'Low Stock Product',
        category: 'Test Category',
        minimumStock: 10,
        currentStock: 3,
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-002',
        entryUserId: testUser.id
      });

      // Create expired product
      await Product.create({
        name: 'Expired Product',
        category: 'Test Category',
        currentStock: 2,
        expirationDate: '2020-01-01',
        invoiceNumber: 'INV-003',
        entryUserId: testUser.id
      });

      const summary = await AlertService.getAlertSummary();
      
      expect(summary.expiring).toBe(1);
      expect(summary.lowStock).toBe(1);
      expect(summary.expired).toBe(1);
      expect(summary.total).toBe(3);
    });

    test('should return zero counts when no alerts', async () => {
      await Product.create({
        name: 'Good Product',
        category: 'Test Category',
        minimumStock: 5,
        currentStock: 15,
        expirationDate: '2025-12-31',
        invoiceNumber: 'INV-001',
        entryUserId: testUser.id
      });

      const summary = await AlertService.getAlertSummary();
      
      expect(summary.expiring).toBe(0);
      expect(summary.lowStock).toBe(0);
      expect(summary.expired).toBe(0);
      expect(summary.total).toBe(0);
    });
  });
});