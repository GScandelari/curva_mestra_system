/**
 * Firebase Functions for Invoice Management
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
 * Invoice interface
 */
interface Invoice {
  id?: string;
  number: string;
  supplier: string;
  receiptDate: admin.firestore.Timestamp;
  totalValue: number;
  notes?: string;
  isActive: boolean;
  createdAt: admin.firestore.Timestamp;
  createdBy: string;
  clinicId: string;
}

/**
 * Get all invoices with filtering and pagination
 */
export const getInvoices = onCall(async (request) => {
  try {
    const authRequest = verifyAuth(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 30, windowMs: 60000 })(authRequest);
    
    const {
      page = 1,
      limit = 10,
      supplier,
      startDate,
      endDate,
      search
    } = request.data || {};

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    let query: admin.firestore.Query = db.collection(`clinics/${clinicId}/invoices`);

    // Apply date filters
    if (startDate) {
      const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(startDate));
      query = query.where('receiptDate', '>=', startTimestamp);
    }

    if (endDate) {
      const endTimestamp = admin.firestore.Timestamp.fromDate(new Date(endDate));
      query = query.where('receiptDate', '<=', endTimestamp);
    }

    // Apply ordering and pagination
    query = query.orderBy('receiptDate', 'desc').limit(limit);

    const snapshot = await query.get();
    let invoices = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Apply client-side filters (Firestore limitations)
    if (supplier) {
      const supplierLower = supplier.toLowerCase();
      invoices = invoices.filter((invoice: any) => 
        invoice.supplier?.toLowerCase().includes(supplierLower)
      );
    }

    if (search) {
      const searchLower = search.toLowerCase();
      invoices = invoices.filter((invoice: any) => 
        invoice.number?.toLowerCase().includes(searchLower) ||
        invoice.supplier?.toLowerCase().includes(searchLower)
      );
    }

    return {
      success: true,
      invoices,
      pagination: {
        currentPage: page,
        totalItems: invoices.length,
        itemsPerPage: limit,
        hasMore: snapshot.docs.length === limit
      }
    };

  } catch (error: any) {
    logError('getInvoices', error, { 
      userId: request.auth?.uid,
      data: request.data 
    });
    
    throw new Error('internal');
  }
});

/**
 * Get invoice by ID
 */
