import React from 'react'
import { 
  Package, 
  AlertTriangle, 
  TrendingDown, 
  Calendar,
  DollarSign,
  Users,
  ClipboardList
} from 'lucide-react'

const DashboardStats = ({ stats, hasPermission }) => {
  if (!stats) {
    return (
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Resumo</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white overflow-hidden shadow rounded-lg animate-pulse">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="bg-gray-200 p-3 rounded-md">
                      <div className="h-6 w-6 bg-gray-300 rounded"></div>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const statCards = [
    {
      name: 'Total de Produtos',
      value: stats.totalProducts,
      icon: Package,
      color: 'text-gray-900',
      bgColor: 'bg-blue-500',
      textColor: 'text-white',
      permission: 'view_products'
    },
    {
      name: 'Estoque Baixo',
      value: stats.lowStockProducts,
      icon: TrendingDown,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-500',
      textColor: 'text-white',
      permission: 'view_products'
    },
    {
      name: 'Vencendo (30 dias)',
      value: stats.expiringProducts,
      icon: Calendar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-500',
      textColor: 'text-white',
      permission: 'view_products'
    },
    {
      name: 'Produtos Vencidos',
      value: stats.expiredProducts,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-500',
      textColor: 'text-white',
      permission: 'view_products'
    },
    {
      name: 'Valor Total',
      value: formatCurrency(stats.totalValue),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-500',
      textColor: 'text-white',
      subtitle: 'Inventário',
      permission: 'view_products'
    }
  ]

  const visibleStats = statCards.filter(stat => 
    !stat.permission || hasPermission(stat.permission)
  )

  if (visibleStats.length === 0) {
    return null
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Resumo do Inventário</h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {visibleStats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.name}
              className="bg-white overflow-hidden shadow rounded-lg"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`${stat.bgColor} p-3 rounded-md`}>
                      <Icon className={`h-6 w-6 ${stat.textColor}`} />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {stat.name}
                      </dt>
                      <dd className={`text-lg font-medium ${stat.color}`}>
                        {stat.value}
                      </dd>
                      {stat.subtitle && (
                        <dd className="text-sm text-gray-500">
                          {stat.subtitle}
                        </dd>
                      )}
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Category Distribution */}
      {stats.categoryStats && stats.categoryStats.length > 0 && (
        <div className="mt-6 bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Distribuição por Categoria
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.categoryStats.slice(0, 6).map((category, index) => (
                <div key={category.category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {category.category || 'Sem Categoria'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {category.count} produtos
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {category.totalStock}
                    </p>
                    <p className="text-xs text-gray-500">unidades</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardStats