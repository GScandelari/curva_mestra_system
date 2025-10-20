import api from './authService'

export const productService = {
  // Get all products with optional filters
  getProducts: async (filters = {}) => {
    const params = new URLSearchParams()
    
    if (filters.category) params.append('category', filters.category)
    if (filters.expirationDays) params.append('expirationDays', filters.expirationDays)
    if (filters.lowStock) params.append('lowStock', filters.lowStock)
    if (filters.search) params.append('search', filters.search)
    if (filters.page) params.append('page', filters.page)
    if (filters.limit) params.append('limit', filters.limit)
    
    const queryString = params.toString()
    const url = queryString ? `/products?${queryString}` : '/products'
    
    const response = await api.get(url)
    return response.data
  },

  // Get single product by ID
  getProduct: async (id) => {
    const response = await api.get(`/products/${id}`)
    return response.data
  },

  // Create new product
  createProduct: async (productData) => {
    const response = await api.post('/products', productData)
    return response.data
  },

  // Update product
  updateProduct: async (id, productData) => {
    const response = await api.put(`/products/${id}`, productData)
    return response.data
  },

  // Delete product
  deleteProduct: async (id) => {
    const response = await api.delete(`/products/${id}`)
    return response.data
  },

  // Get product categories
  getCategories: async () => {
    const response = await api.get('/products/categories')
    return response.data
  },

  // Get products expiring soon
  getExpiringProducts: async (days = 30) => {
    const response = await api.get(`/products/expiring?days=${days}`)
    return response.data
  },

  // Get low stock products
  getLowStockProducts: async () => {
    const response = await api.get('/products/low-stock')
    return response.data
  },

  // Get product statistics
  getProductStats: async () => {
    const response = await api.get('/products/stats')
    return response.data
  },

  // Get stock movement trends
  getStockMovementTrends: async (days = 30) => {
    const response = await api.get(`/products/trends/movements?days=${days}`)
    return response.data
  }
}