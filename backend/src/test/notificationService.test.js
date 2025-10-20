const NotificationService = require('../services/notificationService');

describe('NotificationService', () => {
  describe('shouldSendEmail', () => {
    it('should send email for expired_products type', () => {
      const result = NotificationService.shouldSendEmail('expired_products', 'warning');
      expect(result).toBe(true);
    });

    it('should send email for system_alert type', () => {
      const result = NotificationService.shouldSendEmail('system_alert', 'info');
      expect(result).toBe(true);
    });

    it('should send email for error severity', () => {
      const result = NotificationService.shouldSendEmail('low_stock', 'error');
      expect(result).toBe(true);
    });

    it('should not send email for non-critical notifications', () => {
      const result = NotificationService.shouldSendEmail('request_approved', 'success');
      expect(result).toBe(false);
    });

    it('should not send email for info severity non-critical types', () => {
      const result = NotificationService.shouldSendEmail('low_stock', 'info');
      expect(result).toBe(false);
    });
  });
});