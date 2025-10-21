/**
 * Firebase Functions for Product Management
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
 * Product interface
 */
interface Product {
  id?: string;
  name: string;
  description?: string;
  category: string;
  invoiceNumber: string;
  supplier: string;
  currentStock: number;
  minimumStock: number;
  unitPrice: number;
  expirationDate: admin.firestore.Timestamp;
  entryDate: admin.firestore.Timestamp;
  isExpired: boolean;
  createdAt?: admin.firestore.Timestamp;
  createdBy?: string;
  clinicId: string;
}

/**
 * Create new product
 */
export const createProduct = onCall(async (request) => {
  try {
    const authRequest = authorize(['admin', 'manager'])(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 10, windowMs: 60000 })(authRequest);
    
    const { 
      name, 
      description, 
      category, 
      invoiceNumber, 
      supplier,
      currentStock,
      minimumStock,
      unitPrice,
      expirationDate
    } = request.data;

    // Validate required fields
    validateInput(request.data, [
      'name', 'category', 'invoiceNumber', 'supplier', 
      'currentStock', 'minimumStock', 'unitPrice', 'expirationDate'
    ]);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    // Check if invoice number already exists
    const existingProduct = await db
      .collection(`clinics/${clinicId}/products`)
      .where('invoiceNumber', '==', invoiceNumber)
      .limit(1)
      .get();

    if (!existingProduct.empty) {
      throw new Error('Nota fiscal já cadastrada');
    }

    // Convert expiration date
    const expirationTimestamp = admin.firestore.Timestamp.fromDate(new Date(expirationDate));
    const now = admin.firestore.Timestamp.now();
    
    // Check if product is expired
    const isExpired = expirationTimestamp.toDate() < new Date();

    const productData: Product = {
      name,
      description: description || '',
      category,
      invoiceNumber,
      supplier,
      currentStock: Number(currentStock),
      minimumStock: Number(minimumStock),
      unitPrice: Number(unitPrice),
      expirationDate: expirationTimestamp,
      entryDate: now,
      isExpired,
      createdAt: now,
      createdBy: authRequest.auth.uid,
      clinicId
    };

    const docRef = await db.collection(`clinics/${clinicId}/products`).add(productData);

    // Create initial stock movement
    await db.collection(`clinics/${clinicId}/products/${docRef.id}/movements`).add({
      type: 'ENTRY',
      quantity: currentStock,
      reason: 'Entrada inicial do produto',
      performedBy: authRequest.auth.uid,
      performedAt: now,
      previousStock: 0,
      newStock: currentStock
    });

    logger.info('Product created', {
      productId: docRef.id,
      name,
      clinicId,
      createdBy: authRequest.auth.uid
    });

    return {
      success: true,
      message: 'Produto criado com sucesso',
      productId: docRef.id,
      product: { id: docRef.id, ...productData }
    };

  } catch (error: any) {
    logError('createProduct', error, { 
      userId: request.auth?.uid,
      data: request.data 
    });
    
    if (error.message === 'Nota fiscal já cadastrada') {
      throw new Error('already-exists');
    }
    
    throw new Error('internal');
  }
});

/**
 * Get products with filtering and pagination
 */
export const getProducts = onCall(async (request) => {
  try {
    const authRequest = verifyAuth(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 30, windowMs: 60000 })(authRequest);
    
    const {
      page = 1,
      limit = 10,
      category,
      invoiceNumber,
      lowStock,
      expiringSoon,
      search
    } = request.data || {};

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    let query: admin.firestore.Query = db.collection(`clinics/${clinicId}/products`);

    // Apply filters
    if (category) {
      query = query.where('category', '==', category);
    }

    if (invoiceNumber) {
      query = query.where('invoiceNumber', '==', invoiceNumber);
    }

    if (lowStock === true) {
      // Note: Firestore doesn't support field comparisons directly
      // This would need to be handled client-side or with a different approach
      logger.warn('Low stock filter not fully supported in Firestore');
    }

    if (expiringSoon === true) {
      const thirtyDaysFromNow = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
      query = query.where('expirationDate', '<=', thirtyDaysFromNow);
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.orderBy('createdAt', 'desc').limit(limit);

    if (offset > 0) {
      // For proper pagination, we'd need to use cursor-based pagination
      // This is a simplified version
      logger.warn('Offset pagination not optimal in Firestore');
    }

    const snapshot = await query.get();
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter by search term if provided (client-side filtering)
    let filteredProducts = products;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredProducts = products.filter((product: any) => 
        product.name?.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower)
      );
    }

    // Filter low stock products if requested
    if (lowStock === true) {
      filteredProducts = filteredProducts.filter((product: any) => 
        product.currentStock <= product.minimumStock
      );
    }

    return {
      success: true,
      products: filteredProducts,
      pagination: {
        currentPage: page,
        totalItems: filteredProducts.length,
        itemsPerPage: limit,
        hasMore: snapshot.docs.length === limit
      }
    };

  } catch (error: any) {
    logError('getProducts', error, { 
      userId: request.auth?.uid,
      data: request.data 
    });
    
    throw new Error('internal');
  }
});

