const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { auditAuth } = require('../middleware/audit');
const { 
  validate, 
  loginSchema, 
  refreshTokenSchema, 
  changePasswordSchema 
} = require('../utils/validation');

/**
 * @route POST /api/auth/login
 * @desc User login
 * @access Public
 */
router.post('/login', 
  validate(loginSchema),
  auditAuth('LOGIN'),
  authController.login
);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh', 
  validate(refreshTokenSchema), 
  authController.refreshToken
);

/**
 * @route GET /api/auth/profile
 * @desc Get current user profile
 * @access Private
 */
router.get('/profile', 
  authenticate, 
  authController.getProfile
);

/**
 * @route PUT /api/auth/change-password
 * @desc Change user password
 * @access Private
 */
router.put('/change-password', 
  authenticate,
  validate(changePasswordSchema), 
  authController.changePassword
);

/**
 * @route POST /api/auth/logout
 * @desc User logout
 * @access Private
 */
router.post('/logout', 
  authenticate,
  auditAuth('LOGOUT'),
  authController.logout
);

module.exports = router;