// Models index file
const sequelize = require('../config/database');

// Import all models
const User = require('./User');
const Product = require('./Product');
const Invoice = require('./Invoice');
const Patient = require('./Patient');
const ProductRequest = require('./ProductRequest');
const RequestedProduct = require('./RequestedProduct');
const Treatment = require('./Treatment');
const UsedProduct = require('./UsedProduct');
const StockMovement = require('./StockMovement');
const AuditLog = require('./AuditLog');
const Notification = require('./Notification');

// Define associations
// User associations
User.hasMany(Product, { foreignKey: 'entryUserId', as: 'enteredProducts' });
User.hasMany(Invoice, { foreignKey: 'userId', as: 'invoices' });
User.hasMany(ProductRequest, { foreignKey: 'requesterId', as: 'requests' });
User.hasMany(ProductRequest, { foreignKey: 'approverId', as: 'approvedRequests' });
User.hasMany(Treatment, { foreignKey: 'doctorId', as: 'treatments' });
User.hasMany(StockMovement, { foreignKey: 'userId', as: 'stockMovements' });
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });

// Product associations
Product.belongsTo(User, { foreignKey: 'entryUserId', as: 'entryUser' });
Product.hasMany(RequestedProduct, { foreignKey: 'productId', as: 'requestedProducts' });
Product.hasMany(UsedProduct, { foreignKey: 'productId', as: 'usedProducts' });
Product.hasMany(StockMovement, { foreignKey: 'productId', as: 'stockMovements' });

// Invoice associations
Invoice.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Patient associations
Patient.hasMany(ProductRequest, { foreignKey: 'patientId', as: 'requests' });
Patient.hasMany(Treatment, { foreignKey: 'patientId', as: 'treatments' });
Patient.hasMany(StockMovement, { foreignKey: 'patientId', as: 'stockMovements' });

// ProductRequest associations
ProductRequest.belongsTo(User, { foreignKey: 'requesterId', as: 'requester' });
ProductRequest.belongsTo(User, { foreignKey: 'approverId', as: 'approver' });
ProductRequest.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
ProductRequest.hasMany(RequestedProduct, { foreignKey: 'requestId', as: 'requestedProducts' });
ProductRequest.hasMany(StockMovement, { foreignKey: 'requestId', as: 'stockMovements' });

// RequestedProduct associations
RequestedProduct.belongsTo(ProductRequest, { foreignKey: 'requestId', as: 'request' });
RequestedProduct.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// Treatment associations
Treatment.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
Treatment.belongsTo(User, { foreignKey: 'doctorId', as: 'doctor' });
Treatment.hasMany(UsedProduct, { foreignKey: 'treatmentId', as: 'usedProducts' });

// UsedProduct associations
UsedProduct.belongsTo(Treatment, { foreignKey: 'treatmentId', as: 'treatment' });
UsedProduct.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

// StockMovement associations
StockMovement.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
StockMovement.belongsTo(User, { foreignKey: 'userId', as: 'user' });
StockMovement.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });
StockMovement.belongsTo(ProductRequest, { foreignKey: 'requestId', as: 'request' });

// AuditLog associations
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Notification associations
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });

// Initialize database connection
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexão com a base de dados estabelecida com sucesso.');
    
    // Sync all models
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Modelos sincronizados com a base de dados.');
  } catch (error) {
    console.error('Erro ao conectar com a base de dados:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  initializeDatabase,
  User,
  Product,
  Invoice,
  Patient,
  ProductRequest,
  RequestedProduct,
  Treatment,
  UsedProduct,
  StockMovement,
  AuditLog,
  Notification
};