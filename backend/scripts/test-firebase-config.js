/**
 * Test Firebase Configuration
 * 
 * This script tests the Firebase configuration and connection
 */

const firebaseConfig = require('../src/config/firebase');

async function testFirebaseConfig() {
  console.log('🔥 Testing Firebase Configuration...\n');

  try {
    // Initialize Firebase
    console.log('1. Initializing Firebase Admin SDK...');
    firebaseConfig.initialize();
    console.log('✅ Firebase Admin SDK initialized successfully\n');

    // Test Auth service
    console.log('2. Testing Firebase Auth service...');
    const auth = firebaseConfig.getAuth();
    console.log('✅ Firebase Auth service accessible\n');

    // Test Firestore service
    console.log('3. Testing Firestore service...');
    const firestore = firebaseConfig.getFirestore();
    console.log('✅ Firestore service accessible\n');

    // Test creating a test document (will be deleted)
    console.log('4. Testing Firestore write/read operations...');
    const testDoc = firestore.collection('test').doc('config-test');
    
    await testDoc.set({
      message: 'Firebase configuration test',
      timestamp: new Date(),
      success: true
    });
    console.log('✅ Test document created');

    const docSnapshot = await testDoc.get();
    if (docSnapshot.exists) {
      console.log('✅ Test document read successfully');
      console.log('   Data:', docSnapshot.data());
    }

    // Clean up test document
    await testDoc.delete();
    console.log('✅ Test document deleted\n');

    console.log('🎉 All Firebase services are working correctly!');
    console.log('\nNext steps:');
    console.log('- Run user migration: node scripts/migrate-users-to-firebase.js migrate');
    console.log('- Deploy Firebase Functions: npm run deploy (in functions directory)');
    console.log('- Update frontend to use Firebase Auth');

  } catch (error) {
    console.error('❌ Firebase configuration test failed:', error);
    console.log('\nTroubleshooting:');
    console.log('1. Check if Firebase project ID is correct');
    console.log('2. Verify service account key is properly configured');
    console.log('3. Ensure Firebase services are enabled in the console');
    console.log('4. Check network connectivity');
    
    process.exit(1);
  }
}

// Run test
testFirebaseConfig();