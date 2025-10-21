"use strict";
/**
 * Firebase Functions for Curva Mestra System
 *
 * This file contains all Firebase Functions for authentication,
 * user management, and system operations.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCostThresholds = exports.getCostReport = exports.collectDailyUsageMetrics = exports.getErrorStats = exports.resolveError = exports.generateDailyErrorReport = exports.reportError = exports.restoreFirestoreBackup = exports.cleanupOldBackups = exports.dailyFirestoreBackup = exports.markNotificationAsRead = exports.getNotifications = exports.createSystemAlerts = exports.onStockMovement = exports.checkLowStock = exports.checkExpiringProducts = exports.getPurchaseReport = exports.deleteInvoice = exports.updateInvoice = exports.createInvoice = exports.getInvoiceProducts = exports.getInvoiceById = exports.getInvoices = exports.getPatientConsumption = exports.associateProducts = exports.deletePatient = exports.updatePatient = exports.createPatient = exports.getPatientById = exports.getPatients = exports.fulfillRequest = exports.rejectRequest = exports.approveRequest = exports.getUserRequests = exports.getRequestById = exports.getRequests = exports.createRequest = exports.getExpiringProducts = exports.getLowStockProducts = exports.deleteProduct = exports.adjustStock = exports.updateProduct = exports.getProductById = exports.getProducts = exports.createProduct = exports.listClinicUsers = exports.initializeClinic = exports.updateUserProfile = exports.getUserProfile = exports.setUserRole = void 0;
exports.healthCheck = exports.getOptimizationCostReport = exports.calculateCostEstimate = exports.collectUsageMetrics = exports.monitorResourceUsage = exports.optimizeIndexes = exports.analyzeQueryPerformance = exports.logActivity = void 0;
const firebase_functions_1 = require("firebase-functions");
const https_1 = require("firebase-functions/https");
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin SDK
admin.initializeApp();
// Set global options for cost control
(0, firebase_functions_1.setGlobalOptions)({ maxInstances: 10 });
// Import auth functions
const authFunctions = __importStar(require("./auth"));
// Import API functions
const productFunctions = __importStar(require("./api/products"));
const requestFunctions = __importStar(require("./api/requests"));
const patientFunctions = __importStar(require("./api/patients"));
const invoiceFunctions = __importStar(require("./api/invoices"));
// Import notification functions
const notificationFunctions = __importStar(require("./notifications"));
// Export auth functions
exports.setUserRole = authFunctions.setUserRole;
exports.getUserProfile = authFunctions.getUserProfile;
exports.updateUserProfile = authFunctions.updateUserProfile;
exports.initializeClinic = authFunctions.initializeClinic;
exports.listClinicUsers = authFunctions.listClinicUsers;
// Export product functions
exports.createProduct = productFunctions.createProduct;
exports.getProducts = productFunctions.getProducts;
exports.getProductById = productFunctions.getProductById;
exports.updateProduct = productFunctions.updateProduct;
exports.adjustStock = productFunctions.adjustStock;
exports.deleteProduct = productFunctions.deleteProduct;
exports.getLowStockProducts = productFunctions.getLowStockProducts;
exports.getExpiringProducts = productFunctions.getExpiringProducts;
// Export request functions
exports.createRequest = requestFunctions.createRequest;
exports.getRequests = requestFunctions.getRequests;
exports.getRequestById = requestFunctions.getRequestById;
exports.getUserRequests = requestFunctions.getUserRequests;
exports.approveRequest = requestFunctions.approveRequest;
exports.rejectRequest = requestFunctions.rejectRequest;
exports.fulfillRequest = requestFunctions.fulfillRequest;
// Export patient functions
exports.getPatients = patientFunctions.getPatients;
exports.getPatientById = patientFunctions.getPatientById;
exports.createPatient = patientFunctions.createPatient;
exports.updatePatient = patientFunctions.updatePatient;
exports.deletePatient = patientFunctions.deletePatient;
exports.associateProducts = patientFunctions.associateProducts;
exports.getPatientConsumption = patientFunctions.getPatientConsumption;
// Export invoice functions
exports.getInvoices = invoiceFunctions.getInvoices;
exports.getInvoiceById = invoiceFunctions.getInvoiceById;
exports.getInvoiceProducts = invoiceFunctions.getInvoiceProducts;
exports.createInvoice = invoiceFunctions.createInvoice;
exports.updateInvoice = invoiceFunctions.updateInvoice;
exports.deleteInvoice = invoiceFunctions.deleteInvoice;
exports.getPurchaseReport = invoiceFunctions.getPurchaseReport;
// Export notification functions
exports.checkExpiringProducts = notificationFunctions.checkExpiringProducts;
exports.checkLowStock = notificationFunctions.checkLowStock;
exports.onStockMovement = notificationFunctions.onStockMovement;
exports.createSystemAlerts = notificationFunctions.createSystemAlerts;
exports.getNotifications = notificationFunctions.getNotifications;
exports.markNotificationAsRead = notificationFunctions.markNotificationAsRead;
// Import and export backup functions
const backupFunctions = __importStar(require("./backup/firestoreBackup"));
exports.dailyFirestoreBackup = backupFunctions.dailyFirestoreBackup;
exports.cleanupOldBackups = backupFunctions.cleanupOldBackups;
exports.restoreFirestoreBackup = backupFunctions.restoreFirestoreBackup;
// Import and export error reporting functions
const errorReportingFunctions = __importStar(require("./monitoring/errorReporting"));
exports.reportError = errorReportingFunctions.reportError;
exports.generateDailyErrorReport = errorReportingFunctions.generateDailyErrorReport;
exports.resolveError = errorReportingFunctions.resolveError;
exports.getErrorStats = errorReportingFunctions.getErrorStats;
// Import and export cost monitoring functions
const costMonitoringFunctions = __importStar(require("./monitoring/costMonitoring"));
exports.collectDailyUsageMetrics = costMonitoringFunctions.collectDailyUsageMetrics;
exports.getCostReport = costMonitoringFunctions.getCostReport;
exports.setCostThresholds = costMonitoringFunctions.setCostThresholds;
exports.logActivity = costMonitoringFunctions.logActivity;
// Import and export optimization functions
const performanceAnalyzer = __importStar(require("./optimization/performanceAnalyzer"));
const optimizationCostMonitoring = __importStar(require("./optimization/costMonitoring"));
exports.analyzeQueryPerformance = performanceAnalyzer.analyzeQueryPerformance;
exports.optimizeIndexes = performanceAnalyzer.optimizeIndexes;
exports.monitorResourceUsage = performanceAnalyzer.monitorResourceUsage;
exports.collectUsageMetrics = optimizationCostMonitoring.collectUsageMetrics;
exports.calculateCostEstimate = optimizationCostMonitoring.calculateCostEstimate;
exports.getOptimizationCostReport = optimizationCostMonitoring.getCostReport;
// Health check endpoint
exports.healthCheck = (0, https_1.onRequest)((request, response) => {
    response.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "2.0.0"
    });
});
//# sourceMappingURL=index.js.map