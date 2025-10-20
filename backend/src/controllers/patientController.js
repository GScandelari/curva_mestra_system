const { Patient, Treatment, UsedProduct, Product, User, StockMovement } = require('../models');
const AuditService = require('../services/auditService');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Get all patients with filtering and pagination
 */
const getPatients = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search,
      isActive = 'true'
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Apply filters
    if (isActive !== 'all') {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: patients } = await Patient.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['name', 'ASC']]
    });

    res.json({
      patients,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar os pacientes'
    });
  }
};

/**
 * Get patient by ID
 */
const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findByPk(id, {
      include: [
        {
          model: Treatment,
          as: 'treatments',
          include: [
            {
              model: User,
              as: 'doctor',
              attributes: ['id', 'username']
            },
            {
              model: UsedProduct,
              as: 'usedProducts',
              include: [
                {
                  model: Product,
                  as: 'product',
                  attributes: ['id', 'name', 'unit']
                }
              ]
            }
          ]
        }
      ]
    });

    if (!patient) {
      return res.status(404).json({ 
        error: 'Paciente não encontrado',
        code: 'PATIENT_NOT_FOUND'
      });
    }

    res.json({ patient });
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar o paciente'
    });
  }
};

/**
 * Create new patient
 */
const createPatient = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      birthDate,
      address,
      medicalHistory
    } = req.body;

    // Check if email already exists (if provided)
    if (email) {
      const existingPatient = await Patient.findOne({ where: { email } });
      if (existingPatient) {
        return res.status(400).json({
          error: 'Email já cadastrado',
          message: 'Já existe um paciente com este email',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }
    }

    const patient = await Patient.create({
      name,
      email,
      phone,
      birthDate,
      address,
      medicalHistory
    });

    res.status(201).json({ 
      message: 'Paciente criado com sucesso',
      patient 
    });
  } catch (error) {
    console.error('Error creating patient:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível criar o paciente'
    });
  }
};

/**
 * Update patient
 */
const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      birthDate,
      address,
      medicalHistory,
      isActive
    } = req.body;

    const patient = await Patient.findByPk(id);

    if (!patient) {
      return res.status(404).json({ 
        error: 'Paciente não encontrado',
        code: 'PATIENT_NOT_FOUND'
      });
    }

    // Check if email already exists for another patient (if provided)
    if (email && email !== patient.email) {
      const existingPatient = await Patient.findOne({ 
        where: { 
          email,
          id: { [Op.ne]: id }
        } 
      });
      if (existingPatient) {
        return res.status(400).json({
          error: 'Email já cadastrado',
          message: 'Já existe outro paciente com este email',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }
    }

    await patient.update({
      name,
      email,
      phone,
      birthDate,
      address,
      medicalHistory,
      isActive
    });

    res.json({ 
      message: 'Paciente atualizado com sucesso',
      patient 
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível atualizar o paciente'
    });
  }
};

/**
 * Delete patient (soft delete by setting isActive to false)
 */
const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findByPk(id);

    if (!patient) {
      return res.status(404).json({ 
        error: 'Paciente não encontrado',
        code: 'PATIENT_NOT_FOUND'
      });
    }

    // Check if patient has treatments
    const treatmentCount = await Treatment.count({
      where: { patientId: id }
    });

    if (treatmentCount > 0) {
      // Soft delete - just deactivate
      await patient.update({ isActive: false });
      res.json({ 
        message: 'Paciente desativado com sucesso',
        note: 'Paciente possui tratamentos e foi desativado ao invés de excluído'
      });
    } else {
      // Hard delete if no treatments
      await patient.destroy();
      res.json({ message: 'Paciente excluído com sucesso' });
    }
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível excluir o paciente'
    });
  }
};

/**
 * Get patient consumption history
 */
const getPatientConsumption = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, startDate, endDate } = req.query;

    const patient = await Patient.findByPk(id);
    if (!patient) {
      return res.status(404).json({ 
        error: 'Paciente não encontrado',
        code: 'PATIENT_NOT_FOUND'
      });
    }

    const offset = (page - 1) * limit;
    const where = { patientId: id };

    // Apply date filters
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date[Op.gte] = new Date(startDate);
      if (endDate) where.date[Op.lte] = new Date(endDate);
    }

    const { count, rows: movements } = await StockMovement.findAndCountAll({
      where,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'unit', 'category']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['date', 'DESC']]
    });

    res.json({
      patient: {
        id: patient.id,
        name: patient.name
      },
      movements,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching patient consumption:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar o histórico de consumo'
    });
  }
};

/**
 * Get patient product usage report
 */
const getPatientProductReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const patient = await Patient.findByPk(id);
    if (!patient) {
      return res.status(404).json({ 
        error: 'Paciente não encontrado',
        code: 'PATIENT_NOT_FOUND'
      });
    }

    const where = { patientId: id };

    // Apply date filters
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date[Op.gte] = new Date(startDate);
      if (endDate) where.date[Op.lte] = new Date(endDate);
    }

    // Get aggregated product usage
    const productUsage = await StockMovement.findAll({
      where,
      attributes: [
        'productId',
        [sequelize.fn('SUM', sequelize.col('quantity')), 'totalQuantity'],
        [sequelize.fn('COUNT', sequelize.col('StockMovement.id')), 'usageCount']
      ],
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'unit', 'category']
        }
      ],
      group: ['productId', 'product.id'],
      order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']]
    });

    // Get treatment summary
    const treatmentWhere = { patientId: id };
    if (startDate || endDate) {
      treatmentWhere.date = {};
      if (startDate) treatmentWhere.date[Op.gte] = new Date(startDate);
      if (endDate) treatmentWhere.date[Op.lte] = new Date(endDate);
    }

    const treatments = await Treatment.findAll({
      where: treatmentWhere,
      include: [
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'username']
        },
        {
          model: UsedProduct,
          as: 'usedProducts',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'unit']
            }
          ]
        }
      ],
      order: [['date', 'DESC']]
    });

    res.json({
      patient: {
        id: patient.id,
        name: patient.name
      },
      reportPeriod: {
        startDate: startDate || null,
        endDate: endDate || null
      },
      productUsage,
      treatments,
      summary: {
        totalProducts: productUsage.length,
        totalTreatments: treatments.length,
        totalQuantityUsed: productUsage.reduce((sum, item) => 
          sum + parseInt(item.dataValues.totalQuantity), 0
        )
      }
    });
  } catch (error) {
    console.error('Error generating patient product report:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível gerar o relatório de produtos'
    });
  }
};

/**
 * Associate products to patient (create treatment record)
 */
const associateProducts = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const {
      procedure,
      doctorId,
      products, // Array of { productId, quantity, batchNumber }
      notes,
      treatmentDate
    } = req.body;

    const patient = await Patient.findByPk(id);
    if (!patient) {
      return res.status(404).json({ 
        error: 'Paciente não encontrado',
        code: 'PATIENT_NOT_FOUND'
      });
    }

    // Validate doctor exists
    const doctor = await User.findByPk(doctorId);
    if (!doctor) {
      return res.status(404).json({ 
        error: 'Médico não encontrado',
        code: 'DOCTOR_NOT_FOUND'
      });
    }

    // Create treatment record
    const treatment = await Treatment.create({
      patientId: id,
      date: treatmentDate || new Date(),
      procedure,
      doctorId,
      notes
    }, { transaction });

    // Process each product
    for (const productData of products) {
      const { productId, quantity, batchNumber } = productData;

      // Validate product exists and has sufficient stock
      const product = await Product.findByPk(productId);
      if (!product) {
        throw new Error(`Produto não encontrado: ${productId}`);
      }

      if (product.currentStock < quantity) {
        throw new Error(`Estoque insuficiente para ${product.name}. Disponível: ${product.currentStock}, solicitado: ${quantity}`);
      }

      if (product.isExpired) {
        throw new Error(`Produto vencido: ${product.name}`);
      }

      // Create used product record
      await UsedProduct.create({
        treatmentId: treatment.id,
        productId,
        quantity,
        batchNumber
      }, { transaction });

      // Update product stock
      await product.update({
        currentStock: product.currentStock - quantity
      }, { transaction });

      // Create stock movement
      const stockMovement = await StockMovement.create({
        productId,
        movementType: 'exit',
        quantity: -quantity,
        userId: req.user.id,
        patientId: id,
        notes: `Uso em tratamento: ${procedure}`
      }, { transaction });

      // Log stock movement audit
      await AuditService.logStockMovement({
        productId,
        movementType: 'exit',
        quantity: -quantity,
        userId: req.user.id,
        patientId: id,
        notes: `Uso em tratamento: ${procedure}`
      }, req);
    }

    await transaction.commit();

    // Fetch created treatment with associations
    const createdTreatment = await Treatment.findByPk(treatment.id, {
      include: [
        {
          model: User,
          as: 'doctor',
          attributes: ['id', 'username']
        },
        {
          model: UsedProduct,
          as: 'usedProducts',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'unit']
            }
          ]
        }
      ]
    });

    res.status(201).json({ 
      message: 'Produtos associados ao paciente com sucesso',
      treatment: createdTreatment
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error associating products to patient:', error);
    
    if (error.message.includes('não encontrado') || 
        error.message.includes('insuficiente') || 
        error.message.includes('vencido')) {
      return res.status(400).json({
        error: 'Erro de validação',
        message: error.message
      });
    }

    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível associar produtos ao paciente'
    });
  }
};

module.exports = {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientConsumption,
  getPatientProductReport,
  associateProducts
};