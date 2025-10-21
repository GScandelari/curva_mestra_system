# Firebase Authentication Setup Guide

This document provides instructions for setting up and using Firebase Authentication in the Curva Mestra system.

## Overview

The system has been migrated from JWT-based authentication to Firebase Authentication, providing:

- Managed authentication service
- Custom claims for role-based access control
- Secure token management
- Integration with Firebase Functions
- Real-time authentication state management

## Prerequisites

1. Firebase project "curva-mestra" configured
2. Firebase CLI installed and authenticated
3. Firebase services enabled:
   - Authentication (Email/Password provider)
   - Firestore
   - Functions
   - Hosting

## Configuration

### Backend Configuration

1. **Environment Variables** (`.env`):
```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=curva-mestra
FIREBASE_SERVICE_ACCOUNT_PATH=config/firebase-service-account.json
FIREBASE_SERVICE_ACCOUNT_KEY=
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099  # For development
```

2. **Service Account Key**:
   - Download service account key from Firebase Console
   - Place in `backend/config/firebase-service-account.json`
   - Or set as environment variable `FIREBASE_SERVICE_ACCOUNT_KEY`

### Frontend Configuration

1. **Environment Variables** (`.env`):
```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyBtNXznf7cvdzGCcBym84ux-SjJrrKaSJU
VITE_FIREBASE_AUTH_DOMAIN=curva-mestra.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=curva-mestra
VITE_FIREBASE_STORAGE_BUCKET=curva-mestra.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456

# Firebase Emulator Configuration (Development)
REACT_APP_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
REACT_APP_FIREBASE_FIRESTORE_EMULATOR_HOST=localhost:8080
REACT_APP_FIREBASE_FUNCTIONS_EMULATOR_HOST=localhost:5001
```

## User Migration

### Step 1: Test Firebase Configuration

```bash
cd backend
node scripts/test-firebase-config.js
```

### Step 2: Migrate Users from PostgreSQL

```bash
cd backend
node scripts/migrate-users-to-firebase.js migrate
```

### Step 3: Validate Migration

```bash
cd backend
node scripts/migrate-users-to-firebase.js validate
```

### Step 4: Rollback (if needed)

```bash
cd backend
node scripts/migrate-users-to-firebase.js rollback
```

## Custom Claims Structure

Firebase Auth users have the following custom claims:

```javascript
{
  role: 'admin' | 'doctor' | 'receptionist' | 'manager',
  permissions: string[],
  clinicId: string,
  migrated: boolean,
  migratedAt: string,
  originalUserId: string
}
```

### Role Permissions

- **admin**: All permissions + `admin: true` claim
- **manager**: Product management, request approval, reports, invoices
- **doctor**: Product viewing/requesting, patient management, treatments
- **receptionist**: Patient management, request viewing, invoice viewing

## Firebase Functions

### Authentication Functions

1. **setUserRole**: Set custom claims for users (admin only)
2. **getUserProfile**: Get user profile with custom claims
3. **updateUserProfile**: Update user profile information
4. **initializeClinic**: Create clinic and set user as admin
5. **listClinicUsers**: List users in a clinic (admin/manager only)

### Usage Example

```javascript
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

// Set user role
const setUserRole = httpsCallable(functions, 'setUserRole');
await setUserRole({
  uid: 'user-id',
  role: 'doctor',
  clinicId: 'clinic-id'
});
```

## Frontend Integration

### AuthContext Updates

The `AuthContext` has been updated to use Firebase Auth:

- Automatic token refresh
- Real-time auth state changes
- Custom claims integration
- Role-based permissions

### API Client Updates

The API client automatically includes Firebase ID tokens:

```javascript
// Automatic token inclusion
const response = await api.get('/products');
```

### Authentication Service

New `firebaseAuthService` provides:

```javascript
// Login
await firebaseAuthService.login({ email, password });

// Logout
await firebaseAuthService.logout();

// Password reset
await firebaseAuthService.forgotPassword(email);

// Check permissions
firebaseAuthService.hasPermission('manage_products');
```

## Development with Emulators

### Start Firebase Emulators

```bash
firebase emulators:start
```

### Emulator Ports

- Auth: `localhost:9099`
- Firestore: `localhost:8080`
- Functions: `localhost:5001`
- Hosting: `localhost:5000`
- UI: `localhost:4000`

## Security Rules

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Base authentication check
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Role check
    function hasRole(role) {
      return isAuthenticated() && request.auth.token.role == role;
    }
    
    // Clinic access check
    function sameClinic(clinicId) {
      return isAuthenticated() && request.auth.token.clinicId == clinicId;
    }
    
    match /clinics/{clinicId} {
      allow read, write: if sameClinic(clinicId);
      
      match /products/{productId} {
        allow read: if sameClinic(clinicId);
        allow write: if sameClinic(clinicId) && 
          (hasRole('admin') || hasRole('manager'));
      }
    }
  }
}
```

## Middleware Usage

### Backend Middleware

```javascript
const FirebaseAuthMiddleware = require('./middleware/firebaseAuth');

// Require authentication
app.use('/api/protected', FirebaseAuthMiddleware.authenticate);

// Require specific role
app.use('/api/admin', FirebaseAuthMiddleware.requireRole('admin'));

// Require permission
app.use('/api/products', FirebaseAuthMiddleware.requirePermission('manage_products'));

// Require same clinic
app.use('/api/clinic/:clinicId', FirebaseAuthMiddleware.requireSameClinic('clinicId'));
```

## Troubleshooting

### Common Issues

1. **Token Expired**: Tokens are automatically refreshed by Firebase SDK
2. **Permission Denied**: Check custom claims and Firestore rules
3. **User Not Found**: Ensure user migration completed successfully
4. **Emulator Connection**: Check emulator configuration and ports

### Debug Commands

```bash
# Test Firebase config
node scripts/test-firebase-config.js

# Validate user migration
node scripts/migrate-users-to-firebase.js validate

# Check Firebase project
firebase projects:list

# Check Functions deployment
firebase functions:log
```

## Migration Checklist

- [ ] Firebase project configured
- [ ] Environment variables set
- [ ] Service account key configured
- [ ] Firebase configuration tested
- [ ] Users migrated from PostgreSQL
- [ ] Migration validated
- [ ] Firebase Functions deployed
- [ ] Frontend updated to use Firebase Auth
- [ ] Security rules configured
- [ ] Testing completed

## Next Steps

1. Deploy Firebase Functions: `firebase deploy --only functions`
2. Update frontend authentication flows
3. Test end-to-end authentication
4. Configure production security rules
5. Set up monitoring and alerts

## Support

For issues or questions:
1. Check Firebase Console for errors
2. Review Firebase Functions logs
3. Test with Firebase emulators
4. Validate custom claims and permissions