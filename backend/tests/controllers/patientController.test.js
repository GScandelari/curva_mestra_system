const request = require('supertest');
const app = require('../../src/server');
const { Patient, User, Treatment, UsedProduct, Product, StockMovement } = require('../../src/models');
const jwt = require('jsonwebtoken');

describe('Patient Controller', () => {
  let authToken;
  let testUser;
  let testPatient;
  let testProduct;

  beforeAll(async () => {
    // Create test user
    testUser = await User.create({
      username: 'testadmin',
      email: 'admin@test.com',
      passwordHash: 'password123',
      role: 'admin'
    });

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser.id, role: testUser.role },
      process.env.JWT_SECRET || 'test-secret'
    );

    // Create test product
    testProduct = await Product.create({
      name: 'Test Product',
      category: 'Test Category',
      unit: 'ml',
      minimumStock: 10,
      currentStock: 100,
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      invoiceNumber: 'TEST-001',
      entryUserId: testUser.id
    });
  });

  beforeEach(async () => {
    // Create fresh test patient for each test
    testPatient = await Patient.create({
      name: 'Test Patient',
      email: 'patient@test.com',
      phone: '(11) 99999-9999',
      birthDate: '1990-01-01',
      address: {
        street: 'Test Street, 123',
        city: 'Test City',
        zipCode: '12345-678'
      }
    });
  });

  afterEach(async () => {
    // Clean up test data
    await StockMovement.destroy({ where: {} });
    await UsedProduct.destroy({ where: {} });
    await Treatment.destroy({ where: {} });
    await Patient.destroy({ where: {} });
  });

  afterAll(async () => {
    await Product.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  describe('GET /api/patients', () => {
    test('should get all patients with pagination', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.patients).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.patients.length).toBeGreaterThan(0);
    });

    test('should filter patients by search term', async () => {
      const response = await request(app)
        .get('/api/patients?search=Test Patient')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.patients).toBeDefined();
      expect(response.body.patients.some(p => p.name.includes('Test Patient'))).toBe(true);
    });

    test('should filter active patients only', async () => {
      // Create inactive patient
      await Patient.create({
        name: 'Inactive Patient',
        isActive: false
      });

      const response = await request(app)
        .get('/api/patients?isActive=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.patients.every(p => p.isActive === true)).toBe(true);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/patients')
        .expect(401);
    });
  });

  describe('GET /api/patients/:id', () => {
    test('should get patient by ID with treatments', async () => {
      const response = await request(app)
        .get(`/api/patients/${testPatient.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.patient).toBeDefined();
      expect(response.body.patient.id).toBe(testPatient.id);
      expect(response.body.patient.name).toBe('Test Patient');
      expect(response.body.patient.treatments).toBeDefined();
    });

    test('should return 404 for non-existent patient', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      await request(app)
        .get(`/api/patients/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    test('should require authentication', async () => {
      await request(app)
        .get(`/api/patients/${testPatient.id}`)
        .expect(401);
    });
  });

  describe('POST /api/patients', () => {
    test('should create new patient with valid data', async () => {
      const patientData = {
        name: 'New Patient',
        email: 'newpatient@test.com',
        phone: '(11) 88888-8888',
        birthDate: '1985-05-15',
        address: {
          street: 'New Street, 456',
          city: 'New City',
          zipCode: '98765-432'
        },
        medicalHistory: 'No known allergies'
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(201);

      expect(response.body.message).toBe('Paciente criado com sucesso');
      expect(response.body.patient).toBeDefined();
      expect(response.body.patient.name).toBe('New Patient');
      expect(response.body.patient.email).toBe('newpatient@test.com');
    });

    test('should create patient with minimal data', async () => {
      const patientData = {
        name: 'Minimal Patient'
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(201);

      expect(response.body.patient.name).toBe('Minimal Patient');
      expect(response.body.patient.isActive).toBe(true);
    });

    test('should validate required fields', async () => {
      const patientData = {
        email: 'test@test.com'
        // Missing required name
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(400);

      expect(response.body.error).toBe('Dados inválidos');
    });

    test('should validate email format', async () => {
      const patientData = {
        name: 'Test Patient',
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(400);

      expect(response.body.error).toBe('Dados inválidos');
    });

    test('should prevent duplicate email', async () => {
      const patientData = {
        name: 'Duplicate Email Patient',
        email: testPatient.email
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(patientData)
        .expect(400);

      expect(response.body.error).toBe('Email já cadastrado');
    });

    test('should require appropriate role', async () => {
      // Create user with insufficient permissions - doctor can create patients, so use a different role
      const limitedUser = await User.create({
        username: 'limiteduser',
        email: 'limited@test.com',
        passwordHash: 'password123',
        role: 'doctor' // Doctor can create patients according to routes
      });

      const limitedToken = jwt.sign(
        { id: limitedUser.id, role: limitedUser.role },
        process.env.JWT_SECRET || 'test-secret'
      );

      const patientData = {
        name: 'Authorized Patient'
      };

      // Doctor should be able to create patients, so this should succeed
      await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${limitedToken}`)
        .send(patientData)
        .expect(403); // Actually, doctor is not in the allowed roles, so this should fail

      await limitedUser.destroy();
    });
  });

  describe('PUT /api/patients/:id', () => {
    test('should update patient with valid data', async () => {
      const updateData = {
        name: 'Updated Patient Name',
        phone: '(11) 77777-7777',
        medicalHistory: 'Updated medical history'
      };

      const response = await request(app)
        .put(`/api/patients/${testPatient.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.message).toBe('Paciente atualizado com sucesso');
      expect(response.body.patient.name).toBe('Updated Patient Name');
      expect(response.body.patient.phone).toBe('(11) 77777-7777');
    });

    test('should validate email uniqueness on update', async () => {
      // Create another patient
      const anotherPatient = await Patient.create({
        name: 'Another Patient',
        email: 'another@test.com'
      });

      const updateData = {
        email: anotherPatient.email
      };

      const response = await request(app)
        .put(`/api/patients/${testPatient.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error).toBe('Email já cadastrado');

      await anotherPatient.destroy();
    });

    test('should return 404 for non-existent patient', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      await request(app)
        .put(`/api/patients/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Name' })
        .expect(404);
    });
  });

  describe('DELETE /api/patients/:id', () => {
    test('should delete patient without treatments', async () => {
      const response = await request(app)
        .delete(`/api/patients/${testPatient.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Paciente excluído com sucesso');

      // Verify patient is deleted
      const deletedPatient = await Patient.findByPk(testPatient.id);
      expect(deletedPatient).toBeNull();
    });

    test('should soft delete patient with treatments', async () => {
      // Create treatment for patient
      await Treatment.create({
        patientId: testPatient.id,
        date: new Date(),
        procedure: 'Test Procedure',
        doctorId: testUser.id
      });

      const response = await request(app)
        .delete(`/api/patients/${testPatient.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Paciente desativado com sucesso');

      // Verify patient is deactivated, not deleted
      const deactivatedPatient = await Patient.findByPk(testPatient.id);
      expect(deactivatedPatient).not.toBeNull();
      expect(deactivatedPatient.isActive).toBe(false);
    });

    test('should require admin or manager role', async () => {
      // Create user with insufficient permissions
      const doctorUser = await User.create({
        username: 'doctoruser',
        email: 'doctor2@test.com',
        passwordHash: 'password123',
        role: 'doctor'
      });

      const doctorToken = jwt.sign(
        { id: doctorUser.id, role: doctorUser.role },
        process.env.JWT_SECRET || 'test-secret'
      );

      await request(app)
        .delete(`/api/patients/${testPatient.id}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(403);

      await doctorUser.destroy();
    });
  });

  describe('GET /api/patients/:id/consumption', () => {
    test('should get patient consumption history', async () => {
      // Create stock movement for patient
      await StockMovement.create({
        productId: testProduct.id,
        movementType: 'exit',
        quantity: -5,
        userId: testUser.id,
        patientId: testPatient.id,
        notes: 'Test consumption'
      });

      const response = await request(app)
        .get(`/api/patients/${testPatient.id}/consumption`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.patient).toBeDefined();
      expect(response.body.movements).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.movements.length).toBeGreaterThan(0);
    });

    test('should filter consumption by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      const response = await request(app)
        .get(`/api/patients/${testPatient.id}/consumption?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.movements).toBeDefined();
    });
  });

  describe('GET /api/patients/:id/report', () => {
    test('should generate patient product usage report', async () => {
      // Create treatment and used products
      const treatment = await Treatment.create({
        patientId: testPatient.id,
        date: new Date(),
        procedure: 'Test Procedure',
        doctorId: testUser.id
      });

      await UsedProduct.create({
        treatmentId: treatment.id,
        productId: testProduct.id,
        quantity: 3
      });

      const response = await request(app)
        .get(`/api/patients/${testPatient.id}/report`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.patient).toBeDefined();
      expect(response.body.productUsage).toBeDefined();
      expect(response.body.treatments).toBeDefined();
      expect(response.body.summary).toBeDefined();
    });
  });

  describe('POST /api/patients/:id/associate-products', () => {
    test('should associate products to patient', async () => {
      const associationData = {
        procedure: 'Test Treatment',
        doctorId: testUser.id,
        products: [
          {
            productId: testProduct.id,
            quantity: 2,
            batchNumber: 'BATCH001'
          }
        ],
        notes: 'Test treatment notes'
      };

      const response = await request(app)
        .post(`/api/patients/${testPatient.id}/associate-products`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(associationData)
        .expect(201);

      expect(response.body.message).toBe('Produtos associados ao paciente com sucesso');
      expect(response.body.treatment).toBeDefined();
      expect(response.body.treatment.procedure).toBe('Test Treatment');

      // Verify stock was updated
      const updatedProduct = await Product.findByPk(testProduct.id);
      expect(updatedProduct.currentStock).toBe(98); // 100 - 2
    });

    test('should validate sufficient stock', async () => {
      const associationData = {
        procedure: 'Test Treatment',
        doctorId: testUser.id,
        products: [
          {
            productId: testProduct.id,
            quantity: 200 // More than available stock
          }
        ]
      };

      const response = await request(app)
        .post(`/api/patients/${testPatient.id}/associate-products`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(associationData)
        .expect(400);

      expect(response.body.error).toBe('Erro de validação');
      expect(response.body.message).toContain('Estoque insuficiente');
    });

    test('should validate doctor exists', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      const associationData = {
        procedure: 'Test Treatment',
        doctorId: fakeId,
        products: [
          {
            productId: testProduct.id,
            quantity: 1
          }
        ]
      };

      const response = await request(app)
        .post(`/api/patients/${testPatient.id}/associate-products`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(associationData)
        .expect(404);

      expect(response.body.error).toBe('Médico não encontrado');
    });

    test('should require appropriate role', async () => {
      // Create user with insufficient permissions
      const receptionistUser = await User.create({
        username: 'receptionist',
        email: 'receptionist@test.com',
        passwordHash: 'password123',
        role: 'receptionist'
      });

      const receptionistToken = jwt.sign(
        { id: receptionistUser.id, role: receptionistUser.role },
        process.env.JWT_SECRET || 'test-secret'
      );

      const associationData = {
        procedure: 'Test Treatment',
        doctorId: testUser.id,
        products: [
          {
            productId: testProduct.id,
            quantity: 1
          }
        ]
      };

      await request(app)
        .post(`/api/patients/${testPatient.id}/associate-products`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send(associationData)
        .expect(403);

      await receptionistUser.destroy();
    });
  });
});