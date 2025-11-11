import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import readline from 'readline';

// Configuração Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBtP7vZ8L2nQXxK9mY3J5eR6wH8lN4pT0a",
  authDomain: "curva-mestra.firebaseapp.com",
  projectId: "curva-mestra",
  storageBucket: "curva-mestra.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Conectar aos emuladores
connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
connectFirestoreEmulator(db, "localhost", 8080);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupTenantAndUser() {
  try {
    console.log('\n🏥 Setup de Tenant e Usuário\n');
    console.log('═'.repeat(60));

    // Passo 1: Criar Tenant
    console.log('\n📋 PASSO 1: Criar Tenant (Clínica)');
    console.log('─'.repeat(60));

    const tenantName = await question('Nome da Clínica: ');
    const tenantCnpj = await question('CNPJ: ');
    const tenantEmail = await question('Email da Clínica: ');

    const tenantId = `tenant_${Date.now()}`;

    console.log('\n⏳ Criando tenant no Firestore...');

    await setDoc(doc(db, 'tenants', tenantId), {
      id: tenantId,
      name: tenantName,
      cnpj: tenantCnpj,
      email: tenantEmail,
      plan_id: 'basic',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      active: true
    });

    console.log('✅ Tenant criado com sucesso!');
    console.log('   Tenant ID:', tenantId);

    // Passo 2: Obter UID do usuário
    console.log('\n📋 PASSO 2: Configurar Usuário');
    console.log('─'.repeat(60));
    console.log('\n💡 Você precisa do UID do usuário.');
    console.log('   Para obter o UID:');
    console.log('   1. Acesse: http://127.0.0.1:4000/auth');
    console.log('   2. Procure por: clinica@clinicaabc.com.br');
    console.log('   3. Copie o UID (primeira coluna)\n');

    const userId = await question('Cole o UID do usuário aqui: ');

    if (!userId || userId.trim() === '') {
      console.log('\n❌ UID inválido. Abortando...');
      rl.close();
      process.exit(1);
    }

    console.log('\n⏳ Configurando usuário no Firestore...');

    // Criar documento do usuário no tenant
    await setDoc(doc(db, 'tenants', tenantId, 'users', userId), {
      uid: userId,
      tenant_id: tenantId,
      role: 'admin',
      active: true,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });

    console.log('✅ Usuário configurado no Firestore!');

    // Passo 3: Instruções para Custom Claims
    console.log('\n📋 PASSO 3: Configurar Custom Claims');
    console.log('─'.repeat(60));
    console.log('\n⚠️  IMPORTANTE: Configure as custom claims manualmente:');
    console.log('   1. Acesse: http://127.0.0.1:4000/auth');
    console.log('   2. Encontre o usuário com UID:', userId);
    console.log('   3. Clique no UID para abrir os detalhes');
    console.log('   4. Na seção "Custom Claims", adicione:\n');
    console.log('   {');
    console.log('     "tenant_id": "' + tenantId + '",');
    console.log('     "role": "admin",');
    console.log('     "is_system_admin": false,');
    console.log('     "active": true');
    console.log('   }\n');
    console.log('   5. Salve as alterações');

    console.log('\n═'.repeat(60));
    console.log('✅ SETUP COMPLETO!');
    console.log('═'.repeat(60));
    console.log('\n📊 Resumo:');
    console.log('   Tenant ID:', tenantId);
    console.log('   Nome:', tenantName);
    console.log('   User ID:', userId);
    console.log('   Role: admin');
    console.log('\n🌐 Próximos passos:');
    console.log('   1. Configure as custom claims (instruções acima)');
    console.log('   2. Faça logout do usuário (se estiver logado)');
    console.log('   3. Faça login novamente em: http://localhost:3000/login');
    console.log('   4. Email: clinica@clinicaabc.com.br');
    console.log('\n');

    rl.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    rl.close();
    process.exit(1);
  }
}

setupTenantAndUser();
