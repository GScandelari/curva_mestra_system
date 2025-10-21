import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';

/**
 * User Role Manager for Admin System Organization
 * Handles custom claims assignment and admin role verification
 */

/**
 * Sets admin role for a specific user
 * @param uid - User ID to assign admin role to
 */
export const setAdminRole = onCall(async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { uid } = request.data;

  // Validate required parameters
  if (!uid) {
    throw new HttpsError('invalid-argument', 'UID is required');
  }

  try {
    // Verify user exists
    const user = await getAuth().getUser(uid);
    
    // Set admin custom claims
    const adminClaims = {
      admin: true,
      role: 'administrator',
      permissions: [
        'view_products', 'manage_products', 'view_requests', 'approve_requests',
        'view_patients', 'manage_patients', 'view_invoices', 'manage_invoices',
        'view_reports', 'manage_users', 'view_analytics', 'manage_settings',
        'system_admin'
      ],
      assignedAt: new Date().toISOString()
    };

    await getAuth().setCustomUserClaims(uid, adminClaims);

    return {
      success: true,
      message: `Admin role assigned to user ${uid}`,
      claims: adminClaims,
      userEmail: user.email
    };
  } catch (error) {
    console.error('Error setting admin role:', error);
    
    if (error instanceof Error && error.message.includes('no user record')) {
      throw new HttpsError('not-found', 'User not found');
    }
    
    throw new HttpsError('internal', 'Internal error setting admin role');
  }
});

/**
 * Verifies if a user has admin role
 * @param uid - User ID to verify admin role for
 */
export const verifyAdminRole = onCall(async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { uid } = request.data;
  const targetUid = uid || request.auth.uid;

  try {
    const user = await getAuth().getUser(targetUid);
    const customClaims = user.customClaims || {};
    
    const isAdmin = customClaims.admin === true || customClaims.role === 'administrator';
    
    return {
      success: true,
      isAdmin,
      uid: targetUid,
      email: user.email,
      claims: customClaims
    };
  } catch (error) {
    console.error('Error verifying admin role:', error);
    
    if (error instanceof Error && error.message.includes('no user record')) {
      throw new HttpsError('not-found', 'User not found');
    }
    
    throw new HttpsError('internal', 'Internal error verifying admin role');
  }
});

/**
 * Gets user role information
 * @param uid - User ID to get role information for
 */
export const getUserRole = onCall(async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { uid } = request.data;
  const targetUid = uid || request.auth.uid;

  try {
    const user = await getAuth().getUser(targetUid);
    const customClaims = user.customClaims || {};
    
    return {
      success: true,
      uid: targetUid,
      email: user.email,
      displayName: user.displayName,
      role: customClaims.role || 'user',
      isAdmin: customClaims.admin === true,
      permissions: customClaims.permissions || [],
      assignedAt: customClaims.assignedAt || null
    };
  } catch (error) {
    console.error('Error getting user role:', error);
    
    if (error instanceof Error && error.message.includes('no user record')) {
      throw new HttpsError('not-found', 'User not found');
    }
    
    throw new HttpsError('internal', 'Internal error getting user role');
  }
});