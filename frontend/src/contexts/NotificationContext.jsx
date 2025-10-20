import React, { createContext, useContext, useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import NotificationService from '../services/notificationService'

const NotificationContext = createContext()

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Load initial notifications and set up periodic checking
  useEffect(() => {
    if (!isAuthenticated || !user) return

    // Load initial notifications
    loadNotifications()
    loadUnreadCount()

    // Set up periodic check for new notifications
    const interval = setInterval(() => {
      checkForNewNotifications()
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [isAuthenticated, user])

  const loadNotifications = async () => {
    try {
      const response = await NotificationService.getNotifications({ limit: 50 })
      setNotifications(response.data.notifications)
    } catch (error) {
      console.error('Error loading notifications:', error)
    }
  }

  const loadUnreadCount = async () => {
    try {
      const count = await NotificationService.getUnreadCount()
      setUnreadCount(count)
    } catch (error) {
      console.error('Error loading unread count:', error)
    }
  }

  const checkForNewNotifications = async () => {
    try {
      // Check for new unread notifications
      const newCount = await NotificationService.getUnreadCount()
      
      if (newCount > unreadCount) {
        // There are new notifications, reload them
        await loadNotifications()
        setUnreadCount(newCount)
      }
    } catch (error) {
      console.error('Error checking notifications:', error)
    }
  }

  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      read: false,
      ...notification
    }

    setNotifications(prev => [newNotification, ...prev])
    setUnreadCount(prev => prev + 1)

    // Show toast notification
    switch (notification.type) {
      case 'request_approved':
        toast.success(notification.message)
        break
      case 'request_rejected':
        toast.error(notification.message)
        break
      case 'request_fulfilled':
        toast.info(notification.message)
        break
      case 'low_stock':
        toast.warning(notification.message)
        break
      default:
        toast.info(notification.message)
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      await NotificationService.markAsRead(notificationId)
      
      setNotifications(prev =>
        prev.map(notification =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast.error('Erro ao marcar notificação como lida')
    }
  }

  const markAllAsRead = async () => {
    try {
      await NotificationService.markAllAsRead()
      
      setNotifications(prev =>
        prev.map(notification => ({ ...notification, read: true }))
      )
      setUnreadCount(0)
      
      toast.success('Todas as notificações foram marcadas como lidas')
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
      toast.error('Erro ao marcar todas as notificações como lidas')
    }
  }

  const clearNotifications = async () => {
    try {
      // In a real implementation, you might want to delete all notifications
      // For now, we'll just mark them all as read
      await markAllAsRead()
    } catch (error) {
      console.error('Error clearing notifications:', error)
      toast.error('Erro ao limpar notificações')
    }
  }

  const deleteNotification = async (notificationId) => {
    try {
      await NotificationService.deleteNotification(notificationId)
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      
      // Update unread count if the deleted notification was unread
      const deletedNotification = notifications.find(n => n.id === notificationId)
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
      
      toast.success('Notificação removida')
    } catch (error) {
      console.error('Error deleting notification:', error)
      toast.error('Erro ao remover notificação')
    }
  }

  // Simulate request status change notifications
  const notifyRequestStatusChange = (requestId, status, requesterName) => {
    let message = ''
    let type = ''

    switch (status) {
      case 'approved':
        message = `Sua solicitação #${requestId.slice(-8)} foi aprovada`
        type = 'request_approved'
        break
      case 'rejected':
        message = `Sua solicitação #${requestId.slice(-8)} foi rejeitada`
        type = 'request_rejected'
        break
      case 'fulfilled':
        message = `Sua solicitação #${requestId.slice(-8)} foi atendida`
        type = 'request_fulfilled'
        break
      default:
        return
    }

    addNotification({
      type,
      message,
      title: 'Status da Solicitação',
      data: { requestId, status }
    })
  }

  const value = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    deleteNotification,
    notifyRequestStatusChange,
    loadNotifications,
    loadUnreadCount
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export default NotificationContext