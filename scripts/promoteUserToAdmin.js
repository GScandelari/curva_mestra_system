#!/usr/bin/env node

const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const axios = require('axios');

/**
 * Script para promover um usuário a system_admin
 * Identifica o usuário por email e atribui privilégios administrativos
 */

const BASE_URL = 'https://us-central1-curva-mestra.cloudfunctions.net';

// Inicializar Firebase Admin
if (!admin.apps.length) {
  try {
    // Tentar usar Application Default Credentials primeiro
    admin.initializeApp({
      projectId: 'curva-mestra',
      credential: admin.credential.applicationDefault()
    });
  } catch (error) {
    console.log('⚠️  Application Default Credentials não disponíveis, tentando sem credenciais...');
    // Fallback para inicialização básica (funciona em alguns casos)
    admin.initializeApp({
      projectId: 'curva-mestra'
    });
  }
}

class UserPromoter {
  constructor() {
    this.adminToken = null;
  }

  async generateAdminToken() {
    try {
      console.log('🔑 Gerando token do admin padrão...');
      const adminUID = 'gEjUSOsHF9QmS0Dvi0zB10GsxrD2';
      this.adminToken = await getAuth().createCustomToken(adminUID);
      console.log('✅ Token do admin gerado com sucesso');
      return this.adminToken;
    } catch (error) {
      console.error('❌ Erro ao gerar token do admin:', error.message);
      throw error;
    }
  }

