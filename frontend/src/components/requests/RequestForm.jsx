import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle, Plus, Trash2 } from 'lucide-react'
import { toast } from 'react-toastify'
import { requestService, productService } from '../../services'
import { useAuth } from '../../hooks/useAuth'

const RequestForm = ({ onSave, onCancel, isModal = false }) => {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    patientId: '',
    notes: '',
    products: [{ productId: '', quantity: 1, reason: '' }]
  })
  
  const [products, setProducts] = useState([])
  const [patients, setPatients] = useState([])
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      const [productsData, patientsData] = await Promise.all([
        productService.getProducts({ limit: 1000 }), // Get all products
        // TODO: Add patient service when implemented
        Promise.resolve({ patients: [] })
      ])
      
      setProducts(productsData.products || [])
      setPatients(patientsData.patients || [])
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setIsLoadingData(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleProductChange = (index, field, value) => {
    const updatedProducts = [...formData.products]
    updatedProducts[index] = {
      ...updatedProducts[index],
      [field]: value
    }
    
    setFormData(prev => ({
      ...prev,
      products: updatedProducts
    }))

    // Clear product-specific errors
    if (errors[`products.${index}.${field}`]) {
      setErrors(prev => ({
        ...prev,
        [`products.${index}.${field}`]: ''
      }))
    }
  }

  const addProduct = () => {
    setFormData(prev => ({
      ...prev,
      products: [...prev.products, { productId: '', quantity: 1, reason: '' }]
    }))
  }

  const removeProduct = (index) => {
    if (formData.products.length > 1) {
      const updatedProducts = formData.products.filter((_, i) => i !== index)
      setFormData(prev => ({
        ...prev,
        products: updatedProducts
      }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    // Validate products
    if (formData.products.length === 0) {
      newErrors.products = 'Pelo menos um produto deve ser solicitado'
    } else {
      formData.products.forEach((product, index) => {
        if (!product.productId) {
          newErrors[`products.${index}.productId`] = 'Produto é obrigatório'
        }
        
        if (!product.quantity || product.quantity < 1) {
          newErrors[`products.${index}.quantity`] = 'Quantidade deve ser maior que zero'
        }

        // Check if product has sufficient stock
        const selectedProduct = products.find(p => p.id === product.productId)
        if (selectedProduct && product.quantity > selectedProduct.currentStock) {
          newErrors[`products.${index}.quantity`] = `Estoque insuficiente. Disponível: ${selectedProduct.currentStock}`
        }

        if (!product.reason.trim()) {
          newErrors[`products.${index}.reason`] = 'Motivo da solicitação é obrigatório'
        }
      })
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    
    try {
      const requestData = {
        ...formData,
        patientId: formData.patientId || null,
        products: formData.products.map(p => ({
          ...p,
          quantity: parseInt(p.quantity)
        }))
      }

      const result = await requestService.createRequest(requestData)
      toast.success('Solicitação criada com sucesso!')
      onSave(result.request)
    } catch (error) {
      console.error('Error creating request:', error)
      const message = error.response?.data?.error || 'Erro ao criar solicitação'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const getAvailableProducts = () => {
    return products.filter(product => 
      product.currentStock > 0 && 
      !product.isExpired &&
      product.expirationDate > new Date().toISOString()
    )
  }

  const FormContent = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Patient Selection */}
      <div>
        <label htmlFor="patientId" className="block text-sm font-medium text-gray-700">
          Paciente (Opcional)
        </label>
        <select
          id="patientId"
          name="patientId"
          value={formData.patientId}
          onChange={handleInputChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          disabled={isLoadingData}
        >
          <option value="">Selecione um paciente (opcional)</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>
              {patient.name} - {patient.email}
            </option>
          ))}
        </select>
      </div>

      {/* Products Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Produtos Solicitados *
          </label>
          <button
            type="button"
            onClick={addProduct}
            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Produto
          </button>
        </div>

        {errors.products && (
          <p className="mb-4 text-sm text-red-600 flex items-center">
            <AlertCircle className="h-4 w-4 mr-1" />
            {errors.products}
          </p>
        )}

        <div className="space-y-4">
          {formData.products.map((product, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-sm font-medium text-gray-900">
                  Produto {index + 1}
                </h4>
                {formData.products.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeProduct(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Product Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Produto *
                  </label>
                  <select
                    value={product.productId}
                    onChange={(e) => handleProductChange(index, 'productId', e.target.value)}
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                      errors[`products.${index}.productId`] ? 'border-red-300' : ''
                    }`}
                    disabled={isLoadingData}
                  >
                    <option value="">Selecione um produto</option>
                    {getAvailableProducts().map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name} (Estoque: {prod.currentStock} {prod.unit})
                      </option>
                    ))}
                  </select>
                  {errors[`products.${index}.productId`] && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors[`products.${index}.productId`]}
                    </p>
                  )}
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Quantidade *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={product.quantity}
                    onChange={(e) => handleProductChange(index, 'quantity', e.target.value)}
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                      errors[`products.${index}.quantity`] ? 'border-red-300' : ''
                    }`}
                    placeholder="1"
                  />
                  {errors[`products.${index}.quantity`] && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors[`products.${index}.quantity`]}
                    </p>
                  )}
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Motivo *
                  </label>
                  <input
                    type="text"
                    value={product.reason}
                    onChange={(e) => handleProductChange(index, 'reason', e.target.value)}
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                      errors[`products.${index}.reason`] ? 'border-red-300' : ''
                    }`}
                    placeholder="Motivo da solicitação"
                  />
                  {errors[`products.${index}.reason`] && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors[`products.${index}.reason`]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
          Observações
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={formData.notes}
          onChange={handleInputChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Observações adicionais sobre a solicitação"
        />
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
          disabled={isLoading || isLoadingData}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Criando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Criar Solicitação
            </>
          )}
        </button>
      </div>
    </form>
  )

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Nova Solicitação
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
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-6">
          Nova Solicitação
        </h2>
        <FormContent />
      </div>
    </div>
  )
}

export default RequestForm