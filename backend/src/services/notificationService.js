const { Notification, User } = require('../models');
const { Op } = require('sequelize');
const emailService = require('./emailService');

/**
 * Notification service for managing user notifications and email alerts
 */
class NotificationService {
  /**
   * Create a new notification
   */
  static async createNotification({
    userId,
    type,
    title,
    message,
    data = null,
    severity = 'info',
    sendEmail = false
  }) {
    try {
      const notification = await Notification.create({
        userId,
        type,
        title,
        message,
        data,
        severity,
        emailSent: false
      });

      // Send email if requested and it's a critical notification
      if (sendEmail && this.shouldSendEmail(type, severity)) {
        await this.sendEmailNotification(notification);
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Create notifications for multiple users
   */
  static async createBulkNotifications(userIds, notificationData) {
    try {
      const notifications = userIds.map(userId => ({
        userId,
        ...notificationData,
        emailSent: false
      }));

      const createdNotifications = await Notification.bulkCreate(notifications);

      // Send emails for critical notifications
      if (this.shouldSendEmail(notificationData.type, notificationData.severity)) {
        await Promise.all(
          createdNotifications.map(notification => 
            this.sendEmailNotification(notification).catch(error => 
              console.error(`Failed to send email for notification ${notification.id}:`, error)
            )
          )
        );
      }

      return createdNotifications;
    } catch (error) {
      console.error('Error creating bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   */
  static async getUserNotifications(userId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      unreadOnly = false,
      type = null
    } = options;

    const whereClause = { userId };
    
    if (unreadOnly) {
      whereClause.read = false;
    }
    
    if (type) {
      whereClause.type = type;
    }

    return await Notification.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    const [updatedCount] = await Notification.update(
      { read: true },
      { 
        where: { 
          id: notificationId,
          userId 
        } 
      }
    );

    return updatedCount > 0;
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId) {
    const [updatedCount] = await Notification.update(
      { read: true },
      { 
        where: { 
          userId,
          read: false 
        } 
      }
    );

    return updatedCount;
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId, userId) {
    const deletedCount = await Notification.destroy({
      where: {
        id: notificationId,
        userId
      }
    });

    return deletedCount > 0;
  }

  /**
   * Get unread count for user
   */
  static async getUnreadCount(userId) {
    return await Notification.count({
      where: {
        userId,
        read: false
      }
    });
  }

  /**
   * Clean old notifications (older than 30 days)
   */
  static async cleanOldNotifications() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deletedCount = await Notification.destroy({
      where: {
        createdAt: {
          [Op.lt]: thirtyDaysAgo
        },
        read: true
      }
    });

    console.log(`Cleaned ${deletedCount} old notifications`);
    return deletedCount;
  }

  /**
   * Send email notification
   */
  static async sendEmailNotification(notification) {
    try {
      // Get user email
      const user = await User.findByPk(notification.userId, {
        attributes: ['email', 'name']
      });

      if (!user || !user.email) {
        console.log(`No email found for user ${notification.userId}`);
        return false;
      }

      // Send email using email service
      const result = await emailService.sendNotificationEmail(
        user.email,
        notification.title,
        notification.message,
        notification.severity
      );

      // Mark email as sent if successful
      if (result.success) {
        await Notification.update(
          { emailSent: true },
          { where: { id: notification.id } }
        );
      }

      return result.success;
    } catch (error) {
      console.error('Error sending email notification:', error);
      return false;
    }
  }

  /**
   * Determine if email should be sent based on type and severity
   */
  static shouldSendEmail(type, severity) {
    // Send emails for critical notifications
    const criticalTypes = [
      'expired_products',
      'system_alert'
    ];

    const criticalSeverities = ['error'];

    return criticalTypes.includes(type) || criticalSeverities.includes(severity);
  }

  /**
   * Create notification for request status change
   */
  static async notifyRequestStatusChange(requestId, status, requesterId, approverId = null) {
    const statusMessages = {
      approved: {
        title: 'Solicitação Aprovada',
        message: `Sua solicitação #${requestId.slice(-8)} foi aprovada`,
        severity: 'success',
        type: 'request_approved'
      },
      rejected: {
        title: 'Solicitação Rejeitada',
        message: `Sua solicitação #${requestId.slice(-8)} foi rejeitada`,
        severity: 'error',
        type: 'request_rejected'
      },
      fulfilled: {
        title: 'Solicitação Atendida',
        message: `Sua solicitação #${requestId.slice(-8)} foi atendida`,
        severity: 'success',
        type: 'request_fulfilled'
      }
    };

    const notificationData = statusMessages[status];
    if (!notificationData) return null;

    return await this.createNotification({
      userId: requesterId,
      ...notificationData,
      data: { requestId, status, approverId }
    });
  }

  /**
   * Create notifications for pending requests (for managers/admins)
   */
  static async notifyPendingRequests(requestId, requesterId, managerIds) {
    const notificationData = {
      type: 'request_pending',
      title: 'Nova Solicitação Pendente',
      message: `Nova solicitação #${requestId.slice(-8)} aguardando aprovação`,
      severity: 'info',
      data: { requestId, requesterId }
    };

    return await this.createBulkNotifications(managerIds, notificationData);
  }
}

module.exports = NotificationService;