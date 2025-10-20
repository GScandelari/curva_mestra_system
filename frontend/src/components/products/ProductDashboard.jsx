import React, { useState, useEffect } from 'react'
import { 
  Package, 
  AlertTriangle, 
  TrendingDown, 
  Calendar,
  DollarSign,
  BarChart3,
  RefreshCw
} from 'lucide-react'
import { toast } from 'react-toastify'
import { productService } from '../../services'

const ProductDashboard = ({ onViewProduct, onEditProduct }) => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockProducts: 0,
    expiringProducts: 0,
    expiredProducts: 0,
    totalValue: 0
  })
  const [expiringProducts, setExpiringProducts] = useState([])
  const [lowStockProducts, setLowStockProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      const [statsData, expiringData, lowStockData] = await Promise.all([
        productService.getProductStats(),
        productService.getExpiringProducts(30),
        productService.getLowStockProducts()
      ])

      setStats(statsData)
      setExpiringProducts(expiringData)
      setLowStockProducts(lowStockData)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast.error('Erro ao carregar dados do dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const getDaysUntilExpiration = (expirationDate) => {
    const today = new Date()
    const expiration = new Date(expirationDate)
    return Math.ceil((expiration - today) / (1000 * 60 * 60 * 24))
  }

  const StatCard = ({ title, value, icon: Icon, color, bgColor, textColor, subtitle }) => (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`${bgColor} p-3 rounded-md`}>
              <Icon className={`h-6 w-6 ${textColor}`} />
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className={`text-lg font-medium ${color}`}>
                {value}
              </dd>
              {subtitle && (
                <dd className="text-sm text-gray-500">
                  {subtitle}
                </dd>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )

  const AlertCard = ({ title, items, icon: Icon, emptyMessage, onItemClick, renderItem }) => (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
            <Icon className="h-5 w-5 mr-2 text-gray-400" />
            {title}
          </h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            {items.length}
          </span>
        </div>
        
        {items.length === 0 ? (
          <div className="text-center py-6">
            <Icon className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => onItemClick && onItemClick(item)}
              >
                {renderItem(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Produtos</h1>
        </div>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard de Produtos</h1>
          <p className="mt-1 text-sm text-gray-600">
            Visão geral do inventário e alertas importantes
          </p>
        </div>
        <button
          onClick={loadDashboardData}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </button>
      </div>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-sm text-gray-500">
          Última atualização: {lastUpdated.toLocaleString('pt-BR')}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total de Produtos"
          value={stats.totalProducts}
          icon={Package}
          color="text-gray-900"
          bgColor="bg-blue-500"
          textColor="text-white"
        />
        
        <StatCard
          title="Estoque Baixo"
          value={stats.lowStockProducts}
          icon={TrendingDown}
          color="text-yellow-600"
          bgColor="bg-yellow-500"
          textColor="text-white"
        />
        
        <StatCard
          title="Vencendo (30 dias)"
          value={stats.expiringProducts}
          icon={Calendar}
          color="text-orange-600"
          bgColor="bg-orange-500"
          textColor="text-white"
        />
        
        <StatCard
          title="Produtos Vencidos"
          value={stats.expiredProducts}
          icon={AlertTriangle}
          color="text-red-600"
          bgColor="bg-red-500"
          textColor="text-white"
        />
        
        <StatCard
          title="Valor Total"
          value={formatCurrency(stats.totalValue)}
          icon={DollarSign}
          color="text-green-600"
          bgColor="bg-green-500"
          textColor="text-white"
          subtitle="Inventário"
        />
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiring Products */}
        <AlertCard
          title="Produtos Vencendo"
          items={expiringProducts}
          icon={Calendar}
          emptyMessage="Nenhum produto vencendo nos próximos 30 dias"
          onItemClick={onViewProduct}
          renderItem={(product) => (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {product.name}
                </p>
                <p className="text-sm text-gray-500">
                  {product.category} • {product.currentStock} {product.unit}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center text-sm text-orange-600">
                  <Calendar className="h-4 w-4 mr-1" />
                  {getDaysUntilExpiration(product.expirationDate)} dias
                </div>
                <p className="text-xs text-gray-500">
                  {formatDate(product.expirationDate)}
                </p>
              </div>
            </>
          )}
        />

        {/* Low Stock Products */}
        <AlertCard
          title="Estoque Baixo"
          items={lowStockProducts}
          icon={TrendingDown}
          emptyMessage="Todos os produtos estão com estoque adequado"
          onItemClick={onViewProduct}
          renderItem={(product) => (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {product.name}
                </p>
                <p className="text-sm text-gray-500">
                  {product.category}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center text-sm text-yellow-600">
                  <TrendingDown className="h-4 w-4 mr-1" />
                  {product.currentStock} {product.unit}
                </div>
                <p className="text-xs text-gray-500">
                  Mín: {product.minimumStock} {product.unit}
                </p>
              </div>
            </>
          )}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Ações Rápidas
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => window.location.href = '/products/new'}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Package className="h-4 w-4 mr-2" />
              Novo Produto
            </button>
            
            <button
              onClick={() => window.location.href = '/products?filter=lowStock'}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <TrendingDown className="h-4 w-4 mr-2" />
              Ver Estoque Baixo
            </button>
            
            <button
              onClick={() => window.location.href = '/products?filter=expiring'}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Ver Vencimentos
            </button>
            
            <button
              onClick={() => window.location.href = '/reports/products'}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Relatórios
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductDashboard