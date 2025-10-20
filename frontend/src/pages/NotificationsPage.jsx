import React, { useState, useEffect } from 'react'
import { Bell, Check, CheckCheck, Trash2, RefreshCw, Filter } from 'lucide-react'
import Header from '../components/layout/Header'
import NotificationService from '../services/notificationService'
import { useNotifications } from '../contexts/NotificationContext'
import { toast } from 'react-toastify'

const NotificationsPage = () => {
  const { loadNotifications, loadUnreadCount } = useNotifications()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, unread, read
  const [typeFilter, setTypeFilter] = useState('all')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  useEffect(() => {
    loadNotificationsData()
  }, [filter, typeFilter, pagination.page])

  const loadNotificationsData = async () => {
    try {
      setLoading(true)
      const response = await NotificationService.getNotifications({
        page: pagination.page,
        limit: pagination.limit,
        unreadOnly: filter === 'unread',
        type: typeFilter === 'all' ? null : typeFilter
      })

      setNotifications(response.data.notifications)
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
        totalPages: response.data.pagination.totalPages
      }))
    } catch (error) {
      console.error('Error loading notifications:', error)
      toast.error('Erro ao carregar notificações')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (notificationId) => {
    try {
      await NotificationService.markAsRead(notificationId)
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      )
      await loadUnreadCount()
      toast.success('Notificação marcada como lida')
    } catch (error) {
      toast.error('Erro ao marcar notificação como lida')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await NotificationService.markAllAsRead()
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      )
      await loadUnreadCount()
      toast.success('Todas as notificações foram marcadas como lidas')
    } catch (error) {
      toast.error('Erro ao marcar todas as notificações como lidas')
    }
  }

  const handleDeleteNotification = async (notificationId) => {
    try {
      await NotificationService.deleteNotification(notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      await loadUnreadCount()
      toast.success('Notificação removida')
    } catch (error) {
      toast.error('Erro ao remover notificação')
    }
  }

  const getNotificationStyle = (notification) => {
    const typeInfo = NotificationService.getNotificationTypeInfo(notification.type)
    const severityInfo = NotificationService.getSeverityInfo(notification.severity)
    
    return {
      ...typeInfo,
      ...(notification.severity === 'error' ? severityInfo : {})
    }
  }

  const formatTime = (timestamp) => {
    return NotificationService.formatTime(timestamp)
  }

  const getFilteredCount = (filterType) => {
    switch (filterType) {
      case 'unread':
        return notifications.filter(n => !n.read).length
      case 'read':
        return notifications.filter(n => n.read).length
      default:
        return notifications.length
    }
  }

  const notificationTypes = [
    { value: 'all', label: 'Todos os tipos' },
    { value: 'expiring_products', label: 'Produtos vencendo' },
    { value: 'low_stock', label: 'Estoque baixo' },
    { value: 'expired_products', label: 'Produtos vencidos' },
    { value: 'request_approved', label: 'Solicitações aprovadas' },
    { value: 'request_rejected', label: 'Solicitações rejeitadas' },
    { value: 'request_fulfilled', label: 'Solicitações atendidas' },
    { value: 'request_pending', label: 'Solicitações pendentes' },
    { value: 'system_alert', label: 'Alertas do sistema' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Bell className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
                  <p className="text-sm text-gray-600">
                    Gerencie suas notificações e alertas do sistema
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={loadNotificationsData}
                  disabled={loading}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
                {notifications.some(n => !n.read) && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Marcar todas como lidas
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <Filter className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-700">Filtros:</span>
                  </div>
                  
                  {/* Status Filter */}
                  <div className="flex rounded-md shadow-sm">
                    {['all', 'unread', 'read'].map((filterType) => (
                      <button
                        key={filterType}
                        onClick={() => setFilter(filterType)}
                        className={`px-3 py-2 text-xs font-medium border ${
                          filter === filterType
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        } ${
                          filterType === 'all' ? 'rounded-l-md' : 
                          filterType === 'read' ? 'rounded-r-md -ml-px' : '-ml-px'
                        }`}
                      >
                        {filterType === 'all' ? 'Todas' : 
                         filterType === 'unread' ? 'Não lidas' : 'Lidas'}
                        <span className="ml-1 text-xs opacity-75">
                          ({filterType === 'all' ? notifications.length : getFilteredCount(filterType)})
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Type Filter */}
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="text-xs border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {notificationTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-sm text-gray-500">
                  {pagination.total} notificação{pagination.total !== 1 ? 'ões' : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Notifications List */}
          <div className="bg-white rounded-lg shadow">
            {loading ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-start space-x-4">
                      <div className="w-8 h-8 bg-gray-200 rounded"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Nenhuma notificação encontrada
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {filter === 'unread' 
                    ? 'Você não tem notificações não lidas.'
                    : 'Não há notificações para exibir.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => {
                  const style = getNotificationStyle(notification)
                  return (
                    <div
                      key={notification.id}
                      className={`p-6 hover:bg-gray-50 ${
                        !notification.read ? `border-l-4 ${style.borderColor} ${style.bgColor}` : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="text-xl">
                            {NotificationService.getNotificationTypeInfo(notification.type).icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className={`text-sm font-medium ${
                                notification.read ? 'text-gray-600' : 'text-gray-900'
                              }`}>
                                {notification.title}
                              </h3>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500">
                                  {formatTime(notification.createdAt)}
                                </span>
                                {notification.severity && (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.bgColor} ${style.color}`}>
                                    {notification.severity.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className={`mt-1 text-sm ${
                              notification.read ? 'text-gray-500' : 'text-gray-700'
                            }`}>
                              {notification.message}
                            </p>
                            <div className="mt-3 flex items-center space-x-3">
                              {!notification.read && (
                                <button
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Marcar como lida
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteNotification(notification.id)}
                                className="inline-flex items-center text-xs text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Remover
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Página {pagination.page} de {pagination.totalPages}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default NotificationsPage