const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { authenticate, authorize } = require('../middleware/auth');
const { auditMiddleware, captureOldValues, auditWithOldValues } = require('../middleware/audit');
const { validatePatient, validatePatientUpdate, validateProductAssociation } = require('../utils/validation');
const { Patient } = require('../models');

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route GET /api/patients
 * @desc Get all patients with filtering and pagination
 * @access Private (All authenticated users)
 */
router.get('/', patientController.getPatients);

/**
 * @route GET /api/patients/:id
 * @desc Get patient by ID with treatments
 * @access Private (All authenticated users)
 */
router.get('/:id', patientController.getPatientById);

/**
 * @route POST /api/patients
 * @desc Create new patient
 * @access Private (Admin, Manager, Receptionist)
 */
router.post('/', 
  authorize(['admin', 'manager', 'receptionist']),
  validatePatient,
  auditMiddleware('CREATE', 'PATIENT'),
  patientController.createPatient
);

/**
 * @route PUT /api/patients/:id
 * @desc Update patient
 * @access Private (Admin, Manager, Receptionist)
 */
router.put('/:id', 
  authorize(['admin', 'manager', 'receptionist']),
  captureOldValues(Patient, 'PATIENT'),
  validatePatientUpdate,
  auditWithOldValues('UPDATE', 'PATIENT'),
  patientController.updatePatient
);

/**
 * @route DELETE /api/patients/:id
 * @desc Delete patient (soft delete if has treatments)
 * @access Private (Admin, Manager)
 */
router.delete('/:id', 
  authorize(['admin', 'manager']),
  captureOldValues(Patient, 'PATIENT'),
  auditWithOldValues('DELETE', 'PATIENT'),
  patientController.deletePatient
);

/**
 * @route GET /api/patients/:id/consumption
 * @desc Get patient consumption history
 * @access Private (All authenticated users)
 */
router.get('/:id/consumption', patientController.getPatientConsumption);

/**
 * @route GET /api/patients/:id/report
 * @desc Get patient product usage report
 * @access Private (All authenticated users)
 */
router.get('/:id/report', patientController.getPatientProductReport);

/**
 * @route POST /api/patients/:id/associate-products
 * @desc Associate products to patient (create treatment)
 * @access Private (Admin, Manager, Doctor)
 */
router.post('/:id/associate-products', 
  authorize(['admin', 'manager', 'doctor']),
  validateProductAssociation,
  patientController.associateProducts
);

module.exports = router;