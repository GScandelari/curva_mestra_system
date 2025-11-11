import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

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

// Conectar ao emulador
connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });

async function createSystemAdmin() {
  try {
    console.log('\n🔧 Criando usuário System Admin...\n');

    // Criar usuário no Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      'admin@curva-mestra.dev',
      'admin123'
    );

    const user = userCredential.user;

    // Atualizar perfil
    await updateProfile(user, {
      displayName: 'System Admin'
    });

    console.log('✅ Usuário criado com sucesso!\n');
    console.log('📋 Detalhes:');
    console.log('   User ID (UID):', user.uid);
    console.log('   Email:', user.email);
    console.log('   Nome:', user.displayName);
    console.log('\n🔑 Credenciais de Login:');
    console.log('   Email: admin@curva-mestra.dev');
    console.log('   Senha: admin123');

    console.log('\n⚠️  PRÓXIMO PASSO:');
    console.log('   Configure as custom claims no Firebase Emulator UI:');
    console.log('   1. Acesse: http://127.0.0.1:4000/auth');
    console.log('   2. Encontre o usuário com UID:', user.uid);
    console.log('   3. Clique no UID para abrir os detalhes');
    console.log('   4. Na aba "Custom Claims", adicione:\n');
    console.log('   {');
    console.log('     "is_system_admin": true,');
    console.log('     "role": "system_admin",');
    console.log('     "active": true');
    console.log('   }\n');
    console.log('   5. Salve as alterações');
    console.log('\n🌐 Depois, faça login em: http://localhost:3000/login');

    process.exit(0);

  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.error('\n❌ Erro: Este email já está em uso!');
      console.log('\n💡 Soluções:');
      console.log('   1. Acesse http://127.0.0.1:4000/auth');
      console.log('   2. Encontre o usuário admin@curva-mestra.dev');
      console.log('   3. Configure as custom claims manualmente (veja instruções acima)');
      console.log('   OU');
      console.log('   4. Delete o usuário existente e tente novamente');
    } else {
      console.error('\n❌ Erro ao criar usuário:', error.message);
      if (error.code) {
        console.error('   Código:', error.code);
      }
    }
    process.exit(1);
  }
}

createSystemAdmin();
