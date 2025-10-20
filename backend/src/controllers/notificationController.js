const NotificationService = require('../services/notificationService');
const AlertService = require('../services/alertService');
const { User } = require('../models');

/**
 * Notification controller for managing user notifications
 */
class NotificationController {
  /**
   * Get notifications for the authenticated user
   */
  static async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      const {
        page = 1,
        limit = 20,
        unreadOnly = false,
        type = null
      } = req.query;

      const offset = (page - 1) * limit;

      const result = await NotificationService.getUserNotifications(userId, {
        limit: parseInt(limit),
        offset,
        unreadOnly: unreadOnly === 'true',
        type
      });

      res.json({
        success: true,
        data: {
          notifications: result.rows,
          pagination: {
            total: result.count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(result.count / limit)
          }
        }
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar notificações',
        error: error.message
      });
    }
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;
      const count = await NotificationService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { count }
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar contagem de notificações',
        error: error.message
      });
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const success = await NotificationService.markAsRead(id, userId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Notificação não encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Notificação marcada como lida'
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao marcar notificação como lida',
        error: error.message
      });
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;
      const count = await NotificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: `${count} notificações marcadas como lidas`
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao marcar todas as notificações como lidas',
        error: error.message
      });
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const success = await NotificationService.deleteNotification(id, userId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Notificação não encontrada'
        });
      }

      res.json({
        success: true,
        message: 'Notificação removida'
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao remover notificação',
        error: error.message
      });
    }
  }

  /**
   * Get current alerts (expiring products, low stock, etc.)
   */
  static async getCurrentAlerts(req, res) {
    try {
      const alerts = await AlertService.getActiveAlerts();

      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      console.error('Error getting current alerts:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar alertas atuais',
        error: error.message
      });
    }
  }

  /**
   * Create system-wide alert notifications
   */
  static async createSystemAlerts(req, res) {
    try {
      // Only admins can create system alerts
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado'
        });
      }

      // Get all active alerts
      const alerts = await AlertService.getActiveAlerts();
      
      if (alerts.length === 0) {
        return res.json({
          success: true,
          message: 'Nenhum alerta ativo encontrado'
        });
      }

      // Get all users who should receive alerts (managers and admins)
      const users = await User.findAll({
        where: {
          role: ['admin', 'manager'],
          isActive: true
        },
        attributes: ['id']
      });

      const userIds = users.map(user => user.id);
      let totalNotifications = 0;

      // Create notifications for each alert type
      for (const alert of alerts) {
        const notifications = await NotificationService.createBulkNotifications(
          userIds,
          {
            type: alert.type,
            title: alert.title,
            message: alert.message,
            severity: alert.severity,
            data: alert.data,
            sendEmail: alert.severity === 'error'
          }
        );
        totalNotifications += notifications.length;
      }

      res.json({
        success: true,
        message: `${totalNotifications} notificações de alerta criadas`,
        data: {
          alertsProcessed: alerts.length,
          notificationsCreated: totalNotifications
        }
      });
    } catch (error) {
      console.error('Error creating system alerts:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao criar alertas do sistema',
        error: error.message
      });
    }
  }
}

module.exports = NotificationController;