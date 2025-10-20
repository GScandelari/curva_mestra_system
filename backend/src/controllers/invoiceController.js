const { Invoice, Product, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Get all invoices with filtering and pagination
 */
const getInvoices = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      supplier, 
      startDate, 
      endDate,
      search 
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Apply filters
    if (supplier) {
      where.supplier = { [Op.like]: `%${supplier}%` };
    }

    if (startDate && endDate) {
      where.receiptDate = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      where.receiptDate = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      where.receiptDate = {
        [Op.lte]: endDate
      };
    }

    if (search) {
      where[Op.or] = [
        { number: { [Op.like]: `%${search}%` } },
        { supplier: { [Op.like]: `%${search}%` } }
      ];
    }

    // Get invoices with associations
    const { count, rows: invoices } = await Invoice.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['receiptDate', 'DESC']]
    });

    res.json({
      invoices,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar as notas fiscais'
    });
  }
};

/**
 * Get invoice by ID
 */
const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({ 
        error: 'Nota fiscal não encontrada',
        code: 'INVOICE_NOT_FOUND'
      });
    }

    res.json({ invoice });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar a nota fiscal'
    });
  }
};

/**
 * Create new invoice
 */
const createInvoice = async (req, res) => {
  try {
    const {
      number,
      supplier,
      issueDate,
      receiptDate,
      totalValue
    } = req.body;

    // Check for duplicate invoice number
    const existingInvoice = await Invoice.findOne({
      where: { number }
    });

    if (existingInvoice) {
      return res.status(400).json({
        error: 'Número de nota fiscal já existe',
        message: `Nota fiscal com número ${number} já está cadastrada`,
        code: 'DUPLICATE_INVOICE_NUMBER'
      });
    }

    // Create invoice
    const invoice = await Invoice.create({
      number,
      supplier,
      issueDate,
      receiptDate,
      totalValue,
      userId: req.user.id
    });

    // Fetch created invoice with associations
    const createdInvoice = await Invoice.findByPk(invoice.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        }
      ]
    });

    res.status(201).json({ 
      message: 'Nota fiscal criada com sucesso',
      invoice: createdInvoice 
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        error: 'Número de nota fiscal já existe',
        code: 'DUPLICATE_INVOICE_NUMBER'
      });
    }

    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível criar a nota fiscal'
    });
  }
};

/**
 * Update invoice
 */
const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      number,
      supplier,
      issueDate,
      receiptDate,
      totalValue
    } = req.body;

    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({ 
        error: 'Nota fiscal não encontrada',
        code: 'INVOICE_NOT_FOUND'
      });
    }

    // Check for duplicate invoice number if number is being updated
    if (number && number !== invoice.number) {
      const existingInvoice = await Invoice.findOne({
        where: { 
          number,
          id: { [Op.ne]: id }
        }
      });

      if (existingInvoice) {
        return res.status(400).json({
          error: 'Número de nota fiscal já existe',
          message: `Nota fiscal com número ${number} já está cadastrada`,
          code: 'DUPLICATE_INVOICE_NUMBER'
        });
      }
    }

    // Update invoice
    await invoice.update({
      number,
      supplier,
      issueDate,
      receiptDate,
      totalValue
    });

    // Fetch updated invoice with associations
    const updatedInvoice = await Invoice.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        }
      ]
    });

    res.json({ 
      message: 'Nota fiscal atualizada com sucesso',
      invoice: updatedInvoice 
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        error: 'Número de nota fiscal já existe',
        code: 'DUPLICATE_INVOICE_NUMBER'
      });
    }

    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível atualizar a nota fiscal'
    });
  }
};

/**
 * Delete invoice
 */
const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({ 
        error: 'Nota fiscal não encontrada',
        code: 'INVOICE_NOT_FOUND'
      });
    }

    // Check if invoice has associated products
    const productCount = await Product.count({
      where: { invoiceNumber: invoice.number }
    });

    if (productCount > 0) {
      return res.status(400).json({
        error: 'Não é possível excluir nota fiscal com produtos associados',
        message: 'Esta nota fiscal possui produtos cadastrados e não pode ser excluída',
        code: 'INVOICE_HAS_PRODUCTS'
      });
    }

    await invoice.destroy();

    res.json({ message: 'Nota fiscal excluída com sucesso' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível excluir a nota fiscal'
    });
  }
};

/**
 * Get products associated with invoice
 */
const getInvoiceProducts = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({ 
        error: 'Nota fiscal não encontrada',
        code: 'INVOICE_NOT_FOUND'
      });
    }

    const products = await Product.findAll({
      where: { invoiceNumber: invoice.number },
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
      invoice: {
        id: invoice.id,
        number: invoice.number,
        supplier: invoice.supplier
      },
      products,
      totalProducts: products.length
    });
  } catch (error) {
    console.error('Error fetching invoice products:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível buscar produtos da nota fiscal'
    });
  }
};

/**
 * Generate purchase report by period
 */
const getPurchaseReport = async (req, res) => {
  try {
    const { startDate, endDate, supplier } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Período é obrigatório para o relatório',
        message: 'Informe as datas de início e fim do período'
      });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        error: 'Data inicial deve ser anterior à data final'
      });
    }

    const where = {
      receiptDate: {
        [Op.between]: [startDate, endDate]
      }
    };

    if (supplier) {
      where.supplier = { [Op.like]: `%${supplier}%` };
    }

    const invoices = await Invoice.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        }
      ],
      order: [['receiptDate', 'DESC']]
    });

    // Calculate summary
    const totalValue = invoices.reduce((sum, invoice) => {
      return sum + parseFloat(invoice.totalValue);
    }, 0);

    const suppliers = [...new Set(invoices.map(invoice => invoice.supplier))];

    const summary = {
      totalInvoices: invoices.length,
      totalValue: totalValue.toFixed(2),
      supplierCount: suppliers.length,
      period: {
        startDate,
        endDate
      }
    };

    res.json({
      invoices,
      summary,
      suppliers
    });
  } catch (error) {
    console.error('Error generating purchase report:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível gerar o relatório de compras'
    });
  }
};

module.exports = {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoiceProducts,
  getPurchaseReport
};