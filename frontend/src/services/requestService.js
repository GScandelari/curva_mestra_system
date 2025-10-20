import api from './authService'

export const requestService = {
  // Create a new request
  createRequest: async (requestData) => {
    const response = await api.post('/api/requests', requestData)
    return response.data
  },

  // Get all requests (admin/manager only)
  getRequests: async (params = {}) => {
    const queryParams = new URLSearchParams()
    
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        queryParams.append(key, params[key])
      }
    })
    
    const response = await api.get(`/api/requests?${queryParams.toString()}`)
    return response.data
  },

  // Get specific request by ID
  getRequestById: async (id) => {
    const response = await api.get(`/api/requests/${id}`)
    return response.data
  },

  // Get requests by user ID
  getUserRequests: async (userId, params = {}) => {
    const queryParams = new URLSearchParams()
    
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        queryParams.append(key, params[key])
      }
    })
    
    const response = await api.get(`/api/requests/user/${userId}?${queryParams.toString()}`)
    return response.data
  },

  // Approve a request
  approveRequest: async (id) => {
    const response = await api.patch(`/api/requests/${id}/approve`)
    return response.data
  },

  // Reject a request
  rejectRequest: async (id, reason) => {
    const response = await api.patch(`/api/requests/${id}/reject`, { reason })
    return response.data
  },

  // Mark request as fulfilled
  fulfillRequest: async (id) => {
    const response = await api.patch(`/api/requests/${id}/fulfill`)
    return response.data
  }
}