/**
 * Script para configurar Firestore em modo produção
 * 
 * Este script configura o Firestore com as coleções necessárias,
 * índices compostos e configurações de produção.
 */

const admin = require('firebase-admin');
const firebaseConfig = require('../src/config/firebase');

class FirestoreSetup {
  constructor() {
    this.db = null;
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
   * Criar estrutura básica de coleções para uma clínica
   */
  async createClinicStructure(clinicId, clinicData = {}) {
    console.log(`Criando estrutura para clínica: ${clinicId}`);
    
    try {
      // Criar documento da clínica
      const clinicDoc = {
        name: clinicData.name || 'Nova Clínica',
        address: clinicData.address || null,
        phone: clinicData.phone || null,
        email: clinicData.email || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true,
        settings: {
          timezone: 'America/Sao_Paulo',
          currency: 'BRL',
          language: 'pt-BR',
          notifications: {
            lowStock: true,
            expiring: true,
            requests: true
          }
        }
      };

      await this.db.doc(`clinics/${clinicId}`).set(clinicDoc);
      console.log(`✅ Documento da clínica ${clinicId} criado`);

      // Criar coleções vazias com documentos de exemplo (serão removidos após)
      const collections = [
        'users',
        'products', 
        'patients',
        'requests',
        'invoices',
        'stockMovements',
        'auditLogs',
        'notifications'
      ];

      for (const collection of collections) {
        const tempDoc = {
          _temp: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await this.db.collection(`clinics/${clinicId}/${collection}`).add(tempDoc);
        await docRef.delete(); // Remove o documento temporário
        
        console.log(`✅ Coleção ${collection} inicializada`);
      }

      return clinicId;

    } catch (error) {
      console.error(`Erro ao criar estrutura da clínica ${clinicId}:`, error);
      throw error;
    }
  }

  /**
   * Configurar índices compostos programaticamente
   * Nota: Alguns índices podem precisar ser criados via Firebase Console
   */
  async setupIndexes() {
    console.log('Configurando índices compostos...');
    
    // Nota: A criação de índices via Admin SDK é limitada
    // A maioria dos índices deve ser definida em firestore.indexes.json
    // Este método serve para documentar os índices necessários
    
    const requiredIndexes = [
      {
        collection: 'products',
        fields: ['category', 'expirationDate'],
        description: 'Busca de produtos por categoria e data de vencimento'
      },
      {
        collection: 'products', 
        fields: ['currentStock', 'minimumStock'],
        description: 'Identificação de produtos com estoque baixo'
      },
      {
        collection: 'requests',
        fields: ['status', 'requestDate'],
        description: 'Listagem de solicitações por status e data'
      },
      {
        collection: 'stockMovements',
        fields: ['productId', 'date'],
        description: 'Histórico de movimentações por produto'
      },
      {
        collection: 'notifications',
        fields: ['userId', 'isRead', 'createdAt'],
        description: 'Notificações não lidas por usuário'
      }
    ];

    console.log('📋 Índices necessários (definidos em firestore.indexes.json):');
    requiredIndexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.collection}: [${index.fields.join(', ')}] - ${index.description}`);
    });

    console.log('\n⚠️ Certifique-se de que os índices estão definidos em firestore.indexes.json');
    console.log('Execute: firebase deploy --only firestore:indexes');
  }

  /**
   * Criar usuário administrador inicial
   */
  async createInitialAdmin(clinicId, adminData) {
    console.log('Criando usuário administrador inicial...');
    
    try {
      // Criar usuário no Firebase Auth
      const userRecord = await admin.auth().createUser({
        uid: adminData.uid || undefined,
        email: adminData.email,
        password: adminData.password,
        displayName: adminData.name,
        disabled: false
      });

      // Definir custom claims
      await admin.auth().setCustomUserClaims(userRecord.uid, {
        role: 'admin',
        clinicId: clinicId,
        permissions: ['all']
      });

      // Criar documento do usuário no Firestore
      const userDoc = {
        name: adminData.name,
        email: adminData.email,
        role: 'admin',
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLogin: null,
        permissions: ['all']
      };

      await this.db.doc(`clinics/${clinicId}/users/${userRecord.uid}`).set(userDoc);

      console.log(`✅ Usuário administrador criado: ${adminData.email} (${userRecord.uid})`);
      
      return userRecord.uid;

    } catch (error) {
      console.error('Erro ao criar usuário administrador:', error);
      throw error;
    }
  }

  /**
   * Configurar regras de segurança (informativo)
   */
  async checkSecurityRules() {
    console.log('Verificando regras de segurança...');
    
    // Nota: As regras são definidas em firestore.rules
    // Este método serve para validar se as regras estão ativas
    
    try {
      // Tentar uma operação que deve falhar sem autenticação
      const testRef = this.db.doc('test/unauthorized');
      
      try {
        await testRef.get();
        console.log('⚠️ ATENÇÃO: Regras de segurança podem não estar ativas!');
        console.log('Execute: firebase deploy --only firestore:rules');
      } catch (error) {
        if (error.code === 'permission-denied') {
          console.log('✅ Regras de segurança estão ativas');
        } else {
          console.log('❓ Status das regras de segurança indeterminado');
        }
      }
    } catch (error) {
      console.log('❓ Não foi possível verificar regras de segurança');
    }
  }

  /**
   * Configurar triggers e funções de notificação
   */
  async setupTriggers() {
    console.log('Configurando triggers de notificação...');
    
    // Nota: Os triggers são implementados como Firebase Functions
    // Este método serve para documentar os triggers necessários
    
    const requiredTriggers = [
      {
        trigger: 'onCreate',
        collection: 'products',
        function: 'onProductCreate',
        description: 'Criar log de auditoria quando produto é criado'
      },
      {
        trigger: 'onUpdate', 
        collection: 'products',
        function: 'onProductUpdate',
        description: 'Verificar estoque baixo e criar notificações'
      },
      {
        trigger: 'onWrite',
        collection: 'stockMovements', 
        function: 'onStockMovement',
        description: 'Atualizar estoque atual do produto'
      },
      {
        trigger: 'scheduled',
        schedule: '0 9 * * *',
        function: 'checkExpiringProducts',
        description: 'Verificar produtos vencendo diariamente'
      }
    ];

    console.log('📋 Triggers necessários (implementar em Firebase Functions):');
    requiredTriggers.forEach((trigger, i) => {
      console.log(`${i + 1}. ${trigger.function}: ${trigger.trigger} ${trigger.collection || trigger.schedule} - ${trigger.description}`);
    });

    console.log('\n⚠️ Implemente estes triggers em functions/src/');
  }

  /**
   * Executar configuração completa
   */
  async setup(options = {}) {
    console.log('🚀 Iniciando configuração do Firestore...\n');
    
    try {
      // Configurar clínica
      const clinicId = options.clinicId || 'default-clinic';
      const clinicData = options.clinicData || {};
      
      await this.createClinicStructure(clinicId, clinicData);
      
      // Criar admin inicial se fornecido
      if (options.adminData) {
        await this.createInitialAdmin(clinicId, options.adminData);
      }
      
      // Configurar índices
      await this.setupIndexes();
      
      // Verificar regras de segurança
      await this.checkSecurityRules();
      
      // Configurar triggers
      await this.setupTriggers();
      
      console.log('\n🎉 Configuração do Firestore concluída com sucesso!');
      console.log('\n📝 Próximos passos:');
      console.log('1. Execute: firebase deploy --only firestore:rules');
      console.log('2. Execute: firebase deploy --only firestore:indexes');
      console.log('3. Implemente as Firebase Functions necessárias');
      console.log('4. Execute os testes de segurança: node backend/scripts/test-firestore-rules.js');
      
      return {
        success: true,
        clinicId,
        message: 'Firestore configurado com sucesso'
      };

    } catch (error) {
      console.error('❌ Erro durante configuração:', error);
      throw error;
    }
  }

  /**
   * Verificar status da configuração
   */
  async checkStatus(clinicId = 'default-clinic') {
    console.log(`Verificando status da configuração para clínica: ${clinicId}`);
    
    const status = {
      clinic: false,
      collections: {},
      admin: false,
      rules: 'unknown'
    };

    try {
      // Verificar documento da clínica
      const clinicDoc = await this.db.doc(`clinics/${clinicId}`).get();
      status.clinic = clinicDoc.exists;
      
      // Verificar coleções
      const collections = ['users', 'products', 'patients', 'requests', 'invoices', 'stockMovements', 'auditLogs', 'notifications'];
      
      for (const collection of collections) {
        try {
          const snapshot = await this.db.collection(`clinics/${clinicId}/${collection}`).limit(1).get();
          status.collections[collection] = true;
        } catch (error) {
          status.collections[collection] = false;
        }
      }
      
      // Verificar se existe pelo menos um admin
      const adminQuery = await this.db.collection(`clinics/${clinicId}/users`)
        .where('role', '==', 'admin')
        .limit(1)
        .get();
      
      status.admin = !adminQuery.empty;
      
      console.log('📊 Status da Configuração:');
      console.log(`Clínica: ${status.clinic ? '✅' : '❌'}`);
      console.log(`Admin: ${status.admin ? '✅' : '❌'}`);
      console.log('Coleções:');
      
      Object.entries(status.collections).forEach(([collection, exists]) => {
        console.log(`  ${collection}: ${exists ? '✅' : '❌'}`);
      });
      
      return status;

    } catch (error) {
      console.error('Erro ao verificar status:', error);
      throw error;
    }
  }
}

// Função principal
async function main() {
  const setup = new FirestoreSetup();
  
  try {
    await setup.initialize();
    
    // Obter parâmetros da linha de comando
    const args = process.argv.slice(2);
    const command = args[0] || 'setup';
    
    switch (command) {
      case 'setup':
        const clinicId = args[1] || 'default-clinic';
        const clinicName = args[2] || 'Nova Clínica';
        
        await setup.setup({
          clinicId,
          clinicData: { name: clinicName }
        });
        break;
        
      case 'create-admin':
        const adminClinicId = args[1] || 'default-clinic';
        const adminEmail = args[2];
        const adminPassword = args[3];
        const adminName = args[4] || 'Administrador';
        
        if (!adminEmail || !adminPassword) {
          console.error('❌ Email e senha são obrigatórios para criar admin');
          console.log('Uso: node setup-firestore.js create-admin <clinicId> <email> <password> [nome]');
          process.exit(1);
        }
        
        await setup.createInitialAdmin(adminClinicId, {
          email: adminEmail,
          password: adminPassword,
          name: adminName
        });
        break;
        
      case 'status':
        const statusClinicId = args[1] || 'default-clinic';
        await setup.checkStatus(statusClinicId);
        break;
        
      default:
        console.log('Comandos disponíveis:');
        console.log('  setup [clinicId] [clinicName] - Configurar Firestore');
        console.log('  create-admin <clinicId> <email> <password> [nome] - Criar admin');
        console.log('  status [clinicId] - Verificar status');
        break;
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = FirestoreSetup;