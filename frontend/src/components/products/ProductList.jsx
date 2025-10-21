import React, { useState, useEffect, useCallback } from 'react'
import { 
  Search, 
  Filter, 
  Plus, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  Package,
  Calendar,
  TrendingDown,
  Wifi,
  WifiOff
} from 'lucide-react'
import { toast } from 'react-toastify'
import { firebaseProductService } from '../../services'
import { useAuth } from '../../contexts/AuthContext'

const ProductList = ({ onEditProduct, onCreateProduct }) => {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const [listenerId, setListenerId] = useState(null)
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    expirationDays: '',
    lowStock: false
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  })
  const [showFilters, setShowFilters] = useState(false)
  
  const { hasPermission } = useAuth()

  // Handle real-time updates
  const handleProductsUpdate = useCallback((result) => {
    if (result.success) {
      setProducts(result.data)
      setPagination(prev => ({
        ...prev,
        total: result.data.length
      }))
      setIsOffline(result.fromCache || false)
      
      // Show notification for real-time changes
      if (result.changes && result.changes.length > 0) {
        const addedCount = result.changes.filter(change => change.type === 'added').length
        const modifiedCount = result.changes.filter(change => change.type === 'modified').length
        const removedCount = result.changes.filter(change => change.type === 'removed').length
        
        if (addedCount > 0 || modifiedCount > 0 || removedCount > 0) {
          toast.info(`Produtos atualizados: ${addedCount} novos, ${modifiedCount} modificados, ${removedCount} removidos`)
        }
      }
    } else {
      console.error('Error in real-time products update:', result.error)
      setIsOffline(true)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (isRealTimeEnabled) {
      // Setup real-time listener
      const id = firebaseProductService.onProductsChange(handleProductsUpdate, {
        category: filters.category || undefined
      })
      setListenerId(id)
      
      return () => {
        if (id) {
          firebaseProductService.removeListener(id)
        }
      }
    } else {
      // Load products once
      loadProducts()
    }
    
    loadCategories()
  }, [isRealTimeEnabled, filters.category, handleProductsUpdate])

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      if (listenerId) {
        firebaseProductService.removeListener(listenerId)
      }
    }
  }, [listenerId])

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const result = await firebaseProductService.getProducts({
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      })
      
      if (result.success) {
        setProducts(result.data.products || [])
        setPagination(prev => ({
          ...prev,
          total: result.data.total || 0,
          totalPages: Math.ceil((result.data.total || 0) / pagination.limit)
        }))
        setIsOffline(result.fromCache || false)
      } else {
        console.error('Error loading products:', result.error)
        toast.error(result.error || 'Erro ao carregar produtos')
      }
    } catch (error) {
      console.error('Error loading products:', error)
      toast.error('Erro ao carregar produtos')
    } finally {
      setIsLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const result = await firebaseProductService.getCategories()
      if (result.success) {
        setCategories(result.data.categories || [])
      } else {
        console.error('Error loading categories:', result.error)
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }))
    setPagination(prev => ({ ...prev, page: 1 }))
    
    // If not using real-time updates, reload products
    if (!isRealTimeEnabled) {
      loadProducts()
    }
  }

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Tem certeza que deseja excluir o produto "${product.name}"?`)) {
      return
    }

    try {
      const result = await firebaseProductService.deleteProduct(product.id)
      if (result.success) {
        toast.success(result.message || 'Produto excluído com sucesso!')
        // Real-time listener will update the list automatically
        if (!isRealTimeEnabled) {
          loadProducts()
        }
      } else {
        toast.error(result.error || 'Erro ao excluir produto')
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Erro ao excluir produto')
    }
  }

  const getStockStatus = (product) => {
    if (product.currentStock <= 0) {
      return { status: 'out', color: 'text-red-600', bg: 'bg-red-100', label: 'Sem estoque' }
    }
    if (product.currentStock <= product.minimumStock) {
      return { status: 'low', color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Estoque baixo' }
    }
    return { status: 'ok', color: 'text-green-600', bg: 'bg-green-100', label: 'Estoque OK' }
  }

  const getExpirationStatus = (expirationDate) => {
    const today = new Date()
    const expiration = new Date(expirationDate)
    const daysUntilExpiration = Math.ceil((expiration - today) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiration < 0) {
      return { status: 'expired', color: 'text-red-600', bg: 'bg-red-100', label: 'Vencido' }
    }
    if (daysUntilExpiration <= 30) {
      return { status: 'expiring', color: 'text-yellow-600', bg: 'bg-yellow-100', label: `${daysUntilExpiration} dias` }
    }
    return { status: 'ok', color: 'text-green-600', bg: 'bg-green-100', label: `${daysUntilExpiration} dias` }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
            {isOffline && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </span>
            )}
            {isRealTimeEnabled && !isOffline && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <Wifi className="h-3 w-3 mr-1" />
                Tempo Real
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Gerencie o inventário de produtos da clínica
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Real-time toggle */}
          <label className="flex items-center">
            <input
              type="checkbox"
              id="realtime-toggle"
              name="realtimeToggle"
              checked={isRealTimeEnabled}
              onChange={(e) => setIsRealTimeEnabled(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Atualizações em tempo real</span>
          </label>
          
          {hasPermission('manage_products') && (
            <button
              onClick={onCreateProduct}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todas as categorias</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Expiration Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vencimento
                </label>
                <select
                  value={filters.expirationDays}
                  onChange={(e) => handleFilterChange('expirationDays', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos os produtos</option>
                  <option value="7">Próximos 7 dias</option>
                  <option value="30">Próximos 30 dias</option>
                  <option value="90">Próximos 90 dias</option>
                  <option value="-1">Produtos vencidos</option>
                </select>
              </div>

              {/* Low Stock Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estoque
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    id="low-stock-filter"
                    name="lowStockFilter"
                    checked={filters.lowStock}
                    onChange={(e) => handleFilterChange('lowStock', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Apenas estoque baixo</span>
                </label>
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilters({
                      search: '',
                      category: '',
                      expirationDays: '',
                      lowStock: false
                    })
                    setPagination(prev => ({ ...prev, page: 1 }))
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Carregando produtos...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum produto encontrado</h3>
            <p className="mt-1 text-sm text-gray-500">
              {Object.values(filters).some(f => f) 
                ? 'Tente ajustar os filtros de busca.'
                : 'Comece cadastrando o primeiro produto.'
              }
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estoque
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Validade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preço
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      NF
                    </th>
                    {hasPermission('manage_products') && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => {
                    const stockStatus = getStockStatus(product)
                    const expirationStatus = getExpirationStatus(product.expirationDate)
                    
                    return (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {product.name}
                            </div>
                            {product.description && (
                              <div className="text-sm text-gray-500 truncate max-w-xs">
                                {product.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
                              {stockStatus.status === 'low' && <TrendingDown className="h-3 w-3 mr-1" />}
                              {stockStatus.status === 'out' && <AlertTriangle className="h-3 w-3 mr-1" />}
                              {product.currentStock} {product.unit}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Mín: {product.minimumStock} {product.unit}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${expirationStatus.bg} ${expirationStatus.color}`}>
                              {expirationStatus.status === 'expiring' && <Calendar className="h-3 w-3 mr-1" />}
                              {expirationStatus.status === 'expired' && <AlertTriangle className="h-3 w-3 mr-1" />}
                              {expirationStatus.label}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDate(product.expirationDate)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(product.unitPrice)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {product.invoiceNumber}
                        </td>
                        {hasPermission('manage_products') && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => onEditProduct(product)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Editar produto"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product)}
                                className="text-red-600 hover:text-red-900"
                                title="Excluir produto"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Próximo
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Mostrando{' '}
                      <span className="font-medium">
                        {(pagination.page - 1) * pagination.limit + 1}
                      </span>{' '}
                      até{' '}
                      <span className="font-medium">
                        {Math.min(pagination.page * pagination.limit, pagination.total)}
                      </span>{' '}
                      de{' '}
                      <span className="font-medium">{pagination.total}</span> resultados
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={pagination.page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        const page = i + 1
                        return (
                          <button
                            key={page}
                            onClick={() => setPagination(prev => ({ ...prev, page }))}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              page === pagination.page
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {page}
                          </button>
                        )
                      })}
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                        disabled={pagination.page === pagination.totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Próximo
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default ProductList