import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

/**
 * Firebase Configuration
 * 
 * This file initializes Firebase services for the frontend application
 */

// Firebase configuration object
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "curva-mestra.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "curva-mestra",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "curva-mestra.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef123456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Connect to emulators in development
if (process.env.NODE_ENV === 'development' && !auth._delegate._config.emulator) {
  try {
    // Connect to Auth emulator
    if (process.env.REACT_APP_FIREBASE_AUTH_EMULATOR_HOST) {
      const [host, port] = process.env.REACT_APP_FIREBASE_AUTH_EMULATOR_HOST.split(':');
      connectAuthEmulator(auth, `http://${host}:${port}`, { disableWarnings: true });
    }

    // Connect to Firestore emulator
    if (process.env.REACT_APP_FIREBASE_FIRESTORE_EMULATOR_HOST) {
      const [host, port] = process.env.REACT_APP_FIREBASE_FIRESTORE_EMULATOR_HOST.split(':');
      connectFirestoreEmulator(db, host, parseInt(port));
    }

    // Connect to Functions emulator
    if (process.env.REACT_APP_FIREBASE_FUNCTIONS_EMULATOR_HOST) {
      const [host, port] = process.env.REACT_APP_FIREBASE_FUNCTIONS_EMULATOR_HOST.split(':');
      connectFunctionsEmulator(functions, host, parseInt(port));
    }

    console.log('🔧 Connected to Firebase emulators');
  } catch (error) {
    console.warn('⚠️ Could not connect to Firebase emulators:', error.message);
  }
}

export default app;