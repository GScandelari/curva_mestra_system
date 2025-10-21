const admin = require('firebase-admin');
const path = require('path');

/**
 * Firebase Admin SDK Configuration
 */
class FirebaseConfig {
  constructor() {
    this.app = null;
    this.auth = null;
    this.firestore = null;
  }

  /**
   * Initialize Firebase Admin SDK
   */
  initialize() {
    if (this.app) {
      return this.app;
    }

    try {
      // Initialize Firebase Admin SDK
      // In production, use service account key or default credentials
      if (process.env.NODE_ENV === 'production') {
        // Use service account key file or default credentials
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          this.app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: process.env.FIREBASE_PROJECT_ID || 'curva-mestra'
          });
        } else {
          // Use default credentials (when running on Google Cloud)
          this.app = admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || 'curva-mestra'
          });
        }
      } else {
        // Development mode - use emulator or service account
        if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
          // Use Firebase emulator
          this.app = admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || 'curva-mestra'
          });
        } else {
          // Use service account for development
          const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
            path.join(__dirname, '../../config/firebase-service-account.json');
          
          try {
            const serviceAccount = require(serviceAccountPath);
            this.app = admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: process.env.FIREBASE_PROJECT_ID || 'curva-mestra'
            });
          } catch (error) {
            console.warn('Firebase service account not found, using default initialization');
            this.app = admin.initializeApp({
              projectId: process.env.FIREBASE_PROJECT_ID || 'curva-mestra'
            });
          }
        }
      }

      this.auth = admin.auth();
      this.firestore = admin.firestore();

      console.log('Firebase Admin SDK initialized successfully');
      return this.app;
    } catch (error) {
      console.error('Error initializing Firebase Admin SDK:', error);
      throw error;
    }
  }

  /**
   * Get Firebase Auth instance
   */
  getAuth() {
    if (!this.auth) {
      this.initialize();
    }
    return this.auth;
  }

  /**
   * Get Firestore instance
   */
  getFirestore() {
    if (!this.firestore) {
      this.initialize();
    }
    return this.firestore;
  }

  /**
   * Set custom claims for a user
   * @param {string} uid - User UID
   * @param {Object} claims - Custom claims object
   */
  async setCustomClaims(uid, claims) {
    try {
      await this.getAuth().setCustomUserClaims(uid, claims);
      console.log(`Custom claims set for user ${uid}:`, claims);
    } catch (error) {
      console.error(`Error setting custom claims for user ${uid}:`, error);
      throw error;
    }
  }

  /**
   * Create Firebase user with custom claims
   * @param {Object} userData - User data
   * @param {Object} customClaims - Custom claims
   */
  async createUserWithClaims(userData, customClaims) {
    try {
      const userRecord = await this.getAuth().createUser(userData);
      
      if (customClaims) {
        await this.setCustomClaims(userRecord.uid, customClaims);
      }

      return userRecord;
    } catch (error) {
      console.error('Error creating Firebase user:', error);
      throw error;
    }
  }

  /**
   * Get user by UID
   * @param {string} uid - User UID
   */
  async getUser(uid) {
    try {
      return await this.getAuth().getUser(uid);
    } catch (error) {
      console.error(`Error getting user ${uid}:`, error);
      throw error;
    }
  }

  /**
   * Delete user by UID
   * @param {string} uid - User UID
   */
  async deleteUser(uid) {
    try {
      await this.getAuth().deleteUser(uid);
      console.log(`User ${uid} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting user ${uid}:`, error);
      throw error;
    }
  }

  /**
   * Verify Firebase ID token
   * @param {string} idToken - Firebase ID token
   */
  async verifyIdToken(idToken) {
    try {
      return await this.getAuth().verifyIdToken(idToken);
    } catch (error) {
      console.error('Error verifying ID token:', error);
      throw error;
    }
  }
}

// Create singleton instance
const firebaseConfig = new FirebaseConfig();

module.exports = firebaseConfig;