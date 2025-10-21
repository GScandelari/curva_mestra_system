# Firebase Setup Documentation

## Overview

This document describes the Firebase configuration for the Curva Mestra system migration.

## Project Configuration

- **Project ID**: curva-mestra
- **Project Name**: Curva Mestra
- **API Key**: AIzaSyBtNXznf7cvdzGCcBym84ux-SjJrrKaSJU

## Services Configured

### 1. Firebase Hosting
- **Public Directory**: `frontend/dist`
- **SPA Configuration**: Enabled (all routes redirect to index.html)
- **Cache Headers**: Configured for static assets

### 2. Cloud Firestore
- **Database Location**: northamerica-south1
- **Rules File**: `firestore.rules`
- **Indexes File**: `firestore.indexes.json`

### 3. Firebase Functions
- **Runtime**: Node.js 22
- **Language**: TypeScript
- **Source Directory**: `functions/src`
- **Build Directory**: `functions/lib`

### 4. Firebase Authentication
- **Providers**: Email/Password (to be configured)
- **Custom Claims**: Supported for role-based access

### 5. Cloud Storage
- **Rules File**: `storage.rules`

## Development Setup

### Prerequisites
- Node.js 16+
- Firebase CLI installed globally
- Firebase project access

### Installation
```bash
# Install all dependencies
npm run install:all

# Build functions
cd functions && npm run build

# Build frontend
cd frontend && npm run build
```

### Development with Emulators
```bash
# Start Firebase emulators
firebase emulators:start

# Or use npm script
npm run dev:firebase
```

### Emulator Ports
- **Auth Emulator**: http://localhost:9099
- **Firestore Emulator**: http://localhost:8080
- **Functions Emulator**: http://localhost:5001
- **Hosting Emulator**: http://localhost:5000
- **Storage Emulator**: http://localhost:9199
- **Emulator UI**: http://localhost:4000

## Environment Variables

### Frontend (.env)
```
VITE_FIREBASE_API_KEY=AIzaSyBtNXznf7cvdzGCcBym84ux-SjJrrKaSJU
VITE_FIREBASE_AUTH_DOMAIN=curva-mestra.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=curva-mestra
VITE_FIREBASE_STORAGE_BUCKET=curva-mestra.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1079488992
VITE_FIREBASE_APP_ID=1:1079488992:web:your-app-id-here
```

### Backend (for Firebase Admin SDK)
```
FIREBASE_SERVICE_ACCOUNT_KEY=<service-account-json>
```

## Deployment

### Deploy All Services
```bash
firebase deploy
```

### Deploy Specific Services
```bash
# Deploy only hosting
firebase deploy --only hosting

# Deploy only functions
firebase deploy --only functions

# Deploy only firestore rules
firebase deploy --only firestore
```

## File Structure

```
├── firebase.json              # Firebase configuration
├── firestore.rules           # Firestore security rules
├── firestore.indexes.json    # Firestore indexes
├── storage.rules             # Storage security rules
├── functions/                # Cloud Functions
│   ├── src/                  # TypeScript source
│   ├── lib/                  # Compiled JavaScript
│   ├── package.json          # Functions dependencies
│   └── tsconfig.json         # TypeScript configuration
├── frontend/
│   ├── src/config/firebase.js # Firebase client configuration
│   └── dist/                 # Built frontend (for hosting)
└── backend/
    └── src/config/firebase.js # Firebase Admin configuration
```

## Next Steps

1. **Configure Authentication Providers** in Firebase Console
2. **Set up Custom Claims** for user roles
3. **Configure Firestore Security Rules** based on requirements
4. **Set up Service Account** for production backend
5. **Configure Domain** for hosting (if needed)

## Security Notes

- Current Firestore and Storage rules are temporary (expire 2025-11-19)
- Production rules must be implemented before expiration
- Service account key should be stored securely in production
- API keys are public but restricted by domain in Firebase Console