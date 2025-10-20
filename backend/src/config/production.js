const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

/**
 * Production-specific middleware and configurations
 */
class ProductionConfig {
  /**
   * Get security middleware for production
   * @returns {Array} Array of middleware functions
   */
  static getSecurityMiddleware() {
    return [
      // Enhanced helmet configuration for production
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        crossOriginEmbedderPolicy: false,
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      }),

      // Compression middleware
      compression({
        level: 6,
        threshold: 1024,
        filter: (req, res) => {
          if (req.headers['x-no-compression']) {
            return false;
          }
          return compression.filter(req, res);
        }
      }),

      // Rate limiting
      rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
        message: {
          error: 'Muitas tentativas. Tente novamente mais tarde.',
          code: 'RATE_LIMIT_EXCEEDED'
        },
        standardHeaders: true,
        legacyHeaders: false,
      })
    ];
  }

  /**
   * Get CORS configuration for production
   * @returns {Object} CORS options
   */
  static getCorsOptions() {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['https://yourdomain.com'];

    return {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Não permitido pelo CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count']
    };
  }

  /**
   * Get logging configuration for production
   * @returns {Object} Morgan logging options
   */
  static getLoggingOptions() {
    return {
      format: 'combined',
      skip: (req, res) => {
        // Skip health check logs
        return req.url === '/health';
      }
    };
  }

  /**
   * Configure trust proxy settings
   * @param {Object} app Express app instance
   */
  static configureTrustProxy(app) {
    // Trust first proxy (load balancer, reverse proxy)
    app.set('trust proxy', 1);
  }

  /**
   * Configure session settings for production
   * @returns {Object} Session configuration
   */
  static getSessionConfig() {
    return {
      secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true, // HTTPS only
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
        sameSite: 'strict'
      }
    };
  }
}

module.exports = ProductionConfig;