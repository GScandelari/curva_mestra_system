#!/usr/bin/env node

const axios = require('axios');
const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');

/**
 * Script para testar a API Admin com tokens válidos
 */

const BASE_URL = 'https://us-central1-curva-mestra.cloudfunctions.net';
const ADMIN_UID = 'gEjUSOsHF9QmS0Dvi0zB10GsxrD2';

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'curva-mestra'
  });
}

class APITester {
  constructor() {
    this.token = null;
  }

  async generateToken(uid) {
    try {
      console.log(`🔑 Gerando token para UID: ${uid}`);
      this.token = await getAuth().createCustomToken(uid);
      console.log(`✅ Token gerado com sucesso`);
      return this.token;
    } catch (error) {
      console.error('❌ Erro ao gerar token:', error.message);
      throw error;
    }
  }

  async callAPI(endpoint, data = {}, requireAuth = true) {
    const url = `${BASE_URL}/${endpoint}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    if (requireAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const payload = { data };

    try {
      console.log(`\n🚀 Chamando: ${endpoint}`);
      console.log(`📤 Payload:`, JSON.stringify(payload, null, 2));
      
      const response = await axios.post(url, payload, { headers });
      
      console.log(`✅ Sucesso (${response.status})`);
      console.log(`📥 Resposta:`, JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error) {
      console.error(`❌ Erro em ${endpoint}:`);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Resposta:`, JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(`Erro:`, error.message);
      }
      throw error;
    }
  }

  async testInitialization() {
    console.log('\n🔧 === TESTE DE INICIALIZAÇÃO ===');
    
    try {
      // 1. Validar inicialização (sem auth)
      await this.callAPI('validateAdminInitialization', {}, false);
      
      // 2. Inicializar admin (sem auth)
      await this.callAPI('initializeDefaultAdmin', {}, false);
      
      // 3. Validar novamente
      await this.callAPI('validateAdminInitialization', {}, false);
      
      console.log('✅ Teste de inicialização concluído');
    } catch (error) {
      console.error('❌ Falha no teste de inicialização');
    }
  }

  async testUserManagement() {
    console.log('\n👥 === TESTE DE GERENCIAMENTO DE USUÁRIOS ===');
    
    try {
      // Gerar token para o admin
      await this.generateToken(ADMIN_UID);
      
      // 1. Obter role do usuário atual
      await this.callAPI('getUserRole', {});
      
      // 2. Verificar se é admin
      await this.callAPI('verifyAdminRole', {});
      
      // 3. Definir role admin para o próprio usuário (teste)
      await this.callAPI('setAdminRole', { uid: ADMIN_UID });
      
      // 4. Verificar novamente
      await this.callAPI('verifyAdminRole', { uid: ADMIN_UID });
      
      console.log('✅ Teste de gerenciamento de usuários concluído');
    } catch (error) {
      console.error('❌ Falha no teste de gerenciamento de usuários');
    }
  }

  async testEmergencyAssignment() {
    console.log('\n🚨 === TESTE DE ATRIBUIÇÃO DE EMERGÊNCIA ===');
    
    try {
      // Gerar token para o admin
      await this.generateToken(ADMIN_UID);
      
      // Criar usuário de teste se não existir
      let testUser;
      try {
        testUser = await getAuth().getUserByEmail('test@curva-mestra.com');
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          testUser = await getAuth().createUser({
            email: 'test@curva-mestra.com',
            password: 'testpassword123',
            displayName: 'Test User'
          });
          console.log(`👤 Usuário de teste criado: ${testUser.uid}`);
        }
      }
      
      // Atribuição de emergência
      await this.callAPI('emergencyAdminAssignment', {
        uid: testUser.uid,
        email: testUser.email
      });
      
      // Verificar se funcionou
      await this.callAPI('getUserRole', { uid: testUser.uid });
      
      console.log('✅ Teste de atribuição de emergência concluído');
    } catch (error) {
      console.error('❌ Falha no teste de atribuição de emergência');
    }
  }

  async generateCurlExamples() {
    console.log('\n📋 === EXEMPLOS DE CURL ===');
    
    try {
      const token = await this.generateToken(ADMIN_UID);
      
      console.log(`
🔐 Token gerado: ${token}

📋 Exemplos de curl com token válido:

1️⃣ Inicializar Admin (sem auth):
curl --location '${BASE_URL}/initializeDefaultAdmin' \\
--header 'Content-Type: application/json' \\
--data '{"data": {}}'

2️⃣ Validar Inicialização (sem auth):
curl --location '${BASE_URL}/validateAdminInitialization' \\
--header 'Content-Type: application/json' \\
--data '{"data": {}}'

3️⃣ Obter Role do Usuário (com auth):
curl --location '${BASE_URL}/getUserRole' \\
--header 'Content-Type: application/json' \\
--header 'Authorization: Bearer ${token}' \\
--data '{"data": {}}'

4️⃣ Verificar Admin (com auth):
curl --location '${BASE_URL}/verifyAdminRole' \\
--header 'Content-Type: application/json' \\
--header 'Authorization: Bearer ${token}' \\
--data '{"data": {}}'

5️⃣ Definir Admin Role (com auth):
curl --location '${BASE_URL}/setAdminRole' \\
--header 'Content-Type: application/json' \\
--header 'Authorization: Bearer ${token}' \\
--data '{"data": {"uid": "${ADMIN_UID}"}}'

6️⃣ Atribuição de Emergência (com auth):
curl --location '${BASE_URL}/emergencyAdminAssignment' \\
--header 'Content-Type: application/json' \\
--header 'Authorization: Bearer ${token}' \\
--data '{"data": {"uid": "test-user-uid", "email": "test@example.com"}}'
      `);
      
    } catch (error) {
      console.error('❌ Erro ao gerar exemplos de curl');
    }
  }

  async runAllTests() {
    console.log('🧪 === INICIANDO TESTES DA API ADMIN ===');
    
    try {
      await this.testInitialization();
      await this.testUserManagement();
      await this.testEmergencyAssignment();
      await this.generateCurlExamples();
      
      console.log('\n🎉 === TODOS OS TESTES CONCLUÍDOS ===');
    } catch (error) {
      console.error('\n💥 === ERRO NOS TESTES ===');
      console.error(error.message);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const tester = new APITester();
  
  try {
    switch (command) {
      case 'init':
        await tester.testInitialization();
        break;
        
      case 'user':
        await tester.testUserManagement();
        break;
        
      case 'emergency':
        await tester.testEmergencyAssignment();
        break;
        
      case 'curl':
        await tester.generateCurlExamples();
        break;
        
      case 'all':
      default:
        await tester.runAllTests();
        break;
    }
  } catch (error) {
    console.error('💥 Erro na execução:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = APITester;