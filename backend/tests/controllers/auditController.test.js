const request = require('supertest');
const app = require('../../src/server');
const { sequelize, AuditLog, User } = require('../../src/models');
const { generateToken } = require('../../src/utils/jwt');

describe('Audit Controller', () => {
  let adminUser, managerUser, doctorUser;
  let adminToken, managerToken, doctorToken;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    // Create test users
    adminUser = await User.create({
      username: 'admin_audit',
      email: 'admin_audit@test.com',
      password: 'password123',
      role: 'admin'
    });

    managerUser = await User.create({
      username: 'manager_audit',
      email: 'manager_audit@test.com',
      password: 'password123',
      role: 'manager'
    });

    doctorUser = await User.create({
      username: 'doctor_audit',
      email: 'doctor_audit@test.com',
      password: 'password123',
      role: 'doctor'
    });

    // Generate tokens
    adminToken = generateToken({ id: adminUser.id, role: adminUser.role });
    managerToken = generateToken({ id: managerUser.id, role: managerUser.role });
    doctorToken = generateToken({ id: doctorUser.id, role: doctorUser.role });

    // Create some test audit logs
    await AuditLog.bulkCreate([
      {
        userId: adminUser.id,
        action: 'CREATE',
        resource: 'PRODUCT',
        resourceId: '123e4567-e89b-12d3-a456-426614174000',
        success: true,
        timestamp: new Date('2024-01-01T10:00:00Z')
      },
      {
        userId: managerUser.id,
        action: 'UPDATE',
        resource: 'PATIENT',
        resourceId: '123e4567-e89b-12d3-a456-426614174001',
        success: true,
        timestamp: new Date('2024-01-01T11:00:00Z')
      },
      {
        userId: doctorUser.id,
        action: 'LOGIN',
        resource: 'AUTH',
        success: false,
        errorMessage: 'Invalid credentials',
        timestamp: new Date('2024-01-01T12:00:00Z')
      }
    ]);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('GET /api/audit/logs', () => {
    it('should get audit logs for admin user', async () => {
      const response = await request(app)
        .get('/api/audit/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('auditLogs');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.auditLogs)).toBe(true);
      expect(response.body.auditLogs.length).toBeGreaterThan(0);
    });

    it('should get audit logs for manager user', async () => {
      const response = await request(app)
        .get('/api/audit/logs')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('auditLogs');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should deny access for doctor user', async () => {
      await request(app)
        .get('/api/audit/logs')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(403);
    });

    it('should filter audit logs by action', async () => {
      const response = await request(app)
        .get('/api/audit/logs?action=CREATE')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.auditLogs.every(log => log.action === 'CREATE')).toBe(true);
    });

    it('should filter audit logs by resource', async () => {
      const response = await request(app)
        .get('/api/audit/logs?resource=PRODUCT')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.auditLogs.every(log => log.resource === 'PRODUCT')).toBe(true);
    });

    it('should filter audit logs by success status', async () => {
      const response = await request(app)
        .get('/api/audit/logs?success=false')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.auditLogs.every(log => log.success === false)).toBe(true);
    });

    it('should paginate audit logs', async () => {
      const response = await request(app)
        .get('/api/audit/logs?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.auditLogs.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.itemsPerPage).toBe(2);
    });
  });

  describe('GET /api/audit/stats', () => {
    it('should get audit statistics for admin user', async () => {
      const response = await request(app)
        .get('/api/audit/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('actionStats');
      expect(response.body).toHaveProperty('resourceStats');
      expect(response.body).toHaveProperty('successStats');
      expect(response.body).toHaveProperty('userStats');
      expect(Array.isArray(response.body.actionStats)).toBe(true);
    });

    it('should deny access for doctor user', async () => {
      await request(app)
        .get('/api/audit/stats')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(403);
    });
  });

  describe('GET /api/audit/users/:userId/activity', () => {
    it('should get user activity for admin user', async () => {
      const response = await request(app)
        .get(`/api/audit/users/${adminUser.id}/activity`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('activities');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.activities)).toBe(true);
    });

    it('should deny access for doctor user', async () => {
      await request(app)
        .get(`/api/audit/users/${adminUser.id}/activity`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(403);
    });
  });

  describe('GET /api/audit/backup/status', () => {
    it('should get backup status for admin user', async () => {
      const response = await request(app)
        .get('/api/audit/backup/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('isRunning');
      expect(response.body).toHaveProperty('backupInterval');
      expect(response.body).toHaveProperty('backupDirectory');
    });

    it('should get backup status for manager user', async () => {
      const response = await request(app)
        .get('/api/audit/backup/status')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('isRunning');
    });

    it('should deny access for doctor user', async () => {
      await request(app)
        .get('/api/audit/backup/status')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(403);
    });
  });

  describe('POST /api/audit/backup', () => {
    it('should trigger manual backup for admin user', async () => {
      const response = await request(app)
        .post('/api/audit/backup')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should deny access for manager user', async () => {
      await request(app)
        .post('/api/audit/backup')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(403);
    });

    it('should deny access for doctor user', async () => {
      await request(app)
        .post('/api/audit/backup')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(403);
    });
  });

  describe('Authentication required', () => {
    it('should require authentication for all audit endpoints', async () => {
      await request(app)
        .get('/api/audit/logs')
        .expect(401);

      await request(app)
        .get('/api/audit/stats')
        .expect(401);

      await request(app)
        .post('/api/audit/backup')
        .expect(401);
    });
  });
});