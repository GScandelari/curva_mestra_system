const request = require('supertest');
const express = require('express');
const { User } = require('../../src/models');
const { authenticate, authorize } = require('../../src/middleware/auth');
const { generateTokenPair } = require('../../src/utils/jwt');

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Test routes
  app.get('/protected', authenticate, (req, res) => {
    res.json({ user: req.user });
  });
  
  app.get('/admin-only', authenticate, authorize(['admin']), (req, res) => {
    res.json({ message: 'Admin access granted' });
  });
  
  app.get('/doctor-or-admin', authenticate, authorize(['admin', 'doctor']), (req, res) => {
    res.json({ message: 'Doctor or admin access granted' });
  });
  
  return app;
};

describe('Authentication Middleware', () => {
  let app;
  let testUser;
  let adminUser;
  let tokens;
  let adminTokens;

  beforeEach(async () => {
    app = createTestApp();
    
    // Create test users
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'password123',
      role: 'doctor'
    });

    adminUser = await User.create({
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: 'password123',
      role: 'admin'
    });

    tokens = generateTokenPair(testUser);
    adminTokens = generateTokenPair(adminUser);
  });

  describe('authenticate middleware', () => {
    it('should allow access with valid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      expect(response.body.user).toMatchObject({
        id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        role: testUser.role
      });
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/protected')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Token de acesso requerido',
        code: 'AUTH_001'
      });
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Token inválido',
        code: 'AUTH_001'
      });
    });

    it('should reject request with malformed authorization header', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Token de acesso requerido',
        code: 'AUTH_001'
      });
    });

    it('should reject request for inactive user', async () => {
      // Deactivate user
      await testUser.update({ isActive: false });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Usuário não encontrado ou inativo',
        code: 'AUTH_002'
      });
    });
  });

  describe('authorize middleware', () => {
    it('should allow access for correct role', async () => {
      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(response.body.message).toBe('Admin access granted');
    });

    it('should deny access for incorrect role', async () => {
      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Permissões insuficientes',
        code: 'AUTH_003'
      });
    });

    it('should allow access for multiple allowed roles', async () => {
      // Test with doctor role
      const doctorResponse = await request(app)
        .get('/doctor-or-admin')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      expect(doctorResponse.body.message).toBe('Doctor or admin access granted');

      // Test with admin role
      const adminResponse = await request(app)
        .get('/doctor-or-admin')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(adminResponse.body.message).toBe('Doctor or admin access granted');
    });

    it('should deny access without authentication', async () => {
      const response = await request(app)
        .get('/admin-only')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Token de acesso requerido',
        code: 'AUTH_001'
      });
    });
  });
});