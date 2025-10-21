import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, Check, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import firebaseNotificationService from '../../services/firebaseNotificationService';

/**
 * NotificationCenter Component
 * 
 * Real-time notification center with Firebase integration
 */
const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Real-time listeners
  const [notificationListener, setNotificationListener] = useState(null);
  const [unreadListener, setUnreadListener] = useState(null);

  /**
   * Setup real-time listeners
   */
  const setupListeners = useCallback(() => {
    // Listener for notifications
    const notifListener = firebaseNotificationService.onNotificationsChange(
      (result) => {
        if (result.success) {
          const formattedNotifications = result.data.map(notification => 
            firebaseNotificationService.formatNotification(notification)
          );
          setNotifications(formattedNotifications);
        } else {
          setError(result.error);
        }
      },
      { limit: 50 } // Limit to last 50 notifications
    );

    // Listener for unread count
    const unreadListener = firebaseNotificationService.onUnreadCountChange(
      (result) => {
        if (result.success) {
          setUnreadCount(result.data.count);
        }
      }
    );

    setNotificationListener(notifListener);
    setUnreadListener(unreadListener);
  }, []);

  /**
   * Cleanup listeners
   */
  const cleanupListeners = useCallback(() => {
    if (notificationListener) {
      firebaseNotificationService.removeListener(notificationListener);
    }
    if (unreadListener) {
      firebaseNotificationService.removeListener(unreadListener);
    }
  }, [notificationListener, unreadListener]);

  /**
   * Load initial notifications
   */
  const loadNotifications = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await firebaseNotificationService.getNotifications({ limit: 50 });
      
      if (result.success) {
        const formattedNotifications = result.data.notifications.map(notification => 
          firebaseNotificationService.formatNotification(notification)
        );
        setNotifications(formattedNotifications);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mark notification as read
   */
  const markAsRead = async (notificationId) => {
    try {
      const result = await firebaseNotificationService.markAsRead(notificationId);
      
      if (!result.success) {
        setError(result.error);
      }
      // Real-time listener will update the UI automatically
    } catch (err) {
      setError('Erro ao marcar notificação como lida');
    }
  };

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = async () => {
    try {
      const result = await firebaseNotificationService.markAllAsRead();
      
      if (!result.success) {
        setError(result.error);
      }
      // Real-time listener will update the UI automatically
    } catch (err) {
      setError('Erro ao marcar todas como lidas');
    }
  };

  /**
   * Create system alerts manually
   */
  const createSystemAlerts = async () => {
    setLoading(true);
    try {
      const result = await firebaseNotificationService.createSystemAlerts();
      
      if (!result.success) {
        setError(result.error);
      }
      // Real-time listener will show new notifications automatically
    } catch (err) {
      setError('Erro ao criar alertas do sistema');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get notification icon based on type
   */
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'expiring_products':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'low_stock':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'stock_movement':
        return <Info className="w-5 h-5 text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  /**
   * Get notification background color based on type
   */
  const getNotificationBgColor = (type, isRead) => {
    const baseClasses = isRead ? 'bg-gray-50' : 'bg-white';
    const borderClasses = isRead ? 'border-gray-200' : 'border-l-4';
    
    if (isRead) return `${baseClasses} ${borderClasses}`;
    
    switch (type) {
      case 'expiring_products':
        return `${baseClasses} ${borderClasses} border-l-orange-500`;
      case 'low_stock':
        return `${baseClasses} ${borderClasses} border-l-red-500`;
      case 'stock_movement':
        return `${baseClasses} ${borderClasses} border-l-blue-500`;
      case 'success':
        return `${baseClasses} ${borderClasses} border-l-green-500`;
      case 'error':
        return `${baseClasses} ${borderClasses} border-l-red-500`;
      case 'warning':
        return `${baseClasses} ${borderClasses} border-l-yellow-500`;
      default:
        return `${baseClasses} ${borderClasses} border-l-blue-500`;
    }
  };

  // Setup listeners on mount
  useEffect(() => {
    setupListeners();
    loadNotifications();

    return () => {
      cleanupListeners();
    };
  }, [setupListeners, cleanupListeners]);

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Notificações</h3>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Marcar todas como lidas
                </button>
              )}
              <button
                onClick={createSystemAlerts}
                disabled={loading}
                className="text-sm text-green-600 hover:text-green-800 disabled:opacity-50"
              >
                Verificar Alertas
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-200">
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-red-500 hover:text-red-700 mt-1"
              >
                Fechar
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                Carregando notificações...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                Nenhuma notificação encontrada
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${getNotificationBgColor(notification.type, notification.read)}`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start space-x-3">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${notification.read ? 'text-gray-600' : 'text-gray-900'}`}>
                          {notification.title}
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">
                            {notification.timeAgo}
                          </span>
                          {!notification.read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className={`text-sm ${notification.read ? 'text-gray-500' : 'text-gray-700'} mt-1`}>
                        {notification.message}
                      </p>
                      
                      {/* Additional data display for specific notification types */}
                      {notification.data && notification.type === 'expiring_products' && notification.data.products && (
                        <div className="mt-2 text-xs text-gray-600">
                          <p>Produtos: {notification.data.products.slice(0, 3).map(p => p.name).join(', ')}</p>
                          {notification.data.products.length > 3 && (
                            <p>e mais {notification.data.products.length - 3} produto(s)</p>
                          )}
                        </div>
                      )}
                      
                      {notification.data && notification.type === 'low_stock' && notification.data.productName && (
                        <div className="mt-2 text-xs text-gray-600">
                          <p>Estoque atual: {notification.data.currentStock} / Mínimo: {notification.data.minimumStock}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 bg-gray-50 text-center">
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to full notifications page if exists
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Ver todas as notificações
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;