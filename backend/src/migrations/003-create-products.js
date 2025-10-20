const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable('products', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      category: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      unit: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'unidade'
      },
      minimum_stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      current_stock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      expiration_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      invoice_number: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      entry_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      entry_user_id: {
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
    await queryInterface.addIndex('products', ['category']);
    await queryInterface.addIndex('products', ['expiration_date']);
    await queryInterface.addIndex('products', ['invoice_number']);
    await queryInterface.addIndex('products', ['current_stock']);
    await queryInterface.addIndex('products', ['entry_user_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('products');
  }
};