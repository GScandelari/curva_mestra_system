const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

const config = {
  testEnvironment: 'node',
  coverageProvider: 'v8',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  setupFiles: ['<rootDir>/src/lib/__mocks__/firebase-env.ts'],
};

module.exports = async () => {
  const jestConfig = await createJestConfig(config)();
  return {
    ...jestConfig,
    setupFiles: ['<rootDir>/src/lib/__mocks__/firebase-env.ts'],
    moduleNameMapper: {
      ...jestConfig.moduleNameMapper,
    },
  };
};
