import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle, Plus, Trash2, Package } from 'lucide-react'
import { toast } from 'react-toastify'
import { patientService, productService } from '../../services'

const TreatmentForm = ({ patient, treatment = null, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    procedure: '',
    date: '',
    doctorId: '',
    notes: '',
    productsUsed: []
  })
  
  const [products, setProducts] = useState([])
  const [doctors, setDoctors] = useState([])
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)

  useEffect(() => {
    loadProducts()
    loadDoctors()
  }, [])

  // Populate form when editing existing treatment
  useEffect(() => {
    if (treatment) {
      setFormData({
        procedure: treatment.procedure || '',
        date: treatment.date ? 
          new Date(treatment.date).toISOString().slice(0, 16) : '',
        doctorId: treatment.doctorId || '',
        notes: treatment.notes || '',
        productsUsed: treatment.productsUsed || []
      })
    } else {
      // Set current date/time as default for new treatments
      const now = new Date()
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
      setFormData(prev => ({
        ...prev,
        date: now.toISOString().slice(0, 16)
      }))
    }
  }, [treatment])

  const loadProducts = async () => {
    try {
      const data = await productService.getProducts({ limit: 1000 })
      setProducts(data.products || [])
    } catch (error) {
      console.error('Error loading products:', error)
      toast.error('Erro ao carregar produtos')
    } finally {
      setIsLoadingProducts(false)
    }
  }

  const loadDoctors = async () => {
    try {
      // This would typically come from a users/doctors endpoint
      // For now, we'll use a mock list
      setDoctors([
        { id: '1', name: 'Dr. João Silva' },
        { id: '2', name: 'Dra. Maria Santos' },
        { id: '3', name: 'Dr. Pedro Costa' }
      ])
    } catch (error) {
      console.error('Error loading doctors:', error)
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

  const handleAddProduct = () => {
    setFormData(prev => ({
      ...prev,
      productsUsed: [
        ...prev.productsUsed,
        {
          productId: '',
          quantity: '',
          batchNumber: ''
        }
      ]
    }))
  }

  const handleRemoveProduct = (index) => {
    setFormData(prev => ({
      ...prev,
      productsUsed: prev.productsUsed.filter((_, i) => i !== index)
    }))
  }

  const handleProductChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      productsUsed: prev.productsUsed.map((product, i) => 
        i === index ? { ...product, [field]: value } : product
      )
    }))
  }

  const getProductById = (productId) => {
    return products.find(p => p.id === productId)
  }

  const validateForm = () => {
    const newErrors = {}

    // Required fields
    if (!formData.procedure.trim()) {
      newErrors.procedure = 'Procedimento é obrigatório'
    }
    
    if (!formData.date) {
      newErrors.date = 'Data e hora são obrigatórias'
    }
    
    if (!formData.doctorId) {
      newErrors.doctorId = 'Médico responsável é obrigatório'
    }

    // Validate products
    formData.productsUsed.forEach((product, index) => {
      if (product.productId && !product.quantity) {
        newErrors[`product_${index}_quantity`] = 'Quantidade é obrigatória'
      }
      if (product.quantity && !product.productId) {
        newErrors[`product_${index}_productId`] = 'Produto é obrigatório'
      }
      if (product.quantity && parseFloat(product.quantity) <= 0) {
        newErrors[`product_${index}_quantity`] = 'Quantidade deve ser maior que zero'
      }
    })

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
      const treatmentData = {
        ...formData,
        productsUsed: formData.productsUsed
          .filter(p => p.productId && p.quantity)
          .map(p => ({
            ...p,
            quantity: parseFloat(p.quantity)
          }))
      }

      let result
      if (treatment) {
        result = await patientService.updateTreatment(patient.id, treatment.id, treatmentData)
        toast.success('Tratamento atualizado com sucesso!')
      } else {
        result = await patientService.createTreatment(patient.id, treatmentData)
        toast.success('Tratamento registrado com sucesso!')
      }

      onSave(result)
    } catch (error) {
      console.error('Error saving treatment:', error)
      const message = error.response?.data?.message || 'Erro ao salvar tratamento'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {treatment ? 'Editar Tratamento' : 'Registrar Tratamento'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Patient Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Paciente</h4>
            <p className="text-sm text-gray-600">{patient.name}</p>
          </div>

          {/* Treatment Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Procedure */}
            <div>
              <label htmlFor="procedure" className="block text-sm font-medium text-gray-700">
                Procedimento *
              </label>
              <input
                type="text"
                id="procedure"
                name="procedure"
                value={formData.procedure}
                onChange={handleInputChange}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                  errors.procedure ? 'border-red-300' : ''
                }`}
                placeholder="Nome do procedimento realizado"
              />
              {errors.procedure && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.procedure}
                </p>
              )}
            </div>

            {/* Date and Time */}
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                Data e Hora *
              </label>
              <input
                type="datetime-local"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                  errors.date ? 'border-red-300' : ''
                }`}
              />
              {errors.date && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.date}
                </p>
              )}
            </div>
          </div>

          {/* Doctor */}
          <div>
            <label htmlFor="doctorId" className="block text-sm font-medium text-gray-700">
              Médico Responsável *
            </label>
            <select
              id="doctorId"
              name="doctorId"
              value={formData.doctorId}
              onChange={handleInputChange}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${
                errors.doctorId ? 'border-red-300' : ''
              }`}
            >
              <option value="">Selecione o médico</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>
            {errors.doctorId && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.doctorId}
              </p>
            )}
          </div>

          {/* Products Used */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Produtos Utilizados
              </label>
              <button
                type="button"
                onClick={handleAddProduct}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
                disabled={isLoadingProducts}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Produto
              </button>
            </div>

            {formData.productsUsed.length === 0 ? (
              <div className="text-center py-4 border-2 border-dashed border-gray-300 rounded-lg">
                <Package className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  Nenhum produto adicionado
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.productsUsed.map((productUsed, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <h5 className="text-sm font-medium text-gray-900">
                        Produto {index + 1}
                      </h5>
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(index)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Product Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Produto
                        </label>
                        <select
                          value={productUsed.productId}
                          onChange={(e) => handleProductChange(index, 'productId', e.target.value)}
                          className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm ${
                            errors[`product_${index}_productId`] ? 'border-red-300' : ''
                          }`}
                          disabled={isLoadingProducts}
                        >
                          <option value="">Selecione um produto</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} ({product.currentStock} {product.unit} disponível)
                            </option>
                          ))}
                        </select>
                        {errors[`product_${index}_productId`] && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors[`product_${index}_productId`]}
                          </p>
                        )}
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantidade
                        </label>
                        <div className="flex">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={productUsed.quantity}
                            onChange={(e) => handleProductChange(index, 'quantity', e.target.value)}
                            className={`block w-full rounded-l-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm ${
                              errors[`product_${index}_quantity`] ? 'border-red-300' : ''
                            }`}
                            placeholder="0"
                          />
                          <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                            {productUsed.productId ? getProductById(productUsed.productId)?.unit || '' : ''}
                          </span>
                        </div>
                        {errors[`product_${index}_quantity`] && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors[`product_${index}_quantity`]}
                          </p>
                        )}
                      </div>

                      {/* Batch Number */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Lote (opcional)
                        </label>
                        <input
                          type="text"
                          value={productUsed.batchNumber}
                          onChange={(e) => handleProductChange(index, 'batchNumber', e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                          placeholder="Número do lote"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              placeholder="Observações sobre o tratamento..."
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
                  {treatment ? 'Atualizar' : 'Registrar'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TreatmentForm