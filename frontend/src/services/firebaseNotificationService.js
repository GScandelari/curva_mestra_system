import { 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit,
  Timestamp
} from 'firebase/firestore';
import firebaseService from './firebaseService';

/**
 * Firebase Notification Service
 * 
 * This service replaces the REST API notification service with Firebase operations
 */
class FirebaseNotificationService {
  constructor() {
    this.collectionName = 'notifications';
  }

  /**
   * Get notifications with filters
   */
  async getNotifications(filters = {}) {
    try {
      const options = {
        orderBy: [['createdAt', 'desc']]
      };

      const whereConditions = [];

      // Filter by read status
      if (filters.unread === 'true' || filters.unread === true) {
        whereConditions.push(['read', '==', false]);
      } else if (filters.read === 'true' || filters.read === true) {
        whereConditions.push(['read', '==', true]);
      }

      // Filter by type
      if (filters.type) {
        whereConditions.push(['type', '==', filters.type]);
      }

      // Filter by date range
      if (filters.startDate) {
        whereConditions.push(['createdAt', '>=', Timestamp.fromDate(new Date(filters.startDate))]);
      }

      if (filters.endDate) {
        whereConditions.push(['createdAt', '<=', Timestamp.fromDate(new Date(filters.endDate))]);
      }

      if (whereConditions.length > 0) {
        options.where = whereConditions;
      }

      // Apply limit
      if (filters.limit) {
        options.limit = parseInt(filters.limit);
      }

      const result = await firebaseService.getAll(this.collectionName, options);

      if (result.success) {
        return {
          success: true,
          data: {
            notifications: result.data,
            total: result.data.length
          }
        };
      }

      return result;
    } catch (error) {
      console.error('Error getting notifications:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar notificações'
      };
    }
  }

  /**
   * Get unread notifications count
   */
  async getUnreadCount() {
    try {
      const result = await firebaseService.getAll(this.collectionName, {
        where: [['read', '==', false]]
      });

      if (result.success) {
        return {
          success: true,
          data: { count: result.data.length }
        };
      }

      return result;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar contagem de não lidas'
      };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId) {
    try {
      const result = await firebaseService.update(this.collectionName, notificationId, {
        read: true,
        readAt: Timestamp.now()
      });

      if (result.success) {
        return {
          success: true,
          data: { notification: result.data },
          message: 'Notificação marcada como lida'
        };
      }

      return result;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return {
        success: false,
        error: error.message || 'Erro ao marcar como lida'
      };
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    try {
      // Get all unread notifications
      const unreadResult = await firebaseService.getAll(this.collectionName, {
        where: [['read', '==', false]]
      });

      if (!unreadResult.success) {
        return unreadResult;
      }

      if (unreadResult.data.length === 0) {
        return {
          success: true,
          message: 'Nenhuma notificação para marcar como lida'
        };
      }

      // Prepare batch operations
      const operations = unreadResult.data.map(notification => ({
        type: 'update',
        collection: this.collectionName,
        id: notification.id,
        data: {
          read: true,
          readAt: Timestamp.now()
        }
      }));

      const result = await firebaseService.batchWrite(operations);

      if (result.success) {
        return {
          success: true,
          message: `${unreadResult.data.length} notificações marcadas como lidas`
        };
      }

      return result;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return {
        success: false,
        error: error.message || 'Erro ao marcar todas como lidas'
      };
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId) {
    try {
      const result = await firebaseService.delete(this.collectionName, notificationId);

      if (result.success) {
        return {
          success: true,
          message: 'Notificação deletada com sucesso'
        };
      }

      return result;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return {
        success: false,
        error: error.message || 'Erro ao deletar notificação'
      };
    }
  }

  /**
   * Get current alerts (expiring products, low stock, etc.)
   */
  async getCurrentAlerts() {
    try {
      // Get alert-type notifications from the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const result = await firebaseService.getAll(this.collectionName, {
        where: [
          ['type', 'in', ['expiring_products', 'low_stock', 'system_alert']],
          ['createdAt', '>=', Timestamp.fromDate(sevenDaysAgo)]
        ],
        orderBy: [['createdAt', 'desc']]
      });

      if (result.success) {
        return {
          success: true,
          data: result.data
        };
      }

      return result;
    } catch (error) {
      console.error('Error getting current alerts:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar alertas atuais'
      };
    }
  }

  /**
   * Create system alerts (trigger Firebase Functions)
   */
  async createSystemAlerts() {
    try {
      const result = await firebaseService.callFunction('createSystemAlerts');

      if (result.success) {
        return {
          success: true,
          data: result.data,
          message: 'Alertas do sistema criados com sucesso'
        };
      }

      return result;
    } catch (error) {
      console.error('Error creating system alerts:', error);
      return {
        success: false,
        error: error.message || 'Erro ao criar alertas do sistema'
      };
    }
  }