/**
 * Get product by ID
 */
export const getProductById = onCall(async (request) => {
  try {
    const authRequest = verifyAuth(request);
    
    const { productId } = request.data;
    validateInput(request.data, ['productId']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    const productDoc = await db
      .collection(`clinics/${clinicId}/products`)
      .doc(productId)
      .get();

    if (!productDoc.exists) {
      throw new Error('Produto não encontrado');
    }

    return {
      success: true,
      product: {
        id: productDoc.id,
        ...productDoc.data()
      }
    };

  } catch (error: any) {
    logError('getProductById', error, { 
      userId: request.auth?.uid,
      productId: request.data?.productId 
    });
    
    if (error.message === 'Produto não encontrado') {
      throw new Error('not-found');
    }
    
    throw new Error('internal');
  }
});

/**
 * Update product
 */
export const updateProduct = onCall(async (request) => {
  try {
    const authRequest = authorize(['admin', 'manager'])(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 10, windowMs: 60000 })(authRequest);
    
    const { productId, ...updateData } = request.data;
    validateInput(request.data, ['productId']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    const productRef = db.collection(`clinics/${clinicId}/products`).doc(productId);
    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      throw new Error('Produto não encontrado');
    }

    // Prepare update data
    const updates: any = {
      ...updateData,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: authRequest.auth.uid
    };

    // Handle expiration date conversion if provided
    if (updateData.expirationDate) {
      updates.expirationDate = admin.firestore.Timestamp.fromDate(new Date(updateData.expirationDate));
      updates.isExpired = updates.expirationDate.toDate() < new Date();
    }

    await productRef.update(updates);

    logger.info('Product updated', {
      productId,
      clinicId,
      updatedBy: authRequest.auth.uid,
      updatedFields: Object.keys(updateData)
    });

    return {
      success: true,
      message: 'Produto atualizado com sucesso',
      productId
    };

  } catch (error: any) {
    logError('updateProduct', error, { 
      userId: request.auth?.uid,
      productId: request.data?.productId 
    });
    
    if (error.message === 'Produto não encontrado') {
      throw new Error('not-found');
    }
    
    throw new Error('internal');
  }
});

/**
 * Adjust product stock
 */
