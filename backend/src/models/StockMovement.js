const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StockMovement = sequelize.define('StockMovement', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
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
  movementType: {
    type: DataTypes.ENUM('entry', 'exit', 'adjustment'),
    allowNull: false,
    field: 'movement_type'
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notZero(value) {
        if (value === 0) {
          throw new Error('Quantity cannot be zero');
        }
      }
    }
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'patient_id',
    references: {
      model: 'patients',
      key: 'id'
    }
  },
  requestId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'request_id',
    references: {
      model: 'product_requests',
      key: 'id'
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'stock_movements',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['product_id']
    },
    {
      fields: ['movement_type']
    },
    {
      fields: ['date']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['patient_id']
    }
  ]
});

module.exports = StockMovement;