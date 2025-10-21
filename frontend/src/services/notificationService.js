import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://us-central1-curva-mestra.cloudfunctions.net'

/**
 * Frontend notification service for interacting with notification API
 */
class NotificationService {
  /**
   * Get notifications for the current user
   */
  static async getNotifications(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        unreadOnly = false,
        type = null
      } = options

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        unreadOnly: unreadOnly.toString()
      })

      if (type) {
        params.append('type', type)
      }

      const response = await axios.get(`${API_BASE_URL}/notifications?${params}`)
      return response.data
    } catch (error) {
      console.warn('Notifications service not available:', error.message)
      return { data: [], total: 0, page: 1, totalPages: 0 }
    }
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount() {
    try {
      const response = await axios.get(`${API_BASE_URL}/notifications/unread-count`)
      return response.data.data.count
    } catch (error) {
      console.warn('Notifications service not available:', error.message)
      return 0
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId) {
    const response = await axios.patch(`${API_BASE_URL}/notifications/${notificationId}/read`)
    return response.data
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead() {
    const response = await axios.patch(`${API_BASE_URL}/notifications/mark-all-read`)
    return response.data
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId) {
    const response = await axios.delete(`${API_BASE_URL}/notifications/${notificationId}`)
    return response.data
  }

  /**
   * Get current system alerts
   */
  static async getCurrentAlerts() {
    try {
      const response = await axios.get(`${API_BASE_URL}/notifications/alerts`)
      return response.data.data
    } catch (error) {
      console.warn('Notifications service not available:', error.message)
      return []
    }
  }

  /**
   * Create system alert notifications (admin only)
   */
  static async createSystemAlerts() {
    const response = await axios.post(`${API_BASE_URL}/notifications/system-alerts`)
    return response.data
  }

  /**
   * Get notification type display information
   */
  static getNotificationTypeInfo(type) {
    const typeMap = {
      expiring_products: {
        icon: '⏰',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200'
      },
      low_stock: {
        icon: '📦',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200'
      },
      expired_products: {
        icon: '❌',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200'
      },
      request_approved: {
        icon: '✅',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200'
      },
      request_rejected: {
        icon: '❌',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200'
      },
      request_fulfilled: {
        icon: '📦',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
      },
      request_pending: {
        icon: '⏳',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200'
      },
      system_alert: {
        icon: '🚨',
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200'
      }
    }

    return typeMap[type] || {
      icon: '📢',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200'
    }
  }

  /**
   * Get severity display information
   */
  static getSeverityInfo(severity) {
    const severityMap = {
      info: {
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
      },
      warning: {
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200'
      },
      error: {
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200'
      },
      success: {
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200'
      }
    }

    return severityMap[severity] || severityMap.info
  }

  /**
   * Format notification time
   */
  static formatTime(timestamp) {
    const now = new Date()
    const notificationTime = new Date(timestamp)
    const diffInMinutes = Math.floor((now - notificationTime) / (1000 * 60))

    if (diffInMinutes < 1) return 'Agora'
    if (diffInMinutes < 60) return `${diffInMinutes}m atrás`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h atrás`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d atrás`
    
    return notificationTime.toLocaleDateString('pt-BR')
  }
}

export default NotificationService