import { 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit,
  Timestamp,
  startAt,
  endAt
} from 'firebase/firestore';
import firebaseService from './firebaseService';

/**
 * Firebase Product Service
 * 
 * This service replaces the REST API product service with Firebase operations
 */
class FirebaseProductService {
  constructor() {
    this.collectionName = 'products';
  }

  /**
   * Get all products with optional filters
   */
  async getProducts(filters = {}) {
    try {
      const options = {
        orderBy: [['createdAt', 'desc']]
      };

      // Build where conditions
      const whereConditions = [];

      if (filters.category) {
        whereConditions.push(['category', '==', filters.category]);
      }

      if (filters.lowStock) {
        whereConditions.push(['currentStock', '<=', 'minimumStock']);
      }

      if (filters.search) {
        // Firestore doesn't support full-text search, so we'll use array-contains for tags
        // or startAt/endAt for name prefix search
        const searchTerm = filters.search.toLowerCase();
        whereConditions.push(['searchTerms', 'array-contains', searchTerm]);
      }

      if (filters.expirationDays) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + parseInt(filters.expirationDays));
        whereConditions.push(['expirationDate', '<=', Timestamp.fromDate(futureDate)]);
        whereConditions.push(['isExpired', '==', false]);
      }

      if (whereConditions.length > 0) {
        options.where = whereConditions;
      }

      if (filters.limit) {
        options.limit = parseInt(filters.limit);
      }

      const result = await firebaseService.getAll(this.collectionName, options);

      // Apply client-side filtering for complex conditions that Firestore can't handle
      if (result.success && result.data) {
        let filteredData = result.data;

        // Client-side search if no searchTerms field exists
        if (filters.search && !filters.search.includes('searchTerms')) {
          const searchTerm = filters.search.toLowerCase();
          filteredData = filteredData.filter(product => 
            product.name?.toLowerCase().includes(searchTerm) ||
            product.description?.toLowerCase().includes(searchTerm) ||
            product.invoiceNumber?.toLowerCase().includes(searchTerm)
          );
        }

        // Client-side low stock filtering (more accurate)
        if (filters.lowStock) {
          filteredData = filteredData.filter(product => 
            product.currentStock <= product.minimumStock
          );
        }

        // Pagination (client-side for now)
        if (filters.page && filters.limit) {
          const page = parseInt(filters.page);
          const pageLimit = parseInt(filters.limit);
          const startIndex = (page - 1) * pageLimit;
          const endIndex = startIndex + pageLimit;
          filteredData = filteredData.slice(startIndex, endIndex);
        }

        return {
          success: true,
          data: {
            products: filteredData,
            total: filteredData.length,
            page: filters.page ? parseInt(filters.page) : 1,
            limit: filters.limit ? parseInt(filters.limit) : filteredData.length
          }
        };
      }

