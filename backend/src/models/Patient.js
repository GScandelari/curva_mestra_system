const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Patient = sequelize.define('Patient', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      is: /^[\d\s\-\+\(\)]+$/
    }
  },
  birthDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'birth_date',
    validate: {
      isDate: true
    }
  },
  address: {
    type: DataTypes.JSON,
    allowNull: true,
    validate: {
      isValidAddress(value) {
        if (value && typeof value === 'object') {
          const requiredFields = ['street', 'city', 'zipCode'];
          const hasRequiredFields = requiredFields.every(field => 
            value[field] && typeof value[field] === 'string'
          );
          if (!hasRequiredFields) {
            throw new Error('Address must contain street, city, and zipCode');
          }
        }
      }
    }
  },
  medicalHistory: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'medical_history'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'patients',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['name']
    },
    {
      fields: ['email']
    },
    {
      fields: ['phone']
    },
    {
      fields: ['is_active']
    }
  ]
});

module.exports = Patient;