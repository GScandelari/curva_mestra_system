// Routes index file
const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const userRoutes = require('./users');
const productRoutes = require('./products');
const invoiceRoutes = require('./invoices');
const requestRoutes = require('./requests');
const patientRoutes = require('./patients');
const auditRoutes = require('./audit');
const movementRoutes = require('./movements');
const reportRoutes = require('./reports');
const notificationRoutes = require('./notifications');

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/requests', requestRoutes);
router.use('/patients', patientRoutes);
router.use('/audit', auditRoutes);
router.use('/movements', movementRoutes);
router.use('/reports', reportRoutes);
router.use('/notifications', notificationRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({ 
    message: 'Curva Mestra System API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      users: '/api/users',
      products: '/api/products',
      invoices: '/api/invoices',
      requests: '/api/requests',
      patients: '/api/patients',
      audit: '/api/audit',
      movements: '/api/movements',
      reports: '/api/reports',
      notifications: '/api/notifications'
    }
  });
});

module.exports = router;