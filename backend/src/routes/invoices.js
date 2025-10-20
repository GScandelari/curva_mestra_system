const express = require('express');
const router = express.Router();

const invoiceController = require('../controllers/invoiceController');
const { authenticate, authorize } = require('../middleware/auth');
const { auditMiddleware, captureOldValues, auditWithOldValues } = require('../middleware/audit');
const { 
  validate, 
  createInvoiceSchema, 
  updateInvoiceSchema
} = require('../utils/validation');
const { Invoice } = require('../models');

/**
 * @route GET /api/invoices
 * @desc Get all invoices with filtering and pagination
 * @access Private
 */
router.get('/', 
  authenticate, 
  invoiceController.getInvoices
);

/**
 * @route GET /api/invoices/reports/purchases
 * @desc Generate purchase report by period
 * @access Private
 */
router.get('/reports/purchases', 
  authenticate, 
  invoiceController.getPurchaseReport
);

/**
 * @route GET /api/invoices/:id
 * @desc Get invoice by ID
 * @access Private
 */
router.get('/:id', 
  authenticate, 
  invoiceController.getInvoiceById
);

/**
 * @route GET /api/invoices/:id/products
 * @desc Get products associated with invoice
 * @access Private
 */
router.get('/:id/products', 
  authenticate, 
  invoiceController.getInvoiceProducts
);

/**
 * @route POST /api/invoices
 * @desc Create new invoice
 * @access Private - Admin, Manager
 */
router.post('/', 
  authenticate,
  authorize(['admin', 'manager']),
  validate(createInvoiceSchema),
  auditMiddleware('CREATE', 'INVOICE'),
  invoiceController.createInvoice
);

/**
 * @route PUT /api/invoices/:id
 * @desc Update invoice
 * @access Private - Admin, Manager
 */
router.put('/:id', 
  authenticate,
  authorize(['admin', 'manager']),
  captureOldValues(Invoice, 'INVOICE'),
  validate(updateInvoiceSchema),
  auditWithOldValues('UPDATE', 'INVOICE'),
  invoiceController.updateInvoice
);

/**
 * @route DELETE /api/invoices/:id
 * @desc Delete invoice
 * @access Private - Admin only
 */
router.delete('/:id', 
  authenticate,
  authorize(['admin']),
  captureOldValues(Invoice, 'INVOICE'),
  auditWithOldValues('DELETE', 'INVOICE'),
  invoiceController.deleteInvoice
);

module.exports = router;