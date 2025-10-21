import firebaseService from './firebaseService'

export const invoiceService = {
  // Get all invoices with optional filters
  getInvoices: async (filters = {}) => {
    try {
      const options = {}
      
      // Apply filters
      if (filters.supplier || filters.search) {
        options.where = []
        if (filters.supplier) {
          options.where.push(['supplier', '==', filters.supplier])
        }
        if (filters.search) {
          // For search, we'll filter by supplier name or invoice number
          options.where.push(['supplier', '>=', filters.search])
          options.where.push(['supplier', '<=', filters.search + '\uf8ff'])
        }
      }
      
      // Apply ordering
      options.orderBy = [['receiptDate', 'desc']]
      
      // Apply pagination
      if (filters.limit) {
        options.limit = parseInt(filters.limit)
      }
      
      const result = await firebaseService.getAll('invoices', options)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      // Filter by date range if specified
      let invoices = result.data
      if (filters.startDate || filters.endDate) {
        invoices = invoices.filter(invoice => {
          const receiptDate = new Date(invoice.receiptDate)
          if (filters.startDate && receiptDate < new Date(filters.startDate)) {
            return false
          }
          if (filters.endDate && receiptDate > new Date(filters.endDate)) {
            return false
          }
          return true
        })
      }
      
      return {
        invoices,
        total: invoices.length,
        page: filters.page || 1,
        totalPages: Math.ceil(invoices.length / (filters.limit || 10))
      }
    } catch (error) {
      console.error('Error getting invoices:', error)
      throw error
    }
  },

  // Get single invoice by ID
  getInvoice: async (id) => {
    try {
      const result = await firebaseService.getById('invoices', id)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { invoice: result.data }
    } catch (error) {
      console.error('Error getting invoice:', error)
      throw error
    }
  },

  // Create new invoice
  createInvoice: async (invoiceData) => {
    try {
      const invoiceWithTimestamp = {
        ...invoiceData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      const result = await firebaseService.create('invoices', invoiceWithTimestamp)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { invoice: result.data }
    } catch (error) {
      console.error('Error creating invoice:', error)
      throw error
    }
  },

  // Update invoice
  updateInvoice: async (id, invoiceData) => {
    try {
      const updateData = {
        ...invoiceData,
        updatedAt: new Date().toISOString()
      }
      
      const result = await firebaseService.update('invoices', id, updateData)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { invoice: result.data }
    } catch (error) {
      console.error('Error updating invoice:', error)
      throw error
    }
  },

  // Delete invoice
  deleteInvoice: async (id) => {
    try {
      const result = await firebaseService.delete('invoices', id)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { success: true }
    } catch (error) {
      console.error('Error deleting invoice:', error)
      throw error
    }
  },

  // Get products associated with invoice
  getInvoiceProducts: async (id) => {
    try {
      // Get the invoice first
      const invoiceResult = await firebaseService.getById('invoices', id)
      
      if (!invoiceResult.success) {
        throw new Error(invoiceResult.error)
      }
      
      // Get products associated with this invoice
      const productsResult = await firebaseService.getAll('products', {
        where: [['invoiceId', '==', id]],
        orderBy: [['name', 'asc']]
      })
      
      if (!productsResult.success) {
        throw new Error(productsResult.error)
      }
      
      return {
        invoice: invoiceResult.data,
        products: productsResult.data
      }
    } catch (error) {
      console.error('Error getting invoice products:', error)
      throw error
    }
  },

  // Generate purchase report by period
  getPurchaseReport: async (startDate, endDate, supplier = null) => {
    try {
      const options = {
        orderBy: [['receiptDate', 'desc']]
      }
      
      if (supplier) {
        options.where = [['supplier', '==', supplier]]
      }
      
      const result = await firebaseService.getAll('invoices', options)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      // Filter by date range
      const filteredInvoices = result.data.filter(invoice => {
        const receiptDate = new Date(invoice.receiptDate)
        return receiptDate >= new Date(startDate) && receiptDate <= new Date(endDate)
      })
      
      // Calculate totals
      const totalValue = filteredInvoices.reduce((sum, invoice) => sum + (invoice.totalValue || 0), 0)
      const totalInvoices = filteredInvoices.length
      
      // Group by supplier
      const supplierSummary = filteredInvoices.reduce((acc, invoice) => {
        const supplier = invoice.supplier
        if (!acc[supplier]) {
          acc[supplier] = {
            supplier,
            invoiceCount: 0,
            totalValue: 0
          }
        }
        acc[supplier].invoiceCount++
        acc[supplier].totalValue += invoice.totalValue || 0
        return acc
      }, {})
      
      return {
        invoices: filteredInvoices,
        summary: {
          totalInvoices,
          totalValue,
          averageValue: totalInvoices > 0 ? totalValue / totalInvoices : 0,
          supplierSummary: Object.values(supplierSummary)
        }
      }
    } catch (error) {
      console.error('Error generating purchase report:', error)
      throw error
    }
  }
}