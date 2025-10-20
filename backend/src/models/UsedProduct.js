const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UsedProduct = sequelize.define('UsedProduct', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  treatmentId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'treatment_id',
    references: {
      model: 'treatments',
      key: 'id'
    }
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'product_id',
    references: {
      model: 'products',
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  batchNumber: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'batch_number'
  }
}, {
  tableName: 'used_products',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['treatment_id']
    },
    {
      fields: ['product_id']
    },
    {
      fields: ['batch_number']
    }
  ]
});

module.exports = UsedProduct;