const { Product, StockMovement, ProductRequest, Patient, Invoice, User } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// Optional dependencies for report generation
let ExcelJS, PDFDocument;
try {
  ExcelJS = require('exceljs');
  PDFDocument = require('pdfkit');
} catch (error) {
  console.warn('Report generation dependencies not installed. Excel and PDF export will not be available.');
}

/**
 * Generate expiration report
 */
const getExpirationReport = async (req, res) => {
  try {
    const { days = 30, format = 'json' } = req.query;
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

    const reportData = {
      title: 'Relatório de Produtos Próximos ao Vencimento',
      generatedAt: new Date(),
      period: `Próximos ${days} dias`,
      totalProducts: products.length,
      products: products.map(product => ({
        id: product.id,
        name: product.name,
        category: product.category,
        currentStock: product.currentStock,
        unit: product.unit,
        expirationDate: product.expirationDate,
        daysToExpiration: Math.ceil((new Date(product.expirationDate) - new Date()) / (1000 * 60 * 60 * 24)),
        invoiceNumber: product.invoiceNumber,
        entryUser: product.entryUser?.username
      }))
    };

    if (format === 'excel') {
      if (!ExcelJS) {
        return res.status(400).json({ error: 'Excel export não disponível. Dependências não instaladas.' });
      }
      return await generateExcelReport(res, reportData, 'expiration');
    } else if (format === 'pdf') {
      if (!PDFDocument) {
        return res.status(400).json({ error: 'PDF export não disponível. Dependências não instaladas.' });
      }
      return await generatePDFReport(res, reportData, 'expiration');
    }

    res.json(reportData);
  } catch (error) {
    console.error('Error generating expiration report:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível gerar o relatório de vencimentos'
    });
  }
};

/**
 * Generate requests report by period
 */
const getRequestsReport = async (req, res) => {
  try {
    const { startDate, endDate, status, format = 'json' } = req.query;
    
    const whereClause = {};
    
    if (startDate && endDate) {
      whereClause.requestDate = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    
    if (status) {
      whereClause.status = status;
    }

    const requests = await ProductRequest.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'requester',
          attributes: ['id', 'username', 'role']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'username'],
          required: false
        },
        {
          model: Patient,
          as: 'patient',
          attributes: ['id', 'name'],
          required: false
        }
      ],
      order: [['requestDate', 'DESC']]
    });

    // Get status summary
    const statusSummary = await ProductRequest.findAll({
      where: whereClause,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    const reportData = {
      title: 'Relatório de Solicitações',
      generatedAt: new Date(),
      period: {
        startDate: startDate || null,
        endDate: endDate || null
      },
      totalRequests: requests.length,
      statusSummary: statusSummary.map(item => ({
        status: item.status,
        count: parseInt(item.dataValues.count)
      })),
      requests: requests.map(request => ({
        id: request.id,
        requestDate: request.requestDate,
        status: request.status,
        requester: request.requester?.username,
        requesterRole: request.requester?.role,
        approver: request.approver?.username,
        approvalDate: request.approvalDate,
        patient: request.patient?.name,
        notes: request.notes
      }))
    };

    if (format === 'excel') {
      if (!ExcelJS) {
        return res.status(400).json({ error: 'Excel export não disponível. Dependências não instaladas.' });
      }
      return await generateExcelReport(res, reportData, 'requests');
    } else if (format === 'pdf') {
      if (!PDFDocument) {
        return res.status(400).json({ error: 'PDF export não disponível. Dependências não instaladas.' });
      }
      return await generatePDFReport(res, reportData, 'requests');
    }

    res.json(reportData);
  } catch (error) {
    console.error('Error generating requests report:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível gerar o relatório de solicitações'
    });
  }
};

/**
 * Generate inventory summary report
 */
const getInventorySummaryReport = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    // Get products with stock information
    const products = await Product.findAll({
      include: [
        {
          model: User,
          as: 'entryUser',
          attributes: ['id', 'username']
        }
      ],
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    // Calculate summary statistics
    const totalProducts = products.length;
    const totalValue = products.reduce((sum, product) => sum + (product.currentStock * 10), 0); // Placeholder calculation
    const lowStockCount = products.filter(p => p.currentStock <= p.minimumStock).length;
    const expiredCount = products.filter(p => new Date(p.expirationDate) < new Date()).length;

    // Group by category
    const categoryGroups = products.reduce((groups, product) => {
      const category = product.category || 'Sem Categoria';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(product);
      return groups;
    }, {});

    const reportData = {
      title: 'Relatório Resumo do Inventário',
      generatedAt: new Date(),
      summary: {
        totalProducts,
        totalValue,
        lowStockCount,
        expiredCount
      },
      categories: Object.keys(categoryGroups).map(category => ({
        name: category,
        productCount: categoryGroups[category].length,
        totalStock: categoryGroups[category].reduce((sum, p) => sum + p.currentStock, 0),
        products: categoryGroups[category].map(product => ({
          id: product.id,
          name: product.name,
          currentStock: product.currentStock,
          minimumStock: product.minimumStock,
          unit: product.unit,
          expirationDate: product.expirationDate,
          isLowStock: product.currentStock <= product.minimumStock,
          isExpired: new Date(product.expirationDate) < new Date(),
          invoiceNumber: product.invoiceNumber
        }))
      }))
    };

    if (format === 'excel') {
      if (!ExcelJS) {
        return res.status(400).json({ error: 'Excel export não disponível. Dependências não instaladas.' });
      }
      return await generateExcelReport(res, reportData, 'inventory');
    } else if (format === 'pdf') {
      if (!PDFDocument) {
        return res.status(400).json({ error: 'PDF export não disponível. Dependências não instaladas.' });
      }
      return await generatePDFReport(res, reportData, 'inventory');
    }

    res.json(reportData);
  } catch (error) {
    console.error('Error generating inventory summary report:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Não foi possível gerar o relatório de inventário'
    });
  }
};

