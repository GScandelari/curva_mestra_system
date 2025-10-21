import firebaseService from './firebaseService'

export const requestService = {
  // Create a new request
  createRequest: async (requestData) => {
    try {
      const requestWithTimestamp = {
        ...requestData,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      const result = await firebaseService.create('requests', requestWithTimestamp)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { request: result.data }
    } catch (error) {
      console.error('Error creating request:', error)
      throw error
    }
  },

  // Get all requests (admin/manager only)
  getRequests: async (params = {}) => {
    try {
      const options = {}
      
      // Apply filters
      if (params.status || params.userId) {
        options.where = []
        if (params.status) {
          options.where.push(['status', '==', params.status])
        }
        if (params.userId) {
          options.where.push(['userId', '==', params.userId])
        }
      }
      
      // Apply ordering
      options.orderBy = [['createdAt', 'desc']]
      
      // Apply pagination
      if (params.limit) {
        options.limit = parseInt(params.limit)
      }
      
      const result = await firebaseService.getAll('requests', options)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return {
        requests: result.data,
        total: result.data.length
      }
    } catch (error) {
      console.error('Error getting requests:', error)
      throw error
    }
  },

  // Get specific request by ID
  getRequestById: async (id) => {
    try {
      const result = await firebaseService.getById('requests', id)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { request: result.data }
    } catch (error) {
      console.error('Error getting request:', error)
      throw error
    }
  },

  // Get requests by user ID
  getUserRequests: async (userId, params = {}) => {
    try {
      const options = {
        where: [['userId', '==', userId]],
        orderBy: [['createdAt', 'desc']]
      }
      
      // Apply additional filters
      if (params.status) {
        options.where.push(['status', '==', params.status])
      }
      
      if (params.limit) {
        options.limit = parseInt(params.limit)
      }
      
      const result = await firebaseService.getAll('requests', options)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return {
        requests: result.data,
        total: result.data.length
      }
    } catch (error) {
      console.error('Error getting user requests:', error)
      throw error
    }
  },

  // Approve a request
  approveRequest: async (id) => {
    try {
      const updateData = {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      const result = await firebaseService.update('requests', id, updateData)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { request: result.data }
    } catch (error) {
      console.error('Error approving request:', error)
      throw error
    }
  },

  // Reject a request
  rejectRequest: async (id, reason) => {
    try {
      const updateData = {
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      const result = await firebaseService.update('requests', id, updateData)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { request: result.data }
    } catch (error) {
      console.error('Error rejecting request:', error)
      throw error
    }
  },

  // Mark request as fulfilled
  fulfillRequest: async (id) => {
    try {
      const updateData = {
        status: 'fulfilled',
        fulfilledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      const result = await firebaseService.update('requests', id, updateData)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { request: result.data }
    } catch (error) {
      console.error('Error fulfilling request:', error)
      throw error
    }
  }
}