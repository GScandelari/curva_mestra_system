import React from 'react'
import { BarChart3, TrendingUp, Package } from 'lucide-react'

const DashboardCharts = ({ trends, hasPermission }) => {
  if (!trends || !hasPermission('view_products')) {
    return null
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // Process daily trends for simple visualization
  const processedTrends = trends.dailyTrends.reduce((acc, trend) => {
    const date = trend.date
    if (!acc[date]) {
      acc[date] = { date, entries: 0, exits: 0 }
    }
    
    if (trend.movementType === 'entry') {
      acc[date].entries = trend.totalQuantity
    } else if (trend.movementType === 'exit') {
      acc[date].exits = trend.totalQuantity
    }
    
    return acc
  }, {})

  const chartData = Object.values(processedTrends).slice(-7) // Last 7 days

  // Calculate max value for scaling
  const maxValue = Math.max(
    ...chartData.map(d => Math.max(d.entries, d.exits)),
    1
  )

  return (
    <div className="mb-8">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Análise de Movimentação</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Movement Trends Chart */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-gray-400" />
                Movimentação (Últimos 7 dias)
              </h3>
            </div>
            
            {chartData.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  Nenhuma movimentação recente
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {chartData.map((data, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-16 text-xs text-gray-500">
                      {formatDate(data.date)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        {/* Entries bar */}
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-green-600">Entradas</span>
                            <span className="text-gray-500">{data.entries}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${(data.entries / maxValue) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        {/* Exits bar */}
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-red-600">Saídas</span>
                            <span className="text-gray-500">{data.exits}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-red-500 h-2 rounded-full"
                              style={{ width: `${(data.exits / maxValue) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Consumed Products */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                <Package className="h-5 w-5 mr-2 text-gray-400" />
                Produtos Mais Consumidos
              </h3>
            </div>
            
            {trends.topConsumedProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  Nenhum consumo registrado
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {trends.topConsumedProducts.slice(0, 5).map((item, index) => {
                  const maxConsumed = trends.topConsumedProducts[0]?.totalConsumed || 1
                  const percentage = (item.totalConsumed / maxConsumed) * 100
                  
                  return (
                    <div key={item.product.id} className="flex items-center space-x-3">
                      <div className="flex-shrink-0 w-6 text-center">
                        <span className="text-sm font-medium text-gray-500">
                          {index + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.product.name}
                          </p>
                          <span className="text-sm text-gray-500">
                            {item.totalConsumed} {item.product.unit}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.product.category}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardCharts