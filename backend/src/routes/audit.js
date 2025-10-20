const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticate, authorize } = require('../middleware/auth');

// All audit routes require authentication and admin/manager role
router.use(authenticate);
router.use(authorize(['admin', 'manager']));

/**
 * @route GET /api/audit/logs
 * @desc Get audit logs with filtering and pagination
 * @access Admin, Manager
 */
router.get('/logs', auditController.getAuditLogs);

/**
 * @route GET /api/audit/logs/:id
 * @desc Get specific audit log by ID
 * @access Admin, Manager
 */
router.get('/logs/:id', auditController.getAuditLogById);

/**
 * @route GET /api/audit/stats
 * @desc Get audit statistics
 * @access Admin, Manager
 */
router.get('/stats', auditController.getAuditStats);

/**
 * @route GET /api/audit/users/:userId/activity
 * @desc Get user activity timeline
 * @access Admin, Manager
 */
router.get('/users/:userId/activity', auditController.getUserActivity);

/**
 * @route GET /api/audit/resources/:resource/:resourceId/history
 * @desc Get resource history
 * @access Admin, Manager
 */
router.get('/resources/:resource/:resourceId/history', auditController.getResourceHistory);

/**
 * @route POST /api/audit/backup
 * @desc Trigger manual backup of audit logs
 * @access Admin only
 */
router.post('/backup', authorize(['admin']), auditController.triggerBackup);

/**
 * @route GET /api/audit/backup/status
 * @desc Get backup status and statistics
 * @access Admin, Manager
 */
router.get('/backup/status', auditController.getBackupStatus);

module.exports = router;