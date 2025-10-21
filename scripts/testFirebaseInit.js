#!/usr/bin/env node

/**
 * Test Firebase Initialization
 * 
 * This script tests Firebase configuration and initialization
 */

const fs = require('fs');
const path = require('path');

console.log('🔥 Teste de Inicialização do Firebase\n');

// Read .env file
const envPath = path.join(__dirname, '../frontend/.env');
if (!fs.existsSync(envPath)) {
  console.log('❌ Arquivo .env não encontrado');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  if (line.includes('=') && !line.startsWith('#')) {
    const [key, value] = line.split('=');
    envVars[key.trim()] = value.trim();
  }
});

console.log('📋 Configurações Firebase encontradas:');
console.log('');

const firebaseVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

let hasIssues = false;

firebaseVars.forEach(varName => {
  const value = envVars[varName];
  if (value) {
    // Mask sensitive values
    let displayValue = value;
    if (varName === 'VITE_FIREBASE_API_KEY') {
      displayValue = value.substring(0, 10) + '...' + value.substring(value.length - 4);
    }
    
    // Check for placeholder values
    if (value.includes('your-') || value.includes('example') || value.includes('placeholder')) {
      console.log(`❌ ${varName}: ${displayValue} (PLACEHOLDER - PRECISA SER CORRIGIDO)`);
      hasIssues = true;
    } else {
      console.log(`✅ ${varName}: ${displayValue}`);
    }
  } else {
    console.log(`❌ ${varName}: NÃO DEFINIDO`);
    hasIssues = true;
  }
});

console.log('');

if (hasIssues) {
  console.log('🚨 PROBLEMAS ENCONTRADOS:');
  console.log('');
  console.log('1. Valores placeholder detectados');
  console.log('2. Variáveis não definidas');
  console.log('');
  console.log('💡 COMO CORRIGIR:');
  console.log('');
  console.log('1. Acesse o Firebase Console:');
  console.log('   https://console.firebase.google.com/project/curva-mestra');
  console.log('');
  console.log('2. Vá em Project Settings (ícone de engrenagem)');
  console.log('');
  console.log('3. Na aba "General", role até "Your apps"');
  console.log('');
  console.log('4. Clique no app web ou crie um novo');
  console.log('');
  console.log('5. Copie a configuração Firebase:');
  console.log('   const firebaseConfig = {');
  console.log('     apiKey: "...",');
  console.log('     authDomain: "...",');
  console.log('     projectId: "...",');
  console.log('     storageBucket: "...",');
  console.log('     messagingSenderId: "...",');
  console.log('     appId: "..."');
  console.log('   };');
  console.log('');
  console.log('6. Atualize o arquivo frontend/.env com os valores corretos');
  console.log('');
} else {
  console.log('✅ Todas as configurações Firebase estão presentes');
}

console.log('🔍 TESTE DE CONECTIVIDADE:');
console.log('');

// Test Firebase connectivity
const https = require('https');

const testFirebaseConnectivity = () => {
  return new Promise((resolve) => {
    const req = https.request('https://firebase.googleapis.com/', { method: 'HEAD' }, (res) => {
      resolve({ success: true, status: res.statusCode });
    });
    
    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });
    
    req.setTimeout(5000, () => {
      resolve({ success: false, error: 'Timeout' });
    });
    
    req.end();
  });
};

testFirebaseConnectivity().then(result => {
  if (result.success) {
    console.log('✅ Conectividade com Firebase: OK');
  } else {
    console.log(`❌ Conectividade com Firebase: ${result.error}`);
  }
  
  console.log('');
  console.log('📊 RESUMO:');
  console.log('');
  
  if (hasIssues) {
    console.log('❌ Configuração Firebase: PROBLEMAS ENCONTRADOS');
    console.log('🔧 Ação necessária: Corrigir configurações no .env');
  } else {
    console.log('✅ Configuração Firebase: OK');
  }
  
  console.log('');
  console.log('🎯 PRÓXIMOS PASSOS:');
  console.log('');
  console.log('1. Corrigir configurações se necessário');
  console.log('2. Reiniciar servidor de desenvolvimento');
  console.log('3. Testar login na aplicação');
  console.log('4. Verificar console do navegador para erros');
  console.log('');
  console.log('🌐 Aplicação: http://localhost:3000');
});