  /**
   * Get notifications using Cloud Function
   */
  async getNotificationsFromFunction(filters = {}) {
    try {
      const result = await firebaseService.callFunction('getNotifications', filters);

      if (result.success) {
        return {
          success: true,
          data: {
            notifications: result.notifications || [],
            total: result.total || 0
          }
        };
      }

      return result;
    } catch (error) {
      console.error('Error getting notifications from function:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar notificações'
      };
    }
  }

  /**
   * Mark notification as read using Cloud Function
   */
  async markAsReadWithFunction(notificationId) {
    try {
      const result = await firebaseService.callFunction('markNotificationAsRead', {
        notificationId: notificationId
      });

      if (result.success) {
        return {
          success: true,
          message: result.message || 'Notificação marcada como lida'
        };
      }

      return result;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return {
        success: false,
        error: error.message || 'Erro ao marcar como lida'
      };
    }
  }

  /**
   * Create a custom notification
   */
  async createNotification(notificationData) {
    try {
      const notification = {
        ...notificationData,
        read: false,
        type: notificationData.type || 'info'
      };

      const result = await firebaseService.create(this.collectionName, notification);

      if (result.success) {
        return {
          success: true,
          data: { notification: result.data },
          message: 'Notificação criada com sucesso'
        };
      }

      return result;
    } catch (error) {
      console.error('Error creating notification:', error);
      return {
        success: false,
        error: error.message || 'Erro ao criar notificação'
      };
    }
  }

  /**
   * Setup real-time listener for notifications
   */
  onNotificationsChange(callback, filters = {}) {
    const options = {
      orderBy: [['createdAt', 'desc']]
    };

    // Apply filters
    const whereConditions = [];

    if (filters.unread) {
      whereConditions.push(['read', '==', false]);
    }

    if (filters.type) {
      whereConditions.push(['type', '==', filters.type]);
    }

    if (whereConditions.length > 0) {
      options.where = whereConditions;
    }

    return firebaseService.onCollectionChange(this.collectionName, callback, options);
  }

  /**
   * Setup real-time listener for unread count
   */
  onUnreadCountChange(callback) {
    return firebaseService.onCollectionChange(
      this.collectionName, 
      (result) => {
        if (result.success) {
          const unreadCount = result.data.filter(notification => !notification.read).length;
          callback({
            success: true,
            data: { count: unreadCount }
          });
        } else {
          callback(result);
        }
      },
      {
        where: [['read', '==', false]]
      }
    );
  }

  /**
   * Remove listener
   */
  removeListener(listenerId) {
    return firebaseService.removeListener(listenerId);
  }

  /**
   * Get notification types
   */
  getNotificationTypes() {
    return [
      { value: 'info', label: 'Informação', color: 'blue' },
      { value: 'warning', label: 'Aviso', color: 'yellow' },
      { value: 'error', label: 'Erro', color: 'red' },
      { value: 'success', label: 'Sucesso', color: 'green' },
      { value: 'expiring_products', label: 'Produtos Vencendo', color: 'orange' },
      { value: 'low_stock', label: 'Estoque Baixo', color: 'red' },
      { value: 'system_alert', label: 'Alerta do Sistema', color: 'purple' }
    ];
  }

  /**
   * Format notification for display
   */
  formatNotification(notification) {
    const types = this.getNotificationTypes();
    const type = types.find(t => t.value === notification.type) || types[0];

    return {
      ...notification,
      typeLabel: type.label,
      typeColor: type.color,
      timeAgo: this.getTimeAgo(notification.createdAt),
      isRecent: this.isRecent(notification.createdAt)
    };
  }

  /**
   * Get time ago string
   */
  getTimeAgo(date) {
    const now = new Date();
    const notificationDate = date instanceof Date ? date : new Date(date);
    const diffInMinutes = Math.floor((now - notificationDate) / (1000 * 60));

    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes < 60) return `${diffInMinutes}m atrás`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h atrás`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d atrás`;
    
    return notificationDate.toLocaleDateString('pt-BR');
  }

  /**
   * Check if notification is recent (less than 1 hour)
   */
  isRecent(date) {
    const now = new Date();
    const notificationDate = date instanceof Date ? date : new Date(date);
    const diffInMinutes = Math.floor((now - notificationDate) / (1000 * 60));
    return diffInMinutes < 60;
  }
}

// Create singleton instance
const firebaseNotificationService = new FirebaseNotificationService();

export default firebaseNotificationService;