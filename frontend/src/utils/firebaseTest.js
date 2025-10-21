// Firebase connection test utility
import { auth, db } from '../config/firebase';
import { connectAuthEmulator, connectFirestoreEmulator } from 'firebase/auth';

export const testFirebaseConnection = async () => {
  try {
    console.log('Testing Firebase connection...');
    
    // Test Auth connection
    console.log('Auth instance:', auth);
    console.log('Auth app:', auth.app);
    
    // Test Firestore connection
    console.log('Firestore instance:', db);
    console.log('Firestore app:', db.app);
    
    console.log('Firebase configuration loaded successfully!');
    return true;
  } catch (error) {
    console.error('Firebase connection test failed:', error);
    return false;
  }
};

// Function to connect to Firebase emulators in development
export const connectToEmulators = () => {
  if (import.meta.env.DEV) {
    try {
      connectAuthEmulator(auth, 'http://localhost:9099');
      connectFirestoreEmulator(db, 'localhost', 8080);
      console.log('Connected to Firebase emulators');
    } catch (error) {
      console.log('Emulators not available or already connected');
    }
  }
};