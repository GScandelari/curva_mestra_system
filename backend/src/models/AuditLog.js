const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true, // Can be null for system operations
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
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
  resourceId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'resource_id',
    comment: 'ID of the affected resource'
  },
  oldValues: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'old_values',
    comment: 'Previous values before change'
  },
  newValues: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'new_values',
    comment: 'New values after change'
  },
  ipAddress: {
    type: DataTypes.INET,
    allowNull: true,
    field: 'ip_address',
    comment: 'IP address of the user'
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'user_agent',
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
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message',
    comment: 'Error message if action failed'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional metadata about the action'
  }
}, {
  tableName: 'audit_logs',
  timestamps: false, // We use our own timestamp field
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['action']
    },
    {
      fields: ['resource']
    },
    {
      fields: ['resource_id']
    },
    {
      fields: ['timestamp']
    },
    {
      fields: ['success']
    },
    {
      // Composite index for common queries
      fields: ['resource', 'action', 'timestamp']
    },
    {
      // Index for user activity queries
      fields: ['user_id', 'timestamp']
    }
  ]
});

module.exports = AuditLog;