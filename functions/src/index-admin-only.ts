import * as functions from 'firebase-functions';

// Admin functions
export { initializeDefaultAdmin, validateAdminInitialization, emergencyAdminAssignment } from './admin/adminInitializer';
export { assignUserRole, removeUserRole, getUserRoles, listUsersWithRoles } from './admin/userRoleManager';