/**
 * Firebase Functions for Curva Mestra System
 * 
 * This file contains all Firebase Functions for authentication,
 * user management, and system operations.
 */

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Set global options for cost control
setGlobalOptions({ maxInstances: 10 });

// Import auth functions
import * as authFunctions from "./auth";

// Import API functions
import * as productFunctions from "./api/products";
import * as requestFunctions from "./api/requests";
import * as patientFunctions from "./api/patients";
import * as invoiceFunctions from "./api/invoices";

// Import notification functions
import * as notificationFunctions from "./notifications";

// Export auth functions
export const setUserRole = authFunctions.setUserRole;
export const getUserProfile = authFunctions.getUserProfile;
export const updateUserProfile = authFunctions.updateUserProfile;
export const initializeClinic = authFunctions.initializeClinic;
export const listClinicUsers = authFunctions.listClinicUsers;

// Export product functions
export const createProduct = productFunctions.createProduct;
export const getProducts = productFunctions.getProducts;
export const getProductById = productFunctions.getProductById;
export const updateProduct = productFunctions.updateProduct;
export const adjustStock = productFunctions.adjustStock;
export const deleteProduct = productFunctions.deleteProduct;
export const getLowStockProducts = productFunctions.getLowStockProducts;
export const getExpiringProducts = productFunctions.getExpiringProducts;

// Export request functions
export const createRequest = requestFunctions.createRequest;
export const getRequests = requestFunctions.getRequests;
export const getRequestById = requestFunctions.getRequestById;
export const getUserRequests = requestFunctions.getUserRequests;
export const approveRequest = requestFunctions.approveRequest;
export const rejectRequest = requestFunctions.rejectRequest;
export const fulfillRequest = requestFunctions.fulfillRequest;

// Export patient functions
export const getPatients = patientFunctions.getPatients;
export const getPatientById = patientFunctions.getPatientById;
export const createPatient = patientFunctions.createPatient;
export const updatePatient = patientFunctions.updatePatient;
export const deletePatient = patientFunctions.deletePatient;
export const associateProducts = patientFunctions.associateProducts;
export const getPatientConsumption = patientFunctions.getPatientConsumption;

// Export invoice functions
export const getInvoices = invoiceFunctions.getInvoices;
export const getInvoiceById = invoiceFunctions.getInvoiceById;
export const getInvoiceProducts = invoiceFunctions.getInvoiceProducts;
export const createInvoice = invoiceFunctions.createInvoice;
export const updateInvoice = invoiceFunctions.updateInvoice;
export const deleteInvoice = invoiceFunctions.deleteInvoice;
export const getPurchaseReport = invoiceFunctions.getPurchaseReport;

// Export notification functions
export const checkExpiringProducts = notificationFunctions.checkExpiringProducts;
export const checkLowStock = notificationFunctions.checkLowStock;
export const onStockMovement = notificationFunctions.onStockMovement;
export const createSystemAlerts = notificationFunctions.createSystemAlerts;
export const getNotifications = notificationFunctions.getNotifications;
export const markNotificationAsRead = notificationFunctions.markNotificationAsRead;

// Import and export backup functions
import * as backupFunctions from "./backup/firestoreBackup";
export const dailyFirestoreBackup = backupFunctions.dailyFirestoreBackup;
export const cleanupOldBackups = backupFunctions.cleanupOldBackups;
export const restoreFirestoreBackup = backupFunctions.restoreFirestoreBackup;

// Import and export error reporting functions
import * as errorReportingFunctions from "./monitoring/errorReporting";
export const reportError = errorReportingFunctions.reportError;
export const generateDailyErrorReport = errorReportingFunctions.generateDailyErrorReport;
export const resolveError = errorReportingFunctions.resolveError;
export const getErrorStats = errorReportingFunctions.getErrorStats;

// Import and export cost monitoring functions
import * as costMonitoringFunctions from "./monitoring/costMonitoring";
export const collectDailyUsageMetrics = costMonitoringFunctions.collectDailyUsageMetrics;
export const getCostReport = costMonitoringFunctions.getCostReport;
export const setCostThresholds = costMonitoringFunctions.setCostThresholds;
export const logActivity = costMonitoringFunctions.logActivity;

// Import and export optimization functions
import * as performanceAnalyzer from "./optimization/performanceAnalyzer";
import * as optimizationCostMonitoring from "./optimization/costMonitoring";
export const analyzeQueryPerformance = performanceAnalyzer.analyzeQueryPerformance;
export const optimizeIndexes = performanceAnalyzer.optimizeIndexes;
export const monitorResourceUsage = performanceAnalyzer.monitorResourceUsage;
export const collectUsageMetrics = optimizationCostMonitoring.collectUsageMetrics;
export const calculateCostEstimate = optimizationCostMonitoring.calculateCostEstimate;
export const getOptimizationCostReport = optimizationCostMonitoring.getCostReport;

// Health check endpoint
export const healthCheck = onRequest((request, response) => {
  response.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "2.0.0"
  });
});