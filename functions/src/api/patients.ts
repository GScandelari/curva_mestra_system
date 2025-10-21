/**
 * Firebase Functions for Patient Management
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
 * Patient interface
 */
interface Patient {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  birthDate?: admin.firestore.Timestamp;
  address?: string;
  notes?: string;
  isActive: boolean;
  createdAt: admin.firestore.Timestamp;
  createdBy: string;
  clinicId: string;
}

interface Treatment {
  id?: string;
  patientId: string;
  description: string;
  performedBy: string;
  performedAt: admin.firestore.Timestamp;
  notes?: string;
  clinicId: string;
}

// interface UsedProduct {
//   productId: string;
//   productName: string;
//   quantity: number;
//   unitPrice: number;
//   totalPrice: number;
// }

/**
 * Get all patients with filtering and pagination
 */
export const getPatients = onCall(async (request) => {
  try {
    const authRequest = verifyAuth(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 30, windowMs: 60000 })(authRequest);
    
    const {
      page = 1,
      limit = 10,
      search,
      isActive = 'true'
    } = request.data || {};

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    let query: admin.firestore.Query = db.collection(`clinics/${clinicId}/patients`);

    // Apply active filter
    if (isActive !== 'all') {
      query = query.where('isActive', '==', isActive === 'true');
    }

    // Apply ordering and pagination
    query = query.orderBy('name', 'asc').limit(limit);

    const snapshot = await query.get();
    let patients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Apply search filter client-side (Firestore limitation)
    if (search) {
      const searchLower = search.toLowerCase();
      patients = patients.filter((patient: any) => 
        patient.name?.toLowerCase().includes(searchLower) ||
        patient.email?.toLowerCase().includes(searchLower) ||
        patient.phone?.includes(search)
      );
    }

    return {
      success: true,
      patients,
      pagination: {
        currentPage: page,
        totalItems: patients.length,
        itemsPerPage: limit,
        hasMore: snapshot.docs.length === limit
      }
    };

  } catch (error: any) {
    logError('getPatients', error, { 
      userId: request.auth?.uid,
      data: request.data 
    });
    
    throw new Error('internal');
  }
});

/**
 * Get patient by ID with treatments
 */
