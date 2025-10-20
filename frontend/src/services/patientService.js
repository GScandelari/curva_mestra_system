import api from './authService'

export const patientService = {
  // Get all patients with optional filters
  getPatients: async (filters = {}) => {
    const params = new URLSearchParams()
    
    if (filters.search) params.append('search', filters.search)
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive)
    if (filters.page) params.append('page', filters.page)
    if (filters.limit) params.append('limit', filters.limit)
    
    const queryString = params.toString()
    const url = queryString ? `/patients?${queryString}` : '/patients'
    
    const response = await api.get(url)
    return response.data
  },

  // Get single patient by ID
  getPatient: async (id) => {
    const response = await api.get(`/patients/${id}`)
    return response.data
  },

  // Create new patient
  createPatient: async (patientData) => {
    const response = await api.post('/patients', patientData)
    return response.data
  },

  // Update patient
  updatePatient: async (id, patientData) => {
    const response = await api.put(`/patients/${id}`, patientData)
    return response.data
  },

  // Delete patient
  deletePatient: async (id) => {
    const response = await api.delete(`/patients/${id}`)
    return response.data
  },

  // Get patient treatments
  getPatientTreatments: async (patientId) => {
    const response = await api.get(`/patients/${patientId}/treatments`)
    return response.data
  },

  // Create treatment for patient
  createTreatment: async (patientId, treatmentData) => {
    const response = await api.post(`/patients/${patientId}/treatments`, treatmentData)
    return response.data
  },

  // Update treatment
  updateTreatment: async (patientId, treatmentId, treatmentData) => {
    const response = await api.put(`/patients/${patientId}/treatments/${treatmentId}`, treatmentData)
    return response.data
  },

  // Delete treatment
  deleteTreatment: async (patientId, treatmentId) => {
    const response = await api.delete(`/patients/${patientId}/treatments/${treatmentId}`)
    return response.data
  },

  // Get patient consumption report
  getPatientConsumption: async (patientId, filters = {}) => {
    const params = new URLSearchParams()
    
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.productId) params.append('productId', filters.productId)
    
    const queryString = params.toString()
    const url = queryString 
      ? `/patients/${patientId}/consumption?${queryString}` 
      : `/patients/${patientId}/consumption`
    
    const response = await api.get(url)
    return response.data
  },

  // Get patient statistics
  getPatientStats: async () => {
    const response = await api.get('/patients/stats')
    return response.data
  }
}