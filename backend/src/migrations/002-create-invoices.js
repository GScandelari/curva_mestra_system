const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('invoices', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      supplier: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      issue_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      receipt_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      total_value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
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
    await queryInterface.addIndex('invoices', ['number'], { unique: true });
    await queryInterface.addIndex('invoices', ['supplier']);
    await queryInterface.addIndex('invoices', ['issue_date']);
    await queryInterface.addIndex('invoices', ['receipt_date']);
    await queryInterface.addIndex('invoices', ['user_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('invoices');
  }
};