export const getPatientById = onCall(async (request) => {
  try {
    const authRequest = verifyAuth(request);
    
    const { patientId } = request.data;
    validateInput(request.data, ['patientId']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    const patientDoc = await db
      .collection(`clinics/${clinicId}/patients`)
      .doc(patientId)
      .get();

    if (!patientDoc.exists) {
      throw new Error('Paciente não encontrado');
    }

    // Get patient treatments
    const treatmentsSnapshot = await db
      .collection(`clinics/${clinicId}/patients/${patientId}/treatments`)
      .orderBy('performedAt', 'desc')
      .get();

    const treatments = await Promise.all(
      treatmentsSnapshot.docs.map(async (treatmentDoc) => {
        const treatmentData = { id: treatmentDoc.id, ...treatmentDoc.data() };
        
        // Get used products for this treatment
        const usedProductsSnapshot = await db
          .collection(`clinics/${clinicId}/patients/${patientId}/treatments/${treatmentDoc.id}/usedProducts`)
          .get();
        
        const usedProducts = usedProductsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        return {
          ...treatmentData,
          usedProducts
        };
      })
    );

    return {
      success: true,
      patient: {
        id: patientDoc.id,
        ...patientDoc.data(),
        treatments
      }
    };

  } catch (error: any) {
    logError('getPatientById', error, { 
      userId: request.auth?.uid,
      patientId: request.data?.patientId 
    });
    
    if (error.message === 'Paciente não encontrado') {
      throw new Error('not-found');
    }
    
    throw new Error('internal');
  }
});

/**
 * Create new patient
 */
export const createPatient = onCall(async (request) => {
  try {
    const authRequest = authorize(['admin', 'manager', 'receptionist'])(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 10, windowMs: 60000 })(authRequest);
    
    const { name, email, phone, birthDate, address, notes } = request.data;
    
    // Validate required fields
    validateInput(request.data, ['name']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    // Check if patient with same email already exists (if email provided)
    if (email) {
      const existingPatient = await db
        .collection(`clinics/${clinicId}/patients`)
        .where('email', '==', email)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (!existingPatient.empty) {
        throw new Error('Já existe um paciente ativo com este email');
      }
    }

    const patientData: Patient = {
      name,
      email: email || null,
      phone: phone || null,
      birthDate: birthDate ? admin.firestore.Timestamp.fromDate(new Date(birthDate)) : undefined,
      address: address || null,
      notes: notes || null,
      isActive: true,
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: authRequest.auth.uid,
      clinicId
    };

    const docRef = await db.collection(`clinics/${clinicId}/patients`).add(patientData);

    logger.info('Patient created', {
      patientId: docRef.id,
      name,
      clinicId,
      createdBy: authRequest.auth.uid
    });

    return {
      success: true,
      message: 'Paciente criado com sucesso',
      patientId: docRef.id,
      patient: { id: docRef.id, ...patientData }
    };

  } catch (error: any) {
    logError('createPatient', error, { 
      userId: request.auth?.uid,
      data: request.data 
    });
    
    if (error.message === 'Já existe um paciente ativo com este email') {
      throw new Error('already-exists');
    }
    
    throw new Error('internal');
  }
});

/**
 * Update patient
 */
export const updatePatient = onCall(async (request) => {
  try {
    const authRequest = authorize(['admin', 'manager', 'receptionist'])(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 10, windowMs: 60000 })(authRequest);
    
    const { patientId, ...updateData } = request.data;
    validateInput(request.data, ['patientId']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    const patientRef = db.collection(`clinics/${clinicId}/patients`).doc(patientId);
    const patientDoc = await patientRef.get();

    if (!patientDoc.exists) {
      throw new Error('Paciente não encontrado');
    }

    // Check email uniqueness if email is being updated
    if (updateData.email) {
      const existingPatient = await db
        .collection(`clinics/${clinicId}/patients`)
        .where('email', '==', updateData.email)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (!existingPatient.empty && existingPatient.docs[0].id !== patientId) {
        throw new Error('Já existe um paciente ativo com este email');
      }
    }

    // Prepare update data
    const updates: any = {
      ...updateData,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: authRequest.auth.uid
    };

    // Handle birth date conversion if provided
    if (updateData.birthDate) {
      updates.birthDate = admin.firestore.Timestamp.fromDate(new Date(updateData.birthDate));
    }

    await patientRef.update(updates);

    logger.info('Patient updated', {
      patientId,
      clinicId,
      updatedBy: authRequest.auth.uid,
      updatedFields: Object.keys(updateData)
    });

    return {
      success: true,
      message: 'Paciente atualizado com sucesso',
      patientId
    };

  } catch (error: any) {
    logError('updatePatient', error, { 
      userId: request.auth?.uid,
      patientId: request.data?.patientId 
    });
    
    if (error.message === 'Paciente não encontrado') {
      throw new Error('not-found');
    }
    
    if (error.message === 'Já existe um paciente ativo com este email') {
      throw new Error('already-exists');
    }
    
    throw new Error('internal');
  }
});

/**
 * Delete patient (soft delete if has treatments)
 */
export const deletePatient = onCall(async (request) => {
  try {
    const authRequest = authorize(['admin', 'manager'])(request);
    
    const { patientId } = request.data;
    validateInput(request.data, ['patientId']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    const patientRef = db.collection(`clinics/${clinicId}/patients`).doc(patientId);
    const patientDoc = await patientRef.get();

    if (!patientDoc.exists) {
      throw new Error('Paciente não encontrado');
    }

    // Check if patient has treatments
    const treatmentsSnapshot = await db
      .collection(`clinics/${clinicId}/patients/${patientId}/treatments`)
      .limit(1)
      .get();

    if (!treatmentsSnapshot.empty) {
      // Soft delete - mark as inactive
      await patientRef.update({
        isActive: false,
        deletedAt: admin.firestore.Timestamp.now(),
        deletedBy: authRequest.auth.uid
      });
    } else {
      // Hard delete if no treatments
      await patientRef.delete();
    }

    logger.info('Patient deleted', {
      patientId,
      clinicId,
      deletedBy: authRequest.auth.uid,
      softDelete: !treatmentsSnapshot.empty
    });

    return {
      success: true,
      message: 'Paciente removido com sucesso',
      patientId
    };

  } catch (error: any) {
    logError('deletePatient', error, { 
      userId: request.auth?.uid,
      patientId: request.data?.patientId 
    });
    
    if (error.message === 'Paciente não encontrado') {
      throw new Error('not-found');
    }
    
    throw new Error('internal');
  }
});

/**
 * Associate products to patient (create treatment)
 */
export const associateProducts = onCall(async (request) => {
  try {
    const authRequest = authorize(['admin', 'manager', 'doctor'])(request);
    
    // Rate limiting
    rateLimit({ maxRequests: 10, windowMs: 60000 })(authRequest);
    
    const { patientId, products, description, notes } = request.data;
    
    // Validate required fields
    validateInput(request.data, ['patientId', 'products', 'description']);
    
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('Lista de produtos é obrigatória');
    }

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    // Validate patient exists
    const patientDoc = await db
      .collection(`clinics/${clinicId}/patients`)
      .doc(patientId)
      .get();
    
    if (!patientDoc.exists) {
      throw new Error('Paciente não encontrado');
    }

    // Validate products and check stock
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

    // Create treatment and adjust stock using transaction
    const result = await db.runTransaction(async (transaction) => {
      // Create treatment document
      const treatmentRef = db.collection(`clinics/${clinicId}/patients/${patientId}/treatments`).doc();
      
      const treatmentData: Treatment = {
        patientId,
        description,
        notes: notes || '',
        performedBy: authRequest.auth.uid,
        performedAt: admin.firestore.Timestamp.now(),
        clinicId
      };

      transaction.set(treatmentRef, treatmentData);

      // Process each product
      const stockAdjustments = [];
      
      for (const product of productValidations) {
        // Create used product record
        const usedProductRef = db
          .collection(`clinics/${clinicId}/patients/${patientId}/treatments/${treatmentRef.id}/usedProducts`)
          .doc();
        
        transaction.set(usedProductRef, product);

        // Adjust product stock
        const productRef = db.collection(`clinics/${clinicId}/products`).doc(product.productId);
        const productSnapshot = await transaction.get(productRef);
        
        const productData = productSnapshot.data();
        const newStock = productData!.currentStock - product.quantity;

        transaction.update(productRef, {
          currentStock: newStock,
          updatedAt: admin.firestore.Timestamp.now(),
          updatedBy: authRequest.auth.uid
        });

        // Create stock movement
        const movementRef = db.collection(`clinics/${clinicId}/products/${product.productId}/movements`).doc();
        transaction.set(movementRef, {
          type: 'EXIT',
          quantity: product.quantity,
          reason: `Tratamento do paciente ${patientDoc.data()!.name}`,
          performedBy: authRequest.auth.uid,
          performedAt: admin.firestore.Timestamp.now(),
          previousStock: productData!.currentStock,
          newStock,
          treatmentId: treatmentRef.id,
          patientId
        });

        stockAdjustments.push({
          productId: product.productId,
          productName: product.productName,
          quantity: product.quantity,
          previousStock: productData!.currentStock,
          newStock
        });
      }

      return {
        treatmentId: treatmentRef.id,
        stockAdjustments
      };
    });

    logger.info('Products associated to patient', {
      patientId,
      treatmentId: result.treatmentId,
      productsCount: products.length,
      performedBy: authRequest.auth.uid,
      clinicId
    });

    return {
      success: true,
      message: 'Produtos associados ao paciente com sucesso',
      treatmentId: result.treatmentId,
      stockAdjustments: result.stockAdjustments
    };

  } catch (error: any) {
    logError('associateProducts', error, { 
      userId: request.auth?.uid,
      patientId: request.data?.patientId 
    });
    
    if (error.message.includes('não encontrado') || error.message.includes('Estoque insuficiente')) {
      throw new Error('invalid-argument');
    }
    
    throw new Error('internal');
  }
});

/**
 * Get patient consumption history
 */
export const getPatientConsumption = onCall(async (request) => {
  try {
    const authRequest = verifyAuth(request);
    
    const { patientId, startDate, endDate } = request.data;
    validateInput(request.data, ['patientId']);

    const clinicId = authRequest.auth.token.clinicId;
    validateClinic(authRequest);

    // Validate patient exists
    const patientDoc = await db
      .collection(`clinics/${clinicId}/patients`)
      .doc(patientId)
      .get();
    
    if (!patientDoc.exists) {
      throw new Error('Paciente não encontrado');
    }

    let treatmentsQuery = db
      .collection(`clinics/${clinicId}/patients/${patientId}/treatments`)
      .orderBy('performedAt', 'desc');

    // Apply date filters if provided
    if (startDate) {
      const startTimestamp = admin.firestore.Timestamp.fromDate(new Date(startDate));
      treatmentsQuery = treatmentsQuery.where('performedAt', '>=', startTimestamp);
    }

    if (endDate) {
      const endTimestamp = admin.firestore.Timestamp.fromDate(new Date(endDate));
      treatmentsQuery = treatmentsQuery.where('performedAt', '<=', endTimestamp);
    }

    const treatmentsSnapshot = await treatmentsQuery.get();

    // Get consumption details for each treatment
    const consumption = await Promise.all(
      treatmentsSnapshot.docs.map(async (treatmentDoc) => {
        const treatmentData = { id: treatmentDoc.id, ...treatmentDoc.data() };
        
        // Get used products for this treatment
        const usedProductsSnapshot = await db
          .collection(`clinics/${clinicId}/patients/${patientId}/treatments/${treatmentDoc.id}/usedProducts`)
          .get();
        
        const usedProducts = usedProductsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const totalValue = usedProducts.reduce((sum: number, product: any) => sum + product.totalPrice, 0);

        return {
          ...treatmentData,
          usedProducts,
          totalValue,
          productsCount: usedProducts.length
        };
      })
    );

    // Calculate summary statistics
    const totalTreatments = consumption.length;
    const totalValue = consumption.reduce((sum, treatment) => sum + treatment.totalValue, 0);
    const totalProducts = consumption.reduce((sum, treatment) => sum + treatment.productsCount, 0);

    return {
      success: true,
      patient: {
        id: patientDoc.id,
        ...patientDoc.data()
      },
      consumption,
      summary: {
        totalTreatments,
        totalValue,
        totalProducts,
        averageValuePerTreatment: totalTreatments > 0 ? totalValue / totalTreatments : 0
      }
    };

  } catch (error: any) {
    logError('getPatientConsumption', error, { 
      userId: request.auth?.uid,
      patientId: request.data?.patientId 
    });
    
    if (error.message === 'Paciente não encontrado') {
      throw new Error('not-found');
    }
    
    throw new Error('internal');
  }
});
