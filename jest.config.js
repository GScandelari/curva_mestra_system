const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  coverageProvider: 'v8',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/lib/firebase$': '<rootDir>/src/lib/__mocks__/firebase.ts',
  },
};

module.exports = createJestConfig(config);
