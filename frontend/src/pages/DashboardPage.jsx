import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/layout/Header'
import DashboardStats from '../components/dashboard/DashboardStats'
import DashboardCharts from '../components/dashboard/DashboardCharts'
import RecentActivity from '../components/dashboard/RecentActivity'
import QuickActions from '../components/dashboard/QuickActions'
import AlertDashboard from '../components/alerts/AlertDashboard'
import { 
  Package, 
  FileText, 
  Users, 
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  RefreshCw
} from 'lucide-react'
import { productService, requestService, patientService } from '../services'
import { toast } from 'react-toastify'

const DashboardPage = () => {
  const { user, hasPermission } = useAuth()
  const [dashboardData, setDashboardData] = useState({
    stats: null,
    trends: null,
    recentActivity: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      const promises = []
      
      // Load product stats if user has permission
      if (hasPermission('view_products')) {
        promises.push(productService.getProductStats())
        promises.push(productService.getStockMovementTrends())
      }

      const results = await Promise.allSettled(promises)
      
      const newData = {
        stats: results[0]?.status === 'fulfilled' ? results[0].value : null,
        trends: results[1]?.status === 'fulfilled' ? results[1].value : null,
        recentActivity: [] // Will be populated by RecentActivity component
      }

      setDashboardData(newData)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast.error('Erro ao carregar dados do dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const getRoleDisplayName = (role) => {
    const roleNames = {
      admin: 'Administrador',
      doctor: 'Médico',
      manager: 'Gerente',
      receptionist: 'Recepcionista'
    }
    return roleNames[role] || role
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white p-5 rounded-lg shadow">
                    <div className="h-16 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header Section */}
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Bem-vindo, {user?.name || user?.email}!
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Perfil: {getRoleDisplayName(user?.role)} | Sistema de Gestão de Inventário
              </p>
              {lastUpdated && (
                <p className="mt-1 text-xs text-gray-500">
                  Última atualização: {lastUpdated.toLocaleString('pt-BR')}
                </p>
              )}
            </div>
            <button
              onClick={loadDashboardData}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </button>
          </div>

          {/* Dashboard Stats */}
          <DashboardStats 
            stats={dashboardData.stats} 
            hasPermission={hasPermission}
          />

          {/* Alert Dashboard */}
          <div className="mb-8">
            <AlertDashboard />
          </div>

          {/* Charts Section */}
          {dashboardData.trends && (
            <DashboardCharts 
              trends={dashboardData.trends}
              hasPermission={hasPermission}
            />
          )}

          {/* Quick Actions and Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <QuickActions hasPermission={hasPermission} />
            <RecentActivity />
          </div>
        </div>
      </main>
    </div>
  )
}

export default DashboardPage