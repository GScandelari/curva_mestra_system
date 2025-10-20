const { StockMovement, Product, User, Patient, ProductRequest } = require('../models');
const { Op } = require('sequelize');
const { validateStockMovementQuery } = require('../utils/validation');

/**
 * Get all stock movements with filtering and pagination
 */
const getStockMovements = async (req, res) => {
  try {
    const { error, value } = validateStockMovementQuery(req.query);
    if (error) {
      return res.status(400).json({ 
        error: 'Parâmetros de consulta inválidos',
        details: error.details.map(d => d.message)
      });
    }

    const {
      page = 1,
      limit = 50,
      productId,
      userId,
      patientId,
      requestId,
      movementType,
      startDate,
      endDate,
      sortBy = 'date',
      sortOrder = 'DESC'
    } = value;

    // Build where clause
    const whereClause = {};

    if (productId) {
      whereClause.productId = productId;
    }

    if (userId) {
      whereClause.userId = userId;
    }

    if (patientId) {
      whereClause.patientId = patientId;
    }

    if (requestId) {
      whereClause.requestId = requestId;
    }

    if (movementType) {
      if (Array.isArray(movementType)) {
        whereClause.movementType = { [Op.in]: movementType };
      } else {
        whereClause.movementType = movementType;
      }
    }

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        whereClause.date[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.date[Op.lte] = new Date(endDate);
      }
    }

    // Calculate offset
    const offset = (page - 1) * limit;

    // Query stock movements
    const { count, rows } = await StockMovement.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'category', 'unit']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'role']
        },
        {
          model: Patient,
          as: 'patient',
          attributes: ['id', 'name'],
          required: false
        },
        {
          model: ProductRequest,
          as: 'request',
          attributes: ['id', 'status'],
          required: false
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      movements: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('Error fetching stock movements:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao buscar movimentações de estoque' 
    });
  }
};

/**
 * Get stock movement by ID
 */
const getStockMovementById = async (req, res) => {
  try {
    const { id } = req.params;

    const movement = await StockMovement.findByPk(id, {
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'category', 'unit', 'currentStock']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'role']
        },
        {
          model: Patient,
          as: 'patient',
          attributes: ['id', 'name', 'email'],
          required: false
        },
        {
          model: ProductRequest,
          as: 'request',
          attributes: ['id', 'status', 'requestDate'],
          required: false
        }
      ]
    });

    if (!movement) {
      return res.status(404).json({ 
        error: 'Movimentação de estoque não encontrada' 
      });
    }

    res.json(movement);

  } catch (error) {
    console.error('Error fetching stock movement:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao buscar movimentação de estoque' 
    });
  }
};

/**
 * Get stock movement statistics
 */
const getMovementStats = async (req, res) => {
  try {
    const { startDate, endDate, productId } = req.query;

    const whereClause = {};
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        whereClause.date[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.date[Op.lte] = new Date(endDate);
      }
    }

    if (productId) {
      whereClause.productId = productId;
    }

    // Get movement type statistics
    const movementTypeStats = await StockMovement.findAll({
      where: whereClause,
      attributes: [
        'movementType',
        [StockMovement.sequelize.fn('COUNT', StockMovement.sequelize.col('id')), 'count'],
        [StockMovement.sequelize.fn('SUM', StockMovement.sequelize.col('quantity')), 'totalQuantity']
      ],
      group: ['movementType']
    });

    // Get daily movement trends
    const dailyStats = await StockMovement.findAll({
      where: whereClause,
      attributes: [
        [StockMovement.sequelize.fn('DATE', StockMovement.sequelize.col('date')), 'date'],
        'movementType',
        [StockMovement.sequelize.fn('COUNT', StockMovement.sequelize.col('id')), 'count'],
        [StockMovement.sequelize.fn('SUM', StockMovement.sequelize.col('quantity')), 'totalQuantity']
      ],
      group: [
        StockMovement.sequelize.fn('DATE', StockMovement.sequelize.col('date')),
        'movementType'
      ],
      order: [[StockMovement.sequelize.fn('DATE', StockMovement.sequelize.col('date')), 'DESC']],
      limit: 30 // Last 30 days
    });

    // Get top products by movement volume
    const topProducts = await StockMovement.findAll({
      where: whereClause,
      attributes: [
        'productId',
        [StockMovement.sequelize.fn('COUNT', StockMovement.sequelize.col('StockMovement.id')), 'movementCount'],
        [StockMovement.sequelize.fn('SUM', StockMovement.sequelize.col('quantity')), 'totalQuantity']
      ],
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['name', 'category']
        }
      ],
      group: ['productId', 'product.id', 'product.name', 'product.category'],
      order: [[StockMovement.sequelize.fn('COUNT', StockMovement.sequelize.col('StockMovement.id')), 'DESC']],
      limit: 10
    });

    // Get user activity statistics
    const userStats = await StockMovement.findAll({
      where: whereClause,
      attributes: [
        'userId',
        [StockMovement.sequelize.fn('COUNT', StockMovement.sequelize.col('StockMovement.id')), 'movementCount']
      ],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['username', 'role']
        }
      ],
      group: ['userId', 'user.id', 'user.username', 'user.role'],
      order: [[StockMovement.sequelize.fn('COUNT', StockMovement.sequelize.col('StockMovement.id')), 'DESC']],
      limit: 10
    });

    res.json({
      movementTypeStats,
      dailyStats,
      topProducts,
      userStats
    });

  } catch (error) {
    console.error('Error fetching movement statistics:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao buscar estatísticas de movimentação' 
    });
  }
};

/**
 * Get movement history for a specific resource
 */
const getResourceMovements = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    let whereClause = {};
    let include = [
      {
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'category']
      },
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'role']
      }
    ];

    // Build where clause based on resource type
    switch (resourceType.toLowerCase()) {
      case 'product':
        whereClause.productId = resourceId;
        break;
      case 'user':
        whereClause.userId = resourceId;
        break;
      case 'patient':
        whereClause.patientId = resourceId;
        include.push({
          model: Patient,
          as: 'patient',
          attributes: ['id', 'name']
        });
        break;
      case 'request':
        whereClause.requestId = resourceId;
        include.push({
          model: ProductRequest,
          as: 'request',
          attributes: ['id', 'status']
        });
        break;
      default:
        return res.status(400).json({ 
          error: 'Tipo de recurso inválido. Use: product, user, patient, ou request' 
        });
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await StockMovement.findAndCountAll({
      where: whereClause,
      include,
      order: [['date', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      movements: rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching resource movements:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao buscar movimentações do recurso' 
    });
  }
};

module.exports = {
  getStockMovements,
  getStockMovementById,
  getMovementStats,
  getResourceMovements
};