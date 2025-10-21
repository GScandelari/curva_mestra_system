import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  onSnapshot,
  enableNetwork,
  disableNetwork,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import firebaseAuthService from './firebaseAuthService';

/**
 * Base Firebase Service
 * 
 * This service provides common Firebase operations and replaces the REST API client
 */
class FirebaseService {
  constructor() {
    this.listeners = new Map();
    this.offlineCache = new Map();
    this.isOnline = true;
    
    // Monitor network status
    this.setupNetworkMonitoring();
  }

  /**
   * Setup network monitoring for offline support
   */
  setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      enableNetwork(db).catch(console.error);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      disableNetwork(db).catch(console.error);
    });
  }

  /**
   * Get current user's clinic ID
   */
  getCurrentClinicId() {
    const user = firebaseAuthService.getCurrentUser();
    if (!user || !user.clinicId) {
      throw new Error('Usuário não associado a uma clínica');
    }
    return user.clinicId;
  }

  /**
   * Get collection reference for current clinic
   */
  getClinicCollection(collectionName) {
    const clinicId = this.getCurrentClinicId();
    return collection(db, 'clinics', clinicId, collectionName);
  }

  /**
   * Get document reference for current clinic
   */
  getClinicDocument(collectionName, docId) {
    const clinicId = this.getCurrentClinicId();
    return doc(db, 'clinics', clinicId, collectionName, docId);
  }

  /**
   * Generic method to get all documents from a collection
   */
  async getAll(collectionName, options = {}) {
    try {
      const collectionRef = this.getClinicCollection(collectionName);
      let q = query(collectionRef);

      // Apply filters
      if (options.where) {
        options.where.forEach(([field, operator, value]) => {
          q = query(q, where(field, operator, value));
        });
      }

      // Apply ordering
      if (options.orderBy) {
        options.orderBy.forEach(([field, direction = 'asc']) => {
          q = query(q, orderBy(field, direction));
        });
      }

      // Apply limit
      if (options.limit) {
        q = query(q, limit(options.limit));
      }

      // Apply pagination
      if (options.startAfter) {
        q = query(q, startAfter(options.startAfter));
      }

      const snapshot = await getDocs(q);
      const documents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamps to JavaScript dates
        ...this.convertTimestamps(doc.data())
      }));

      // Cache results for offline access
      this.offlineCache.set(`${collectionName}_all`, documents);

      return {
        success: true,
        data: documents,
        total: documents.length
      };
    } catch (error) {
      console.error(`Error getting ${collectionName}:`, error);
      
      // Return cached data if offline
      if (!this.isOnline && this.offlineCache.has(`${collectionName}_all`)) {
        return {
          success: true,
          data: this.offlineCache.get(`${collectionName}_all`),
          fromCache: true
        };
      }

      return {
        success: false,
        error: error.message || `Erro ao buscar ${collectionName}`
      };
    }
  }

  /**
   * Generic method to get a single document
   */
  async getById(collectionName, id) {
    try {
      const docRef = this.getClinicDocument(collectionName, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return {
          success: false,
          error: 'Documento não encontrado'
        };
      }

      const data = {
        id: docSnap.id,
        ...docSnap.data(),
        ...this.convertTimestamps(docSnap.data())
      };

      // Cache result
      this.offlineCache.set(`${collectionName}_${id}`, data);

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error(`Error getting ${collectionName} by ID:`, error);
      
      // Return cached data if offline
      if (!this.isOnline && this.offlineCache.has(`${collectionName}_${id}`)) {
        return {
          success: true,
          data: this.offlineCache.get(`${collectionName}_${id}`),
          fromCache: true
        };
      }

      return {
        success: false,
        error: error.message || `Erro ao buscar ${collectionName}`
      };
    }
  }

  /**
   * Generic method to create a document
   */
  async create(collectionName, data) {
    try {
      const collectionRef = this.getClinicCollection(collectionName);
      
      // Add metadata
      const documentData = {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: firebaseAuthService.getCurrentUser()?.uid,
        clinicId: this.getCurrentClinicId()
      };

      const docRef = await addDoc(collectionRef, documentData);
      
      // Get the created document with server timestamp
      const createdDoc = await getDoc(docRef);
      const result = {
        id: createdDoc.id,
        ...createdDoc.data(),
        ...this.convertTimestamps(createdDoc.data())
      };

      // Clear cache to force refresh
      this.offlineCache.delete(`${collectionName}_all`);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error(`Error creating ${collectionName}:`, error);
      return {
        success: false,
        error: error.message || `Erro ao criar ${collectionName}`
      };
    }
  }

  /**
   * Generic method to update a document
   */
  async update(collectionName, id, data) {
    try {
      const docRef = this.getClinicDocument(collectionName, id);
      
      // Add update metadata
      const updateData = {
        ...data,
        updatedAt: serverTimestamp(),
        updatedBy: firebaseAuthService.getCurrentUser()?.uid
      };

      await updateDoc(docRef, updateData);
      
      // Get updated document
      const updatedDoc = await getDoc(docRef);
      const result = {
        id: updatedDoc.id,
        ...updatedDoc.data(),
        ...this.convertTimestamps(updatedDoc.data())
      };

      // Update cache
      this.offlineCache.set(`${collectionName}_${id}`, result);
      this.offlineCache.delete(`${collectionName}_all`);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error(`Error updating ${collectionName}:`, error);
      return {
        success: false,
        error: error.message || `Erro ao atualizar ${collectionName}`
      };
    }
  }

  /**
   * Generic method to delete a document
   */
  async delete(collectionName, id) {
    try {
      const docRef = this.getClinicDocument(collectionName, id);
      await deleteDoc(docRef);

      // Clear cache
      this.offlineCache.delete(`${collectionName}_${id}`);
      this.offlineCache.delete(`${collectionName}_all`);

      return {
        success: true,
        message: `${collectionName} deletado com sucesso`
      };
    } catch (error) {
      console.error(`Error deleting ${collectionName}:`, error);
      return {
        success: false,
        error: error.message || `Erro ao deletar ${collectionName}`
      };
    }
  }

  /**
   * Setup real-time listener for a collection
   */
  onCollectionChange(collectionName, callback, options = {}) {
    try {
      const collectionRef = this.getClinicCollection(collectionName);
      let q = query(collectionRef);

      // Apply filters
      if (options.where) {
        options.where.forEach(([field, operator, value]) => {
          q = query(q, where(field, operator, value));
        });
      }

      // Apply ordering
      if (options.orderBy) {
        options.orderBy.forEach(([field, direction = 'asc']) => {
          q = query(q, orderBy(field, direction));
        });
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const documents = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          ...this.convertTimestamps(doc.data())
        }));

        // Update cache
        this.offlineCache.set(`${collectionName}_all`, documents);

        callback({
          success: true,
          data: documents,
          changes: snapshot.docChanges()
        });
      }, (error) => {
        console.error(`Error in ${collectionName} listener:`, error);
        callback({
          success: false,
          error: error.message
        });
      });

      // Store listener for cleanup
      const listenerId = `${collectionName}_${Date.now()}`;
      this.listeners.set(listenerId, unsubscribe);

      return listenerId;
    } catch (error) {
      console.error(`Error setting up ${collectionName} listener:`, error);
      callback({
        success: false,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Setup real-time listener for a document
   */
  onDocumentChange(collectionName, id, callback) {
    try {
      const docRef = this.getClinicDocument(collectionName, id);

      const unsubscribe = onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
          const data = {
            id: doc.id,
            ...doc.data(),
            ...this.convertTimestamps(doc.data())
          };

          // Update cache
          this.offlineCache.set(`${collectionName}_${id}`, data);

          callback({
            success: true,
            data
          });
        } else {
          callback({
            success: false,
            error: 'Documento não encontrado'
          });
        }
      }, (error) => {
        console.error(`Error in ${collectionName} document listener:`, error);
        callback({
          success: false,
          error: error.message
        });
      });

      // Store listener for cleanup
      const listenerId = `${collectionName}_${id}_${Date.now()}`;
      this.listeners.set(listenerId, unsubscribe);

      return listenerId;
    } catch (error) {
      console.error(`Error setting up ${collectionName} document listener:`, error);
      callback({
        success: false,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Remove a real-time listener
   */
  removeListener(listenerId) {
    if (this.listeners.has(listenerId)) {
      const unsubscribe = this.listeners.get(listenerId);
      unsubscribe();
      this.listeners.delete(listenerId);
      return true;
    }
    return false;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners() {
    this.listeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.listeners.clear();
  }

  /**
   * Call a Firebase Function
   */
  async callFunction(functionName, data = {}) {
    try {
      const callable = httpsCallable(functions, functionName);
      const result = await callable(data);
      
      return {
        success: true,
        data: result.data
      };
    } catch (error) {
      console.error(`Error calling function ${functionName}:`, error);
      return {
        success: false,
        error: error.message || `Erro ao chamar função ${functionName}`
      };
    }
  }

  /**
   * Batch operations
   */
  async batchWrite(operations) {
    try {
      const batch = writeBatch(db);
      const clinicId = this.getCurrentClinicId();

      operations.forEach(({ type, collection: collectionName, id, data }) => {
        const docRef = id 
          ? doc(db, 'clinics', clinicId, collectionName, id)
          : doc(collection(db, 'clinics', clinicId, collectionName));

        switch (type) {
          case 'create':
            batch.set(docRef, {
              ...data,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              createdBy: firebaseAuthService.getCurrentUser()?.uid,
              clinicId
            });
            break;
          case 'update':
            batch.update(docRef, {
              ...data,
              updatedAt: serverTimestamp(),
              updatedBy: firebaseAuthService.getCurrentUser()?.uid
            });
            break;
          case 'delete':
            batch.delete(docRef);
            break;
        }
      });

      await batch.commit();

      // Clear relevant caches
      operations.forEach(({ collection: collectionName }) => {
        this.offlineCache.delete(`${collectionName}_all`);
      });

      return {
        success: true,
        message: 'Operações em lote executadas com sucesso'
      };
    } catch (error) {
      console.error('Error in batch write:', error);
      return {
        success: false,
        error: error.message || 'Erro ao executar operações em lote'
      };
    }
  }

  /**
   * Convert Firestore timestamps to JavaScript dates
   */
  convertTimestamps(data) {
    const converted = {};
    
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (value && typeof value === 'object' && value.toDate) {
        // Firestore Timestamp
        converted[key] = value.toDate();
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Nested object
        converted[key] = this.convertTimestamps(value);
      }
    });

    return converted;
  }

  /**
   * Clear all offline cache
   */
  clearCache() {
    this.offlineCache.clear();
  }

  /**
   * Get cache status
   */
  getCacheInfo() {
    return {
      isOnline: this.isOnline,
      cacheSize: this.offlineCache.size,
      activeListeners: this.listeners.size
    };
  }
}

// Create singleton instance
const firebaseService = new FirebaseService();

export default firebaseService;