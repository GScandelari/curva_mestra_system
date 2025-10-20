const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');
const { auditMiddleware, captureOldValues, auditWithOldValues } = require('../middleware/audit');
const { Product } = require('../models');
const { 
  validate, 
  createProductSchema, 
  updateProductSchema,
  adjustStockSchema
} = require('../utils/validation');

/**
 * @route GET /api/products
 * @desc Get all products with filtering and pagination
 * @access Private
 */
router.get('/', 
  authenticate, 
  productController.getProducts
);

/**
 * @route GET /api/products/alerts
 * @desc Get active alerts
 * @access Private
 */
router.get('/alerts', 
  authenticate, 
  productController.getAlerts
);

/**
 * @route GET /api/products/alerts/summary
 * @desc Get alert summary
 * @access Private
 */
router.get('/alerts/summary', 
  authenticate, 
  productController.getAlertSummary
);

/**
 * @route GET /api/products/expiring
 * @desc Get products expiring soon
 * @access Private
 */
router.get('/expiring', 
  authenticate, 
  productController.getExpiringProducts
);

/**
 * @route GET /api/products/low-stock
 * @desc Get products with low stock
 * @access Private
 */
router.get('/low-stock', 
  authenticate, 
  productController.getLowStockProducts
);

/**
 * @route GET /api/products/stats
 * @desc Get product statistics for dashboard
 * @access Private
 */
router.get('/stats', 
  authenticate, 
  productController.getProductStats
);

/**
 * @route GET /api/products/trends/movements
 * @desc Get stock movement trends for charts
 * @access Private
 */
router.get('/trends/movements', 
  authenticate, 
  productController.getStockMovementTrends
);

/**
 * @route GET /api/products/invoice/:invoiceNumber
 * @desc Get products by invoice number
 * @access Private
 */
router.get('/invoice/:invoiceNumber', 
  authenticate, 
  productController.getProductsByInvoice
);

/**
 * @route GET /api/products/:id
 * @desc Get product by ID
 * @access Private
 */
router.get('/:id', 
  authenticate, 
  productController.getProductById
);

/**
 * @route GET /api/products/:id/movements
 * @desc Get product stock movements
 * @access Private
 */
router.get('/:id/movements', 
  authenticate, 
  productController.getProductMovements
);

/**
 * @route POST /api/products
 * @desc Create new product
 * @access Private - Admin, Manager
 */
router.post('/', 
  authenticate,
  authorize(['admin', 'manager']),
  validate(createProductSchema),
  auditMiddleware('CREATE', 'PRODUCT'),
  productController.createProduct
);

/**
 * @route PUT /api/products/:id
 * @desc Update product
 * @access Private - Admin, Manager
 */
router.put('/:id', 
  authenticate,
  authorize(['admin', 'manager']),
  captureOldValues(Product, 'PRODUCT'),
  validate(updateProductSchema),
  auditWithOldValues('UPDATE', 'PRODUCT'),
  productController.updateProduct
);

/**
 * @route POST /api/products/:id/adjust-stock
 * @desc Adjust product stock
 * @access Private - Admin, Manager, Doctor
 */
router.post('/:id/adjust-stock', 
  authenticate,
  authorize(['admin', 'manager', 'doctor']),
  validate(adjustStockSchema),
  auditMiddleware('STOCK_ADJUSTMENT', 'PRODUCT'),
  productController.adjustStock
);

/**
 * @route DELETE /api/products/:id
 * @desc Delete product
 * @access Private - Admin only
 */
router.delete('/:id', 
  authenticate,
  authorize(['admin']),
  captureOldValues(Product, 'PRODUCT'),
  auditWithOldValues('DELETE', 'PRODUCT'),
  productController.deleteProduct
);

module.exports = router;