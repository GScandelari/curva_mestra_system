const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  supplier: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 100]
    }
  },
  issueDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'issue_date',
    validate: {
      isDate: true
    }
  },
  receiptDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'receipt_date',
    validate: {
      isDate: true
    }
  },
  totalValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'total_value',
    validate: {
      min: 0
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'invoices',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['number']
    },
    {
      fields: ['supplier']
    },
    {
      fields: ['issue_date']
    },
    {
      fields: ['receipt_date']
    }
  ]
});

module.exports = Invoice;