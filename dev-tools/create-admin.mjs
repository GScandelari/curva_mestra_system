import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

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
const functions = getFunctions(app);

// Conectar aos emuladores
connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
connectFunctionsEmulator(functions, "localhost", 5001);

async function createSystemAdmin() {
  try {
    console.log('🔧 Criando System Admin...\n');

    const setupSystemAdmin = httpsCallable(functions, 'setupSystemAdmin');

    const result = await setupSystemAdmin({
      email: 'admin@curva-mestra.dev',
      password: 'admin123',
      displayName: 'System Admin'
    });

    console.log('✅ System Admin criado com sucesso!\n');
    console.log('📋 Detalhes:');
    console.log('   User ID:', result.data.userId);
    console.log('   Email:', result.data.email);
    console.log('   Nome: System Admin');
    console.log('\n🔑 Credenciais de Login:');
    console.log('   Email: admin@curva-mestra.dev');
    console.log('   Senha: admin123');
    console.log('\n🌐 Acesse: http://localhost:3000/login');
    console.log('\n✨ Custom Claims aplicados:');
    console.log('   - is_system_admin: true');
    console.log('   - role: system_admin');
    console.log('   - active: true');

  } catch (error) {
    console.error('❌ Erro ao criar system admin:', error.message);
    if (error.code) {
      console.error('   Código:', error.code);
    }
    if (error.details) {
      console.error('   Detalhes:', error.details);
    }
  }
}

createSystemAdmin();
