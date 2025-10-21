/**
 * Firebase Functions for Request Management
 */

import {onCall} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {
  verifyAuth,
  authorize,
  validateClinic,
  validateInput,
  rateLimit,
  logError
} from "../middleware/auth";

const db = admin.firestore();

/**
 * Request interface
 */
interface ProductRequest {
  id?: string;
  requesterId: string;
  patientId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  notes?: string;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: admin.firestore.Timestamp;
  rejectedBy?: string;
  rejectedAt?: admin.firestore.Timestamp;
  fulfilledBy?: string;
  fulfilledAt?: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  clinicId: string;
}

// interface RequestedProduct {
//   productId: string;
//   productName: string;
//   quantity: number;
//   unitPrice: number;
//   totalPrice: number;
// }

/**
 * Create new product request
 */
export const createRequest = onCall(async (request) => {
  try {
    const authRequest = verifyAuth(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 10, windowMs: 60000 })(authRequest);
    
    const { products, patientId, notes } = request.data;
    
    // Validate required fields
    validateInput(request.data, ['products']);
    
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('Lista de produtos é obrigatória');
    }

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    // Validate that all products exist and have sufficient stock
    const productValidations = await Promise.all(
      products.map(async (item: any) => {
        const productDoc = await db
          .collection(`clinics/${clinicId}/products`)
          .doc(item.productId)
          .get();
        
        if (!productDoc.exists) {
          throw new Error(`Produto não encontrado: ${item.productId}`);
        }

        const productData = productDoc.data();
        if (productData!.currentStock < item.quantity) {
          throw new Error(`Estoque insuficiente para ${productData!.name}. Disponível: ${productData!.currentStock}, Solicitado: ${item.quantity}`);
        }

        return {
          productId: item.productId,
          productName: productData!.name,
          quantity: item.quantity,
          unitPrice: productData!.unitPrice,
          totalPrice: productData!.unitPrice * item.quantity
        };
      })
    );

    // Validate patient if provided
    if (patientId) {
      const patientDoc = await db
        .collection(`clinics/${clinicId}/patients`)
        .doc(patientId)
        .get();
      
      if (!patientDoc.exists) {
        throw new Error('Paciente não encontrado');
      }
    }

    // Create request using transaction
    const result = await db.runTransaction(async (transaction) => {
      // Create main request document
      const requestRef = db.collection(`clinics/${clinicId}/requests`).doc();
      
      const requestData: ProductRequest = {
        requesterId: authRequest.auth.uid,
        patientId: patientId || null,
        status: 'pending',
        notes: notes || '',
        createdAt: admin.firestore.Timestamp.now(),
        clinicId
      };

      transaction.set(requestRef, requestData);

      // Create requested products subcollection
      productValidations.forEach((product, index) => {
        const productRef = db
          .collection(`clinics/${clinicId}/requests/${requestRef.id}/products`)
          .doc();
        
        transaction.set(productRef, product);
      });

      return {
        requestId: requestRef.id,
        products: productValidations
      };
    });

    logger.info('Request created', {
      requestId: result.requestId,
      requesterId: authRequest.auth.uid,
      productsCount: products.length,
      clinicId
    });

    return {
      success: true,
      message: 'Solicitação criada com sucesso',
      requestId: result.requestId,
      products: result.products
    };

  } catch (error: any) {
    logError('createRequest', error, { 
      userId: request.auth?.uid,
      data: request.data 
    });
    
    if (error.message.includes('não encontrado') || error.message.includes('Estoque insuficiente')) {
      throw new Error('invalid-argument');
    }
    
    throw new Error('internal');
  }
});

/**
 * Get requests with filtering and pagination
 */
export const getRequests = onCall(async (request) => {
  try {
    const authRequest = authorize(['admin', 'manager'])(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 30, windowMs: 60000 })(authRequest);
    
    const {
      page = 1,
      limit = 10,
      status,
      requesterId,
      startDate,
      endDate
    } = request.data || {};

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    let query: admin.firestore.Query = db.collection(`clinics/${clinicId}/requests`);

    // Apply filters
    if (status) {
      query = query.where('status', '==', status);
    }

    if (requesterId) {
      query = query.where('requesterId', '==', requesterId);
    }

    if (startDate) {
      const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(startDate));
      query = query.where('createdAt', '>=', startTimestamp);
    }

    if (endDate) {
      const endTimestamp = admin.firestore.Timestamp.fromDate(new Date(endDate));
      query = query.where('createdAt', '<=', endTimestamp);
    }

    // Apply pagination and ordering
    query = query.orderBy('createdAt', 'desc').limit(limit);

    const snapshot = await query.get();
    
    // Get requests with their products
    const requests = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const requestData = { id: doc.id, ...doc.data() };
        
        // Get products for this request
        const productsSnapshot = await db
          .collection(`clinics/${clinicId}/requests/${doc.id}/products`)
          .get();
        
        const products = productsSnapshot.docs.map(productDoc => ({
          id: productDoc.id,
          ...productDoc.data()
        }));

        return {
          ...requestData,
          products
        };
      })
    );

    return {
      success: true,
      requests,
      pagination: {
        currentPage: page,
        totalItems: requests.length,
        itemsPerPage: limit,
        hasMore: snapshot.docs.length === limit
      }
    };

  } catch (error: any) {
    logError('getRequests', error, { 
      userId: request.auth?.uid,
      data: request.data 
    });
    
    throw new Error('internal');
  }
});

