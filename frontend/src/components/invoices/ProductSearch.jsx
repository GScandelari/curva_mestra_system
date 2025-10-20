import { useState } from 'react'
import { Search, Package, Calendar, FileText, AlertCircle } from 'lucide-react'
import { toast } from 'react-toastify'
import { productService } from '../../services'

const ProductSearch = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (e) => {
    e.preventDefault()
    
    if (!searchTerm.trim()) {
      toast.error('Por favor, digite o número da nota fiscal')
      return
    }

    try {
      setLoading(true)
      setHasSearched(true)
      
      // Search products by invoice number
      const data = await productService.getProducts({
        search: searchTerm.trim(),
        limit: 100 // Get more results for invoice search
      })
      
      // Filter products that match the invoice number exactly
      const filteredProducts = data.products.filter(product => 
        product.invoiceNumber && 
        product.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
      )
      
      setProducts(filteredProducts)
      
      if (filteredProducts.length === 0) {
        toast.info('Nenhum produto encontrado para esta nota fiscal')
      }
    } catch (error) {
      console.error('Error searching products:', error)
      toast.error('Erro ao buscar produtos')
    } finally {
      setLoading(false)
    }
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

  const getExpirationStatus = (expirationDate) => {
    const today = new Date()
    const expDate = new Date(expirationDate)
    const diffTime = expDate - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return { status: 'expired', label: 'Vencido', color: 'text-red-600 bg-red-100' }
    } else if (diffDays <= 30) {
      return { status: 'expiring', label: 'Vencendo', color: 'text-yellow-600 bg-yellow-100' }
    } else {
      return { status: 'valid', label: 'Válido', color: 'text-green-600 bg-green-100' }
    }
  }

  const getStockStatus = (currentStock, minimumStock) => {
    if (currentStock === 0) {
      return { status: 'out', label: 'Sem estoque', color: 'text-red-600 bg-red-100' }
    } else if (currentStock <= minimumStock) {
      return { status: 'low', label: 'Estoque baixo', color: 'text-yellow-600 bg-yellow-100' }
    } else {
      return { status: 'ok', label: 'Estoque OK', color: 'text-green-600 bg-green-100' }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-medium text-gray-900">Buscar Produtos por Nota Fiscal</h2>
        <p className="text-sm text-gray-500">
          Digite o número da nota fiscal para encontrar todos os produtos associados
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white p-6 rounded-lg shadow">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Digite o número da nota fiscal..."
                className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-lg"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Buscando...
              </>
            ) : (
              <>
                <Search className="h-5 w-5 mr-2" />
                Buscar
              </>
            )}
          </button>
        </form>
      </div>

      {/* Search Results */}
      {hasSearched && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Resultados da Busca
              {searchTerm && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  para "{searchTerm}"
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {products.length} produto{products.length !== 1 ? 's' : ''} encontrado{products.length !== 1 ? 's' : ''}
            </p>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Nenhum produto encontrado
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Não foram encontrados produtos para a nota fiscal "{searchTerm}".
              </p>
              <div className="mt-4 text-sm text-gray-500">
                <p>Verifique se:</p>
                <ul className="mt-2 text-left inline-block">
                  <li>• O número da nota fiscal está correto</li>
                  <li>• Os produtos foram cadastrados no sistema</li>
                  <li>• A nota fiscal foi associada aos produtos</li>
                </ul>
              </div>
            </div>
          ) : (
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
                      Status Estoque
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data Validade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status Validade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preço Unitário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fornecedor
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => {
                    const expirationStatus = getExpirationStatus(product.expirationDate)
                    const stockStatus = getStockStatus(product.currentStock, product.minimumStock)
                    
                    return (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {product.name}
                            </div>
                            {product.description && (
                              <div className="text-sm text-gray-500">
                                {product.description}
                              </div>
                            )}
                            <div className="text-xs text-gray-400 mt-1">
                              NF: {product.invoiceNumber}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <Package className="h-4 w-4 mr-1 text-gray-400" />
                            {product.currentStock} {product.unit}
                          </div>
                          <div className="text-xs text-gray-500">
                            Mín: {product.minimumStock} {product.unit}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stockStatus.color}`}>
                            {stockStatus.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {formatDate(product.expirationDate)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${expirationStatus.color}`}>
                            {expirationStatus.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                          {product.unitPrice ? formatCurrency(product.unitPrice) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {product.supplier || 'N/A'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ProductSearch