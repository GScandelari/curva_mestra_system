const express = require('express');
const router = express.Router();
const stockMovementController = require('../controllers/stockMovementController');
const { authenticate, authorize } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');

// All movement routes require authentication
router.use(authenticate);

/**
 * @route GET /api/movements
 * @desc Get all stock movements with filtering and pagination
 * @access Private - All authenticated users
 */
router.get('/', 
  auditMiddleware('VIEW', 'STOCK_MOVEMENTS'),
  stockMovementController.getStockMovements
);

/**
 * @route GET /api/movements/stats
 * @desc Get stock movement statistics
 * @access Private - Manager, Admin
 */
router.get('/stats', 
  authorize(['admin', 'manager']),
  auditMiddleware('VIEW', 'MOVEMENT_STATS'),
  stockMovementController.getMovementStats
);

/**
 * @route GET /api/movements/:id
 * @desc Get specific stock movement by ID
 * @access Private - All authenticated users
 */
router.get('/:id', 
  auditMiddleware('VIEW', 'STOCK_MOVEMENT'),
  stockMovementController.getStockMovementById
);

/**
 * @route GET /api/movements/resources/:resourceType/:resourceId
 * @desc Get movement history for a specific resource
 * @access Private - All authenticated users
 */
router.get('/resources/:resourceType/:resourceId', 
  auditMiddleware('VIEW', 'RESOURCE_MOVEMENTS'),
  stockMovementController.getResourceMovements
);

module.exports = router;