/**
 * Generate Excel report
 */
const generateExcelReport = async (res, data, type) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(data.title);

    // Add header
    worksheet.addRow([data.title]);
    worksheet.addRow([`Gerado em: ${data.generatedAt.toLocaleString('pt-BR')}`]);
    worksheet.addRow([]); // Empty row

    if (type === 'expiration') {
      // Expiration report columns
      worksheet.addRow(['Produto', 'Categoria', 'Estoque', 'Unidade', 'Vencimento', 'Dias p/ Vencer', 'Nota Fiscal']);
      
      data.products.forEach(product => {
        worksheet.addRow([
          product.name,
          product.category,
          product.currentStock,
          product.unit,
          new Date(product.expirationDate).toLocaleDateString('pt-BR'),
          product.daysToExpiration,
          product.invoiceNumber
        ]);
      });
    } else if (type === 'requests') {
      // Requests report columns
      worksheet.addRow(['Data', 'Status', 'Solicitante', 'Perfil', 'Aprovador', 'Data Aprovação', 'Paciente']);
      
      data.requests.forEach(request => {
        worksheet.addRow([
          new Date(request.requestDate).toLocaleDateString('pt-BR'),
          request.status,
          request.requester,
          request.requesterRole,
          request.approver || '',
          request.approvalDate ? new Date(request.approvalDate).toLocaleDateString('pt-BR') : '',
          request.patient || ''
        ]);
      });
    } else if (type === 'inventory') {
      // Inventory summary
      worksheet.addRow(['Resumo do Inventário']);
      worksheet.addRow(['Total de Produtos', data.summary.totalProducts]);
      worksheet.addRow(['Valor Total Estimado', `R$ ${data.summary.totalValue.toFixed(2)}`]);
      worksheet.addRow(['Produtos com Estoque Baixo', data.summary.lowStockCount]);
      worksheet.addRow(['Produtos Vencidos', data.summary.expiredCount]);
      worksheet.addRow([]); // Empty row

      // Products by category
      data.categories.forEach(category => {
        worksheet.addRow([`Categoria: ${category.name}`]);
        worksheet.addRow(['Produto', 'Estoque Atual', 'Estoque Mínimo', 'Unidade', 'Vencimento', 'Status']);
        
        category.products.forEach(product => {
          const status = product.isExpired ? 'Vencido' : product.isLowStock ? 'Estoque Baixo' : 'OK';
          worksheet.addRow([
            product.name,
            product.currentStock,
            product.minimumStock,
            product.unit,
            new Date(product.expirationDate).toLocaleDateString('pt-BR'),
            status
          ]);
        });
        worksheet.addRow([]); // Empty row between categories
      });
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${Date.now()}.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel report:', error);
    throw error;
  }
};

/**
 * Generate PDF report
 */
const generatePDFReport = async (res, data, type) => {
  try {
    const doc = new PDFDocument();
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${Date.now()}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add title
    doc.fontSize(16).text(data.title, { align: 'center' });
    doc.fontSize(10).text(`Gerado em: ${data.generatedAt.toLocaleString('pt-BR')}`, { align: 'center' });
    doc.moveDown();

    if (type === 'expiration') {
      doc.fontSize(12).text(`Total de produtos vencendo: ${data.totalProducts}`);
      doc.moveDown();

      data.products.forEach(product => {
        doc.fontSize(10)
           .text(`${product.name} (${product.category})`)
           .text(`Estoque: ${product.currentStock} ${product.unit}`)
           .text(`Vencimento: ${new Date(product.expirationDate).toLocaleDateString('pt-BR')} (${product.daysToExpiration} dias)`)
           .text(`Nota Fiscal: ${product.invoiceNumber}`)
           .moveDown(0.5);
      });
    } else if (type === 'requests') {
      doc.fontSize(12).text(`Total de solicitações: ${data.totalRequests}`);
      doc.moveDown();

      // Status summary
      data.statusSummary.forEach(item => {
        doc.fontSize(10).text(`${item.status}: ${item.count}`);
      });
      doc.moveDown();

      data.requests.forEach(request => {
        doc.fontSize(10)
           .text(`Data: ${new Date(request.requestDate).toLocaleDateString('pt-BR')}`)
           .text(`Status: ${request.status}`)
           .text(`Solicitante: ${request.requester} (${request.requesterRole})`)
           .text(`Paciente: ${request.patient || 'N/A'}`)
           .moveDown(0.5);
      });
    }

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error('Error generating PDF report:', error);
    throw error;
  }
};

module.exports = {
  getExpirationReport,
  getRequestsReport,
  getInventorySummaryReport
};