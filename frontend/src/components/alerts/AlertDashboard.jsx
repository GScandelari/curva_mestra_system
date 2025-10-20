import React, { useState, useEffect } from 'react'
import { AlertTriangle, Clock, Package, XCircle, RefreshCw, Bell } from 'lucide-react'
import NotificationService from '../../services/notificationService'
import { toast } from 'react-toastify'

const AlertDashboard = () => {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [creatingNotifications, setCreatingNotifications] = useState(false)

  useEffect(() => {
    loadAlerts()
  }, [])

  const loadAlerts = async () => {
    try {
      setLoading(true)
      const alertsData = await NotificationService.getCurrentAlerts()
      setAlerts(alertsData)
    } catch (error) {
      console.error('Error loading alerts:', error)
      toast.error('Erro ao carregar alertas')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      await loadAlerts()
      toast.success('Alertas atualizados')
    } catch (error) {
      toast.error('Erro ao atualizar alertas')
    } finally {
      setRefreshing(false)
    }
  }

  const handleCreateNotifications = async () => {
    try {
      setCreatingNotifications(true)
      const result = await NotificationService.createSystemAlerts()
      toast.success(result.message)
      
      // Refresh alerts after creating notifications
      await loadAlerts()
    } catch (error) {
      console.error('Error creating notifications:', error)
      toast.error('Erro ao criar notificações')
    } finally {
      setCreatingNotifications(false)
    }
  }

  const getAlertIcon = (type) => {
    switch (type) {
      case 'expiring_products':
        return <Clock className="h-5 w-5" />
      case 'low_stock':
        return <Package className="h-5 w-5" />
      case 'expired_products':
        return <XCircle className="h-5 w-5" />
      default:
        return <AlertTriangle className="h-5 w-5" />
    }
  }

  const getAlertColor = (severity) => {
    switch (severity) {
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getSeverityBadge = (severity) => {
    const colors = {
      error: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      info: 'bg-blue-100 text-blue-800'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[severity] || colors.info}`}>
        {severity?.toUpperCase() || 'INFO'}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">
              Alertas do Sistema
            </h3>
            {alerts.length > 0 && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {alerts.length} ativo{alerts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            {alerts.length > 0 && (
              <button
                onClick={handleCreateNotifications}
                disabled={creatingNotifications}
                className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <Bell className="h-3 w-3 mr-1" />
                {creatingNotifications ? 'Criando...' : 'Criar Notificações'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum alerta ativo</h3>
            <p className="mt-1 text-sm text-gray-500">
              Todos os sistemas estão funcionando normalmente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${getAlertColor(alert.severity)}`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">
                        {alert.title}
                      </h4>
                      {getSeverityBadge(alert.severity)}
                    </div>
                    <p className="mt-1 text-sm">
                      {alert.message}
                    </p>
                    {alert.count && (
                      <p className="mt-2 text-xs opacity-75">
                        {alert.count} item{alert.count !== 1 ? 's' : ''} afetado{alert.count !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AlertDashboard