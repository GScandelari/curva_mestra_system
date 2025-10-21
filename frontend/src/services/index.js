// Services index file
// This file exports both legacy REST API services and new Firebase services

// Legacy REST API services (for backward compatibility)
export { authService } from './authService';
export { productService } from './productService';
export { requestService } from './requestService';
export { patientService } from './patientService';
export { invoiceService } from './invoiceService';
export { reportService } from './reportService';

// Firebase services (new implementation)
export { default as firebaseAuthService } from './firebaseAuthService';
export { default as firebaseService } from './firebaseService';
export { default as firebaseProductService } from './firebaseProductService';
export { default as firebasePatientService } from './firebasePatientService';
export { default as firebaseNotificationService } from './firebaseNotificationService';
export { default as firebaseRequestService } from './firebaseRequestService';