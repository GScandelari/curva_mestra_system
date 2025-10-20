const { auditMiddleware, auditAuth, logAudit, createAuditLog } = require('../../src/middleware/audit');
const { AuditLog, User } = require('../../src/models');
const { sequelize } = require('../../src/models');

// Mock request and response objects
const mockRequest = (overrides = {}) => ({
  user: { id: 'user-123', role: 'admin' },
  method: 'POST',
  originalUrl: '/api/test',
  params: { id: 'resource-123' },
  body: { name: 'Test Resource' },
  headers: { 'user-agent': 'test-agent' },
  ip: '127.0.0.1',
  ...overrides
});

const mockResponse = () => {
  const res = {};
  res.json = jest.fn().mockReturnValue(res);
  res.statusCode = 200;
  return res;
};

const mockNext = jest.fn();

describe('Audit Middleware', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
    
    // Create test user
    await User.create({
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      role: 'admin'
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('auditMiddleware', () => {
    it('should create audit log on successful operation', async () => {
      const req = mockRequest();
      const res = mockResponse();
      const middleware = auditMiddleware('CREATE', 'PRODUCT');

      middleware(req, res, mockNext);

      // Simulate successful response
      res.json({ success: true, id: 'product-123' });

      // Wait for async audit log creation
      await new Promise(resolve => setTimeout(resolve, 100));

      const auditLogs = await AuditLog.findAll({
        where: { action: 'CREATE', resource: 'PRODUCT' }
      });

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].userId).toBe('user-123');
      expect(auditLogs[0].success).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should create audit log on failed operation', async () => {
      const req = mockRequest();
      const res = mockResponse();
      res.statusCode = 400;
      const middleware = auditMiddleware('UPDATE', 'PRODUCT');

      middleware(req, res, mockNext);

      // Simulate failed response
      res.json({ error: 'Validation failed' });

      // Wait for async audit log creation
      await new Promise(resolve => setTimeout(resolve, 100));

      const auditLogs = await AuditLog.findAll({
        where: { action: 'UPDATE', resource: 'PRODUCT' }
      });

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].success).toBe(false);
      expect(auditLogs[0].errorMessage).toBe('Validation failed');
    });

    it('should handle missing user gracefully', async () => {
      const req = mockRequest({ user: null });
      const res = mockResponse();
      const middleware = auditMiddleware('DELETE', 'PRODUCT');

      middleware(req, res, mockNext);
      res.json({ success: true });

      // Wait for async audit log creation
      await new Promise(resolve => setTimeout(resolve, 100));

      const auditLogs = await AuditLog.findAll({
        where: { action: 'DELETE', resource: 'PRODUCT' }
      });

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].userId).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('auditAuth', () => {
    it('should create audit log for authentication events', async () => {
      const req = mockRequest({
        body: { username: 'testuser' }
      });
      const res = mockResponse();
      const middleware = auditAuth('LOGIN');

      middleware(req, res, mockNext);
      res.json({ token: 'jwt-token' });

      // Wait for async audit log creation
      await new Promise(resolve => setTimeout(resolve, 100));

      const auditLogs = await AuditLog.findAll({
        where: { action: 'LOGIN', resource: 'AUTH' }
      });

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].success).toBe(true);
      expect(auditLogs[0].metadata.username).toBe('testuser');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should create audit log for failed authentication', async () => {
      const req = mockRequest({
        body: { username: 'testuser' }
      });
      const res = mockResponse();
      res.statusCode = 401;
      const middleware = auditAuth('LOGIN');

      middleware(req, res, mockNext);
      res.json({ error: 'Invalid credentials' });

      // Wait for async audit log creation
      await new Promise(resolve => setTimeout(resolve, 100));

      const auditLogs = await AuditLog.findAll({
        where: { action: 'LOGIN', resource: 'AUTH', success: false }
      });

      expect(auditLogs.length).toBe(1);
      expect(auditLogs[0].success).toBe(false);
      expect(auditLogs[0].errorMessage).toBe('Invalid credentials');
    });
  });

  describe('logAudit', () => {
    it('should create manual audit log', async () => {
      await logAudit({
        userId: 'user-123',
        action: 'MANUAL_ACTION',
        resource: 'SYSTEM',
        resourceId: 'system-123',
        success: true,
        metadata: { custom: 'data' }
      });

      const auditLog = await AuditLog.findOne({
        where: { action: 'MANUAL_ACTION', resource: 'SYSTEM' }
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog.userId).toBe('user-123');
      expect(auditLog.resourceId).toBe('system-123');
      expect(auditLog.metadata.custom).toBe('data');
    });

    it('should create audit log with request context', async () => {
      const req = mockRequest();
      
      await logAudit({
        userId: 'user-123',
        action: 'CONTEXT_ACTION',
        resource: 'SYSTEM',
        success: true,
        req
      });

      const auditLog = await AuditLog.findOne({
        where: { action: 'CONTEXT_ACTION', resource: 'SYSTEM' }
      });

      expect(auditLog).toBeTruthy();
      expect(auditLog.ipAddress).toBe('127.0.0.1');
      expect(auditLog.userAgent).toBe('test-agent');
    });
  });

  describe('createAuditLog', () => {
    it('should handle audit log creation errors gracefully', async () => {
      // Mock console.error to verify error handling
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Try to create audit log with invalid data
      await createAuditLog({
        userId: 'invalid-uuid',
        action: null, // This should cause validation error
        resource: 'TEST'
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to create audit log:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});