const { Product, StockMovement, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const AlertService = require('../services/alertService');
const AuditService = require('../services/auditService');

/**
 * Get all products with filtering and pagination
 */
const getProducts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      category, 
      invoiceNumber, 
      lowStock, 
      expiringSoon,
      search 
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Apply filters
    if (category) {
      where.category = category;
    }

    if (invoiceNumber) {
      where.invoiceNumber = invoiceNumber;
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    // Get products with associations
    const { count, rows: products } = await Product.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'entryUser',
          attributes: ['id', 'username']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    // Apply virtual field filters after query
    let filteredProducts = products;
    
    if (lowStock === 'true') {
      filteredProducts = filteredProducts.filter(p => p.isLowStock);
    }

    if (expiringSoon === 'true') {
      filteredProducts = filteredProducts.filter(p => 
        p.daysToExpiration <= 30 && p.daysToExpiration > 0
      );
    }

    res.json({
      products: filteredProducts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar os produtos'
    });
  }
};/*
*
 * Get product by ID
 */
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, {
      include: [
        {
          model: User,
          as: 'entryUser',
          attributes: ['id', 'username']
        }
      ]
    });

    if (!product) {
      return res.status(404).json({ 
        error: 'Produto não encontrado',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    res.json({ product });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar o produto'
    });
  }
};

/**
 * Create new product
 */
const createProduct = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const {
      name,
      description,
      category,
      unit,
      minimumStock,
      quantity,
      expirationDate,
      invoiceNumber
    } = req.body;

    // Create product
    const product = await Product.create({
      name,
      description,
      category,
      unit,
      minimumStock,
      currentStock: quantity,
      expirationDate,
      invoiceNumber,
      entryUserId: req.user.id
    }, { transaction });

    // Create stock movement for initial entry
    const stockMovement = await StockMovement.create({
      productId: product.id,
      movementType: 'entry',
      quantity: quantity,
      userId: req.user.id,
      notes: `Entrada inicial - Nota Fiscal: ${invoiceNumber}`
    }, { transaction });

    // Log stock movement audit
    await AuditService.logStockMovement({
      productId: product.id,
      movementType: 'entry',
      quantity: quantity,
      userId: req.user.id,
      notes: `Entrada inicial - Nota Fiscal: ${invoiceNumber}`
    }, req);

    await transaction.commit();

    // Fetch created product with associations
    const createdProduct = await Product.findByPk(product.id, {
      include: [
        {
          model: User,
          as: 'entryUser',
          attributes: ['id', 'username']
        }
      ]
    });

    res.status(201).json({ 
      message: 'Produto criado com sucesso',
      product: createdProduct 
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating product:', error);
    
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
      message: 'Não foi possível criar o produto'
    });
  }
};/**
 
* Update product
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category,
      unit,
      minimumStock,
      expirationDate
    } = req.body;

    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({ 
        error: 'Produto não encontrado',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    // Update product (excluding stock-related fields)
    await product.update({
      name,
      description,
      category,
      unit,
      minimumStock,
      expirationDate
    });

    // Fetch updated product with associations
    const updatedProduct = await Product.findByPk(id, {
      include: [
        {
          model: User,
          as: 'entryUser',
          attributes: ['id', 'username']
        }
      ]
    });

    res.json({ 
      message: 'Produto atualizado com sucesso',
      product: updatedProduct 
    });
  } catch (error) {
    console.error('Error updating product:', error);
    
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
      message: 'Não foi possível atualizar o produto'
    });
  }
};

/**
 * Delete product
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({ 
        error: 'Produto não encontrado',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    // Check if product has stock movements
    const movementCount = await StockMovement.count({
      where: { productId: id }
    });

    if (movementCount > 1) { // More than initial entry
      return res.status(400).json({
        error: 'Não é possível excluir produto com movimentações',
        message: 'Este produto possui movimentações de estoque e não pode ser excluído'
      });
    }

    await product.destroy();

    res.json({ message: 'Produto excluído com sucesso' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível excluir o produto'
    });
  }
};/*
*
 * Get products by invoice number
 */
