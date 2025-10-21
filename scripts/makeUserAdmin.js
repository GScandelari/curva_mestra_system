#!/usr/bin/env node

const axios = require('axios');

/**
 * Script simplificado para promover usuário a admin
 * Usa as APIs Cloud Functions diretamente
 */

const BASE_URL = 'https://us-central1-curva-mestra.cloudfunctions.net';

class SimpleAdminPromoter {
  
  async callAPI(endpoint, data = {}, requireAuth = false) {
    const url = `${BASE_URL}/${endpoint}`;
    const headers = {
      'Content-Type': 'application/json'
    };

    // Para APIs que não requerem auth, não enviamos token
    const payload = { data };

    try {
      console.log(`🚀 Chamando: ${endpoint}`);
      console.log(`📤 Dados:`, JSON.stringify(data, null, 2));
      
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

  async initializeSystem() {
    try {
      console.log('\n🔧 === INICIALIZANDO SISTEMA ===');
      
      // Primeiro, validar o estado atual
      console.log('\n1️⃣ Validando estado atual...');
      await this.callAPI('validateAdminInitialization');
      
      // Inicializar o admin padrão
      console.log('\n2️⃣ Inicializando admin padrão...');
      await this.callAPI('initializeDefaultAdmin');
      
      // Validar novamente
      console.log('\n3️⃣ Validando inicialização...');
      await this.callAPI('validateAdminInitialization');
      
      console.log('\n✅ Sistema inicializado com sucesso!');
      
    } catch (error) {
      console.error('\n❌ Erro ao inicializar sistema:', error.message);
      throw error;
    }
  }

  async createUserAndPromote(email, password = 'TempPassword123!') {
    try {
      console.log(`\n👤 === CRIANDO E PROMOVENDO USUÁRIO ===`);
      console.log(`📧 Email: ${email}`);
      
      // Primeiro, garantir que o sistema está inicializado
      console.log('\n🔧 Garantindo que o sistema está inicializado...');
      await this.initializeSystem();
      
      // Agora, usar a API de atribuição de emergência
      // Esta API permite que qualquer usuário autenticado promova outro
      console.log('\n🚨 Usando atribuição de emergência...');
      
      // Como não temos o UID ainda, vamos tentar uma abordagem diferente
      console.log('\n💡 Para promover sua conta, você precisa:');
      console.log('1. Fazer login no sistema web: https://curva-mestra.web.app');
      console.log('2. Registrar-se com seu email se ainda não tem conta');
      console.log('3. Anotar seu UID do Firebase');
      console.log('4. Executar este script novamente com o UID');
      
      console.log('\n🔍 Ou me informe seu email para que eu possa verificar se você já tem conta');
      
    } catch (error) {
      console.error('\n❌ Erro:', error.message);
      throw error;
    }
  }

  async promoteExistingUser(uid, email) {
    try {
      console.log(`\n👑 === PROMOVENDO USUÁRIO EXISTENTE ===`);
      console.log(`📧 Email: ${email}`);
      console.log(`🆔 UID: ${uid}`);
      
      // Garantir que o sistema está inicializado
      await this.initializeSystem();
      
      // Usar a API de atribuição de emergência
      console.log('\n🚨 Executando atribuição de emergência...');
      await this.callAPI('emergencyAdminAssignment', {
        uid: uid,
        email: email
      });
      
      console.log('\n🎉 Usuário promovido com sucesso!');
      console.log('✅ Agora você tem privilégios de system_admin');
      console.log('🔄 Faça logout e login novamente para aplicar as mudanças');
      
    } catch (error) {
      console.error('\n❌ Erro ao promover usuário:', error.message);
      throw error;
    }
  }

  async showInstructions() {
    console.log(`
🚀 Admin Promoter - Curva Mestra

Para tornar sua conta um system_admin, você tem algumas opções:

📋 === OPÇÕES DISPONÍVEIS ===

1️⃣ **Se você JÁ TEM uma conta no sistema:**
   node makeUserAdmin.js promote <seu-uid> <seu-email>
   
   Exemplo:
   node makeUserAdmin.js promote abc123def456 usuario@exemplo.com

2️⃣ **Se você NÃO TEM uma conta ainda:**
   - Acesse: https://curva-mestra.web.app
   - Registre-se com seu email
   - Anote seu UID (aparece no console do navegador)
   - Execute: node makeUserAdmin.js promote <seu-uid> <seu-email>

3️⃣ **Inicializar apenas o sistema:**
   node makeUserAdmin.js init

🔍 === COMO DESCOBRIR SEU UID ===

1. Acesse: https://curva-mestra.web.app
2. Abra o Console do Navegador (F12)
3. Faça login
4. No console, digite: firebase.auth().currentUser.uid
5. Copie o UID que aparecer

📧 === USUÁRIOS ATUAIS NO SISTEMA ===

Atualmente existe apenas 1 usuário:
- Email: scandelari.guilherme@hotmail.com
- UID: gEjUSOsHF9QmS0Dvi0zB10GsxrD2
- Status: Admin Padrão ✅

💡 === DICA RÁPIDA ===

Se você é o Guilherme (scandelari.guilherme@hotmail.com), 
sua conta JÁ É system_admin! 

Verifique fazendo login em: https://curva-mestra.web.app
    `);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const uid = args[1];
  const email = args[2];
  
  const promoter = new SimpleAdminPromoter();
  
  try {
    switch (command) {
      case 'promote':
        if (!uid || !email) {
          console.error('❌ UID e email são obrigatórios');
          console.log('💡 Uso: node makeUserAdmin.js promote <uid> <email>');
          process.exit(1);
        }
        await promoter.promoteExistingUser(uid, email);
        break;
        
      case 'init':
        await promoter.initializeSystem();
        break;
        
      case 'create':
        if (!email) {
          console.error('❌ Email é obrigatório');
          console.log('💡 Uso: node makeUserAdmin.js create <email>');
          process.exit(1);
        }
        await promoter.createUserAndPromote(email);
        break;
        
      default:
        await promoter.showInstructions();
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

module.exports = SimpleAdminPromoter;