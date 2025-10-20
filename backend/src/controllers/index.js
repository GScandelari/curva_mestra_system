// Controllers index file
// This file will be used to export all controllers

const authController = require('./authController');
const userController = require('./userController');
const productController = require('./productController');
const invoiceController = require('./invoiceController');
const requestController = require('./requestController');
const stockMovementController = require('./stockMovementController');

module.exports = {
  authController,
  userController,
  productController,
  invoiceController,
  requestController,
  stockMovementController
};