const getProductsByInvoice = async (req, res) => {
  try {
    const { invoiceNumber } = req.params;

    const products = await Product.findAll({
      where: { invoiceNumber },
      include: [
        {
          model: User,
          as: 'entryUser',
          attributes: ['id', 'username']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({ 
      invoiceNumber,
      products,
      count: products.length
    });
  } catch (error) {
    console.error('Error fetching products by invoice:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar produtos da nota fiscal'
    });
  }
};

/**
 * Adjust product stock
 */
const adjustStock = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { quantity, movementType, notes, patientId } = req.body;

    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({ 
        error: 'Produto não encontrado',
        code: 'PRODUCT_NOT_FOUND'
      });
    }

    // Validate movement type and quantity
    if (movementType === 'exit' && product.currentStock < Math.abs(quantity)) {
      return res.status(400).json({
        error: 'Estoque insuficiente',
        message: `Estoque atual: ${product.currentStock}, solicitado: ${Math.abs(quantity)}`,
        code: 'INSUFFICIENT_STOCK'
      });
    }

    // Check if product is expired for exit movements
    if (movementType === 'exit' && product.isExpired) {
      return res.status(400).json({
        error: 'Produto vencido',
        message: 'Não é possível retirar produto vencido do estoque',
        code: 'PRODUCT_EXPIRED'
      });
    }

    // Calculate new stock
    let newStock = product.currentStock;
    const adjustmentQuantity = movementType === 'exit' ? -Math.abs(quantity) : Math.abs(quantity);
    newStock += adjustmentQuantity;

    // Update product stock
    await product.update({ currentStock: newStock }, { transaction });

    // Create stock movement
    const stockMovement = await StockMovement.create({
      productId: id,
      movementType,
      quantity: adjustmentQuantity,
      userId: req.user.id,
      patientId,
      notes
    }, { transaction });

    // Log stock movement audit
    await AuditService.logStockMovement({
      productId: id,
      movementType,
      quantity: adjustmentQuantity,
      userId: req.user.id,
      patientId,
      notes
    }, req);

    await transaction.commit();

    // Fetch updated product
    const updatedProduct = await Product.findByPk(id, {
      include: [
        {
          model: User,
          as: 'entryUser',
          attributes: ['id', 'username']
        }
      ]
    });

    res.json({ 
      message: 'Estoque ajustado com sucesso',
      product: updatedProduct 
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error adjusting stock:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível ajustar o estoque'
    });
  }
};/**
 
* Get products expiring soon (within 30 days)
 */
const getExpiringProducts = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const products = await Product.findAll({
      where: {
        expirationDate: {
          [Op.between]: [new Date(), futureDate]
        },
        currentStock: {
          [Op.gt]: 0
        }
      },
      include: [
        {
          model: User,
          as: 'entryUser',
          attributes: ['id', 'username']
        }
      ],
      order: [['expirationDate', 'ASC']]
    });

    res.json({ 
      products,
      count: products.length,
      daysFilter: parseInt(days)
    });
  } catch (error) {
    console.error('Error fetching expiring products:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar produtos próximos ao vencimento'
    });
  }
};

/**
 * Get low stock products
 */
const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: sequelize.where(
        sequelize.col('current_stock'),
        Op.lte,
        sequelize.col('minimum_stock')
      ),
      include: [
        {
          model: User,
          as: 'entryUser',
          attributes: ['id', 'username']
        }
      ],
      order: [['currentStock', 'ASC']]
    });

    res.json({ 
      products,
      count: products.length
    });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar produtos com estoque baixo'
    });
  }
};

/**
 * Get product stock movements
 */
const getProductMovements = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    const { count, rows: movements } = await StockMovement.findAndCountAll({
      where: { productId: id },
      include: [
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
      movements,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching product movements:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar movimentações do produto'
    });
  }
};

/**
 * Get active alerts
 */
const getAlerts = async (req, res) => {
  try {
    const alerts = await AlertService.getActiveAlerts();
    res.json({ alerts });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar os alertas'
    });
  }
};

/**
 * Get alert summary
 */
