const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('audit_logs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      action: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Action performed (CREATE, UPDATE, DELETE, LOGIN, etc.)'
      },
      resource: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Resource affected (Product, Patient, Request, etc.)'
      },
      resource_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID of the affected resource'
      },
      old_values: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Previous values before change'
      },
      new_values: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'New values after change'
      },
      ip_address: {
        type: DataTypes.INET,
        allowNull: true,
        comment: 'IP address of the user'
      },
      user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'User agent string'
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'When the action occurred'
      },
      success: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the action was successful'
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Error message if action failed'
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Additional metadata about the action'
      }
    });

    // Create indexes for better query performance
    await queryInterface.addIndex('audit_logs', ['user_id']);
    await queryInterface.addIndex('audit_logs', ['action']);
    await queryInterface.addIndex('audit_logs', ['resource']);
    await queryInterface.addIndex('audit_logs', ['resource_id']);
    await queryInterface.addIndex('audit_logs', ['timestamp']);
    await queryInterface.addIndex('audit_logs', ['success']);
    
    // Composite indexes for common queries
    await queryInterface.addIndex('audit_logs', ['resource', 'action', 'timestamp']);
    await queryInterface.addIndex('audit_logs', ['user_id', 'timestamp']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('audit_logs');
  }
};