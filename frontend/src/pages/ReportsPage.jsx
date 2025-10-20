import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Header from '../components/layout/Header'
import ExpirationReport from '../components/reports/ExpirationReport'
import RequestsReport from '../components/reports/RequestsReport'
import InventoryReport from '../components/reports/InventoryReport'
import { 
  BarChart3, 
  Calendar, 
  ClipboardList, 
  Package,
  Download,
  FileText
} from 'lucide-react'

const ReportsPage = () => {
  const { hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('expiration')

  const tabs = [
    {
      id: 'expiration',
      name: 'Produtos Vencendo',
      icon: Calendar,
      permission: 'view_products',
      component: ExpirationReport
    },
    {
      id: 'requests',
      name: 'Solicitações',
      icon: ClipboardList,
      permission: 'view_requests',
      component: RequestsReport
    },
    {
      id: 'inventory',
      name: 'Inventário',
      icon: Package,
      permission: 'view_products',
      component: InventoryReport
    }
  ]

  const visibleTabs = tabs.filter(tab => 
    !tab.permission || hasPermission(tab.permission)
  )

  // Set first visible tab as active if current active tab is not visible
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(tab => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id)
    }
  }, [visibleTabs, activeTab])

  const ActiveComponent = visibleTabs.find(tab => tab.id === activeTab)?.component

  if (visibleTabs.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="text-center py-12">
              <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Acesso negado
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Você não tem permissão para visualizar relatórios.
              </p>
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
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <BarChart3 className="h-8 w-8 mr-3 text-blue-600" />
                  Relatórios
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Visualize e exporte relatórios do sistema
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {tab.name}
                    </button>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white shadow rounded-lg">
            {ActiveComponent && <ActiveComponent />}
          </div>
        </div>
      </main>
    </div>
  )
}

export default ReportsPage