const getAlertSummary = async (req, res) => {
  try {
    const summary = await AlertService.getAlertSummary();
    res.json({ summary });
  } catch (error) {
    console.error('Error fetching alert summary:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar o resumo de alertas'
    });
  }
};

/**
 * Get product statistics for dashboard
 */
const getProductStats = async (req, res) => {
  try {
    // Get total products count
    const totalProducts = await Product.count();

    // Get low stock products count
    const lowStockProducts = await Product.count({
      where: sequelize.where(
        sequelize.col('current_stock'),
        Op.lte,
        sequelize.col('minimum_stock')
      )
    });

    // Get expiring products count (next 30 days)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const expiringProducts = await Product.count({
      where: {
        expirationDate: {
          [Op.between]: [new Date(), futureDate]
        },
        currentStock: {
          [Op.gt]: 0
        }
      }
    });

    // Get expired products count
    const expiredProducts = await Product.count({
      where: {
        expirationDate: {
          [Op.lt]: new Date()
        },
        currentStock: {
          [Op.gt]: 0
        }
      }
    });

    // Calculate total inventory value
    const products = await Product.findAll({
      attributes: ['currentStock'],
      include: [
        {
          model: StockMovement,
          as: 'movements',
          where: { movementType: 'entry' },
          attributes: ['quantity'],
          required: false,
          separate: true,
          order: [['date', 'DESC']],
          limit: 1
        }
      ]
    });

    // For simplicity, we'll estimate value based on recent entries
    // In a real system, you'd want to track unit costs properly
    const totalValue = products.reduce((sum, product) => {
      return sum + (product.currentStock * 10); // Placeholder calculation
    }, 0);

    // Get category distribution
    const categoryStats = await Product.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('current_stock')), 'totalStock']
      ],
      group: ['category'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']]
    });

    res.json({
      totalProducts,
      lowStockProducts,
      expiringProducts,
      expiredProducts,
      totalValue,
      categoryStats: categoryStats.map(stat => ({
        category: stat.category,
        count: parseInt(stat.dataValues.count),
        totalStock: parseInt(stat.dataValues.totalStock) || 0
      }))
    });
  } catch (error) {
    console.error('Error fetching product stats:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar estatísticas dos produtos'
    });
  }
};

/**
 * Get stock movement trends for dashboard charts
 */
const getStockMovementTrends = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Get daily movement trends
    const dailyTrends = await StockMovement.findAll({
      where: {
        date: {
          [Op.gte]: startDate
        }
      },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('date')), 'date'],
        'movementType',
        [sequelize.fn('SUM', sequelize.fn('ABS', sequelize.col('quantity'))), 'totalQuantity'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'movementCount']
      ],
      group: [
        sequelize.fn('DATE', sequelize.col('date')),
        'movementType'
      ],
      order: [[sequelize.fn('DATE', sequelize.col('date')), 'ASC']]
    });

    // Get top consumed products
    const topConsumedProducts = await StockMovement.findAll({
      where: {
        movementType: 'exit',
        date: {
          [Op.gte]: startDate
        }
      },
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'category', 'unit']
        }
      ],
      attributes: [
        'productId',
        [sequelize.fn('SUM', sequelize.fn('ABS', sequelize.col('quantity'))), 'totalConsumed']
      ],
      group: ['productId', 'product.id'],
      order: [[sequelize.fn('SUM', sequelize.fn('ABS', sequelize.col('quantity'))), 'DESC']],
      limit: 10
    });

    res.json({
      dailyTrends: dailyTrends.map(trend => ({
        date: trend.dataValues.date,
        movementType: trend.movementType,
        totalQuantity: parseInt(trend.dataValues.totalQuantity),
        movementCount: parseInt(trend.dataValues.movementCount)
      })),
      topConsumedProducts: topConsumedProducts.map(item => ({
        product: item.product,
        totalConsumed: parseInt(item.dataValues.totalConsumed)
      }))
    });
  } catch (error) {
    console.error('Error fetching stock movement trends:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar tendências de movimentação'
    });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByInvoice,
  adjustStock,
  getExpiringProducts,
  getLowStockProducts,
  getProductMovements,
  getAlerts,
  getAlertSummary,
  getProductStats,
  getStockMovementTrends
};