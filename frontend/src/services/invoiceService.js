import api from './authService'

export const invoiceService = {
  // Get all invoices with optional filters
  getInvoices: async (filters = {}) => {
    const params = new URLSearchParams()
    
    if (filters.supplier) params.append('supplier', filters.supplier)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', filters.page)
    if (filters.limit) params.append('limit', filters.limit)
    
    const queryString = params.toString()
    const url = queryString ? `/invoices?${queryString}` : '/invoices'
    
    const response = await api.get(url)
    return response.data
  },

  // Get single invoice by ID
  getInvoice: async (id) => {
    const response = await api.get(`/invoices/${id}`)
    return response.data
  },

  // Create new invoice
  createInvoice: async (invoiceData) => {
    const response = await api.post('/invoices', invoiceData)
    return response.data
  },

  // Update invoice
  updateInvoice: async (id, invoiceData) => {
    const response = await api.put(`/invoices/${id}`, invoiceData)
    return response.data
  },

  // Delete invoice
  deleteInvoice: async (id) => {
    const response = await api.delete(`/invoices/${id}`)
    return response.data
  },

  // Get products associated with invoice
  getInvoiceProducts: async (id) => {
    const response = await api.get(`/invoices/${id}/products`)
    return response.data
  },

  // Generate purchase report by period
  getPurchaseReport: async (startDate, endDate, supplier = null) => {
    const params = new URLSearchParams()
    params.append('startDate', startDate)
    params.append('endDate', endDate)
    if (supplier) params.append('supplier', supplier)
    
    const response = await api.get(`/invoices/reports/purchases?${params.toString()}`)
    return response.data
  }
}