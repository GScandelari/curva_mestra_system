const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

const config = {
  testEnvironment: 'node',
  coverageProvider: 'v8',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
};

module.exports = async () => {
  const jestConfig = await createJestConfig(config)();
  return {
    ...jestConfig,
    moduleNameMapper: {
      '^@/lib/firebase$': '<rootDir>/src/lib/__mocks__/firebase.ts',
      ...jestConfig.moduleNameMapper,
    },
  };
};
