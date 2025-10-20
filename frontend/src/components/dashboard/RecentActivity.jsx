import React, { useState, useEffect } from 'react'
import { 
  Activity, 
  Package, 
  ClipboardList, 
  Users,
  FileText,
  Clock
} from 'lucide-react'

const RecentActivity = () => {
  const [activities, setActivities] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading recent activities
    // In a real implementation, this would fetch from an audit/activity API
    const loadRecentActivity = async () => {
      setIsLoading(true)
      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Mock data - replace with actual API call
        const mockActivities = [
          {
            id: 1,
            type: 'product_created',
            description: 'Produto "Botox 100U" foi cadastrado',
            user: 'Dr. Silva',
            timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
            icon: Package,
            color: 'text-blue-600'
          },
          {
            id: 2,
            type: 'request_approved',
            description: 'Solicitação #123 foi aprovada',
            user: 'Gerente Ana',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            icon: ClipboardList,
            color: 'text-green-600'
          },
          {
            id: 3,
            type: 'patient_registered',
            description: 'Paciente "Maria Santos" foi cadastrada',
            user: 'Recepcionista João',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
            icon: Users,
            color: 'text-purple-600'
          },
          {
            id: 4,
            type: 'invoice_registered',
            description: 'Nota Fiscal #456789 foi registrada',
            user: 'Admin Carlos',
            timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
            icon: FileText,
            color: 'text-orange-600'
          },
          {
            id: 5,
            type: 'stock_adjustment',
            description: 'Estoque do produto "Ácido Hialurônico" foi ajustado',
            user: 'Dr. Silva',
            timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
            icon: Package,
            color: 'text-yellow-600'
          }
        ]
        
        setActivities(mockActivities)
      } catch (error) {
        console.error('Error loading recent activity:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadRecentActivity()
  }, [])

  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days > 0) {
      return `${days} dia${days > 1 ? 's' : ''} atrás`
    } else if (hours > 0) {
      return `${hours} hora${hours > 1 ? 's' : ''} atrás`
    } else if (minutes > 0) {
      return `${minutes} minuto${minutes > 1 ? 's' : ''} atrás`
    } else {
      return 'Agora mesmo'
    }
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-gray-400" />
            Atividade Recente
          </h3>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">
              Nenhuma atividade recente
            </p>
          </div>
        ) : (
          <div className="flow-root">
            <ul className="-mb-8">
              {activities.map((activity, index) => {
                const Icon = activity.icon
                return (
                  <li key={activity.id}>
                    <div className="relative pb-8">
                      {index !== activities.length - 1 && (
                        <span 
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" 
                          aria-hidden="true" 
                        />
                      )}
                      <div className="relative flex items-start space-x-3">
                        <div className="relative">
                          <div className="h-8 w-8 bg-gray-50 rounded-full flex items-center justify-center ring-2 ring-white">
                            <Icon className={`h-4 w-4 ${activity.color}`} />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div>
                            <p className="text-sm text-gray-900">
                              {activity.description}
                            </p>
                            <div className="mt-1 flex items-center space-x-2 text-xs text-gray-500">
                              <span>{activity.user}</span>
                              <span>•</span>
                              <span>{formatTimeAgo(activity.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {activities.length > 0 && (
          <div className="mt-6 text-center">
            <a 
              href="/audit" 
              className="text-sm text-blue-600 hover:text-blue-500 font-medium"
            >
              Ver todas as atividades →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default RecentActivity