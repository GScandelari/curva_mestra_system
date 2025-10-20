const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { auditMiddleware, captureOldValues, auditWithOldValues } = require('../middleware/audit');
const { validate, createUserSchema } = require('../utils/validation');
const { User } = require('../models');
const Joi = require('joi');

// Update user validation schema
const updateUserSchema = Joi.object({
  username: Joi.string().min(3).max(50),
  email: Joi.string().email(),
  role: Joi.string().valid('admin', 'doctor', 'receptionist', 'manager'),
  isActive: Joi.boolean()
}).min(1); // At least one field must be provided

/**
 * @route GET /api/users
 * @desc Get all users
 * @access Private (Admin only)
 */
router.get('/', 
  authenticate, 
  authorize(['admin']), 
  userController.getAllUsers
);

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Private (Admin only)
 */
router.get('/:id', 
  authenticate, 
  authorize(['admin']), 
  userController.getUserById
);

/**
 * @route POST /api/users
 * @desc Create new user
 * @access Private (Admin only)
 */
router.post('/', 
  authenticate, 
  authorize(['admin']), 
  validate(createUserSchema),
  auditMiddleware('CREATE', 'USER'),
  userController.createUser
);

/**
 * @route PUT /api/users/:id
 * @desc Update user
 * @access Private (Admin only)
 */
router.put('/:id', 
  authenticate, 
  authorize(['admin']), 
  captureOldValues(User, 'USER'),
  validate(updateUserSchema),
  auditWithOldValues('UPDATE', 'USER'),
  userController.updateUser
);

/**
 * @route DELETE /api/users/:id
 * @desc Delete (deactivate) user
 * @access Private (Admin only)
 */
router.delete('/:id', 
  authenticate, 
  authorize(['admin']),
  captureOldValues(User, 'USER'),
  auditWithOldValues('DELETE', 'USER'),
  userController.deleteUser
);

module.exports = router;