  async findUserByEmail(email) {
    try {
      console.log(`🔍 Procurando usuário: ${email}`);
      const userRecord = await getAuth().getUserByEmail(email);
      console.log(`✅ Usuário encontrado:`);
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
      console.log(`   Nome: ${userRecord.displayName || 'Não definido'}`);
      return userRecord;
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.error(`❌ Usuário não encontrado: ${email}`);
        console.log('💡 Certifique-se de que o usuário está registrado no Firebase Auth');
        return null;
      }
      console.error('❌ Erro ao buscar usuário:', error.message);
      throw error;
    }
  }

  async getCurrentUserClaims(uid) {
    try {
      console.log(`🔍 Verificando claims atuais do usuário: ${uid}`);
      const userRecord = await getAuth().getUser(uid);
      const claims = userRecord.customClaims || {};
      
      console.log('📋 Claims atuais:');
      console.log(JSON.stringify(claims, null, 2));
      
      return claims;
    } catch (error) {
      console.error('❌ Erro ao obter claims:', error.message);
      throw error;
    }
  }

  async callAdminAPI(endpoint, data = {}) {
    const url = `${BASE_URL}/${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.adminToken}`
    };

    const payload = { data };

    try {
      console.log(`🚀 Chamando API: ${endpoint}`);
      console.log(`📤 Dados:`, JSON.stringify(data, null, 2));
      
      const response = await axios.post(url, payload, { headers });
      
      console.log(`✅ Sucesso (${response.status})`);
      console.log(`📥 Resposta:`, JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error) {
      console.error(`❌ Erro na API ${endpoint}:`);
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Resposta:`, JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(`Erro:`, error.message);
      }
      throw error;
    }
  }

  async promoteUserToAdmin(email) {
    try {
      console.log(`\n🚀 === PROMOVENDO USUÁRIO A SYSTEM_ADMIN ===`);
      console.log(`📧 Email: ${email}\n`);

      // 1. Gerar token do admin
      await this.generateAdminToken();

      // 2. Encontrar o usuário
      const user = await this.findUserByEmail(email);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // 3. Verificar claims atuais
      console.log('\n📋 === VERIFICANDO STATUS ATUAL ===');
      await this.getCurrentUserClaims(user.uid);

      // 4. Verificar se já é admin via API
      console.log('\n🔍 === VERIFICANDO VIA API ===');
      try {
        await this.callAdminAPI('getUserRole', { uid: user.uid });
      } catch (error) {
        console.log('ℹ️  Usuário ainda não tem role definido via API');
      }

      // 5. Promover a admin
      console.log('\n👑 === PROMOVENDO A ADMIN ===');
      await this.callAdminAPI('setAdminRole', { uid: user.uid });

      // 6. Verificar se funcionou
      console.log('\n✅ === VERIFICANDO PROMOÇÃO ===');
      await this.callAdminAPI('getUserRole', { uid: user.uid });
      await this.callAdminAPI('verifyAdminRole', { uid: user.uid });

      // 7. Verificar claims finais
      console.log('\n📋 === CLAIMS FINAIS ===');
      await this.getCurrentUserClaims(user.uid);

      console.log(`\n🎉 === PROMOÇÃO CONCLUÍDA COM SUCESSO ===`);
      console.log(`✅ ${email} agora é system_admin!`);
      console.log(`🔑 UID: ${user.uid}`);

      return {
        success: true,
        uid: user.uid,
        email: user.email,
        message: 'Usuário promovido a system_admin com sucesso'
      };

    } catch (error) {
      console.error('\n💥 === ERRO NA PROMOÇÃO ===');
      console.error(error.message);
      throw error;
    }
  }

  async listAllUsers() {
    try {
      console.log('\n👥 === LISTANDO TODOS OS USUÁRIOS ===');
      
      const listUsersResult = await getAuth().listUsers(1000);
      
      console.log(`📊 Total de usuários: ${listUsersResult.users.length}\n`);
      
      for (const user of listUsersResult.users) {
        const claims = user.customClaims || {};
        const isAdmin = claims.admin || false;
        const role = claims.role || 'user';
        
        console.log(`👤 ${user.email || 'Email não definido'}`);
        console.log(`   UID: ${user.uid}`);
        console.log(`   Nome: ${user.displayName || 'Não definido'}`);
        console.log(`   Role: ${role}`);
        console.log(`   Admin: ${isAdmin ? '✅' : '❌'}`);
        console.log(`   Verificado: ${user.emailVerified ? '✅' : '❌'}`);
        console.log(`   Criado: ${user.metadata.creationTime}`);
        console.log('');
      }
      
      return listUsersResult.users;
    } catch (error) {
      console.error('❌ Erro ao listar usuários:', error.message);
      throw error;
    }
  }

  async initializeSystem() {
    try {
      console.log('\n🔧 === INICIALIZANDO SISTEMA ===');
      
      const url = `${BASE_URL}/initializeDefaultAdmin`;
      const response = await axios.post(url, { data: {} }, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('✅ Sistema inicializado:');
      console.log(JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao inicializar sistema:', error.message);
      if (error.response) {
        console.error('Resposta:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const email = args[1];
  
  const promoter = new UserPromoter();
  
  try {
    switch (command) {
      case 'promote':
        if (!email) {
          console.error('❌ Email é obrigatório para promoção');
          console.log('💡 Uso: node promoteUserToAdmin.js promote <email>');
          process.exit(1);
        }
        await promoter.promoteUserToAdmin(email);
        break;
        
      case 'list':
        await promoter.listAllUsers();
        break;
        
      case 'init':
        await promoter.initializeSystem();
        break;
        
      case 'find':
        if (!email) {
          console.error('❌ Email é obrigatório para busca');
          console.log('💡 Uso: node promoteUserToAdmin.js find <email>');
          process.exit(1);
        }
        await promoter.findUserByEmail(email);
        break;
        
      default:
        console.log(`
🚀 User Promoter - Curva Mestra

Comandos disponíveis:

👑 Promover usuário a system_admin:
   node promoteUserToAdmin.js promote <email>

👥 Listar todos os usuários:
   node promoteUserToAdmin.js list

🔍 Encontrar usuário por email:
   node promoteUserToAdmin.js find <email>

🔧 Inicializar sistema:
   node promoteUserToAdmin.js init

Exemplos:
   node promoteUserToAdmin.js promote usuario@exemplo.com
   node promoteUserToAdmin.js list
   node promoteUserToAdmin.js find usuario@exemplo.com
   node promoteUserToAdmin.js init
        `);
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

module.exports = UserPromoter;