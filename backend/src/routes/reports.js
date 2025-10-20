const express = require('express');
const router = express.Router();

const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');

/**
 * @route GET /api/reports/expiration
 * @desc Generate expiration report
 * @access Private - All authenticated users
 */
router.get('/expiration', 
  authenticate,
  auditMiddleware('VIEW', 'EXPIRATION_REPORT'),
  reportController.getExpirationReport
);

/**
 * @route GET /api/reports/requests
 * @desc Generate requests report by period
 * @access Private - Manager, Admin
 */
router.get('/requests', 
  authenticate,
  authorize(['admin', 'manager']),
  auditMiddleware('VIEW', 'REQUESTS_REPORT'),
  reportController.getRequestsReport
);

/**
 * @route GET /api/reports/inventory
 * @desc Generate inventory summary report
 * @access Private - Manager, Admin
 */
router.get('/inventory', 
  authenticate,
  authorize(['admin', 'manager']),
  auditMiddleware('VIEW', 'INVENTORY_REPORT'),
  reportController.getInventorySummaryReport
);

module.exports = router;