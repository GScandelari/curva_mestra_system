import React, { useState, useEffect } from 'react'
import { 
  Calendar, 
  Package, 
  TrendingUp, 
  Download,
  Filter,
  BarChart3
} from 'lucide-react'
import { toast } from 'react-toastify'
import { firebasePatientService, productService } from '../../services'

const PatientConsumptionReport = ({ patientId }) => {
  const [consumptionData, setConsumptionData] = useState([])
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    productId: ''
  })
  const [summary, setSummary] = useState({
    totalTreatments: 0,
    totalProducts: 0,
    mostUsedProduct: null,
    totalValue: 0
  })

  useEffect(() => {
    loadProducts()
    loadConsumptionData()
  }, [patientId])

  useEffect(() => {
    loadConsumptionData()
  }, [filters])

  const loadProducts = async () => {
    try {
      const data = await productService.getProducts({ limit: 1000 })
      setProducts(data.products || [])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const loadConsumptionData = async () => {
    setIsLoading(true)
    try {
      const result = await firebasePatientService.getPatientConsumption(patientId, filters)
      const data = result.success ? result.data : { consumption: [], summary: {} }
      setConsumptionData(data.consumption || [])
      setSummary(data.summary || {
        totalTreatments: 0,
        totalProducts: 0,
        mostUsedProduct: null,
        totalValue: 0
      })
    } catch (error) {
      console.error('Error loading consumption data:', error)
      toast.error('Erro ao carregar relatório de consumo')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleExportReport = async () => {
    try {
      // This would typically generate and download a PDF or Excel file
      toast.info('Funcionalidade de exportação será implementada em breve')
    } catch (error) {
      console.error('Error exporting report:', error)
      toast.error('Erro ao exportar relatório')
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0)
  }

  const getProductName = (productId) => {
    const product = products.find(p => p.id === productId)
    return product ? product.name : 'Produto não encontrado'
  }

  const groupConsumptionByProduct = () => {
    const grouped = {}
    
    consumptionData.forEach(item => {
      item.productsUsed?.forEach(product => {
        if (!grouped[product.productId]) {
          grouped[product.productId] = {
            productId: product.productId,
            productName: getProductName(product.productId),
            totalQuantity: 0,
            totalValue: 0,
            treatments: 0,
            unit: product.unit
          }
        }
        
        grouped[product.productId].totalQuantity += product.quantity
        grouped[product.productId].totalValue += (product.quantity * (product.unitPrice || 0))
        grouped[product.productId].treatments += 1
      })
    })
    
    return Object.values(grouped).sort((a, b) => b.totalQuantity - a.totalQuantity)
  }

  const groupedData = groupConsumptionByProduct()

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center mb-4">
          <Filter className="h-4 w-4 text-gray-500 mr-2" />
          <h4 className="text-sm font-medium text-gray-900">Filtros</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Product Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Produto
            </label>
            <select
              value={filters.productId}
              onChange={(e) => handleFilterChange('productId', e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="">Todos os produtos</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={() => {
              setFilters({
                startDate: '',
                endDate: '',
                productId: ''
              })
            }}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Limpar filtros
          </button>
          
          <button
            onClick={handleExportReport}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Tratamentos</div>
              <div className="text-2xl font-bold text-gray-900">{summary.totalTreatments}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Package className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Produtos Utilizados</div>
              <div className="text-2xl font-bold text-gray-900">{summary.totalProducts}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Mais Utilizado</div>
              <div className="text-sm font-bold text-gray-900 truncate">
                {summary.mostUsedProduct || 'N/A'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <BarChart3 className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Valor Total</div>
              <div className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalValue)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Consumption by Product */}
      {groupedData.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Consumo por Produto</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantidade Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tratamentos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groupedData.map((item, index) => (
                  <tr key={item.productId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="h-4 w-4 text-gray-400 mr-2" />
                        <div className="text-sm font-medium text-gray-900">
                          {item.productName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.totalQuantity} {item.unit}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.treatments}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(item.totalValue)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Treatment History */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Histórico de Tratamentos</h3>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Carregando dados...</p>
          </div>
        ) : consumptionData.length === 0 ? (
          <div className="p-8 text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum tratamento encontrado</h3>
            <p className="mt-1 text-sm text-gray-500">
              {Object.values(filters).some(f => f) 
                ? 'Tente ajustar os filtros de busca.'
                : 'Nenhum tratamento registrado para este paciente.'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {consumptionData.map((treatment) => (
              <div key={treatment.id} className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{treatment.procedure}</h4>
                    <p className="text-sm text-gray-500">
                      {formatDateTime(treatment.date)} • Dr. {treatment.doctorName}
                    </p>
                  </div>
                </div>
                
                {treatment.notes && (
                  <p className="text-sm text-gray-600 mb-3">{treatment.notes}</p>
                )}
                
                {treatment.productsUsed && treatment.productsUsed.length > 0 && (
                  <div>
                    <h5 className="text-xs font-medium text-gray-700 mb-2">Produtos utilizados:</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {treatment.productsUsed.map((product, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-50 rounded-lg p-2"
                        >
                          <div className="flex items-center">
                            <Package className="h-3 w-3 text-gray-400 mr-2" />
                            <span className="text-xs text-gray-900">
                              {getProductName(product.productId)}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-gray-600">
                            {product.quantity} {product.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default PatientConsumptionReport