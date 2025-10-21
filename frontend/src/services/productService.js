import firebaseService from './firebaseService'

export const productService = {
  // Get all products with optional filters
  getProducts: async (filters = {}) => {
    try {
      const options = {}
      
      // Apply filters
      if (filters.category || filters.search) {
        options.where = []
        if (filters.category) {
          options.where.push(['category', '==', filters.category])
        }
        if (filters.search) {
          // For search, we'll filter by product name
          options.where.push(['name', '>=', filters.search])
          options.where.push(['name', '<=', filters.search + '\uf8ff'])
        }
      }
      
      // Apply ordering
      options.orderBy = [['name', 'asc']]
      
      // Apply pagination
      if (filters.limit) {
        options.limit = parseInt(filters.limit)
      }
      
      const result = await firebaseService.getAll('products', options)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      let products = result.data
      
      // Apply additional filters that can't be done in Firestore query
      if (filters.expirationDays) {
        const expirationDate = new Date()
        expirationDate.setDate(expirationDate.getDate() + parseInt(filters.expirationDays))
        
        products = products.filter(product => {
          if (!product.expirationDate) return false
          return new Date(product.expirationDate) <= expirationDate
        })
      }
      
      if (filters.lowStock) {
        products = products.filter(product => {
          const minStock = product.minStock || 10
          return (product.currentStock || 0) <= minStock
        })
      }
      
      return {
        products,
        total: products.length,
        page: filters.page || 1,
        totalPages: Math.ceil(products.length / (filters.limit || 10))
      }
    } catch (error) {
      console.error('Error getting products:', error)
      throw error
    }
  },

  // Get single product by ID
  getProduct: async (id) => {
    try {
      const result = await firebaseService.getById('products', id)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { product: result.data }
    } catch (error) {
      console.error('Error getting product:', error)
      throw error
    }
  },

  // Create new product
  createProduct: async (productData) => {
    try {
      const productWithTimestamp = {
        ...productData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentStock: productData.currentStock || 0
      }
      
      const result = await firebaseService.create('products', productWithTimestamp)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { product: result.data }
    } catch (error) {
      console.error('Error creating product:', error)
      throw error
    }
  },

  // Update product
  updateProduct: async (id, productData) => {
    try {
      const updateData = {
        ...productData,
        updatedAt: new Date().toISOString()
      }
      
      const result = await firebaseService.update('products', id, updateData)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { product: result.data }
    } catch (error) {
      console.error('Error updating product:', error)
      throw error
    }
  },

  // Delete product
  deleteProduct: async (id) => {
    try {
      const result = await firebaseService.delete('products', id)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      return { success: true }
    } catch (error) {
      console.error('Error deleting product:', error)
      throw error
    }
  },

  // Get product categories
  getCategories: async () => {
    try {
      const result = await firebaseService.getAll('products')
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      // Extract unique categories
      const categories = [...new Set(result.data.map(product => product.category).filter(Boolean))]
      
      return { categories }
    } catch (error) {
      console.error('Error getting categories:', error)
      throw error
    }
  },

  // Get products expiring soon
  getExpiringProducts: async (days = 30) => {
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
      
      return { products: expiringProducts }
    } catch (error) {
      console.error('Error getting expiring products:', error)
      throw error
    }
  },

  // Get low stock products
  getLowStockProducts: async () => {
    try {
      const result = await firebaseService.getAll('products')
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      const lowStockProducts = result.data.filter(product => {
        const minStock = product.minStock || 10
        return (product.currentStock || 0) <= minStock
      })
      
      return { products: lowStockProducts }
    } catch (error) {
      console.error('Error getting low stock products:', error)
      throw error
    }
  },

  // Get product statistics
  getProductStats: async () => {
    try {
      const result = await firebaseService.getAll('products')
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      const products = result.data
      const totalProducts = products.length
      const totalValue = products.reduce((sum, product) => sum + ((product.currentStock || 0) * (product.unitPrice || 0)), 0)
      
      // Calculate expiring products (next 30 days)
      const expirationDate = new Date()
      expirationDate.setDate(expirationDate.getDate() + 30)
      const expiringProducts = products.filter(product => {
        if (!product.expirationDate) return false
        return new Date(product.expirationDate) <= expirationDate
      }).length
      
      // Calculate low stock products
      const lowStockProducts = products.filter(product => {
        const minStock = product.minStock || 10
        return (product.currentStock || 0) <= minStock
      }).length
      
      return {
        stats: {
          totalProducts,
          totalValue,
          expiringProducts,
          lowStockProducts,
          categories: [...new Set(products.map(p => p.category).filter(Boolean))].length
        }
      }
    } catch (error) {
      console.error('Error getting product stats:', error)
      throw error
    }
  },

  // Get stock movement trends (simplified version)
  getStockMovementTrends: async (days = 30) => {
    try {
      // This would require a separate collection for stock movements
      // For now, return empty data
      return {
        trends: [],
        summary: {
          totalMovements: 0,
          totalIn: 0,
          totalOut: 0
        }
      }
    } catch (error) {
      console.error('Error getting stock movement trends:', error)
      throw error
    }
  }
}