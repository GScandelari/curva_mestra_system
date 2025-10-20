// Main server entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const https = require('https');
const http = require('http');
const auditBackupService = require('./services/auditBackupService');
const { AlertService } = require('./services');
const sslConfig = require('./config/ssl');
const ProductionConfig = require('./config/production');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';
const isProduction = process.env.NODE_ENV === 'production';

// Configure trust proxy for production
if (isProduction) {
  ProductionConfig.configureTrustProxy(app);
}

// Middleware
if (isProduction) {
  // Production-specific middleware
  const securityMiddleware = ProductionConfig.getSecurityMiddleware();
  securityMiddleware.forEach(middleware => app.use(middleware));
  
  const corsOptions = ProductionConfig.getCorsOptions();
  app.use(cors(corsOptions));
  
  // Use structured logging instead of morgan
  app.use(requestLogger);
} else {
  // Development middleware
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(requestLogger); // Use structured logging in development too
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
const apiRoutes = require('./routes');
app.use('/api', apiRoutes);

// Import error handling middleware
const { globalErrorHandler, AppError, ErrorCodes } = require('./middleware');

// 404 handler
app.use('*', (req, res, next) => {
  const error = new AppError(
    `Endpoint não encontrado: ${req.originalUrl}`,
    404,
    ErrorCodes.INVALID_DATA_FORMAT
  );
  next(error);
});

// Global error handling middleware (must be last)
app.use(globalErrorHandler);

// Create server (HTTP or HTTPS based on environment)
let server;

if (isProduction) {
  const sslOptions = sslConfig.getSSLOptions();
  
  if (sslOptions) {
    // Validate SSL certificate
    if (!sslConfig.validateCertificate()) {
      console.error('SSL certificate is invalid or expired');
      process.exit(1);
    }
    
    server = https.createServer(sslOptions, app);
    console.log('HTTPS server configured');
  } else {
    server = http.createServer(app);
    console.log('HTTP server configured (SSL certificates not found)');
  }
} else {
  server = http.createServer(app);
}

server.listen(PORT, HOST, async () => {
  const protocol = isProduction && sslConfig.getSSLOptions() ? 'https' : 'http';
  
  // Log application startup
  logger.logStartup({
    protocol,
    host: HOST,
    port: PORT,
    environment: process.env.NODE_ENV,
    sslEnabled: !!(isProduction && sslConfig.getSSLOptions())
  });
  
  // Initialize audit backup service
  try {
    await auditBackupService.initialize();
    logger.info('Audit backup service initialized');
  } catch (error) {
    logger.error('Failed to initialize audit backup service', { error: error.message });
  }

  // Start alert scheduler
  try {
    AlertService.startAlertScheduler();
    logger.info('Alert scheduler started');
  } catch (error) {
    logger.error('Failed to start alert scheduler', { error: error.message });
  }
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.logShutdown(signal);
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Stop services
    auditBackupService.stopBackupSchedule();
    AlertService.stopAlertScheduler();
    
    process.exit(0);
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;