import React, { useState, useEffect } from 'react';
import { X, Bell, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

/**
 * NotificationToast Component
 * 
 * Toast notifications for real-time alerts
 */
const NotificationToast = ({ 
  notification, 
  onClose, 
  onMarkAsRead,
  autoClose = true,
  autoCloseDelay = 5000,
  position = 'top-right'
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  /**
   * Get toast icon based on notification type
   */
  const getIcon = () => {
    switch (notification.type) {
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
        return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  /**
   * Get toast colors based on notification type
   */
  const getColors = () => {
    switch (notification.type) {
      case 'expiring_products':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          text: 'text-orange-800',
          title: 'text-orange-900'
        };
      case 'low_stock':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          title: 'text-red-900'
        };
      case 'stock_movement':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-800',
          title: 'text-blue-900'
        };
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-800',
          title: 'text-green-900'
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          title: 'text-red-900'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800',
          title: 'text-yellow-900'
        };
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-800',
          title: 'text-blue-900'
        };
    }
  };

  /**
   * Get position classes
   */
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-right':
        return 'bottom-4 right-4';
      default:
        return 'top-4 right-4';
    }
  };

  /**
   * Handle close animation
   */
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose && onClose();
    }, 300);
  };

  /**
   * Handle mark as read
   */
  const handleMarkAsRead = () => {
    if (onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    handleClose();
  };

  // Auto close timer
  useEffect(() => {
    if (autoClose && autoCloseDelay > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [autoClose, autoCloseDelay]);

  if (!isVisible) return null;

  const colors = getColors();

  return (
    <div
      className={`
        fixed z-50 max-w-sm w-full shadow-lg rounded-lg pointer-events-auto
        ${getPositionClasses()}
        ${colors.bg} ${colors.border} border
        ${isClosing ? 'animate-fade-out' : 'animate-slide-in'}
      `}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className={`text-sm font-medium ${colors.title}`}>
              {notification.title}
            </p>
            <p className={`mt-1 text-sm ${colors.text}`}>
              {notification.message}
            </p>
            
            {/* Additional data for specific notification types */}
            {notification.data && notification.type === 'expiring_products' && notification.data.products && (
              <div className={`mt-2 text-xs ${colors.text}`}>
                <p>Produtos: {notification.data.products.slice(0, 2).map(p => p.name).join(', ')}</p>
                {notification.data.products.length > 2 && (
                  <p>e mais {notification.data.products.length - 2} produto(s)</p>
                )}
              </div>
            )}
            
            {notification.data && notification.type === 'low_stock' && notification.data.productName && (
              <div className={`mt-2 text-xs ${colors.text}`}>
                <p>{notification.data.productName}</p>
                <p>Estoque: {notification.data.currentStock} / Mínimo: {notification.data.minimumStock}</p>
              </div>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            {!notification.read && (
              <button
                className={`inline-flex text-sm ${colors.text} hover:opacity-75 mr-2`}
                onClick={handleMarkAsRead}
              >
                Marcar como lida
              </button>
            )}
            <button
              className={`inline-flex ${colors.text} hover:opacity-75`}
              onClick={handleClose}
            >
              <span className="sr-only">Fechar</span>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * NotificationToastContainer Component
 * 
 * Container for managing multiple toast notifications
 */
export const NotificationToastContainer = ({ 
  notifications = [], 
  onClose, 
  onMarkAsRead,
  maxToasts = 5,
  position = 'top-right'
}) => {
  const [visibleToasts, setVisibleToasts] = useState([]);

  // Update visible toasts when notifications change
  useEffect(() => {
    // Show only unread notifications as toasts
    const unreadNotifications = notifications
      .filter(n => !n.read && n.isRecent)
      .slice(0, maxToasts);
    
    setVisibleToasts(unreadNotifications);
  }, [notifications, maxToasts]);

  /**
   * Handle toast close
   */
  const handleToastClose = (notificationId) => {
    setVisibleToasts(prev => prev.filter(n => n.id !== notificationId));
    if (onClose) {
      onClose(notificationId);
    }
  };

  /**
   * Handle mark as read
   */
  const handleMarkAsRead = (notificationId) => {
    setVisibleToasts(prev => prev.filter(n => n.id !== notificationId));
    if (onMarkAsRead) {
      onMarkAsRead(notificationId);
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {visibleToasts.map((notification, index) => (
        <div
          key={notification.id}
          style={{
            transform: position.includes('top') 
              ? `translateY(${index * 80}px)` 
              : `translateY(-${index * 80}px)`
          }}
        >
          <NotificationToast
            notification={notification}
            onClose={() => handleToastClose(notification.id)}
            onMarkAsRead={handleMarkAsRead}
            position={position}
            autoClose={true}
            autoCloseDelay={notification.priority === 'high' ? 8000 : 5000}
          />
        </div>
      ))}
    </div>
  );
};

export default NotificationToast;