/**
 * Get request by ID
 */
export const getRequestById = onCall(async (request) => {
  try {
    const authRequest = verifyAuth(request);
    
    const { requestId } = request.data;
    validateInput(request.data, ['requestId']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    const requestDoc = await db
      .collection(`clinics/${clinicId}/requests`)
      .doc(requestId)
      .get();

    if (!requestDoc.exists) {
      throw new Error('Solicitação não encontrada');
    }

    const requestData = requestDoc.data();
    
    // Check if user can access this request
    const userRole = authRequest.auth.token.role;
    if (!['admin', 'manager'].includes(userRole) && 
        requestData!.requesterId !== authRequest.auth.uid) {
      throw new Error('Acesso negado a esta solicitação');
    }

    // Get products for this request
    const productsSnapshot = await db
      .collection(`clinics/${clinicId}/requests/${requestId}/products`)
      .get();
    
    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      success: true,
      request: {
        id: requestDoc.id,
        ...requestData,
        products
      }
    };

  } catch (error: any) {
    logError('getRequestById', error, { 
      userId: request.auth?.uid,
      requestId: request.data?.requestId 
    });
    
    if (error.message === 'Solicitação não encontrada') {
      throw new Error('not-found');
    }
    
    if (error.message === 'Acesso negado a esta solicitação') {
      throw new Error('permission-denied');
    }
    
    throw new Error('internal');
  }
});

/**
 * Get user requests
 */
export const getUserRequests = onCall(async (request) => {
  try {
    const authRequest = verifyAuth(request);
    
    const { userId, page = 1, limit = 10 } = request.data || {};
    
    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    // Users can only see their own requests unless they're admin/manager
    const targetUserId = userId || authRequest.auth.uid;
    const userRole = authRequest.auth.token.role;
    
    if (targetUserId !== authRequest.auth.uid && !['admin', 'manager'].includes(userRole)) {
      throw new Error('Acesso negado');
    }

    const snapshot = await db
      .collection(`clinics/${clinicId}/requests`)
      .where('requesterId', '==', targetUserId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    // Get requests with their products
    const requests = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const requestData = { id: doc.id, ...doc.data() };
        
        // Get products for this request
        const productsSnapshot = await db
          .collection(`clinics/${clinicId}/requests/${doc.id}/products`)
          .get();
        
        const products = productsSnapshot.docs.map(productDoc => ({
          id: productDoc.id,
          ...productDoc.data()
        }));

        return {
          ...requestData,
          products
        };
      })
    );

    return {
      success: true,
      requests,
      pagination: {
        currentPage: page,
        totalItems: requests.length,
        itemsPerPage: limit,
        hasMore: snapshot.docs.length === limit
      }
    };

  } catch (error: any) {
    logError('getUserRequests', error, { 
      userId: request.auth?.uid,
      targetUserId: request.data?.userId 
    });
    
    if (error.message === 'Acesso negado') {
      throw new Error('permission-denied');
    }
    
    throw new Error('internal');
  }
});

/**
 * Approve request
 */
export const approveRequest = onCall(async (request) => {
  try {
    const authRequest = authorize(['admin', 'manager'])(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 10, windowMs: 60000 })(authRequest);
    
    const { requestId } = request.data;
    validateInput(request.data, ['requestId']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    const requestRef = db.collection(`clinics/${clinicId}/requests`).doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      throw new Error('Solicitação não encontrada');
    }

    const requestData = requestDoc.data();
    
    if (requestData!.status !== 'pending') {
      throw new Error('Apenas solicitações pendentes podem ser aprovadas');
    }

    // Update request status
    await requestRef.update({
      status: 'approved',
      approvedBy: authRequest.auth.uid,
      approvedAt: admin.firestore.Timestamp.now()
    });

    logger.info('Request approved', {
      requestId,
      approvedBy: authRequest.auth.uid,
      clinicId
    });

    return {
      success: true,
      message: 'Solicitação aprovada com sucesso',
      requestId
    };

  } catch (error: any) {
    logError('approveRequest', error, { 
      userId: request.auth?.uid,
      requestId: request.data?.requestId 
    });
    
    if (error.message.includes('não encontrada') || error.message.includes('pendentes')) {
      throw new Error('invalid-argument');
    }
    
    throw new Error('internal');
  }
});

