const request = require('supertest');
const express = require('express');
const { User } = require('../../src/models');
const authController = require('../../src/controllers/authController');
const { authenticate } = require('../../src/middleware/auth');
const { validate, loginSchema, refreshTokenSchema, changePasswordSchema } = require('../../src/utils/validation');
const { generateTokenPair } = require('../../src/utils/jwt');

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Auth routes
  app.post('/login', validate(loginSchema), authController.login);
  app.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);
  app.get('/profile', authenticate, authController.getProfile);
  app.put('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);
  app.post('/logout', authenticate, authController.logout);
  
  return app;
};

describe('Auth Controller', () => {
  let app;
  let testUser;

  beforeEach(async () => {
    app = createTestApp();
    
    // Create test user
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'password123',
      role: 'doctor'
    });
  });

  describe('POST /login', () => {
    it('should login with valid credentials (username)', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login realizado com sucesso');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toMatchObject({
        id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        role: testUser.role
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should login with valid credentials (email)', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          username: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should reject invalid username', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          username: 'nonexistent',
          password: 'password123'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Credenciais inválidas',
        code: 'AUTH_001'
      });
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Credenciais inválidas',
        code: 'AUTH_001'
      });
    });

    it('should reject inactive user', async () => {
      await testUser.update({ isActive: false });

      const response = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'password123'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Usuário inativo',
        code: 'AUTH_002'
      });
    });

    it('should validate input data', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          username: 'ab', // Too short
          password: '123' // Too short
        })
        .expect(400);

      expect(response.body.error).toBe('Dados de entrada inválidos');
      expect(response.body.details).toHaveLength(2);
    });
  });

  describe('POST /refresh', () => {
    let tokens;

    beforeEach(() => {
      tokens = generateTokenPair(testUser);
    });

    it('should refresh token with valid refresh token', async () => {
      const response = await request(app)
        .post('/refresh')
        .send({
          refreshToken: tokens.refreshToken
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Token renovado com sucesso');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/refresh')
        .send({
          refreshToken: 'invalid-token'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Refresh token inválido ou expirado',
        code: 'AUTH_002'
      });
    });

    it('should reject refresh token for inactive user', async () => {
      await testUser.update({ isActive: false });

      const response = await request(app)
        .post('/refresh')
        .send({
          refreshToken: tokens.refreshToken
        })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Usuário não encontrado ou inativo',
        code: 'AUTH_002'
      });
    });
  });

  describe('GET /profile', () => {
    let tokens;

    beforeEach(() => {
      tokens = generateTokenPair(testUser);
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/profile')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      expect(response.body.user).toMatchObject({
        id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        role: testUser.role
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/profile')
        .expect(401);

      expect(response.body.code).toBe('AUTH_001');
    });
  });

  describe('PUT /change-password', () => {
    let tokens;

    beforeEach(() => {
      tokens = generateTokenPair(testUser);
    });

    it('should change password with valid current password', async () => {
      const response = await request(app)
        .put('/change-password')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123'
        })
        .expect(200);

      expect(response.body.message).toBe('Senha alterada com sucesso');

      // Verify new password works
      const loginResponse = await request(app)
        .post('/login')
        .send({
          username: 'testuser',
          password: 'newpassword123'
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('accessToken');
    });

    it('should reject incorrect current password', async () => {
      const response = await request(app)
        .put('/change-password')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Senha atual incorreta',
        code: 'INVALID_PASSWORD'
      });
    });

    it('should validate input data', async () => {
      const response = await request(app)
        .put('/change-password')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: '123' // Too short
        })
        .expect(400);

      expect(response.body.error).toBe('Dados de entrada inválidos');
    });
  });

  describe('POST /logout', () => {
    let tokens;

    beforeEach(() => {
      tokens = generateTokenPair(testUser);
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      expect(response.body.message).toBe('Logout realizado com sucesso');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/logout')
        .expect(401);

      expect(response.body.code).toBe('AUTH_001');
    });
  });
});