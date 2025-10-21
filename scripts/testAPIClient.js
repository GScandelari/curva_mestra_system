#!/usr/bin/env node

const axios = require('axios');

/**
 * Script para testar a API Admin usando tokens de cliente
 * Este script mostra como usar a API sem precisar do Firebase Admin SDK
 */

const BASE_URL = 'https://us-central1-curva-mestra.cloudfunctions.net';
const ADMIN_UID = 'gEjUSOsHF9QmS0Dvi0zB10GsxrD2';

class APIClientTester {
  constructor(token = null) {
    this.token = token;
  }

  setToken(token) {
    this.token = token;
    console.log('🔑 Token configurado');
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
      return null;
    }
  }

  async testWithoutAuth() {
    console.log('\n🔓 === TESTES SEM AUTENTICAÇÃO ===');
    
    console.log('1️⃣ Testando validateAdminInitialization...');
    await this.callAPI('validateAdminInitialization', {}, false);
    
    console.log('\n2️⃣ Testando initializeDefaultAdmin...');
    await this.callAPI('initializeDefaultAdmin', {}, false);
  }

  async testWithAuth() {
    if (!this.token) {
      console.log('❌ Token não configurado. Use setToken() primeiro.');
      return;
    }

    console.log('\n🔐 === TESTES COM AUTENTICAÇÃO ===');
    
    console.log('1️⃣ Testando getUserRole...');
    await this.callAPI('getUserRole', {});
    
    console.log('\n2️⃣ Testando verifyAdminRole...');
    await this.callAPI('verifyAdminRole', {});
    
    console.log('\n3️⃣ Testando setAdminRole...');
    await this.callAPI('setAdminRole', { uid: ADMIN_UID });
  }

  generateCurlExamples(token = 'YOUR_FIREBASE_TOKEN_HERE') {
    console.log(`\n📋 === EXEMPLOS DE CURL ===`);
    
    console.log(`
🔐 Substitua YOUR_FIREBASE_TOKEN_HERE pelo seu token Firebase válido

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

📝 Como obter um token Firebase válido:

Método 1 - Console do Navegador:
1. Acesse https://curva-mestra.web.app
2. Faça login com sua conta
3. Abra o Console do Navegador (F12)
4. Execute:
   firebase.auth().currentUser.getIdToken().then(token => {
     console.log('Token:', token);
     navigator.clipboard.writeText(token);
   });

Método 2 - JavaScript/Frontend:
import { getAuth } from 'firebase/auth';
const auth = getAuth();
const user = auth.currentUser;
if (user) {
  user.getIdToken().then(token => console.log('Token:', token));
}

Método 3 - Firebase CLI:
firebase auth:print-users --project curva-mestra
    `);
  }

  showTokenInstructions() {
    console.log(`
🔑 === COMO OBTER UM TOKEN FIREBASE ===

Para testar os endpoints que requerem autenticação, você precisa de um token Firebase válido.

📱 Método Mais Fácil - Console do Navegador:
1. Acesse: https://curva-mestra.web.app
2. Faça login com uma conta válida
3. Abra o Console do Navegador (pressione F12)
4. Cole e execute este código:

firebase.auth().currentUser.getIdToken().then(token => {
  console.log('🔑 Seu token Firebase:');
  console.log(token);
  navigator.clipboard.writeText(token);
  alert('Token copiado para a área de transferência!');
});

5. Copie o token exibido no console
6. Use o token nos comandos curl ou configure com: node testAPIClient.js token SEU_TOKEN_AQUI

💻 Método Programático:
Se você tem um app Firebase configurado, use:

import { getAuth } from 'firebase/auth';
const auth = getAuth();
const user = auth.currentUser;
if (user) {
  const token = await user.getIdToken();
  console.log('Token:', token);
}

🔧 Testando com Token:
node testAPIClient.js token eyJhbGciOiJSUzI1NiIsImtpZCI6...
    `);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const token = args[1];
  
  const tester = new APIClientTester();
  
  try {
    switch (command) {
      case 'no-auth':
        await tester.testWithoutAuth();
        break;
        
      case 'token':
        if (!token) {
          console.log('❌ Token não fornecido. Use: node testAPIClient.js token SEU_TOKEN');
          return;
        }
        tester.setToken(token);
        await tester.testWithAuth();
        break;
        
      case 'curl':
        tester.generateCurlExamples(token);
        break;
        
      case 'help':
      case 'instructions':
        tester.showTokenInstructions();
        break;
        
      default:
        console.log(`
🧪 === TESTADOR DA API ADMIN ===

Comandos disponíveis:

🔓 Testar endpoints sem autenticação:
   node testAPIClient.js no-auth

🔐 Testar endpoints com autenticação:
   node testAPIClient.js token SEU_FIREBASE_TOKEN

📋 Gerar exemplos de curl:
   node testAPIClient.js curl [token]

❓ Ver instruções para obter token:
   node testAPIClient.js instructions

Exemplos:
   node testAPIClient.js no-auth
   node testAPIClient.js token eyJhbGciOiJSUzI1NiIsImtpZCI6...
   node testAPIClient.js curl
   node testAPIClient.js instructions
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

module.exports = APIClientTester;