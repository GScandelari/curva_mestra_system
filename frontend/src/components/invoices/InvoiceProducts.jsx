import { useState, useEffect } from 'react'
import { Package, Calendar, User, ArrowLeft } from 'lucide-react'
import { toast } from 'react-toastify'
import { invoiceService } from '../../services'

const InvoiceProducts = ({ invoice, onBack }) => {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [invoiceData, setInvoiceData] = useState(null)

  useEffect(() => {
    if (invoice?.id) {
      loadInvoiceProducts()
    }
  }, [invoice])

  const loadInvoiceProducts = async () => {
    try {
      setLoading(true)
      const data = await invoiceService.getInvoiceProducts(invoice.id)
      setProducts(data.products)
      setInvoiceData(data.invoice)
    } catch (error) {
      console.error('Error loading invoice products:', error)
      toast.error('Erro ao carregar produtos da nota fiscal')
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </button>
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              Produtos da Nota Fiscal {invoiceData?.number}
            </h2>
            <p className="text-sm text-gray-500">
              Fornecedor: {invoiceData?.supplier}
            </p>
          </div>
        </div>
      </div>

      {/* Invoice Summary */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Resumo da Nota Fiscal</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <dt className="text-sm font-medium text-gray-500">Número</dt>
            <dd className="mt-1 text-sm text-gray-900">{invoice.number}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Fornecedor</dt>
            <dd className="mt-1 text-sm text-gray-900">{invoice.supplier}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Valor Total</dt>
            <dd className="mt-1 text-sm font-medium text-green-600">
              {formatCurrency(invoice.totalValue)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Data de Emissão</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(invoice.issueDate)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Data de Recebimento</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(invoice.receiptDate)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Total de Produtos</dt>
            <dd className="mt-1 text-sm text-gray-900">{products.length}</dd>
          </div>
        </div>
      </div>

      {/* Products List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Produtos Associados</h3>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum produto associado</h3>
            <p className="mt-1 text-sm text-gray-500">
              Esta nota fiscal ainda não possui produtos cadastrados.
            </p>
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
                    Estoque Atual
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data de Validade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preço Unitário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cadastrado por
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => {
                  const expirationStatus = getExpirationStatus(product.expirationDate)
                  
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
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1" />
                          {product.entryUser?.username || 'N/A'}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default InvoiceProducts