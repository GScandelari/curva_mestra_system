/**
 * Script de Migração PostgreSQL para Firestore
 * 
 * Este script migra todos os dados do PostgreSQL para Firestore,
 * mantendo a integridade referencial e transformando os tipos de dados adequadamente.
 */

const admin = require('firebase-admin');
const { sequelize, User, Product, Patient, ProductRequest, Invoice, StockMovement, AuditLog, Notification } = require('../src/models');
const fs = require('fs').promises;
const path = require('path');

// Configurar Firebase Admin
const firebaseConfig = require('../src/config/firebase');

class FirestoreMigration {
  constructor() {
    this.db = null;
    this.batchSize = 500; // Tamanho do lote para evitar timeouts
    this.migrationLog = [];
    this.errors = [];
  }

  /**
   * Inicializar Firebase Admin SDK
   */
  async initialize() {
    try {
      firebaseConfig.initialize();
      this.db = firebaseConfig.getFirestore();
      console.log('Firebase Admin SDK inicializado com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar Firebase:', error);
      throw error;
    }
  }

  /**
   * Criar backup dos dados PostgreSQL antes da migração
   */
  async createBackup() {
    console.log('Criando backup dos dados PostgreSQL...');
    
    const backupData = {
      timestamp: new Date().toISOString(),
      users: await User.findAll({ raw: true }),
      products: await Product.findAll({ raw: true }),
      patients: await Patient.findAll({ raw: true }),
      productRequests: await ProductRequest.findAll({ raw: true }),
      invoices: await Invoice.findAll({ raw: true }),
      stockMovements: await StockMovement.findAll({ raw: true }),
      auditLogs: await AuditLog.findAll({ raw: true }),
      notifications: await Notification.findAll({ raw: true })
    };

    const backupPath = path.join(__dirname, '../backups', `postgresql-backup-${Date.now()}.json`);
    
    // Criar diretório de backup se não existir
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    
    await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`Backup criado em: ${backupPath}`);
    