export const getInvoiceById = onCall(async (request) => {
  try {
    const authRequest = verifyAuth(request);
    
    const { invoiceId } = request.data;
    validateInput(request.data, ['invoiceId']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    const invoiceDoc = await db
      .collection(`clinics/${clinicId}/invoices`)
      .doc(invoiceId)
      .get();

    if (!invoiceDoc.exists) {
      throw new Error('Nota fiscal não encontrada');
    }

    return {
      success: true,
      invoice: {
        id: invoiceDoc.id,
        ...invoiceDoc.data()
      }
    };

  } catch (error: any) {
    logError('getInvoiceById', error, { 
      userId: request.auth?.uid,
      invoiceId: request.data?.invoiceId 
    });
    
    if (error.message === 'Nota fiscal não encontrada') {
      throw new Error('not-found');
    }
    
    throw new Error('internal');
  }
});

/**
 * Get products associated with invoice
 */
export const getInvoiceProducts = onCall(async (request) => {
  try {
    const authRequest = verifyAuth(request);
    
    const { invoiceId } = request.data;
    validateInput(request.data, ['invoiceId']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    // First verify invoice exists
    const invoiceDoc = await db
      .collection(`clinics/${clinicId}/invoices`)
      .doc(invoiceId)
      .get();

    if (!invoiceDoc.exists) {
      throw new Error('Nota fiscal não encontrada');
    }

    const invoiceData = invoiceDoc.data();

    // Get products associated with this invoice number
    const productsSnapshot = await db
      .collection(`clinics/${clinicId}/products`)
      .where('invoiceNumber', '==', invoiceData!.number)
      .orderBy('createdAt', 'desc')
      .get();

    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calculate summary
    const totalProducts = products.length;
    const totalValue = products.reduce((sum: number, product: any) => 
      sum + (product.unitPrice * product.currentStock), 0
    );

    return {
      success: true,
      invoice: {
        id: invoiceDoc.id,
        ...invoiceData
      },
      products,
      summary: {
        totalProducts,
        totalValue
      }
    };

  } catch (error: any) {
    logError('getInvoiceProducts', error, { 
      userId: request.auth?.uid,
      invoiceId: request.data?.invoiceId 
    });
    
    if (error.message === 'Nota fiscal não encontrada') {
      throw new Error('not-found');
    }
    
    throw new Error('internal');
  }
});

/**
 * Create new invoice
 */
export const createInvoice = onCall(async (request) => {
  try {
    const authRequest = authorize(['admin', 'manager'])(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 10, windowMs: 60000 })(authRequest);
    
    const { number, supplier, receiptDate, totalValue, notes } = request.data;
    
    // Validate required fields
    validateInput(request.data, ['number', 'supplier', 'receiptDate', 'totalValue']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    // Check if invoice number already exists
    const existingInvoice = await db
      .collection(`clinics/${clinicId}/invoices`)
      .where('number', '==', number)
      .limit(1)
      .get();

    if (!existingInvoice.empty) {
      throw new Error('Número da nota fiscal já existe');
    }

    const invoiceData: Invoice = {
      number,
      supplier,
      receiptDate: admin.firestore.Timestamp.fromDate(new Date(receiptDate)),
      totalValue: Number(totalValue),
      notes: notes || '',
      isActive: true,
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: authRequest.auth.uid,
      clinicId
    };

    const docRef = await db.collection(`clinics/${clinicId}/invoices`).add(invoiceData);

    logger.info('Invoice created', {
      invoiceId: docRef.id,
      number,
      supplier,
      clinicId,
      createdBy: authRequest.auth.uid
    });

    return {
      success: true,
      message: 'Nota fiscal criada com sucesso',
      invoiceId: docRef.id,
      invoice: { id: docRef.id, ...invoiceData }
    };

  } catch (error: any) {
    logError('createInvoice', error, { 
      userId: request.auth?.uid,
      data: request.data 
    });
    
    if (error.message === 'Número da nota fiscal já existe') {
      throw new Error('already-exists');
    }
    
    throw new Error('internal');
  }
});

/**
 * Update invoice
 */
export const updateInvoice = onCall(async (request) => {
  try {
    const authRequest = authorize(['admin', 'manager'])(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 10, windowMs: 60000 })(authRequest);
    
    const { invoiceId, ...updateData } = request.data;
    validateInput(request.data, ['invoiceId']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    const invoiceRef = db.collection(`clinics/${clinicId}/invoices`).doc(invoiceId);
    const invoiceDoc = await invoiceRef.get();

    if (!invoiceDoc.exists) {
      throw new Error('Nota fiscal não encontrada');
    }

    // Check number uniqueness if number is being updated
    if (updateData.number) {
      const existingInvoice = await db
        .collection(`clinics/${clinicId}/invoices`)
        .where('number', '==', updateData.number)
        .limit(1)
        .get();

      if (!existingInvoice.empty && existingInvoice.docs[0].id !== invoiceId) {
        throw new Error('Número da nota fiscal já existe');
      }
    }

    // Prepare update data
    const updates: any = {
      ...updateData,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: authRequest.auth.uid
    };

    // Handle receipt date conversion if provided
    if (updateData.receiptDate) {
      updates.receiptDate = admin.firestore.Timestamp.fromDate(new Date(updateData.receiptDate));
    }

    // Handle total value conversion if provided
    if (updateData.totalValue) {
      updates.totalValue = Number(updateData.totalValue);
    }

    await invoiceRef.update(updates);

    logger.info('Invoice updated', {
      invoiceId,
      clinicId,
      updatedBy: authRequest.auth.uid,
      updatedFields: Object.keys(updateData)
    });

    return {
      success: true,
      message: 'Nota fiscal atualizada com sucesso',
      invoiceId
    };

  } catch (error: any) {
    logError('updateInvoice', error, { 
      userId: request.auth?.uid,
      invoiceId: request.data?.invoiceId 
    });
    
    if (error.message === 'Nota fiscal não encontrada') {
      throw new Error('not-found');
    }
    
    if (error.message === 'Número da nota fiscal já existe') {
      throw new Error('already-exists');
    }
    
    throw new Error('internal');
  }
});

/**
 * Delete invoice
 */
export const deleteInvoice = onCall(async (request) => {
  try {
    const authRequest = authorize(['admin'])(request);
    
    const { invoiceId } = request.data;
    validateInput(request.data, ['invoiceId']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    const invoiceRef = db.collection(`clinics/${clinicId}/invoices`).doc(invoiceId);
    const invoiceDoc = await invoiceRef.get();

    if (!invoiceDoc.exists) {
      throw new Error('Nota fiscal não encontrada');
    }

    const invoiceData = invoiceDoc.data();

    // Check if invoice has associated products
    const productsSnapshot = await db
      .collection(`clinics/${clinicId}/products`)
      .where('invoiceNumber', '==', invoiceData!.number)
      .limit(1)
      .get();

    if (!productsSnapshot.empty) {
      // Soft delete - mark as inactive
      await invoiceRef.update({
        isActive: false,
        deletedAt: admin.firestore.Timestamp.now(),
        deletedBy: authRequest.auth.uid
      });
    } else {
      // Hard delete if no associated products
      await invoiceRef.delete();
    }

    logger.info('Invoice deleted', {
      invoiceId,
      clinicId,
      deletedBy: authRequest.auth.uid,
      softDelete: !productsSnapshot.empty
    });

    return {
      success: true,
      message: 'Nota fiscal removida com sucesso',
      invoiceId
    };

  } catch (error: any) {
    logError('deleteInvoice', error, { 
      userId: request.auth?.uid,
      invoiceId: request.data?.invoiceId 
    });
    
    if (error.message === 'Nota fiscal não encontrada') {
      throw new Error('not-found');
    }
    
    throw new Error('internal');
  }
});

/**
 * Generate purchase report by period
 */
export const getPurchaseReport = onCall(async (request) => {
  try {
    const authRequest = verifyAuth(request);
    
    const { startDate, endDate, supplier } = request.data || {};

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    let query: admin.firestore.Query = db.collection(`clinics/${clinicId}/invoices`);

    // Apply date filters
    if (startDate) {
      const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(startDate));
      query = query.where('receiptDate', '>=', startTimestamp);
    }

    if (endDate) {
      const endTimestamp = admin.firestore.Timestamp.fromDate(new Date(endDate));
      query = query.where('receiptDate', '<=', endTimestamp);
    }

    query = query.orderBy('receiptDate', 'desc');

    const snapshot = await query.get();
    let invoices = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Apply supplier filter client-side if provided
    if (supplier) {
      const supplierLower = supplier.toLowerCase();
      invoices = invoices.filter((invoice: any) => 
        invoice.supplier?.toLowerCase().includes(supplierLower)
      );
    }

    // Calculate summary statistics
    const totalInvoices = invoices.length;
    const totalValue = invoices.reduce((sum: number, invoice: any) => sum + invoice.totalValue, 0);
    
    // Group by supplier
    const supplierSummary = invoices.reduce((acc: any, invoice: any) => {
      const supplier = invoice.supplier;
      if (!acc[supplier]) {
        acc[supplier] = {
          supplier,
          invoiceCount: 0,
          totalValue: 0
        };
      }
      acc[supplier].invoiceCount++;
      acc[supplier].totalValue += invoice.totalValue;
      return acc;
    }, {});

    // Group by month
    const monthlySummary = invoices.reduce((acc: any, invoice: any) => {
      const date = invoice.receiptDate.toDate();
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          invoiceCount: 0,
          totalValue: 0
        };
      }
      acc[monthKey].invoiceCount++;
      acc[monthKey].totalValue += invoice.totalValue;
      return acc;
    }, {});

    return {
      success: true,
      report: {
        period: {
          startDate,
          endDate
        },
        summary: {
          totalInvoices,
          totalValue,
          averageInvoiceValue: totalInvoices > 0 ? totalValue / totalInvoices : 0
        },
        invoices,
        supplierSummary: Object.values(supplierSummary),
        monthlySummary: Object.values(monthlySummary).sort((a: any, b: any) => a.month.localeCompare(b.month))
      }
    };

  } catch (error: any) {
    logError('getPurchaseReport', error, { 
      userId: request.auth?.uid,
      data: request.data 
    });
    
    throw new Error('internal');
  }
});
