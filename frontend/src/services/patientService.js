import firebaseService from './firebaseService'

export const patientService = {
  // Get all patients with optional filters
  getPatients: async (filters = {}) => {
    try {
      const options = {}
      
      // Apply filters
      if (filters.search) {
        options.where = [
          ['name', '>=', filters.search],
          ['name', '<=', filters.search + '\uf8ff']
        ]
      }
      
      if (filters.isActive !== undefined) {
        if (!options.where) options.where = []
        options.where.push(['isActive', '==', filters.isActive])
      }
      
      // Apply ordering
      options.orderBy = [['name', 'asc']]
      
      // Apply pagination
      if (filters.limit) {
        options.limit = parseInt(filters.limit)
      }
      
      const result = await firebaseService.getAll('patients', options)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return {
        patients: result.data,
        total: result.data.length,
        page: filters.page || 1,
        totalPages: Math.ceil(result.data.length / (filters.limit || 10))
      }
    } catch (error) {
      console.error('Error getting patients:', error)
      throw error
    }
  },

  // Get single patient by ID
  getPatient: async (id) => {
    try {
      const result = await firebaseService.getById('patients', id)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { patient: result.data }
    } catch (error) {
      console.error('Error getting patient:', error)
      throw error
    }
  },

  // Create new patient
  createPatient: async (patientData) => {
    try {
      const patientWithTimestamp = {
        ...patientData,
        isActive: patientData.isActive !== undefined ? patientData.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      const result = await firebaseService.create('patients', patientWithTimestamp)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { patient: result.data }
    } catch (error) {
      console.error('Error creating patient:', error)
      throw error
    }
  },

  // Update patient
  updatePatient: async (id, patientData) => {
    try {
      const updateData = {
        ...patientData,
        updatedAt: new Date().toISOString()
      }
      
      const result = await firebaseService.update('patients', id, updateData)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { patient: result.data }
    } catch (error) {
      console.error('Error updating patient:', error)
      throw error
    }
  },

  // Delete patient
  deletePatient: async (id) => {
    try {
      const result = await firebaseService.delete('patients', id)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { success: true }
    } catch (error) {
      console.error('Error deleting patient:', error)
      throw error
    }
  },

  // Get patient treatments
  getPatientTreatments: async (patientId) => {
    try {
      const result = await firebaseService.getAll('treatments', {
        where: [['patientId', '==', patientId]],
        orderBy: [['createdAt', 'desc']]
      })
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { treatments: result.data }
    } catch (error) {
      console.error('Error getting patient treatments:', error)
      throw error
    }
  },

  // Create treatment for patient
  createTreatment: async (patientId, treatmentData) => {
    try {
      const treatmentWithTimestamp = {
        ...treatmentData,
        patientId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      const result = await firebaseService.create('treatments', treatmentWithTimestamp)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { treatment: result.data }
    } catch (error) {
      console.error('Error creating treatment:', error)
      throw error
    }
  },

  // Update treatment
  updateTreatment: async (patientId, treatmentId, treatmentData) => {
    try {
      const updateData = {
        ...treatmentData,
        updatedAt: new Date().toISOString()
      }
      
      const result = await firebaseService.update('treatments', treatmentId, updateData)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { treatment: result.data }
    } catch (error) {
      console.error('Error updating treatment:', error)
      throw error
    }
  },

  // Delete treatment
  deleteTreatment: async (patientId, treatmentId) => {
    try {
      const result = await firebaseService.delete('treatments', treatmentId)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { success: true }
    } catch (error) {
      console.error('Error deleting treatment:', error)
      throw error
    }
  },

  // Get patient consumption report
  getPatientConsumption: async (patientId, filters = {}) => {
    try {
      const options = {
        where: [['patientId', '==', patientId]],
        orderBy: [['consumedAt', 'desc']]
      }
      
      // Add product filter if specified
      if (filters.productId) {
        options.where.push(['productId', '==', filters.productId])
      }
      
      const result = await firebaseService.getAll('consumptions', options)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      let consumptions = result.data
      
      // Filter by date range
      if (filters.startDate || filters.endDate) {
        consumptions = consumptions.filter(consumption => {
          const consumedDate = new Date(consumption.consumedAt)
          if (filters.startDate && consumedDate < new Date(filters.startDate)) {
            return false
          }
          if (filters.endDate && consumedDate > new Date(filters.endDate)) {
            return false
          }
          return true
        })
      }
      
      return { consumptions }
    } catch (error) {
      console.error('Error getting patient consumption:', error)
      throw error
    }
  },

  // Get patient statistics
  getPatientStats: async () => {
    try {
      const result = await firebaseService.getAll('patients')
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      const patients = result.data
      const totalPatients = patients.length
      const activePatients = patients.filter(p => p.isActive !== false).length
      const inactivePatients = totalPatients - activePatients
      
      // Get recent patients (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const recentPatients = patients.filter(p => 
        new Date(p.createdAt) >= thirtyDaysAgo
      ).length
      
      return {
        stats: {
          totalPatients,
          activePatients,
          inactivePatients,
          recentPatients
        }
      }
    } catch (error) {
      console.error('Error getting patient stats:', error)
      throw error
    }
  }
}