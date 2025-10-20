const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const { authenticate, authorize } = require('../middleware/auth');
const { auditMiddleware } = require('../middleware/audit');
const { validate, createRequestSchema, rejectRequestSchema } = require('../utils/validation');

// All routes require authentication
router.use(authenticate);

// Create a new request
router.post('/', 
  validate(createRequestSchema),
  auditMiddleware('CREATE', 'REQUEST'),
  requestController.createRequest
);

// Get all requests (admin/manager only)
router.get('/', 
  authorize(['admin', 'manager']),
  requestController.getRequests
);

// Get specific request by ID
router.get('/:id', 
  requestController.getRequestById
);

// Get requests by user ID
router.get('/user/:userId', 
  requestController.getUserRequests
);

// Approve a request (admin/manager only)
router.patch('/:id/approve', 
  authorize(['admin', 'manager']),
  auditMiddleware('APPROVE', 'REQUEST'),
  requestController.approveRequest
);

// Reject a request (admin/manager only)
router.patch('/:id/reject', 
  authorize(['admin', 'manager']),
  validate(rejectRequestSchema),
  auditMiddleware('REJECT', 'REQUEST'),
  requestController.rejectRequest
);

// Mark request as fulfilled
router.patch('/:id/fulfill', 
  authorize(['admin', 'manager', 'doctor']),
  auditMiddleware('FULFILL', 'REQUEST'),
  requestController.fulfillRequest
);

module.exports = router;