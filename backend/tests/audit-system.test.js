const AuditService = require('../src/services/auditService');
const { AuditLog, StockMovement } = require('../src/models');

describe('Audit System Implementation', () => {
  
  describe('AuditService', () => {
    test('should have all required methods', () => {
      expect(typeof AuditService.logStockMovement).toBe('function');
      expect(typeof AuditService.logCriticalOperation).toBe('function');
      expect(typeof AuditService.logAuthEvent).toBe('function');
      expect(typeof AuditService.logDataAccess).toBe('function');
      expect(typeof AuditService.logBulkOperation).toBe('function');
      expect(typeof AuditService.generateAuditSummary).toBe('function');
      expect(typeof AuditService.detectSuspiciousActivity).toBe('function');
    });
  });

  describe('Models', () => {
    test('should have AuditLog model with required fields', () => {
      const auditLogAttributes = Object.keys(AuditLog.rawAttributes);
      
      expect(auditLogAttributes).toContain('id');
      expect(auditLogAttributes).toContain('userId');
      expect(auditLogAttributes).toContain('action');
      expect(auditLogAttributes).toContain('resource');
      expect(auditLogAttributes).toContain('resourceId');
      expect(auditLogAttributes).toContain('oldValues');
      expect(auditLogAttributes).toContain('newValues');
      expect(auditLogAttributes).toContain('ipAddress');
      expect(auditLogAttributes).toContain('userAgent');
      expect(auditLogAttributes).toContain('timestamp');
      expect(auditLogAttributes).toContain('success');
      expect(auditLogAttributes).toContain('errorMessage');
      expect(auditLogAttributes).toContain('metadata');
    });

    test('should have StockMovement model with required fields', () => {
      const stockMovementAttributes = Object.keys(StockMovement.rawAttributes);
      
      expect(stockMovementAttributes).toContain('id');
      expect(stockMovementAttributes).toContain('productId');
      expect(stockMovementAttributes).toContain('movementType');
      expect(stockMovementAttributes).toContain('quantity');
      expect(stockMovementAttributes).toContain('date');
      expect(stockMovementAttributes).toContain('userId');
      expect(stockMovementAttributes).toContain('patientId');
      expect(stockMovementAttributes).toContain('requestId');
      expect(stockMovementAttributes).toContain('notes');
    });
  });

  describe('Audit Middleware', () => {
    test('should have audit middleware functions', () => {
      const auditMiddleware = require('../src/middleware/audit');
      
      expect(typeof auditMiddleware.auditMiddleware).toBe('function');
      expect(typeof auditMiddleware.auditAuth).toBe('function');
      expect(typeof auditMiddleware.logAudit).toBe('function');
      expect(typeof auditMiddleware.captureOldValues).toBe('function');
      expect(typeof auditMiddleware.auditWithOldValues).toBe('function');
      expect(typeof auditMiddleware.createAuditLog).toBe('function');
    });
  });

  describe('Stock Movement Controller', () => {
    test('should have stock movement controller functions', () => {
      const stockMovementController = require('../src/controllers/stockMovementController');
      
      expect(typeof stockMovementController.getStockMovements).toBe('function');
      expect(typeof stockMovementController.getStockMovementById).toBe('function');
      expect(typeof stockMovementController.getMovementStats).toBe('function');
      expect(typeof stockMovementController.getResourceMovements).toBe('function');
    });
  });

  describe('Validation', () => {
    test('should have stock movement query validation', () => {
      const { validateStockMovementQuery } = require('../src/utils/validation');
      
      expect(typeof validateStockMovementQuery).toBe('function');
      
      // Test valid query
      const validQuery = {
        page: 1,
        limit: 10,
        movementType: 'entry'
      };
      
      const result = validateStockMovementQuery(validQuery);
      expect(result.error).toBeUndefined();
      expect(result.value).toBeDefined();
    });
  });

  describe('Backup Service', () => {
    test('should have audit backup service', () => {
      const auditBackupService = require('../src/services/auditBackupService');
      
      expect(typeof auditBackupService.initialize).toBe('function');
      expect(typeof auditBackupService.performBackup).toBe('function');
      expect(typeof auditBackupService.triggerManualBackup).toBe('function');
      expect(typeof auditBackupService.getBackupStatus).toBe('function');
      expect(typeof auditBackupService.startBackupSchedule).toBe('function');
      expect(typeof auditBackupService.stopBackupSchedule).toBe('function');
    });
  });
});