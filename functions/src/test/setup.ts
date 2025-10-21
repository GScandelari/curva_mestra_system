/**
 * Jest Test Setup
 * Global configuration and utilities for Firebase Functions tests
 */

import * as admin from 'firebase-admin';

// Increase timeout for Firebase operations
jest.setTimeout(30000);

// Initialize Firebase Admin SDK for testing
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'curva-mestra-test',
    credential: admin.credential.applicationDefault()
  });
}

// Global test cleanup
afterAll(async () => {
  // Clean up any remaining Firebase connections
  await Promise.all(admin.apps.map(app => app ? app.delete() : Promise.resolve()));
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};