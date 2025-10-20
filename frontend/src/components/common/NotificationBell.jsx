import React, { useState, useRef, useEffect } from 'react'
import { Bell, X, Check, CheckCheck, Trash2 } from 'lucide-react'
import { useNotifications } from '../../contexts/NotificationContext'
import NotificationService from '../../services/notificationService'

const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications, deleteNotification } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const formatTime = (timestamp) => {
    return NotificationService.formatTime(timestamp)
  }

  const getNotificationIcon = (type) => {
    return NotificationService.getNotificationTypeInfo(type).icon
  }

  const getNotificationStyle = (notification) => {
    const typeInfo = NotificationService.getNotificationTypeInfo(notification.type)
    const severityInfo = NotificationService.getSeverityInfo(notification.severity)
    
    return {
      ...typeInfo,
      // Override with severity if it's more critical
      ...(notification.severity === 'error' ? severityInfo : {})
    }
  }

  const handleDeleteNotification = async (e, notificationId) => {
    e.stopPropagation()
    setLoading(true)
    try {
      await deleteNotification(notificationId)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAllAsRead = async () => {
    setLoading(true)
    try {
      await markAllAsRead()
    } finally {
      setLoading(false)
    }
  }

  const handleClearNotifications = async () => {
    setLoading(true)
    try {
      await clearNotifications()
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationClick = (notification) => {
    if (!notification.read) {
      markAsRead(notification.id)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-full"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">
                  Notificações
                  {unreadCount > 0 && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {unreadCount} nova{unreadCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </h3>
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      disabled={loading}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center disabled:opacity-50"
                      title="Marcar todas como lidas"
                    >
                      <CheckCheck className="h-3 w-3 mr-1" />
                      Marcar todas
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearNotifications}
                      disabled={loading}
                      className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                      title="Limpar todas"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <Bell className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">
                    Nenhuma notificação
                  </p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const style = getNotificationStyle(notification)
                  return (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-l-4 ${
                        notification.read 
                          ? 'border-transparent bg-white' 
                          : `${style.borderColor} ${style.bgColor}`
                      }`}
                    >
                      <div className="flex items-start">
                        <div className="flex-shrink-0 text-lg">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm ${
                              notification.read ? 'text-gray-600' : 'text-gray-900 font-medium'
                            }`}>
                              {notification.title || 'Notificação'}
                            </p>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">
                                {formatTime(notification.createdAt || notification.timestamp)}
                              </span>
                              <button
                                onClick={(e) => handleDeleteNotification(e, notification.id)}
                                disabled={loading}
                                className="text-gray-400 hover:text-red-500 disabled:opacity-50"
                                title="Remover notificação"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <p className={`text-sm mt-1 ${
                            notification.read ? 'text-gray-500' : 'text-gray-700'
                          }`}>
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            {!notification.read && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  markAsRead(notification.id)
                                }}
                                disabled={loading}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center disabled:opacity-50"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Marcar como lida
                              </button>
                            )}
                            {notification.severity && (
                              <span className={`text-xs px-2 py-1 rounded-full ${style.bgColor} ${style.color}`}>
                                {notification.severity.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full text-center text-xs text-gray-500 hover:text-gray-700"
                >
                  Fechar notificações
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell