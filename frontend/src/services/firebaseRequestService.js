import { 
  query, 
  where, 
  orderBy, 
  Timestamp
} from 'firebase/firestore';
import firebaseService from './firebaseService';

/**
 * Firebase Request Service
 * 
 * This service handles product requests using Firebase operations
 */
class FirebaseRequestService {
  constructor() {
    this.collectionName = 'requests';
  }

  /**
   * Get all requests with optional filters
   */
  async getRequests(filters = {}) {
    try {
      const options = {
        orderBy: [['createdAt', 'desc']]
      };

      const whereConditions = [];

      if (filters.status) {
        whereConditions.push(['status', '==', filters.status]);
      }

      if (filters.requesterId) {
        whereConditions.push(['requesterId', '==', filters.requesterId]);
      }

      if (filters.productId) {
        whereConditions.push(['productId', '==', filters.productId]);
      }

      if (whereConditions.length > 0) {
        options.where = whereConditions;
      }

      if (filters.limit) {
        options.limit = parseInt(filters.limit);
      }

      const result = await firebaseService.getAll(this.collectionName, options);

      if (result.success) {
        return {
          success: true,
          data: {
            requests: result.data,
            total: result.data.length
          }
        };
      }

      return result;
    } catch (error) {
      console.error('Error getting requests:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar solicitações'
      };
    }
  }

  /**
   * Get single request by ID
   */
  async getRequest(id) {
    try {
      const result = await firebaseService.getById(this.collectionName, id);
      
      if (result.success) {
        return {
          success: true,
          data: { request: result.data }
        };
      }

      return result;
    } catch (error) {
      console.error('Error getting request:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar solicitação'
      };
    }
  }

  /**
   * Create new request
   */
  async createRequest(requestData) {
    try {
      const request = {
        ...requestData,
        status: 'pending',
        requestDate: Timestamp.now()
      };

      const result = await firebaseService.create(this.collectionName, request);

      if (result.success) {
        return {
          success: true,
          data: { request: result.data },
          message: 'Solicitação criada com sucesso'
        };
      }

      return result;
    } catch (error) {
      console.error('Error creating request:', error);
      return {
        success: false,
        error: error.message || 'Erro ao criar solicitação'
      };
    }
  }

  /**
   * Update request
   */
  async updateRequest(id, requestData) {
    try {
      const result = await firebaseService.update(this.collectionName, id, requestData);

      if (result.success) {
        return {
          success: true,
          data: { request: result.data },
          message: 'Solicitação atualizada com sucesso'
        };
      }

      return result;
    } catch (error) {
      console.error('Error updating request:', error);
      return {
        success: false,
        error: error.message || 'Erro ao atualizar solicitação'
      };
    }
  }

  /**
   * Delete request
   */
  async deleteRequest(id) {
    try {
      const result = await firebaseService.delete(this.collectionName, id);

      if (result.success) {
        return {
          success: true,
          message: 'Solicitação deletada com sucesso'
        };
      }

      return result;
    } catch (error) {
      console.error('Error deleting request:', error);
      return {
        success: false,
        error: error.message || 'Erro ao deletar solicitação'
      };
    }
  }

  /**
   * Approve request
   */
  async approveRequest(id, approvalData = {}) {
    try {
      const updateData = {
        status: 'approved',
        approvedAt: Timestamp.now(),
        ...approvalData
      };

      const result = await firebaseService.update(this.collectionName, id, updateData);

      if (result.success) {
        return {
          success: true,
          data: { request: result.data },
          message: 'Solicitação aprovada com sucesso'
        };
      }

      return result;
    } catch (error) {
      console.error('Error approving request:', error);
      return {
        success: false,
        error: error.message || 'Erro ao aprovar solicitação'
      };
    }
  }

  /**
   * Reject request
   */
  async rejectRequest(id, rejectionData = {}) {
    try {
      const updateData = {
        status: 'rejected',
        rejectedAt: Timestamp.now(),
        ...rejectionData
      };

      const result = await firebaseService.update(this.collectionName, id, updateData);

      if (result.success) {
        return {
          success: true,
          data: { request: result.data },
          message: 'Solicitação rejeitada'
        };
      }

      return result;
    } catch (error) {
      console.error('Error rejecting request:', error);
      return {
        success: false,
        error: error.message || 'Erro ao rejeitar solicitação'
      };
    }
  }

  /**
   * Setup real-time listener for requests
   */
  onRequestsChange(callback, filters = {}) {
    const options = {
      orderBy: [['createdAt', 'desc']]
    };

    const whereConditions = [];

    if (filters.status) {
      whereConditions.push(['status', '==', filters.status]);
    }

    if (filters.requesterId) {
      whereConditions.push(['requesterId', '==', filters.requesterId]);
    }

    if (whereConditions.length > 0) {
      options.where = whereConditions;
    }

    return firebaseService.onCollectionChange(this.collectionName, callback, options);
  }

  /**
   * Setup real-time listener for a specific request
   */
  onRequestChange(id, callback) {
    return firebaseService.onDocumentChange(this.collectionName, id, callback);
  }

  /**
   * Remove listener
   */
  removeListener(listenerId) {
    return firebaseService.removeListener(listenerId);
  }
}

// Create singleton instance
const firebaseRequestService = new FirebaseRequestService();

export default firebaseRequestService;