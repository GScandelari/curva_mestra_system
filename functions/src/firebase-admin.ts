import { initializeApp, getApps } from 'firebase-admin/app';

/**
 * Centralized Firebase Admin SDK initialization
 * Ensures the app is initialized only once
 */

// Initialize Firebase Admin SDK only if not already initialized
if (getApps().length === 0) {
  initializeApp();
}

export { getAuth } from 'firebase-admin/auth';