import { useState, useEffect, useCallback } from 'react';
import firebaseNotificationService from '../services/firebaseNotificationService';

/**
 * Custom hook for managing notifications
 * 
 * Provides real-time notification management with Firebase integration
 */
export const useNotifications = (options = {}) => {
  const {
    limit = 50,
    unreadOnly = false,
    type = null,
    autoSetupListeners = true
  } = options;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [listeners, setListeners] = useState([]);

  /**
   * Load notifications
   */
  const loadNotifications = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);

    try {
      const result = await firebaseNotificationService.getNotifications({
        limit,
        unread: unreadOnly,
        type,
        ...filters
      });

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
  }, [limit, unreadOnly, type]);

  /**
   * Setup real-time listeners
   */
  const setupListeners = useCallback(() => {
    const newListeners = [];

    // Notifications listener
    const notificationListener = firebaseNotificationService.onNotificationsChange(
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
      {
        limit,
        unread: unreadOnly,
        type
      }
    );

    // Unread count listener
    const unreadListener = firebaseNotificationService.onUnreadCountChange(
      (result) => {
        if (result.success) {
          setUnreadCount(result.data.count);
        }
      }
    );

    newListeners.push(notificationListener, unreadListener);
    setListeners(newListeners);

    return newListeners;
  }, [limit, unreadOnly, type]);

  /**
   * Cleanup listeners
   */
  const cleanupListeners = useCallback(() => {
    listeners.forEach(listener => {
      if (listener) {
        firebaseNotificationService.removeListener(listener);
      }
    });
    setListeners([]);
  }, [listeners]);

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const result = await firebaseNotificationService.markAsRead(notificationId);
      
      if (!result.success) {
        setError(result.error);
        return false;
      }
      
      return true;
    } catch (err) {
      setError('Erro ao marcar notificação como lida');
      return false;
    }
  }, []);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      const result = await firebaseNotificationService.markAllAsRead();
      
      if (!result.success) {
        setError(result.error);
        return false;
      }
      
      return true;
    } catch (err) {
      setError('Erro ao marcar todas como lidas');
      return false;
    }
  }, []);

  /**
   * Delete notification
   */
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const result = await firebaseNotificationService.deleteNotification(notificationId);
      
      if (!result.success) {
        setError(result.error);
        return false;
      }
      
      return true;
    } catch (err) {
      setError('Erro ao deletar notificação');
      return false;
    }
  }, []);

  /**
   * Create system alerts
   */
  const createSystemAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await firebaseNotificationService.createSystemAlerts();
      
      if (!result.success) {
        setError(result.error);
        return false;
      }
      
      return true;
    } catch (err) {
      setError('Erro ao criar alertas do sistema');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create custom notification
   */
  const createNotification = useCallback(async (notificationData) => {
    try {
      const result = await firebaseNotificationService.createNotification(notificationData);
      
      if (!result.success) {
        setError(result.error);
        return false;
      }
      
      return true;
    } catch (err) {
      setError('Erro ao criar notificação');
      return false;
    }
  }, []);

  /**
   * Get current alerts
   */
  const getCurrentAlerts = useCallback(async () => {
    try {
      const result = await firebaseNotificationService.getCurrentAlerts();
      
      if (result.success) {
        return result.data;
      } else {
        setError(result.error);
        return [];
      }
    } catch (err) {
      setError('Erro ao buscar alertas atuais');
      return [];
    }
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Refresh notifications
   */
  const refresh = useCallback(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Setup listeners and load initial data
  useEffect(() => {
    // Temporarily disabled to avoid CORS errors until notification API is implemented
    console.log('Notifications temporarily disabled - API not yet implemented');
    
    // if (autoSetupListeners) {
    //   setupListeners();
    //   loadNotifications();
    // }

    // return () => {
    //   if (autoSetupListeners) {
    //     cleanupListeners();
    //   }
    // };
  }, [autoSetupListeners, setupListeners, loadNotifications, cleanupListeners]);

  return {
    // State
    notifications,
    unreadCount,
    loading,
    error,
    
    // Actions
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createSystemAlerts,
    createNotification,
    getCurrentAlerts,
    clearError,
    refresh,
    
    // Listener management
    setupListeners,
    cleanupListeners,
    
    // Utilities
    formatNotification: firebaseNotificationService.formatNotification,
    getNotificationTypes: firebaseNotificationService.getNotificationTypes
  };
};

/**
 * Hook for unread notifications count only
 */
export const useUnreadCount = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [listener, setListener] = useState(null);

  useEffect(() => {
    // Temporarily disabled to avoid CORS errors until notification API is implemented
    console.log('Unread count notifications temporarily disabled');
    
    // const unreadListener = firebaseNotificationService.onUnreadCountChange(
    //   (result) => {
    //     if (result.success) {
    //       setUnreadCount(result.data.count);
    //     }
    //   }
    // );

    // setListener(unreadListener);

    // return () => {
    //   if (unreadListener) {
    //     firebaseNotificationService.removeListener(unreadListener);
    //   }
    // };
  }, []);

  return unreadCount;
};

/**
 * Hook for specific notification types
 */
export const useNotificationsByType = (type, options = {}) => {
  return useNotifications({
    ...options,
    type
  });
};

/**
 * Hook for alerts only (expiring products, low stock, etc.)
 */
export const useAlerts = (options = {}) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await firebaseNotificationService.getCurrentAlerts();
      
      if (result.success) {
        const formattedAlerts = result.data.map(alert => 
          firebaseNotificationService.formatNotification(alert)
        );
        setAlerts(formattedAlerts);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Erro ao carregar alertas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Temporarily disabled to avoid CORS errors until notification API is implemented
    console.log('Alerts temporarily disabled');
    // loadAlerts();
  }, [loadAlerts]);

  return {
    alerts,
    loading,
    error,
    refresh: loadAlerts
  };
};

export default useNotifications;