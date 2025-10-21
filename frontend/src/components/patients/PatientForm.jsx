import React, { useState, useEffect, useCallback } from 'react'
import { X, Save, AlertCircle } from 'lucide-react'
import { toast } from 'react-toastify'
import firebasePatientService from '../../services/firebasePatientService'

const PatientForm = ({ patient = null, onSave, onCancel, isModal = false }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    birthDate: '',
    address: {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: ''
    },
    medicalHistory: ''
  })
  
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)

  // Populate form when editing existing patient
  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name || '',
        email: patient.email || '',
        phone: patient.phone || '',
        birthDate: patient.birthDate ? 
          new Date(patient.birthDate).toISOString().split('T')[0] : '',
        address: {
          street: patient.address?.street || '',
          number: patient.address?.number || '',
          complement: patient.address?.complement || '',
          neighborhood: patient.address?.neighborhood || '',
          city: patient.address?.city || '',
          state: patient.address?.state || '',
          zipCode: patient.address?.zipCode || ''
        },
        medicalHistory: patient.medicalHistory || ''
      })
    }
  }, [patient])

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target
    
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1]
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }, [errors])

  const validateForm = () => {
    const newErrors = {}

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Nome do paciente é obrigatório'
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email deve ter um formato válido'
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório'
    } else if (!/^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(formData.phone)) {
      newErrors.phone = 'Telefone deve estar no formato (XX) XXXXX-XXXX'
    }
    
    if (!formData.birthDate) {
      newErrors.birthDate = 'Data de nascimento é obrigatória'
    } else {
      const birthDate = new Date(formData.birthDate)
      const today = new Date()
      const age = today.getFullYear() - birthDate.getFullYear()
      
      if (age < 0 || age > 120) {
        newErrors.birthDate = 'Data de nascimento deve ser válida'
      }
    }

    // Address validation
    if (!formData.address.street.trim()) {
      newErrors['address.street'] = 'Rua é obrigatória'
    }
    
    if (!formData.address.city.trim()) {
      newErrors['address.city'] = 'Cidade é obrigatória'
    }
    
    if (!formData.address.state.trim()) {
      newErrors['address.state'] = 'Estado é obrigatório'
    }
    
    if (!formData.address.zipCode.trim()) {
      newErrors['address.zipCode'] = 'CEP é obrigatório'
    } else if (!/^\d{5}-?\d{3}$/.test(formData.address.zipCode)) {
      newErrors['address.zipCode'] = 'CEP deve estar no formato XXXXX-XXX'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const formatPhone = (value) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    
    // Format as (XX) XXXXX-XXXX or (XX) XXXX-XXXX
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
    } else {
      return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    }
  }

  const formatZipCode = (value) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    
    // Format as XXXXX-XXX
    return digits.replace(/(\d{5})(\d{3})/, '$1-$2')
  }

  const handlePhoneChange = useCallback((e) => {
    const formatted = formatPhone(e.target.value)
    handleInputChange({ target: { name: 'phone', value: formatted } })
  }, [handleInputChange])

  const handleZipCodeChange = useCallback((e) => {
    const formatted = formatZipCode(e.target.value)
    handleInputChange({ target: { name: 'address.zipCode', value: formatted } })
  }, [handleInputChange])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    
    try {
      let result
      if (patient) {
        result = await firebasePatientService.updatePatient(patient.id, formData)
        if (result.success) {
          toast.success('Paciente atualizado com sucesso!')
          onSave(result.data)
        } else {
          toast.error(result.error || 'Erro ao atualizar paciente')
        }
      } else {
        result = await firebasePatientService.createPatient(formData)
        if (result.success) {
          toast.success('Paciente cadastrado com sucesso!')
          onSave(result.data)
        } else {
          toast.error(result.error || 'Erro ao cadastrar paciente')
        }
      }
    } catch (error) {
      console.error('Error saving patient:', error)
      const message = error.message || 'Erro ao salvar paciente'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const renderFormContent = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Informações Pessoais</h3>
        
        {/* Name */}
        <div className="mb-4">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nome Completo *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            autoComplete="name"
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white ${
              errors.name ? 'border-red-300' : ''
            }`}
            placeholder="Digite o nome completo do paciente"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.name}
            </p>
          )}
        </div>

        {/* Email and Phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              autoComplete="email"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white ${
                errors.email ? 'border-red-300' : ''
              }`}
              placeholder="email@exemplo.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Telefone *
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handlePhoneChange}
              autoComplete="tel"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white ${
                errors.phone ? 'border-red-300' : ''
              }`}
              placeholder="(XX) XXXXX-XXXX"
              maxLength="15"
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.phone}
              </p>
            )}
          </div>
        </div>

        {/* Birth Date */}
        <div className="mb-4">
          <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700">
            Data de Nascimento *
          </label>
          <input
            type="date"
            id="birthDate"
            name="birthDate"
            value={formData.birthDate}
            onChange={handleInputChange}
            autoComplete="bday"
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white ${
              errors.birthDate ? 'border-red-300' : ''
            }`}
          />
          {errors.birthDate && (
            <p className="mt-1 text-sm text-red-600 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {errors.birthDate}
            </p>
          )}
        </div>
      </div>

      {/* Address Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Endereço</h3>
        
        {/* Street and Number */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2">
            <label htmlFor="address-street" className="block text-sm font-medium text-gray-700">
              Rua *
            </label>
            <input
              type="text"
              id="address-street"
              name="address.street"
              value={formData.address.street}
              onChange={handleInputChange}
              autoComplete="address-line1"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white ${
                errors['address.street'] ? 'border-red-300' : ''
              }`}
              placeholder="Nome da rua"
            />
            {errors['address.street'] && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors['address.street']}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="address-number" className="block text-sm font-medium text-gray-700">
              Número
            </label>
            <input
              type="text"
              id="address-number"
              name="address.number"
              value={formData.address.number}
              onChange={handleInputChange}
              autoComplete="off"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
              placeholder="123"
            />
          </div>
        </div>

        {/* Complement and Neighborhood */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="address-complement" className="block text-sm font-medium text-gray-700">
              Complemento
            </label>
            <input
              type="text"
              id="address-complement"
              name="address.complement"
              value={formData.address.complement}
              onChange={handleInputChange}
              autoComplete="address-line2"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
              placeholder="Apto, sala, etc."
            />
          </div>

          <div>
            <label htmlFor="address-neighborhood" className="block text-sm font-medium text-gray-700">
              Bairro
            </label>
            <input
              type="text"
              id="address-neighborhood"
              name="address.neighborhood"
              value={formData.address.neighborhood}
              onChange={handleInputChange}
              autoComplete="off"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
              placeholder="Nome do bairro"
            />
          </div>
        </div>

        {/* City, State and ZIP */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label htmlFor="address-city" className="block text-sm font-medium text-gray-700">
              Cidade *
            </label>
            <input
              type="text"
              id="address-city"
              name="address.city"
              value={formData.address.city}
              onChange={handleInputChange}
              autoComplete="address-level2"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white ${
                errors['address.city'] ? 'border-red-300' : ''
              }`}
              placeholder="Nome da cidade"
            />
            {errors['address.city'] && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors['address.city']}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="address-state" className="block text-sm font-medium text-gray-700">
              Estado *
            </label>
            <input
              type="text"
              id="address-state"
              name="address.state"
              value={formData.address.state}
              onChange={handleInputChange}
              autoComplete="address-level1"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white ${
                errors['address.state'] ? 'border-red-300' : ''
              }`}
              placeholder="SP"
              maxLength="2"
            />
            {errors['address.state'] && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors['address.state']}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="address-zipCode" className="block text-sm font-medium text-gray-700">
              CEP *
            </label>
            <input
              type="text"
              id="address-zipCode"
              name="address.zipCode"
              value={formData.address.zipCode}
              onChange={handleZipCodeChange}
              autoComplete="postal-code"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white ${
                errors['address.zipCode'] ? 'border-red-300' : ''
              }`}
              placeholder="XXXXX-XXX"
              maxLength="9"
            />
            {errors['address.zipCode'] && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors['address.zipCode']}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Medical History */}
      <div>
        <label htmlFor="medicalHistory" className="block text-sm font-medium text-gray-700">
          Histórico Médico
        </label>
        <textarea
          id="medicalHistory"
          name="medicalHistory"
          rows={4}
          value={formData.medicalHistory}
          onChange={handleInputChange}
          autoComplete="off"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
          placeholder="Informações relevantes sobre o histórico médico do paciente..."
        />
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <button
          type="button"
          id="cancel-button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          disabled={isLoading}
        >
          Cancelar
        </button>
        <button
          type="submit"
          id="submit-button"
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
              {patient ? 'Atualizar' : 'Cadastrar'}
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
              {patient ? 'Editar Paciente' : 'Cadastrar Paciente'}
            </h3>
            <button
              type="button"
              id="modal-close-button"
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          {renderFormContent()}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-6">
          {patient ? 'Editar Paciente' : 'Cadastrar Paciente'}
        </h2>
        {renderFormContent()}
      </div>
    </div>
  )
}

export default PatientForm