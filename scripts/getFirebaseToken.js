#!/usr/bin/env node

const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');

/**
 * Script para obter token Firebase para testes da API
 * Gera um custom token que pode ser usado para autenticação
 */

// Inicializar Firebase Admin (usando as credenciais do projeto)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'curva-mestra'
  });
}

async function generateCustomToken(uid) {
  try {
    console.log(`🔑 Gerando token personalizado para UID: ${uid}`);
    
    // Verificar se o usuário existe
    const user = await getAuth().getUser(uid);
    console.log(`✅ Usuário encontrado: ${user.email}`);
    
    // Gerar custom token
    const customToken = await getAuth().createCustomToken(uid);
    console.log(`🎯 Token personalizado gerado com sucesso!`);
    console.log(`📋 Token: ${customToken}`);
    
    return customToken;
  } catch (error) {
    console.error('❌ Erro ao gerar token:', error.message);
    throw error;
  }
}

async function createTestUser(email, password = 'testpassword123') {
  try {
    console.log(`👤 Criando usuário de teste: ${email}`);
    
    const userRecord = await getAuth().createUser({
      email: email,
      password: password,
      displayName: 'Test User',
      emailVerified: true
    });
    
    console.log(`✅ Usuário criado com sucesso!`);
    console.log(`📋 UID: ${userRecord.uid}`);
    console.log(`📧 Email: ${userRecord.email}`);
    
    return userRecord;
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      console.log(`ℹ️  Usuário já existe: ${email}`);
      const user = await getAuth().getUserByEmail(email);
      return user;
    }
    console.error('❌ Erro ao criar usuário:', error.message);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'token':
        const uid = args[1] || 'gEjUSOsHF9QmS0Dvi0zB10GsxrD2';
        await generateCustomToken(uid);
        break;
        
      case 'create-test-user':
        const email = args[1] || 'test@curva-mestra.com';
        const user = await createTestUser(email);
        console.log(`\n🔑 Gerando token para o usuário criado...`);
        await generateCustomToken(user.uid);
        break;
        
      case 'admin-token':
        console.log('🔐 Gerando token para o admin padrão...');
        await generateCustomToken('gEjUSOsHF9QmS0Dvi0zB10GsxrD2');
        break;
        
      default:
        console.log(`
🚀 Firebase Token Generator

Comandos disponíveis:

📋 Gerar token para UID específico:
   node getFirebaseToken.js token <uid>

👤 Criar usuário de teste e gerar token:
   node getFirebaseToken.js create-test-user <email>

🔐 Gerar token para admin padrão:
   node getFirebaseToken.js admin-token

Exemplos:
   node getFirebaseToken.js admin-token
   node getFirebaseToken.js token gEjUSOsHF9QmS0Dvi0zB10GsxrD2
   node getFirebaseToken.js create-test-user test@example.com
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

module.exports = { generateCustomToken, createTestUser };