      return result;
    } catch (error) {
      console.error('Error getting products:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar produtos'
      };
    }
  }

  /**
   * Get single product by ID
   */
  async getProduct(id) {
    try {
      const result = await firebaseService.getById(this.collectionName, id);
      
      if (result.success) {
        return {
          success: true,
          data: { product: result.data }
        };
      }

      return result;
    } catch (error) {
      console.error('Error getting product:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar produto'
      };
    }
  }

  /**
   * Create new product
   */
  async createProduct(productData) {
    try {
      // Validate required fields
      if (!productData.name || !productData.invoiceNumber) {
        return {
          success: false,
          error: 'Nome e número da nota fiscal são obrigatórios'
        };
      }

      // Check if invoice number already exists
      const existingProducts = await firebaseService.getAll(this.collectionName, {
        where: [['invoiceNumber', '==', productData.invoiceNumber]]
      });

      if (existingProducts.success && existingProducts.data.length > 0) {
        return {
          success: false,
          error: 'Número da nota fiscal já existe'
        };
      }

      // Prepare product data
      const productToCreate = {
        ...productData,
        currentStock: productData.initialStock || 0,
        isExpired: false,
        searchTerms: this.generateSearchTerms(productData.name, productData.description),
        // Convert date strings to Firestore timestamps
        expirationDate: productData.expirationDate ? 
          Timestamp.fromDate(new Date(productData.expirationDate)) : null,
        entryDate: productData.entryDate ? 
          Timestamp.fromDate(new Date(productData.entryDate)) : Timestamp.now()
      };

      const result = await firebaseService.create(this.collectionName, productToCreate);

      if (result.success) {
        return {
          success: true,
          data: { product: result.data },
          message: 'Produto criado com sucesso'
        };
      }

      return result;
    } catch (error) {
      console.error('Error creating product:', error);
      return {
        success: false,
        error: error.message || 'Erro ao criar produto'
      };
    }
  }

  /**
   * Update product
   */
  async updateProduct(id, productData) {
    try {
      // Prepare update data
      const updateData = {
        ...productData,
        searchTerms: productData.name ? 
          this.generateSearchTerms(productData.name, productData.description) : undefined
      };

      // Convert date strings to Firestore timestamps
      if (productData.expirationDate) {
        updateData.expirationDate = Timestamp.fromDate(new Date(productData.expirationDate));
      }

      if (productData.entryDate) {
        updateData.entryDate = Timestamp.fromDate(new Date(productData.entryDate));
      }

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const result = await firebaseService.update(this.collectionName, id, updateData);

      if (result.success) {
        return {
          success: true,
          data: { product: result.data },
          message: 'Produto atualizado com sucesso'
        };
      }

      return result;
    } catch (error) {
      console.error('Error updating product:', error);
      return {
        success: false,
        error: error.message || 'Erro ao atualizar produto'
      };
    }
  }

  /**
   * Delete product
   */
  async deleteProduct(id) {
    try {
      const result = await firebaseService.delete(this.collectionName, id);
      
      if (result.success) {
        return {
          success: true,
          message: 'Produto deletado com sucesso'
        };
      }

      return result;
    } catch (error) {
      console.error('Error deleting product:', error);
      return {
        success: false,
        error: error.message || 'Erro ao deletar produto'
      };
    }
  }

  /**
   * Get product categories
   */
  async getCategories() {
    try {
      // Use Firebase Function to get aggregated categories
      const result = await firebaseService.callFunction('getProductCategories');
      
      if (result.success) {
        return {
          success: true,
          data: { categories: result.data }
        };
      }

      // Fallback: get all products and extract unique categories
      const productsResult = await firebaseService.getAll(this.collectionName);
      
      if (productsResult.success) {
        const categories = [...new Set(
          productsResult.data
            .map(product => product.category)
            .filter(category => category)
        )];

        return {
          success: true,
          data: { categories }
        };
      }

      return productsResult;
    } catch (error) {
      console.error('Error getting categories:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar categorias'
      };
    }
  }

  /**
   * Get products expiring soon
   */
  async getExpiringProducts(days = 30) {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const result = await firebaseService.getAll(this.collectionName, {
        where: [
          ['expirationDate', '<=', Timestamp.fromDate(futureDate)],
          ['isExpired', '==', false]
        ],
        orderBy: [['expirationDate', 'asc']]
      });

      if (result.success) {
        return {
          success: true,
          data: { 
            products: result.data,
            total: result.data.length
          }
        };
      }

      return result;
    } catch (error) {
      console.error('Error getting expiring products:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar produtos vencendo'
      };
    }
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts() {
    try {
      // Get all products and filter client-side (Firestore limitation)
      const result = await firebaseService.getAll(this.collectionName);

      if (result.success) {
        const lowStockProducts = result.data.filter(product => 
          product.currentStock <= product.minimumStock
        );

        return {
          success: true,
          data: { 
            products: lowStockProducts,
            total: lowStockProducts.length
          }
        };
      }

      return result;
    } catch (error) {
      console.error('Error getting low stock products:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar produtos com estoque baixo'
      };
    }
  }

  /**
   * Get product statistics
   */
  async getProductStats() {
    try {
      // Use Firebase Function for complex aggregations
      const result = await firebaseService.callFunction('getProductStats');
      
      if (result.success) {
        return {
          success: true,
          data: result.data
        };
      }

      // Fallback: calculate stats client-side
      const productsResult = await firebaseService.getAll(this.collectionName);
      
      if (productsResult.success) {
        const products = productsResult.data;
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

        const stats = {
          total: products.length,
          lowStock: products.filter(p => p.currentStock <= p.minimumStock).length,
          expiringSoon: products.filter(p => 
            p.expirationDate && 
            new Date(p.expirationDate) <= thirtyDaysFromNow && 
            !p.isExpired
          ).length,
          expired: products.filter(p => p.isExpired).length,
          totalValue: products.reduce((sum, p) => sum + (p.unitPrice * p.currentStock || 0), 0),
          categories: [...new Set(products.map(p => p.category).filter(Boolean))].length
        };

        return {
          success: true,
          data: stats
        };
      }

      return productsResult;
    } catch (error) {
      console.error('Error getting product stats:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar estatísticas'
      };
    }
  }

  /**
   * Get stock movement trends
   */
  async getStockMovementTrends(days = 30) {
    try {
      // Use Firebase Function for complex queries
      const result = await firebaseService.callFunction('getStockMovementTrends', { days });
      
      if (result.success) {
        return {
          success: true,
          data: result.data
        };
      }

      return {
        success: false,
        error: 'Funcionalidade de tendências não disponível'
      };
    } catch (error) {
      console.error('Error getting stock movement trends:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar tendências'
      };
    }
  }

  /**
   * Setup real-time listener for products
   */
  onProductsChange(callback, filters = {}) {
    const options = {
      orderBy: [['createdAt', 'desc']]
    };

    // Apply filters
    if (filters.category) {
      options.where = [['category', '==', filters.category]];
    }

    return firebaseService.onCollectionChange(this.collectionName, callback, options);
  }

  /**
   * Setup real-time listener for a specific product
   */
  onProductChange(id, callback) {
    return firebaseService.onDocumentChange(this.collectionName, id, callback);
  }

  /**
   * Remove listener
   */
  removeListener(listenerId) {
    return firebaseService.removeListener(listenerId);
  }

  /**
   * Generate search terms for full-text search
   */
  generateSearchTerms(name, description = '') {
    const terms = [];
    
    if (name) {
      // Add full name
      terms.push(name.toLowerCase());
      
      // Add individual words
      name.toLowerCase().split(' ').forEach(word => {
        if (word.length > 2) {
          terms.push(word);
        }
      });
    }

    if (description) {
      // Add individual words from description
      description.toLowerCase().split(' ').forEach(word => {
        if (word.length > 2) {
          terms.push(word);
        }
      });
    }

    return [...new Set(terms)]; // Remove duplicates
  }
}

// Create singleton instance
const firebaseProductService = new FirebaseProductService();

export default firebaseProductService;