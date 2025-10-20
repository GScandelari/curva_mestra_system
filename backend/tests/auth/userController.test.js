const request = require('supertest');
const express = require('express');
const { User } = require('../../src/models');
const userController = require('../../src/controllers/userController');
const { authenticate, authorize } = require('../../src/middleware/auth');
const { validate, createUserSchema } = require('../../src/utils/validation');
const { generateTokenPair } = require('../../src/utils/jwt');
const Joi = require('joi');

// Update user validation schema
const updateUserSchema = Joi.object({
  username: Joi.string().min(3).max(50),
  email: Joi.string().email(),
  role: Joi.string().valid('admin', 'doctor', 'receptionist', 'manager'),
  isActive: Joi.boolean()
}).min(1);

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // User management routes
  app.get('/users', authenticate, authorize(['admin']), userController.getAllUsers);
  app.get('/users/:id', authenticate, authorize(['admin']), userController.getUserById);
  app.post('/users', authenticate, authorize(['admin']), validate(createUserSchema), userController.createUser);
  app.put('/users/:id', authenticate, authorize(['admin']), validate(updateUserSchema), userController.updateUser);
  app.delete('/users/:id', authenticate, authorize(['admin']), userController.deleteUser);
  
  return app;
};

describe('User Controller', () => {
  let app;
  let adminUser;
  let testUser;
  let adminTokens;

  beforeEach(async () => {
    app = createTestApp();
    
    // Create admin user
    adminUser = await User.create({
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: 'password123',
      role: 'admin'
    });

    // Create test user
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'password123',
      role: 'doctor'
    });

    adminTokens = generateTokenPair(adminUser);
  });

  describe('GET /users', () => {
    it('should return all users for admin', async () => {
      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(response.body.users).toHaveLength(2);
      expect(response.body.pagination).toMatchObject({
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1
      });
    });

    it('should support pagination', async () => {
      // Create more users
      await User.create({
        username: 'user1',
        email: 'user1@example.com',
        passwordHash: 'password123',
        role: 'receptionist'
      });

      const response = await request(app)
        .get('/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(response.body.users).toHaveLength(2);
      expect(response.body.pagination.limit).toBe(2);
    });

    it('should support search by username', async () => {
      const response = await request(app)
        .get('/users?search=admin')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0].username).toBe('admin');
    });

    it('should support filtering by role', async () => {
      const response = await request(app)
        .get('/users?role=doctor')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0].role).toBe('doctor');
    });

    it('should deny access to non-admin users', async () => {
      const userTokens = generateTokenPair(testUser);

      const response = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(403);

      expect(response.body.code).toBe('AUTH_003');
    });
  });

  describe('GET /users/:id', () => {
    it('should return user by ID for admin', async () => {
      const response = await request(app)
        .get(`/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(response.body.user).toMatchObject({
        id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        role: testUser.role
      });
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/users/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(404);

      expect(response.body.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('POST /users', () => {
    it('should create new user for admin', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        role: 'receptionist'
      };

      const response = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .send(userData)
        .expect(201);

      expect(response.body.message).toBe('Usuário criado com sucesso');
      expect(response.body.user).toMatchObject({
        username: userData.username,
        email: userData.email,
        role: userData.role
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject duplicate username', async () => {
      const userData = {
        username: 'testuser', // Already exists
        email: 'different@example.com',
        password: 'password123',
        role: 'receptionist'
      };

      const response = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .send(userData)
        .expect(400);

      expect(response.body.code).toBe('USER_EXISTS');
    });

    it('should reject duplicate email', async () => {
      const userData = {
        username: 'differentuser',
        email: 'test@example.com', // Already exists
        password: 'password123',
        role: 'receptionist'
      };

      const response = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .send(userData)
        .expect(400);

      expect(response.body.code).toBe('USER_EXISTS');
    });

    it('should validate input data', async () => {
      const userData = {
        username: 'ab', // Too short
        email: 'invalid-email',
        password: '123', // Too short
        role: 'invalid-role'
      };

      const response = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .send(userData)
        .expect(400);

      expect(response.body.error).toBe('Dados de entrada inválidos');
    });
  });

  describe('PUT /users/:id', () => {
    it('should update user for admin', async () => {
      const updateData = {
        username: 'updateduser',
        role: 'manager'
      };

      const response = await request(app)
        .put(`/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Usuário atualizado com sucesso');
      expect(response.body.user.username).toBe('updateduser');
      expect(response.body.user.role).toBe('manager');
    });

    it('should reject duplicate username on update', async () => {
      const updateData = {
        username: 'admin' // Already exists
      };

      const response = await request(app)
        .put(`/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.code).toBe('USER_EXISTS');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .put('/users/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .send({ username: 'newname' })
        .expect(404);

      expect(response.body.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('DELETE /users/:id', () => {
    it('should deactivate user for admin', async () => {
      const response = await request(app)
        .delete(`/users/${testUser.id}`)
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(response.body.message).toBe('Usuário desativado com sucesso');

      // Verify user is deactivated
      const updatedUser = await User.findByPk(testUser.id);
      expect(updatedUser.isActive).toBe(false);
    });

    it('should prevent self-deletion', async () => {
      const response = await request(app)
        .delete(`/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(400);

      expect(response.body.code).toBe('CANNOT_DELETE_SELF');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .delete('/users/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(404);

      expect(response.body.code).toBe('USER_NOT_FOUND');
    });
  });
});