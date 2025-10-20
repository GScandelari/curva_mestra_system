const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductRequest = sequelize.define('ProductRequest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  requesterId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'requester_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'fulfilled'),
    allowNull: false,
    defaultValue: 'pending'
  },
  requestDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'request_date'
  },
  approvalDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'approval_date'
  },
  approverId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'approver_id',
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
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'product_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['requester_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['request_date']
    },
    {
      fields: ['patient_id']
    }
  ]
});

module.exports = ProductRequest;