const fs = require('fs');
const path = require('path');

/**
 * SSL Configuration for production environment
 */
class SSLConfig {
  constructor() {
    this.certPath = process.env.SSL_CERT_PATH || '/app/ssl/cert.pem';
    this.keyPath = process.env.SSL_KEY_PATH || '/app/ssl/key.pem';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Get SSL options for HTTPS server
   * @returns {Object|null} SSL options or null if not available
   */
  getSSLOptions() {
    if (!this.isProduction) {
      return null;
    }

    try {
      if (!fs.existsSync(this.certPath) || !fs.existsSync(this.keyPath)) {
        console.warn('SSL certificates not found. Running in HTTP mode.');
        return null;
      }

      const cert = fs.readFileSync(this.certPath, 'utf8');
      const key = fs.readFileSync(this.keyPath, 'utf8');

      return {
        cert,
        key,
        // Additional SSL options for security
        secureProtocol: 'TLSv1_2_method',
        ciphers: [
          'ECDHE-RSA-AES128-GCM-SHA256',
          'ECDHE-RSA-AES256-GCM-SHA384',
          'ECDHE-RSA-AES128-SHA256',
          'ECDHE-RSA-AES256-SHA384'
        ].join(':'),
        honorCipherOrder: true
      };
    } catch (error) {
      console.error('Error loading SSL certificates:', error);
      return null;
    }
  }

  /**
   * Validate SSL certificate expiration
   * @returns {boolean} True if certificate is valid
   */
  validateCertificate() {
    if (!this.isProduction) {
      return true;
    }

    try {
      const cert = fs.readFileSync(this.certPath, 'utf8');
      const crypto = require('crypto');
      const x509 = new crypto.X509Certificate(cert);
      
      const now = new Date();
      const validTo = new Date(x509.validTo);
      const daysUntilExpiry = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 30) {
        console.warn(`SSL certificate expires in ${daysUntilExpiry} days. Please renew.`);
      }

      return validTo > now;
    } catch (error) {
      console.error('Error validating SSL certificate:', error);
      return false;
    }
  }

  /**
   * Generate self-signed certificate for development
   * @param {string} domain Domain name for certificate
   */
  generateSelfSignedCert(domain = 'localhost') {
    const { execSync } = require('child_process');
    const sslDir = path.dirname(this.certPath);

    try {
      // Create SSL directory if it doesn't exist
      if (!fs.existsSync(sslDir)) {
        fs.mkdirSync(sslDir, { recursive: true });
      }

      // Generate self-signed certificate
      const command = `openssl req -x509 -newkey rsa:4096 -keyout ${this.keyPath} -out ${this.certPath} -days 365 -nodes -subj "/C=BR/ST=State/L=City/O=Organization/CN=${domain}"`;
      
      execSync(command, { stdio: 'inherit' });
      console.log('Self-signed SSL certificate generated successfully');
    } catch (error) {
      console.error('Error generating self-signed certificate:', error);
      throw error;
    }
  }
}

module.exports = new SSLConfig();