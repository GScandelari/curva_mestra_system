import { useState, useEffect, useCallback } from 'react'
import { X, Save, AlertCircle } from 'lucide-react'
import { toast } from 'react-toastify'
import { invoiceService } from '../../services'

const InvoiceForm = ({ invoice = null, onSave, onCancel, isModal = false }) => {
  const [formData, setFormData] = useState({
    number: '',
    supplier: '',
    issueDate: '',
    receiptDate: '',
    totalValue: ''
  })
  
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)

  // Populate form when editing existing invoice
  useEffect(() => {
    if (invoice) {
      setFormData({
        number: invoice.number || '',
        supplier: invoice.supplier || '',
        issueDate: invoice.issueDate ? 
          new Date(invoice.issueDate).toISOString().split('T')[0] : '',
        receiptDate: invoice.receiptDate ? 
          new Date(invoice.receiptDate).toISOString().split('T')[0] : '',
        totalValue: invoice.totalValue?.toString() || ''
      })
    }
  }, [invoice])

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear error when user starts typing
    setErrors(prev => {
      if (prev[name]) {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      }
      return prev
    })
  }, [])

  const validateForm = useCallback(() => {
    const newErrors = {}

    // Required fields
    if (!formData.number.trim()) {
      newErrors.number = 'Número da nota fiscal é obrigatório'
    }
    
    if (!formData.supplier.trim()) {
      newErrors.supplier = 'Fornecedor é obrigatório'
    }
    
    if (!formData.issueDate) {
      newErrors.issueDate = 'Data de emissão é obrigatória'
    }
    
    if (!formData.receiptDate) {
      newErrors.receiptDate = 'Data de recebimento é obrigatória'
    }

    // Numeric validations
    const totalValue = parseFloat(formData.totalValue)
    if (!formData.totalValue || totalValue < 0) {
      newErrors.totalValue = 'Valor total deve ser um número válido'
    }

    // Date validation
    if (formData.issueDate && formData.receiptDate) {
      const issueDate = new Date(formData.issueDate)
      const receiptDate = new Date(formData.receiptDate)
      
      if (receiptDate < issueDate) {
        newErrors.receiptDate = 'Data de recebimento não pode ser anterior à data de emissão'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    
    try {
      const invoiceData = {
        ...formData,
        totalValue: parseFloat(formData.totalValue)
      }

      let result
      if (invoice) {
        result = await invoiceService.updateInvoice(invoice.id, invoiceData)
        toast.success('Nota fiscal atualizada com sucesso!')
      } else {
        result = await invoiceService.createInvoice(invoiceData)
        toast.success('Nota fiscal cadastrada com sucesso!')
      }

      onSave(result.invoice)
    } catch (error) {
      console.error('Error saving invoice:', error)
      const message = error.message || 'Erro ao salvar nota fiscal'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [formData, validateForm, invoice, onSave])

  const FormContent = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Invoice Number and Supplier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="number" className="block text-sm font-medium text-gray-700">
            Número da Nota Fiscal *
          </label>
          <input
            type="text"
            id="number"
            name="number"
            value={formData.number}
            onChange={handleInputChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
              errors.number ? 'border-red-300' : ''
            }`}
            style={{ 
              fontSize: '14px',
              padding: '8px 12px',
              backgroundColor: '#ffffff',
              color: '#374151'
            }}
            placeholder="Digite o número da nota fiscal"
          />
          {errors.number && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.number}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="supplier" className="block text-sm font-medium text-gray-700">
            Fornecedor *
          </label>
          <input
            type="text"
            id="supplier"
            name="supplier"
            value={formData.supplier}
            onChange={handleInputChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
              errors.supplier ? 'border-red-300' : ''
            }`}
            style={{ 
              fontSize: '14px',
              padding: '8px 12px',
              backgroundColor: '#ffffff',
              color: '#374151'
            }}
            placeholder="Nome do fornecedor"
          />
          {errors.supplier && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.supplier}
            </p>
          )}
        </div>
      </div>

      {/* Issue Date and Receipt Date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="issueDate" className="block text-sm font-medium text-gray-700">
            Data de Emissão *
          </label>
          <input
            type="date"
            id="issueDate"
            name="issueDate"
            value={formData.issueDate}
            onChange={handleInputChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
              errors.issueDate ? 'border-red-300' : ''
            }`}
            style={{ 
              fontSize: '14px',
              padding: '8px 12px',
              backgroundColor: '#ffffff',
              color: '#374151'
            }}
          />
          {errors.issueDate && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.issueDate}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="receiptDate" className="block text-sm font-medium text-gray-700">
            Data de Recebimento *
          </label>
          <input
            type="date"
            id="receiptDate"
            name="receiptDate"
            value={formData.receiptDate}
            onChange={handleInputChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
              errors.receiptDate ? 'border-red-300' : ''
            }`}
            style={{ 
              fontSize: '14px',
              padding: '8px 12px',
              backgroundColor: '#ffffff',
              color: '#374151'
            }}
          />
          {errors.receiptDate && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.receiptDate}
            </p>
          )}
        </div>
      </div>

      {/* Total Value */}
      <div>
        <label htmlFor="totalValue" className="block text-sm font-medium text-gray-700">
          Valor Total *
        </label>
        <input
          type="number"
          id="totalValue"
          name="totalValue"
          min="0"
          step="0.01"
          value={formData.totalValue}
          onChange={handleInputChange}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
            errors.totalValue ? 'border-red-300' : ''
          }`}
          style={{ 
            fontSize: '14px',
            padding: '8px 12px',
            backgroundColor: '#ffffff',
            color: '#374151'
          }}
          placeholder="0.00"
        />
        {errors.totalValue && (
          <p className="mt-1 text-sm text-red-600 flex items-center">
            <AlertCircle className="h-4 w-4 mr-1" />
            {errors.totalValue}
          </p>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          disabled={isLoading}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {invoice ? 'Atualizar' : 'Cadastrar'}
            </>
          )}
        </button>
      </div>
    </form>
  )

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {invoice ? 'Editar Nota Fiscal' : 'Cadastrar Nota Fiscal'}
            </h3>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <FormContent />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-6">
          {invoice ? 'Editar Nota Fiscal' : 'Cadastrar Nota Fiscal'}
        </h2>
        <FormContent />
      </div>
    </div>
  )
}

export default InvoiceForm