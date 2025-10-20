const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
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
      len: [1, 100]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'unidade',
    validate: {
      notEmpty: true
    }
  },
  minimumStock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'minimum_stock',
    validate: {
      min: 0
    }
  },
  currentStock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'current_stock',
    validate: {
      min: 0
    }
  },
  expirationDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'expiration_date',
    validate: {
      isDate: true
    }
  },
  invoiceNumber: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'invoice_number',
    validate: {
      notEmpty: true
    }
  },
  entryDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'entry_date'
  },
  entryUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'entry_user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  isExpired: {
    type: DataTypes.VIRTUAL,
    get() {
      return new Date(this.expirationDate) < new Date();
    }
  },
  daysToExpiration: {
    type: DataTypes.VIRTUAL,
    get() {
      const today = new Date();
      const expDate = new Date(this.expirationDate);
      const diffTime = expDate - today;
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
  },
  isLowStock: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.currentStock <= this.minimumStock;
    }
  }
}, {
  tableName: 'products',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['category']
    },
    {
      fields: ['expiration_date']
    },
    {
      fields: ['invoice_number']
    },
    {
      fields: ['current_stock']
    }
  ]
});

module.exports = Product;