const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('product_requests', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      requester_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'fulfilled'),
        allowNull: false,
        defaultValue: 'pending'
      },
      request_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      approval_date: {
        type: DataTypes.DATE,
        allowNull: true
      },
      approver_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      patient_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'patients',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // Create indexes
    await queryInterface.addIndex('product_requests', ['requester_id']);
    await queryInterface.addIndex('product_requests', ['status']);
    await queryInterface.addIndex('product_requests', ['request_date']);
    await queryInterface.addIndex('product_requests', ['patient_id']);
    await queryInterface.addIndex('product_requests', ['approver_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('product_requests');
  }
};