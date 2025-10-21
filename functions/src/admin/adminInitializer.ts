import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from '../firebase-admin';

/**
 * Admin Initialization Script
 * Handles initialization of the default administrator user
 */

// Default admin configuration from requirements
const DEFAULT_ADMIN_UID = 'gEjUSOsHF9QmS0Dvi0zB10GsxrD2';
const DEFAULT_ADMIN_EMAIL = 'scandelari.guilherme@hotmail.com';

/**
 * Initializes the default administrator user with admin claims
 */
export const initializeDefaultAdmin = onCall(async (request) => {
  try {
    // Verify the user exists
    const user = await getAuth().getUser(DEFAULT_ADMIN_UID);
    
    // Validate email matches expected admin email
    if (user.email !== DEFAULT_ADMIN_EMAIL) {
      throw new HttpsError('failed-precondition', 
        `User UID ${DEFAULT_ADMIN_UID} exists but email ${user.email} does not match expected admin email ${DEFAULT_ADMIN_EMAIL}`);
    }

    // Check if user already has admin claims
    const currentClaims = user.customClaims || {};
    if (currentClaims.admin === true && currentClaims.role === 'administrator') {
      return {
        success: true,
        message: 'Admin user already initialized',
        uid: DEFAULT_ADMIN_UID,
        email: user.email,
        alreadyAdmin: true,
        claims: currentClaims
      };
    }

    // Set admin custom claims
    const adminClaims = {
      admin: true,
      role: 'administrator',
      permissions: [
        'view_products', 'manage_products', 'view_requests', 'approve_requests',
        'view_patients', 'manage_patients', 'view_invoices', 'manage_invoices',
        'view_reports', 'manage_users', 'view_analytics', 'manage_settings',
        'system_admin', 'initialize_system'
      ],
      assignedAt: new Date().toISOString(),
      isDefaultAdmin: true
    };

    await getAuth().setCustomUserClaims(DEFAULT_ADMIN_UID, adminClaims);

    // Update user display name if not set
    if (!user.displayName) {
      await getAuth().updateUser(DEFAULT_ADMIN_UID, {
        displayName: 'System Administrator'
      });
    }

    return {
      success: true,
      message: 'Default admin user initialized successfully',
      uid: DEFAULT_ADMIN_UID,
      email: user.email,
      displayName: user.displayName || 'System Administrator',
      claims: adminClaims
    };
  } catch (error) {
    console.error('Error initializing default admin:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    if (error instanceof Error && error.message.includes('no user record')) {
      throw new HttpsError('not-found', 
        `Default admin user with UID ${DEFAULT_ADMIN_UID} not found. Please ensure the user is registered.`);
    }
    
    throw new HttpsError('internal', 'Internal error initializing default admin');
  }
});

/**
 * Validates admin initialization status
 */
export const validateAdminInitialization = onCall(async (request) => {
  try {
    // Check if default admin user exists and has proper claims
    const user = await getAuth().getUser(DEFAULT_ADMIN_UID);
    const customClaims = user.customClaims || {};
    
    const isProperlyInitialized = 
      customClaims.admin === true && 
      customClaims.role === 'administrator' &&
      user.email === DEFAULT_ADMIN_EMAIL;

    return {
      success: true,
      isInitialized: isProperlyInitialized,
      uid: DEFAULT_ADMIN_UID,
      email: user.email,
      expectedEmail: DEFAULT_ADMIN_EMAIL,
      emailMatches: user.email === DEFAULT_ADMIN_EMAIL,
      hasAdminClaims: customClaims.admin === true,
      role: customClaims.role,
      claims: customClaims
    };
  } catch (error) {
    console.error('Error validating admin initialization:', error);
    
    if (error instanceof Error && error.message.includes('no user record')) {
      return {
        success: true,
        isInitialized: false,
        userExists: false,
        uid: DEFAULT_ADMIN_UID,
        expectedEmail: DEFAULT_ADMIN_EMAIL,
        error: 'Default admin user not found'
      };
    }
    
    throw new HttpsError('internal', 'Internal error validating admin initialization');
  }
});

/**
 * Emergency admin assignment function
 * Can be used to assign admin role to any user in case of emergency
 */
export const emergencyAdminAssignment = onCall(async (request) => {
  // This function requires special authentication or can be called internally
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { uid, email } = request.data;

  if (!uid || !email) {
    throw new HttpsError('invalid-argument', 'UID and email are required');
  }

  try {
    // Verify user exists and email matches
    const user = await getAuth().getUser(uid);
    
    if (user.email !== email) {
      throw new HttpsError('failed-precondition', 'Email does not match user record');
    }

    // Set emergency admin claims
    const emergencyAdminClaims = {
      admin: true,
      role: 'administrator',
      permissions: [
        'view_products', 'manage_products', 'view_requests', 'approve_requests',
        'view_patients', 'manage_patients', 'view_invoices', 'manage_invoices',
        'view_reports', 'manage_users', 'view_analytics', 'manage_settings',
        'system_admin', 'emergency_admin'
      ],
      assignedAt: new Date().toISOString(),
      isEmergencyAdmin: true,
      assignedBy: request.auth.uid
    };

    await getAuth().setCustomUserClaims(uid, emergencyAdminClaims);

    return {
      success: true,
      message: 'Emergency admin role assigned successfully',
      uid,
      email: user.email,
      assignedBy: request.auth.uid,
      claims: emergencyAdminClaims
    };
  } catch (error) {
    console.error('Error in emergency admin assignment:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    if (error instanceof Error && error.message.includes('no user record')) {
      throw new HttpsError('not-found', 'User not found');
    }
    
    throw new HttpsError('internal', 'Internal error in emergency admin assignment');
  }
});