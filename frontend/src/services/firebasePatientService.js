import firebaseService from './firebaseService';

/**
 * Firebase Patient Service
 * 
 * This service handles all patient-related operations using Firebase Firestore
 */
class FirebasePatientService {
  constructor() {
    this.collectionName = 'patients';
  }

  /**
   * Get all patients with optional filters
   */
  async getPatients(filters = {}) {
    try {
      const options = {};

      // Add filters
      if (filters.search) {
        // For search, we'll need to implement client-side filtering
        // since Firestore doesn't support full-text search natively
        options.orderBy = [['name', 'asc']];
      }

      if (filters.isActive !== undefined) {
        options.where = [['isActive', '==', filters.isActive]];
      }

      // Add pagination
      if (filters.limit) {
        options.limit = parseInt(filters.limit);
      }

      const result = await firebaseService.getAll(this.collectionName, options);
      
      if (result.success) {
        let patients = result.data;

        // Client-side search filtering
        if (filters.search) {
          const searchTerm = filters.search.toLowerCase();
          patients = patients.filter(patient => 
            patient.name?.toLowerCase().includes(searchTerm) ||
            patient.email?.toLowerCase().includes(searchTerm) ||
            patient.phone?.includes(searchTerm)
          );
        }

        return {
          success: true,
          data: patients,
          total: patients.length
        };
      }

      return result;
    } catch (error) {
      console.error('Error getting patients:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar pacientes'
      };
    }
  }

  /**
   * Get single patient by ID
   */
  async getPatient(id) {
    try {
      return await firebaseService.getById(this.collectionName, id);
    } catch (error) {
      console.error('Error getting patient:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar paciente'
      };
    }
  }

  /**
   * Create new patient
   */
  async createPatient(patientData) {
    try {
      // Add default fields
      const data = {
        ...patientData,
        isActive: true,
        registrationDate: new Date(),
        lastVisit: null,
        totalTreatments: 0
      };

      return await firebaseService.create(this.collectionName, data);
    } catch (error) {
      console.error('Error creating patient:', error);
      return {
        success: false,
        error: error.message || 'Erro ao criar paciente'
      };
    }
  }

  /**
   * Update patient
   */
  async updatePatient(id, patientData) {
    try {
      return await firebaseService.update(this.collectionName, id, patientData);
    } catch (error) {
      console.error('Error updating patient:', error);
      return {
        success: false,
        error: error.message || 'Erro ao atualizar paciente'
      };
    }
  }

  /**
   * Delete patient (soft delete)
   */
  async deletePatient(id) {
    try {
      return await firebaseService.update(this.collectionName, id, {
        isActive: false,
        deletedAt: new Date()
      });
    } catch (error) {
      console.error('Error deleting patient:', error);
      return {
        success: false,
        error: error.message || 'Erro ao deletar paciente'
      };
    }
  }

  /**
   * Get patient treatments
   */
  async getPatientTreatments(patientId) {
    try {
      const options = {
        where: [['patientId', '==', patientId]],
        orderBy: [['createdAt', 'desc']]
      };

      return await firebaseService.getAll('treatments', options);
    } catch (error) {
      console.error('Error getting patient treatments:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar tratamentos'
      };
    }
  }

  /**
   * Create treatment for patient
   */
  async createTreatment(patientId, treatmentData) {
    try {
      const data = {
        ...treatmentData,
        patientId,
        status: 'active'
      };

      const result = await firebaseService.create('treatments', data);

      if (result.success) {
        // Update patient's total treatments count
        const patient = await this.getPatient(patientId);
        if (patient.success) {
          await this.updatePatient(patientId, {
            totalTreatments: (patient.data.totalTreatments || 0) + 1,
            lastVisit: new Date()
          });
        }
      }

      return result;
    } catch (error) {
      console.error('Error creating treatment:', error);
      return {
        success: false,
        error: error.message || 'Erro ao criar tratamento'
      };
    }
  }

  /**
   * Update treatment
   */
  async updateTreatment(treatmentId, treatmentData) {
    try {
      return await firebaseService.update('treatments', treatmentId, treatmentData);
    } catch (error) {
      console.error('Error updating treatment:', error);
      return {
        success: false,
        error: error.message || 'Erro ao atualizar tratamento'
      };
    }
  }

  /**
   * Delete treatment
   */
  async deleteTreatment(treatmentId) {
    try {
      return await firebaseService.delete('treatments', treatmentId);
    } catch (error) {
      console.error('Error deleting treatment:', error);
      return {
        success: false,
        error: error.message || 'Erro ao deletar tratamento'
      };
    }
  }

  /**
   * Get patient consumption report
   */
  async getPatientConsumption(patientId, filters = {}) {
    try {
      const options = {
        where: [['patientId', '==', patientId]]
      };

      // Add date filters
      if (filters.startDate && filters.endDate) {
        options.where.push(['date', '>=', new Date(filters.startDate)]);
        options.where.push(['date', '<=', new Date(filters.endDate)]);
      }

      if (filters.productId) {
        options.where.push(['productId', '==', filters.productId]);
      }

      options.orderBy = [['date', 'desc']];

      return await firebaseService.getAll('consumptions', options);
    } catch (error) {
      console.error('Error getting patient consumption:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar consumo do paciente'
      };
    }
  }

  /**
   * Get patient statistics
   */
  async getPatientStats() {
    try {
      const result = await firebaseService.getAll(this.collectionName);
      
      if (result.success) {
        const patients = result.data;
        const activePatients = patients.filter(p => p.isActive !== false);
        const totalTreatments = patients.reduce((sum, p) => sum + (p.totalTreatments || 0), 0);
        
        return {
          success: true,
          data: {
            totalPatients: patients.length,
            activePatients: activePatients.length,
            inactivePatients: patients.length - activePatients.length,
            totalTreatments,
            averageTreatmentsPerPatient: activePatients.length > 0 
              ? Math.round(totalTreatments / activePatients.length * 100) / 100 
              : 0
          }
        };
      }

      return result;
    } catch (error) {
      console.error('Error getting patient stats:', error);
      return {
        success: false,
        error: error.message || 'Erro ao buscar estatísticas'
      };
    }
  }

  /**
   * Setup real-time listener for patients
   */
  onPatientsChange(callback, options = {}) {
    return firebaseService.onCollectionChange(this.collectionName, callback, options);
  }

  /**
   * Setup real-time listener for a specific patient
   */
  onPatientChange(patientId, callback) {
    return firebaseService.onDocumentChange(this.collectionName, patientId, callback);
  }

  /**
   * Remove listener
   */
  removeListener(listenerId) {
    return firebaseService.removeListener(listenerId);
  }
}

// Create singleton instance
const firebasePatientService = new FirebasePatientService();

export default firebasePatientService;