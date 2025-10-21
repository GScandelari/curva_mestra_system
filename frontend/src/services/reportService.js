import firebaseService from './firebaseService'

export const reportService = {
  // Get expiration report
  getExpirationReport: async (days = 30, format = 'json') => {
    try {
      const result = await firebaseService.getAll('products', {
        orderBy: [['expirationDate', 'asc']]
      })
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      const expirationDate = new Date()
      expirationDate.setDate(expirationDate.getDate() + days)
      
      const expiringProducts = result.data.filter(product => {
        if (!product.expirationDate) return false
        return new Date(product.expirationDate) <= expirationDate
      })
      
      // Group by expiration status
      const today = new Date()
      const expired = expiringProducts.filter(p => new Date(p.expirationDate) < today)
      const expiringSoon = expiringProducts.filter(p => {
        const expDate = new Date(p.expirationDate)
        return expDate >= today && expDate <= expirationDate
      })
      
      const report = {
        summary: {
          totalProducts: result.data.length,
          expiredProducts: expired.length,
          expiringSoonProducts: expiringSoon.length,
          totalValue: expiringProducts.reduce((sum, p) => sum + ((p.currentStock || 0) * (p.unitPrice || 0)), 0)
        },
        expired,
        expiringSoon,
        generatedAt: new Date().toISOString()
      }
      
      return { report }
    } catch (error) {
      console.error('Error getting expiration report:', error)
      throw error
    }
  },

  // Get requests report
  getRequestsReport: async (filters = {}) => {
    try {
      const options = {
        orderBy: [['createdAt', 'desc']]
      }
      
      // Apply status filter
      if (filters.status) {
        options.where = [['status', '==', filters.status]]
      }
      
      const result = await firebaseService.getAll('requests', options)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      let requests = result.data
      
      // Filter by date range
      if (filters.startDate || filters.endDate) {
        requests = requests.filter(request => {
          const createdDate = new Date(request.createdAt)
          if (filters.startDate && createdDate < new Date(filters.startDate)) {
            return false
          }
          if (filters.endDate && createdDate > new Date(filters.endDate)) {
            return false
          }
          return true
        })
      }
      
      // Generate summary
      const summary = {
        totalRequests: requests.length,
        pendingRequests: requests.filter(r => r.status === 'pending').length,
        approvedRequests: requests.filter(r => r.status === 'approved').length,
        rejectedRequests: requests.filter(r => r.status === 'rejected').length,
        fulfilledRequests: requests.filter(r => r.status === 'fulfilled').length
      }
      
      const report = {
        summary,
        requests,
        generatedAt: new Date().toISOString()
      }
      
      return { report }
    } catch (error) {
      console.error('Error getting requests report:', error)
      throw error
    }
  },

  // Get inventory summary report
  getInventorySummaryReport: async (format = 'json') => {
    try {
      const productsResult = await firebaseService.getAll('products')
      
      if (!productsResult.success) {
        throw new Error(productsResult.error)
      }
      
      const products = productsResult.data
      
      // Calculate inventory metrics
      const totalProducts = products.length
      const totalValue = products.reduce((sum, p) => sum + ((p.currentStock || 0) * (p.unitPrice || 0)), 0)
      const totalStock = products.reduce((sum, p) => sum + (p.currentStock || 0), 0)
      
      // Low stock products
      const lowStockProducts = products.filter(p => {
        const minStock = p.minStock || 10
        return (p.currentStock || 0) <= minStock
      })
      
      // Expiring products (next 30 days)
      const expirationDate = new Date()
      expirationDate.setDate(expirationDate.getDate() + 30)
      const expiringProducts = products.filter(p => {
        if (!p.expirationDate) return false
        return new Date(p.expirationDate) <= expirationDate
      })
      
      // Category breakdown
      const categoryBreakdown = products.reduce((acc, product) => {
        const category = product.category || 'Sem categoria'
        if (!acc[category]) {
          acc[category] = {
            category,
            productCount: 0,
            totalStock: 0,
            totalValue: 0
          }
        }
        acc[category].productCount++
        acc[category].totalStock += product.currentStock || 0
        acc[category].totalValue += (product.currentStock || 0) * (product.unitPrice || 0)
        return acc
      }, {})
      
      const report = {
        summary: {
          totalProducts,
          totalValue,
          totalStock,
          lowStockCount: lowStockProducts.length,
          expiringCount: expiringProducts.length,
          categories: Object.keys(categoryBreakdown).length
        },
        categoryBreakdown: Object.values(categoryBreakdown),
        lowStockProducts,
        expiringProducts,
        generatedAt: new Date().toISOString()
      }
      
      return { report }
    } catch (error) {
      console.error('Error getting inventory summary report:', error)
      throw error
    }
  },

  // Download report file (simplified - returns JSON data for now)
  downloadReport: async (reportType, params = {}) => {
    try {
      let reportData
      
      switch (reportType) {
        case 'expiration':
          reportData = await reportService.getExpirationReport(params.days)
          break
        case 'requests':
          reportData = await reportService.getRequestsReport(params)
          break
        case 'inventory':
          reportData = await reportService.getInventorySummaryReport()
          break
        default:
          throw new Error('Tipo de relatório não suportado')
      }
      
      // Convert to CSV if requested
      if (params.format === 'csv') {
        // This would need a CSV conversion utility
        // For now, return JSON
        return {
          data: JSON.stringify(reportData, null, 2),
          filename: `${reportType}_report_${new Date().toISOString().split('T')[0]}.json`,
          contentType: 'application/json'
        }
      }
      
      return {
        data: JSON.stringify(reportData, null, 2),
        filename: `${reportType}_report_${new Date().toISOString().split('T')[0]}.json`,
        contentType: 'application/json'
      }
    } catch (error) {
      console.error('Error downloading report:', error)
      throw error
    }
  }
}