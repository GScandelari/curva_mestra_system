const nodemailer = require('nodemailer');

/**
 * Email service for sending notifications
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    try {
      // Check if email configuration is available
      const emailConfig = {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      };

      // If no SMTP configuration is provided, use a test account or log-only mode
      if (!emailConfig.host || !emailConfig.auth.user) {
        console.log('No SMTP configuration found. Email notifications will be logged only.');
        this.isConfigured = false;
        return;
      }

      this.transporter = nodemailer.createTransporter(emailConfig);
      this.isConfigured = true;

      // Verify connection configuration
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('Email service configuration error:', error);
          this.isConfigured = false;
        } else {
          console.log('Email service is ready to send messages');
        }
      });

    } catch (error) {
      console.error('Error initializing email service:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Send email notification
   */
  async sendNotificationEmail(to, subject, message, notificationType = 'info') {
    try {
      if (!this.isConfigured) {
        // Log the email that would be sent
        console.log('EMAIL NOTIFICATION (Log Only):', {
          to,
          subject,
          message,
          type: notificationType,
          timestamp: new Date().toISOString()
        });
        return { success: true, method: 'logged' };
      }

      const htmlContent = this.generateEmailTemplate(subject, message, notificationType);

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text: message,
        html: htmlContent
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId, method: 'smtp' };

    } catch (error) {
      console.error('Error sending email:', error);
      
      // Fallback to logging if email fails
      console.log('EMAIL NOTIFICATION (Fallback Log):', {
        to,
        subject,
        message,
        type: notificationType,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return { success: false, error: error.message, method: 'fallback_log' };
    }
  }

  /**
   * Generate HTML email template
   */
  generateEmailTemplate(subject, message, type) {
    const typeColors = {
      error: '#dc2626',
      warning: '#d97706',
      info: '#2563eb',
      success: '#16a34a'
    };

    const color = typeColors[type] || typeColors.info;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: ${color};
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .content {
            background-color: #f9fafb;
            padding: 30px;
            border-radius: 0 0 8px 8px;
            border: 1px solid #e5e7eb;
            border-top: none;
          }
          .message {
            background-color: white;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid ${color};
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
          .system-name {
            font-weight: bold;
            color: ${color};
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">Sistema de Gestão de Inventário</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Clínica de Harmonização</p>
        </div>
        
        <div class="content">
          <h2 style="color: ${color}; margin-top: 0;">${subject}</h2>
          
          <div class="message">
            <p style="margin: 0;">${message}</p>
          </div>
          
          <div class="footer">
            <p>Esta é uma notificação automática do <span class="system-name">Sistema de Gestão de Inventário</span>.</p>
            <p>Por favor, não responda a este email.</p>
            <p><small>Enviado em ${new Date().toLocaleString('pt-BR')}</small></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send bulk email notifications
   */
  async sendBulkNotifications(recipients, subject, message, type = 'info') {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const result = await this.sendNotificationEmail(recipient, subject, message, type);
        results.push({ recipient, ...result });
      } catch (error) {
        results.push({ 
          recipient, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return results;
  }

  /**
   * Test email configuration
   */
  async testConfiguration() {
    if (!this.isConfigured) {
      return { success: false, message: 'Email service is not configured' };
    }

    try {
      await this.transporter.verify();
      return { success: true, message: 'Email configuration is valid' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;