export const adjustStock = onCall(async (request) => {
  try {
    const authRequest = authorize(['admin', 'manager', 'doctor'])(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 20, windowMs: 60000 })(authRequest);
    
    const { productId, quantity, reason, type } = request.data;
    validateInput(request.data, ['productId', 'quantity', 'reason', 'type']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    const productRef = db.collection(`clinics/${clinicId}/products`).doc(productId);
    
    // Use transaction for stock adjustment
    const result = await db.runTransaction(async (transaction) => {
      const productDoc = await transaction.get(productRef);
      
      if (!productDoc.exists) {
        throw new Error('Produto não encontrado');
      }

      const productData = productDoc.data() as Product;
      const previousStock = productData.currentStock;
      let newStock: number;

      // Calculate new stock based on movement type
      switch (type) {
        case 'ENTRY':
          newStock = previousStock + Number(quantity);
          break;
        case 'EXIT':
          newStock = previousStock - Number(quantity);
          if (newStock < 0) {
            throw new Error('Estoque insuficiente');
          }
          break;
        case 'ADJUSTMENT':
          newStock = Number(quantity);
          break;
        default:
          throw new Error('Tipo de movimento inválido');
      }

      // Update product stock
      transaction.update(productRef, {
        currentStock: newStock,
        updatedAt: admin.firestore.Timestamp.now(),
        updatedBy: authRequest.auth.uid
      });

      // Create stock movement record
      const movementRef = db.collection(`clinics/${clinicId}/products/${productId}/movements`).doc();
      transaction.set(movementRef, {
        type,
        quantity: Number(quantity),
        reason,
        performedBy: authRequest.auth.uid,
        performedAt: admin.firestore.Timestamp.now(),
        previousStock,
        newStock
      });

      return { previousStock, newStock, movementId: movementRef.id };
    });

    logger.info('Stock adjusted', {
      productId,
      type,
      quantity,
      previousStock: result.previousStock,
      newStock: result.newStock,
      clinicId,
      performedBy: authRequest.auth.uid
    });

    return {
      success: true,
      message: 'Estoque ajustado com sucesso',
      previousStock: result.previousStock,
      newStock: result.newStock,
      movementId: result.movementId
    };

  } catch (error: any) {
    logError('adjustStock', error, { 
      userId: request.auth?.uid,
      productId: request.data?.productId 
    });
    
    if (error.message === 'Produto não encontrado') {
      throw new Error('not-found');
    }
    
    if (error.message === 'Estoque insuficiente') {
      throw new Error('failed-precondition');
    }
    
    throw new Error('internal');
  }
});

/**
 * Delete product
 */
export const deleteProduct = onCall(async (request) => {
  try {
    const authRequest = authorize(['admin'])(request);
    
    const { productId } = request.data;
    validateInput(request.data, ['productId']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    const productRef = db.collection(`clinics/${clinicId}/products`).doc(productId);
    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      throw new Error('Produto não encontrado');
    }

    // Check if product has movements (soft delete if it does)
    const movementsSnapshot = await db
      .collection(`clinics/${clinicId}/products/${productId}/movements`)
      .limit(1)
      .get();

    if (!movementsSnapshot.empty) {
      // Soft delete - mark as inactive
      await productRef.update({
        isActive: false,
        deletedAt: admin.firestore.Timestamp.now(),
        deletedBy: authRequest.auth.uid
      });
    } else {
      // Hard delete if no movements
      await productRef.delete();
    }

    logger.info('Product deleted', {
      productId,
      clinicId,
      deletedBy: authRequest.auth.uid,
      softDelete: !movementsSnapshot.empty
    });

    return {
      success: true,
      message: 'Produto removido com sucesso',
      productId
    };

  } catch (error: any) {
    logError('deleteProduct', error, { 
      userId: request.auth?.uid,
      productId: request.data?.productId 
    });
    
    if (error.message === 'Produto não encontrado') {
      throw new Error('not-found');
    }
    
    throw new Error('internal');
  }
});

/**
 * Get products with low stock
 */
export const getLowStockProducts = onCall(async (request) => {
  try {
    const authRequest = verifyAuth(request);
    
    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    // Get all products and filter client-side (Firestore limitation)
    const snapshot = await db
      .collection(`clinics/${clinicId}/products`)
      .where('isActive', '!=', false)
      .get();

    const lowStockProducts = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((product: any) => product.currentStock <= product.minimumStock);

    return {
      success: true,
      products: lowStockProducts,
      count: lowStockProducts.length
    };

  } catch (error: any) {
    logError('getLowStockProducts', error, { 
      userId: request.auth?.uid 
    });
    
    throw new Error('internal');
  }
});

/**
 * Get expiring products
 */
export const getExpiringProducts = onCall(async (request) => {
  try {
    const authRequest = verifyAuth(request);
    
    const { days = 30 } = request.data || {};
    
    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    const expirationDate = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    );

    const snapshot = await db
      .collection(`clinics/${clinicId}/products`)
      .where('expirationDate', '<=', expirationDate)
      .where('isExpired', '==', false)
      .orderBy('expirationDate', 'asc')
      .get();

    const expiringProducts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      success: true,
      products: expiringProducts,
      count: expiringProducts.length
    };

  } catch (error: any) {
    logError('getExpiringProducts', error, { 
      userId: request.auth?.uid 
    });
    
    throw new Error('internal');
  }
});
