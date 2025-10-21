import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle } from 'lucide-react'
import { toast } from 'react-toastify'
import { firebaseProductService } from '../../services'

const ProductForm = ({ product = null, onSave, onCancel, isModal = false }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    unit: '',
    minimumStock: '',
    currentStock: '',
    expirationDate: '',
    invoiceNumber: '',
    supplier: '',
    unitPrice: ''
  })
  
  const [categories, setCategories] = useState([])
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  // Load categories on component mount
  useEffect(() => {
    loadCategories()
  }, [])

  // Populate form when editing existing product
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        category: product.category || '',
        unit: product.unit || '',
        minimumStock: product.minimumStock?.toString() || '',
        currentStock: product.currentStock?.toString() || '',
        expirationDate: product.expirationDate ? 
          new Date(product.expirationDate).toISOString().split('T')[0] : '',
        invoiceNumber: product.invoiceNumber || '',
        supplier: product.supplier || '',
        unitPrice: product.unitPrice?.toString() || ''
      })
    }
  }, [product])

  const loadCategories = async () => {
    try {
      const result = await firebaseProductService.getCategories()
      if (result.success) {
        setCategories(result.data.categories || [])
      } else {
        console.error('Error loading categories:', result.error)
        toast.error(result.error || 'Erro ao carregar categorias')
      }
    } catch (error) {
      console.error('Error loading categories:', error)
      toast.error('Erro ao carregar categorias')
    } finally {
      setIsLoadingCategories(false)
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

  const validateForm = () => {
    const newErrors = {}

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Nome do produto é obrigatório'
    }
    
    if (!formData.category) {
      newErrors.category = 'Categoria é obrigatória'
    }
    
    if (!formData.unit.trim()) {
      newErrors.unit = 'Unidade é obrigatória'
    }
    
    if (!formData.invoiceNumber.trim()) {
      newErrors.invoiceNumber = 'Número da nota fiscal é obrigatório'
    }
    
    if (!formData.expirationDate) {
      newErrors.expirationDate = 'Data de validade é obrigatória'
    }

    // Numeric validations
    const minimumStock = parseInt(formData.minimumStock)
    if (!formData.minimumStock || minimumStock < 0) {
      newErrors.minimumStock = 'Estoque mínimo deve ser um número válido'
    }
    
    const currentStock = parseInt(formData.currentStock)
    if (!formData.currentStock || currentStock < 0) {
      newErrors.currentStock = 'Estoque atual deve ser um número válido'
    }

    const unitPrice = parseFloat(formData.unitPrice)
    if (!formData.unitPrice || unitPrice < 0) {
      newErrors.unitPrice = 'Preço unitário deve ser um valor válido'
    }

    // Date validation
    if (formData.expirationDate) {
      const expirationDate = new Date(formData.expirationDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (expirationDate < today) {
        newErrors.expirationDate = 'Data de validade não pode ser no passado'
      }
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
      const productData = {
        ...formData,
        minimumStock: parseInt(formData.minimumStock),
        currentStock: parseInt(formData.currentStock),
        unitPrice: parseFloat(formData.unitPrice)
      }

      let result
      if (product) {
        result = await firebaseProductService.updateProduct(product.id, productData)
        if (result.success) {
          toast.success(result.message || 'Produto atualizado com sucesso!')
          onSave(result.data.product)
        } else {
          toast.error(result.error || 'Erro ao atualizar produto')
          return
        }
      } else {
        result = await firebaseProductService.createProduct(productData)
        if (result.success) {
          toast.success(result.message || 'Produto cadastrado com sucesso!')
          onSave(result.data.product)
        } else {
          toast.error(result.error || 'Erro ao cadastrar produto')
          return
        }
      }
    } catch (error) {
      console.error('Error saving product:', error)
      const message = error.response?.data?.message || 'Erro ao salvar produto'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const FormContent = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Nome do Produto *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
            errors.name ? 'border-red-300' : ''
          }`}
          placeholder="Digite o nome do produto"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600 flex items-center">
            <AlertCircle className="h-4 w-4 mr-1" />
            {errors.name}
          </p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Descrição
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={formData.description}
          onChange={handleInputChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Descrição detalhada do produto"
        />
      </div>

      {/* Category and Unit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Categoria *
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleInputChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
              errors.category ? 'border-red-300' : ''
            }`}
            disabled={isLoadingCategories}
          >
            <option value="">Selecione uma categoria</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.category}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="unit" className="block text-sm font-medium text-gray-700">
            Unidade *
          </label>
          <input
            type="text"
            id="unit"
            name="unit"
            value={formData.unit}
            onChange={handleInputChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
              errors.unit ? 'border-red-300' : ''
            }`}
            placeholder="Ex: ml, mg, unidade"
          />
          {errors.unit && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.unit}
            </p>
          )}
        </div>
      </div>

      {/* Stock Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="minimumStock" className="block text-sm font-medium text-gray-700">
            Estoque Mínimo *
          </label>
          <input
            type="number"
            id="minimumStock"
            name="minimumStock"
            min="0"
            value={formData.minimumStock}
            onChange={handleInputChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
              errors.minimumStock ? 'border-red-300' : ''
            }`}
            placeholder="0"
          />
          {errors.minimumStock && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.minimumStock}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="currentStock" className="block text-sm font-medium text-gray-700">
            Estoque Atual *
          </label>
          <input
            type="number"
            id="currentStock"
            name="currentStock"
            min="0"
            value={formData.currentStock}
            onChange={handleInputChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
              errors.currentStock ? 'border-red-300' : ''
            }`}
            placeholder="0"
          />
          {errors.currentStock && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.currentStock}
            </p>
          )}
        </div>
      </div>

      {/* Invoice and Supplier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="invoiceNumber" className="block text-sm font-medium text-gray-700">
            Número da Nota Fiscal *
          </label>
          <input
            type="text"
            id="invoiceNumber"
            name="invoiceNumber"
            value={formData.invoiceNumber}
            onChange={handleInputChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
              errors.invoiceNumber ? 'border-red-300' : ''
            }`}
            placeholder="Digite o número da nota fiscal"
          />
          {errors.invoiceNumber && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.invoiceNumber}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="supplier" className="block text-sm font-medium text-gray-700">
            Fornecedor
          </label>
          <input
            type="text"
            id="supplier"
            name="supplier"
            value={formData.supplier}
            onChange={handleInputChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Nome do fornecedor"
          />
        </div>
      </div>

      {/* Expiration Date and Unit Price */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="expirationDate" className="block text-sm font-medium text-gray-700">
            Data de Validade *
          </label>
          <input
            type="date"
            id="expirationDate"
            name="expirationDate"
            value={formData.expirationDate}
            onChange={handleInputChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
              errors.expirationDate ? 'border-red-300' : ''
            }`}
          />
          {errors.expirationDate && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.expirationDate}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="unitPrice" className="block text-sm font-medium text-gray-700">
            Preço Unitário *
          </label>
          <input
            type="number"
            id="unitPrice"
            name="unitPrice"
            min="0"
            step="0.01"
            value={formData.unitPrice}
            onChange={handleInputChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
              errors.unitPrice ? 'border-red-300' : ''
            }`}
            placeholder="0.00"
          />
          {errors.unitPrice && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.unitPrice}
            </p>
          )}
        </div>
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
              {product ? 'Atualizar' : 'Cadastrar'}
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
              {product ? 'Editar Produto' : 'Cadastrar Produto'}
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
          {product ? 'Editar Produto' : 'Cadastrar Produto'}
        </h2>
        <FormContent />
      </div>
    </div>
  )
}

export default ProductForm