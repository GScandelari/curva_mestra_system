import api from './authService'

export const reportService = {
  // Get expiration report
  getExpirationReport: async (days = 30, format = 'json') => {
    const response = await api.get(`/reports/expiration?days=${days}&format=${format}`)
    return response.data
  },

  // Get requests report
  getRequestsReport: async (filters = {}) => {
    const params = new URLSearchParams()
    
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.status) params.append('status', filters.status)
    if (filters.format) params.append('format', filters.format)
    
    const queryString = params.toString()
    const url = queryString ? `/reports/requests?${queryString}` : '/reports/requests'
    
    const response = await api.get(url)
    return response.data
  },

  // Get inventory summary report
  getInventorySummaryReport: async (format = 'json') => {
    const response = await api.get(`/reports/inventory?format=${format}`)
    return response.data
  },

  // Download report file
  downloadReport: async (endpoint, params = {}) => {
    const queryParams = new URLSearchParams(params)
    const url = queryParams.toString() ? `${endpoint}?${queryParams}` : endpoint
    
    const response = await api.get(url, {
      responseType: 'blob'
    })
    
    return response
  }
}