    return backupPath;
  }

  /**
   * Transformar dados PostgreSQL para formato Firestore
   */
  transformData(data, type) {
    const transformed = { ...data };

    // Converter timestamps para Firestore Timestamp
    if (transformed.created_at) {
      transformed.createdAt = admin.firestore.Timestamp.fromDate(new Date(transformed.created_at));
      delete transformed.created_at;
    }
    
    if (transformed.updated_at) {
      transformed.updatedAt = admin.firestore.Timestamp.fromDate(new Date(transformed.updated_at));
      delete transformed.updated_at;
    }

    // Transformações específicas por tipo
    switch (type) {
      case 'user':
        // Converter campos snake_case para camelCase
        if (transformed.password_hash) {
          transformed.passwordHash = transformed.password_hash;
          delete transformed.password_hash;
        }
        if (transformed.is_active !== undefined) {
          transformed.isActive = transformed.is_active;
          delete transformed.is_active;
        }
        break;

      case 'product':
        // Converter campos de produto
        if (transformed.minimum_stock !== undefined) {
          transformed.minimumStock = transformed.minimum_stock;
          delete transformed.minimum_stock;
        }
        if (transformed.current_stock !== undefined) {
          transformed.currentStock = transformed.current_stock;
          delete transformed.current_stock;
        }
        if (transformed.expiration_date) {
          transformed.expirationDate = admin.firestore.Timestamp.fromDate(new Date(transformed.expiration_date));
          delete transformed.expiration_date;
        }
        if (transformed.invoice_number) {
          transformed.invoiceNumber = transformed.invoice_number;
          delete transformed.invoice_number;
        }
        if (transformed.entry_date) {
          transformed.entryDate = admin.firestore.Timestamp.fromDate(new Date(transformed.entry_date));
          delete transformed.entry_date;
        }
        if (transformed.entry_user_id) {
          transformed.entryUserId = transformed.entry_user_id;
          delete transformed.entry_user_id;
        }
        break;

      case 'patient':
        if (transformed.birth_date) {
          transformed.birthDate = admin.firestore.Timestamp.fromDate(new Date(transformed.birth_date));
          delete transformed.birth_date;
        }
        if (transformed.medical_history) {
          transformed.medicalHistory = transformed.medical_history;
          delete transformed.medical_history;
        }
        if (transformed.is_active !== undefined) {
          transformed.isActive = transformed.is_active;
          delete transformed.is_active;
        }
        break;

      case 'productRequest':
        if (transformed.requester_id) {
          transformed.requesterId = transformed.requester_id;
          delete transformed.requester_id;
        }
        if (transformed.request_date) {
          transformed.requestDate = admin.firestore.Timestamp.fromDate(new Date(transformed.request_date));
          delete transformed.request_date;
        }
        if (transformed.approval_date) {
          transformed.approvalDate = admin.firestore.Timestamp.fromDate(new Date(transformed.approval_date));
          delete transformed.approval_date;
        }
        if (transformed.approver_id) {
          transformed.approverId = transformed.approver_id;
          delete transformed.approver_id;
        }
        if (transformed.patient_id) {
          transformed.patientId = transformed.patient_id;
          delete transformed.patient_id;
        }
        break;

      case 'invoice':
        if (transformed.issue_date) {
          transformed.issueDate = admin.firestore.Timestamp.fromDate(new Date(transformed.issue_date));
          delete transformed.issue_date;
        }
        if (transformed.receipt_date) {
          transformed.receiptDate = admin.firestore.Timestamp.fromDate(new Date(transformed.receipt_date));
          delete transformed.receipt_date;
        }
        if (transformed.total_value) {
          transformed.totalValue = parseFloat(transformed.total_value);
          delete transformed.total_value;
        }
        if (transformed.user_id) {
          transformed.userId = transformed.user_id;
          delete transformed.user_id;
        }
        break;

      case 'stockMovement':
        if (transformed.product_id) {
          transformed.productId = transformed.product_id;
          delete transformed.product_id;
        }
        if (transformed.movement_type) {
          transformed.movementType = transformed.movement_type;
          delete transformed.movement_type;
        }
        if (transformed.user_id) {
          transformed.userId = transformed.user_id;
          delete transformed.user_id;
        }
        if (transformed.patient_id) {
          transformed.patientId = transformed.patient_id;
          delete transformed.patient_id;
        }
        if (transformed.request_id) {
          transformed.requestId = transformed.request_id;
          delete transformed.request_id;
        }
        if (transformed.date) {
          transformed.date = admin.firestore.Timestamp.fromDate(new Date(transformed.date));
        }
        break;

      case 'auditLog':
        if (transformed.user_id) {
          transformed.userId = transformed.user_id;
          delete transformed.user_id;
        }
        if (transformed.table_name) {
          transformed.tableName = transformed.table_name;
          delete transformed.table_name;
        }
        if (transformed.record_id) {
          transformed.recordId = transformed.record_id;
          delete transformed.record_id;
        }
        if (transformed.old_values) {
          transformed.oldValues = transformed.old_values;
          delete transformed.old_values;
        }
        if (transformed.new_values) {
          transformed.newValues = transformed.new_values;
          delete transformed.new_values;
        }
        if (transformed.ip_address) {
          transformed.ipAddress = transformed.ip_address;
          delete transformed.ip_address;
        }
        if (transformed.user_agent) {
          transformed.userAgent = transformed.user_agent;
          delete transformed.user_agent;
        }
        break;

      case 'notification':
        if (transformed.user_id) {
          transformed.userId = transformed.user_id;
          delete transformed.user_id;
        }
        if (transformed.is_read !== undefined) {
          transformed.isRead = transformed.is_read;
          delete transformed.is_read;
        }
        break;
    }

    return transformed;
  }

  /**
   * Migrar dados em lotes para evitar timeouts
   */
  async migrateInBatches(data, collectionPath, type) {
    const batches = [];
    
    for (let i = 0; i < data.length; i += this.batchSize) {
      const batch = data.slice(i, i + this.batchSize);
      batches.push(batch);
    }

    console.log(`Migrando ${data.length} registros de ${type} em ${batches.length} lotes...`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const firestoreBatch = this.db.batch();

      for (const record of batch) {
        try {
          const transformedData = this.transformData(record, type);
          const docRef = this.db.doc(`${collectionPath}/${record.id}`);
          firestoreBatch.set(docRef, transformedData);
        } catch (error) {
          this.errors.push({
            type,
            recordId: record.id,
            error: error.message
          });
          console.error(`Erro ao transformar registro ${record.id} de ${type}:`, error);
        }
      }

      try {
        await firestoreBatch.commit();
        console.log(`Lote ${i + 1}/${batches.length} de ${type} migrado com sucesso`);
        
        this.migrationLog.push({
          type,
          batch: i + 1,
          totalBatches: batches.length,
          recordsInBatch: batch.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error(`Erro ao migrar lote ${i + 1} de ${type}:`, error);
        this.errors.push({
          type,
          batch: i + 1,
          error: error.message
        });
      }
    }
  }

  /**
   * Executar migração completa
   */
  async migrate(clinicId = 'default-clinic') {
    try {
      console.log('Iniciando migração para Firestore...');
      
      // Criar backup
      const backupPath = await this.createBackup();
      
      // Conectar ao PostgreSQL
      await sequelize.authenticate();
      console.log('Conectado ao PostgreSQL');

      // Buscar todos os dados
      console.log('Buscando dados do PostgreSQL...');
      const users = await User.findAll({ raw: true });
      const products = await Product.findAll({ raw: true });
      const patients = await Patient.findAll({ raw: true });
      const productRequests = await ProductRequest.findAll({ raw: true });
      const invoices = await Invoice.findAll({ raw: true });
      const stockMovements = await StockMovement.findAll({ raw: true });
      const auditLogs = await AuditLog.findAll({ raw: true });
      const notifications = await Notification.findAll({ raw: true });

      console.log(`Dados encontrados:
        - Usuários: ${users.length}
        - Produtos: ${products.length}
        - Pacientes: ${patients.length}
        - Solicitações: ${productRequests.length}
        - Notas Fiscais: ${invoices.length}
        - Movimentações: ${stockMovements.length}
        - Logs de Auditoria: ${auditLogs.length}
        - Notificações: ${notifications.length}`);

      // Migrar dados seguindo a estrutura hierárquica do Firestore
      // clinics/{clinicId}/users/{userId}
      await this.migrateInBatches(users, `clinics/${clinicId}/users`, 'user');
      
      // clinics/{clinicId}/products/{productId}
      await this.migrateInBatches(products, `clinics/${clinicId}/products`, 'product');
      
      // clinics/{clinicId}/patients/{patientId}
      await this.migrateInBatches(patients, `clinics/${clinicId}/patients`, 'patient');
      
      // clinics/{clinicId}/requests/{requestId}
      await this.migrateInBatches(productRequests, `clinics/${clinicId}/requests`, 'productRequest');
      
      // clinics/{clinicId}/invoices/{invoiceId}
      await this.migrateInBatches(invoices, `clinics/${clinicId}/invoices`, 'invoice');
      
      // clinics/{clinicId}/stockMovements/{movementId}
      await this.migrateInBatches(stockMovements, `clinics/${clinicId}/stockMovements`, 'stockMovement');
      
      // clinics/{clinicId}/auditLogs/{logId}
      await this.migrateInBatches(auditLogs, `clinics/${clinicId}/auditLogs`, 'auditLog');
      
      // clinics/{clinicId}/notifications/{notificationId}
      await this.migrateInBatches(notifications, `clinics/${clinicId}/notifications`, 'notification');

      // Criar documento da clínica
      await this.db.doc(`clinics/${clinicId}`).set({
        name: 'Clínica Migrada',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        migratedFrom: 'postgresql',
        backupPath: backupPath
      });

      console.log('Migração concluída com sucesso!');
      
      // Salvar log de migração
      await this.saveMigrationLog(clinicId);
      
      return {
        success: true,
        backupPath,
        migrationLog: this.migrationLog,
        errors: this.errors
      };

    } catch (error) {
      console.error('Erro durante a migração:', error);
      throw error;
    }
  }

  /**
   * Salvar log de migração
   */
  async saveMigrationLog(clinicId) {
    const logPath = path.join(__dirname, '../logs', `migration-${clinicId}-${Date.now()}.json`);
    
    const logData = {
      clinicId,
      timestamp: new Date().toISOString(),
      migrationLog: this.migrationLog,
      errors: this.errors,
      summary: {
        totalBatches: this.migrationLog.length,
        totalErrors: this.errors.length,
        success: this.errors.length === 0
      }
    };

    // Criar diretório de logs se não existir
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    
    await fs.writeFile(logPath, JSON.stringify(logData, null, 2));
    console.log(`Log de migração salvo em: ${logPath}`);
  }

  /**
   * Validar integridade dos dados migrados
   */
  async validateMigration(clinicId = 'default-clinic') {
    console.log('Validando integridade dos dados migrados...');
    
    try {
      // Contar registros no PostgreSQL
      const pgCounts = {
        users: await User.count(),
        products: await Product.count(),
        patients: await Patient.count(),
        productRequests: await ProductRequest.count(),
        invoices: await Invoice.count(),
        stockMovements: await StockMovement.count(),
        auditLogs: await AuditLog.count(),
        notifications: await Notification.count()
      };

      // Contar registros no Firestore
      const fsCounts = {};
      const collections = ['users', 'products', 'patients', 'requests', 'invoices', 'stockMovements', 'auditLogs', 'notifications'];
      
      for (const collection of collections) {
        const snapshot = await this.db.collection(`clinics/${clinicId}/${collection}`).get();
        fsCounts[collection] = snapshot.size;
      }

      console.log('Contagem PostgreSQL:', pgCounts);
      console.log('Contagem Firestore:', fsCounts);

      // Verificar se as contagens coincidem
      const validationResults = {};
      let allValid = true;

      for (const [key, pgCount] of Object.entries(pgCounts)) {
        const fsKey = key === 'productRequests' ? 'requests' : key;
        const fsCount = fsCounts[fsKey] || 0;
        const isValid = pgCount === fsCount;
        
        validationResults[key] = {
          postgresql: pgCount,
          firestore: fsCount,
          valid: isValid
        };

        if (!isValid) {
          allValid = false;
          console.error(`❌ Inconsistência em ${key}: PostgreSQL=${pgCount}, Firestore=${fsCount}`);
        } else {
          console.log(`✅ ${key}: ${pgCount} registros migrados corretamente`);
        }
      }

      return {
        valid: allValid,
        results: validationResults
      };

    } catch (error) {
      console.error('Erro durante validação:', error);
      throw error;
    }
  }
}

// Função principal para executar migração
async function main() {
  const migration = new FirestoreMigration();
  
  try {
    await migration.initialize();
    
    // Obter clinicId dos argumentos da linha de comando
    const clinicId = process.argv[2] || 'default-clinic';
    
    console.log(`Iniciando migração para clínica: ${clinicId}`);
    
    // Executar migração
    const result = await migration.migrate(clinicId);
    
    // Validar migração
    const validation = await migration.validateMigration(clinicId);
    
    if (validation.valid) {
      console.log('🎉 Migração concluída com sucesso e validada!');
    } else {
      console.log('⚠️ Migração concluída mas com inconsistências. Verifique os logs.');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro fatal durante migração:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = FirestoreMigration;