/**
 * Reject request
 */
export const rejectRequest = onCall(async (request) => {
  try {
    const authRequest = authorize(['admin', 'manager'])(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 10, windowMs: 60000 })(authRequest);
    
    const { requestId, rejectionReason } = request.data;
    validateInput(request.data, ['requestId', 'rejectionReason']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    const requestRef = db.collection(`clinics/${clinicId}/requests`).doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      throw new Error('Solicitação não encontrada');
    }

    const requestData = requestDoc.data();
    
    if (requestData!.status !== 'pending') {
      throw new Error('Apenas solicitações pendentes podem ser rejeitadas');
    }

    // Update request status
    await requestRef.update({
      status: 'rejected',
      rejectionReason,
      rejectedBy: authRequest.auth.uid,
      rejectedAt: admin.firestore.Timestamp.now()
    });

    logger.info('Request rejected', {
      requestId,
      rejectedBy: authRequest.auth.uid,
      rejectionReason,
      clinicId
    });

    return {
      success: true,
      message: 'Solicitação rejeitada com sucesso',
      requestId
    };

  } catch (error: any) {
    logError('rejectRequest', error, { 
      userId: request.auth?.uid,
      requestId: request.data?.requestId 
    });
    
    if (error.message.includes('não encontrada') || error.message.includes('pendentes')) {
      throw new Error('invalid-argument');
    }
    
    throw new Error('internal');
  }
});

/**
 * Fulfill request (mark as completed and adjust stock)
 */
export const fulfillRequest = onCall(async (request) => {
  try {
    const authRequest = authorize(['admin', 'manager', 'doctor'])(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 10, windowMs: 60000 })(authRequest);
    
    const { requestId } = request.data;
    validateInput(request.data, ['requestId']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    // Use transaction to fulfill request and adjust stock
    const result = await db.runTransaction(async (transaction) => {
      const requestRef = db.collection(`clinics/${clinicId}/requests`).doc(requestId);
      const requestDoc = await transaction.get(requestRef);

      if (!requestDoc.exists) {
        throw new Error('Solicitação não encontrada');
      }

      const requestData = requestDoc.data();
      
      if (requestData!.status !== 'approved') {
        throw new Error('Apenas solicitações aprovadas podem ser atendidas');
      }

      // Get requested products
      const productsSnapshot = await db
        .collection(`clinics/${clinicId}/requests/${requestId}/products`)
        .get();

      // Adjust stock for each product
      const stockAdjustments = [];
      
      for (const productDoc of productsSnapshot.docs) {
        const requestedProduct = productDoc.data();
        const productRef = db.collection(`clinics/${clinicId}/products`).doc(requestedProduct.productId);
        const productSnapshot = await transaction.get(productRef);
        
        if (!productSnapshot.exists) {
          throw new Error(`Produto não encontrado: ${requestedProduct.productId}`);
        }

        const productData = productSnapshot.data();
        const newStock = productData!.currentStock - requestedProduct.quantity;
        
        if (newStock < 0) {
          throw new Error(`Estoque insuficiente para ${productData!.name}`);
        }

        // Update product stock
        transaction.update(productRef, {
          currentStock: newStock,
          updatedAt: admin.firestore.Timestamp.now(),
          updatedBy: authRequest.auth.uid
        });

        // Create stock movement
        const movementRef = db.collection(`clinics/${clinicId}/products/${requestedProduct.productId}/movements`).doc();
        transaction.set(movementRef, {
          type: 'EXIT',
          quantity: requestedProduct.quantity,
          reason: `Atendimento da solicitação ${requestId}`,
          performedBy: authRequest.auth.uid,
          performedAt: admin.firestore.Timestamp.now(),
          previousStock: productData!.currentStock,
          newStock,
          requestId
        });

        stockAdjustments.push({
          productId: requestedProduct.productId,
          productName: requestedProduct.productName,
          quantity: requestedProduct.quantity,
          previousStock: productData!.currentStock,
          newStock
        });
      }

      // Update request status
      transaction.update(requestRef, {
        status: 'fulfilled',
        fulfilledBy: authRequest.auth.uid,
        fulfilledAt: admin.firestore.Timestamp.now()
      });

      return stockAdjustments;
    });

    logger.info('Request fulfilled', {
      requestId,
      fulfilledBy: authRequest.auth.uid,
      stockAdjustments: result.length,
      clinicId
    });

    return {
      success: true,
      message: 'Solicitação atendida com sucesso',
      requestId,
      stockAdjustments: result
    };

  } catch (error: any) {
    logError('fulfillRequest', error, { 
      userId: request.auth?.uid,
      requestId: request.data?.requestId 
    });
    
    if (error.message.includes('não encontrada') || 
        error.message.includes('aprovadas') ||
        error.message.includes('Estoque insuficiente')) {
      throw new Error('invalid-argument');
    }
    
    throw new Error('internal');
  }
});
