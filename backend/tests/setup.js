// Test setup file
require('dotenv').config({ path: '.env.test' });

const { sequelize } = require('../src/models');

// Global test setup
beforeAll(async () => {
  // Setup test database connection
  try {
    await sequelize.authenticate();
    
    // Enable foreign key constraints for SQLite
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON');
    }
    
    // Force sync for test environment - this will recreate tables
    await sequelize.sync({ force: true });
    console.log('Test database setup completed');
  } catch (error) {
    console.error('Test database setup failed:', error);
    throw error;
  }
});

afterAll(async () => {
  // Cleanup after all tests
  try {
    await sequelize.close();
    console.log('Test database connection closed');
  } catch (error) {
    console.error('Error closing test database:', error);
  }
});

beforeEach(async () => {
  // Clean all tables before each test
  try {
    await sequelize.truncate({ cascade: true, restartIdentity: true });
  } catch (error) {
    console.error('Error cleaning test database:', error);
  }
});

afterEach(() => {
  // Cleanup after each test if needed
});