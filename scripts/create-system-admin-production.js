/**
 * Script para criar APENAS o system_admin em PRODUÇÃO
 *
 * IMPORTANTE: Este script cria o usuário diretamente no Firebase Authentication de produção
 *
 * Uso: node scripts/create-system-admin-production.js
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin para PRODUÇÃO
// NÃO configurar emuladores aqui!
admin.initializeApp({
  projectId: 'curva-mestra',
});

const auth = admin.auth();

async function createSystemAdmin() {
  try {
    console.log('🚀 Criando System Admin em PRODUÇÃO...\n');
    console.log('⚠️  ATENÇÃO: Este script vai criar o usuário no Firebase de PRODUÇÃO!\n');

    // Dados do system_admin
    const adminEmail = 'scandelari.guilherme@curvamestra.com.br';
    const adminPassword = 'Admin@123';
    const adminName = 'Guilherme Scandelari';

    // Verificar se já existe
    let systemAdmin;
    try {
      systemAdmin = await auth.getUserByEmail(adminEmail);
      console.log('ℹ️  Usuário já existe no Authentication');
      console.log('   UID:', systemAdmin.uid);
      console.log('   Email:', systemAdmin.email);
      console.log('\n🔄 Atualizando custom claims...');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Criar novo usuário
        console.log('1️⃣ Criando usuário no Firebase Authentication...');
        systemAdmin = await auth.createUser({
          email: adminEmail,
          password: adminPassword,
          displayName: adminName,
          emailVerified: true,
        });
        console.log('   ✓ Usuário criado com sucesso!');
        console.log('   UID:', systemAdmin.uid);
        console.log('   Email:', systemAdmin.email);
      } else {
        throw error;
      }
    }

    // Configurar custom claims
    console.log('\n2️⃣ Configurando custom claims...');
    await auth.setCustomUserClaims(systemAdmin.uid, {
      is_system_admin: true,
      role: 'system_admin',
      active: true,
    });
    console.log('   ✓ Custom claims configurados');

    // Resumo
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SYSTEM ADMIN CRIADO COM SUCESSO!\n');
    console.log('👑 CREDENCIAIS DO SYSTEM ADMIN:\n');
    console.log('   Email: ' + adminEmail);
    console.log('   Senha: ' + adminPassword);
    console.log('   UID: ' + systemAdmin.uid);
    console.log('   Nome: ' + adminName);
    console.log('\n📋 CUSTOM CLAIMS:');
    console.log('   is_system_admin: true');
    console.log('   role: system_admin');
    console.log('   active: true');
    console.log('\n🌐 Acesse: https://curva-mestra.web.app/login');
    console.log('🔧 Firebase Console: https://console.firebase.google.com/project/curva-mestra/authentication/users');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('⚠️  IMPORTANTE:');
    console.log('   1. Salve estas credenciais em local seguro');
    console.log('   2. Recomendado alterar a senha após primeiro login');
    console.log('   3. Usuário tem acesso TOTAL ao sistema');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao criar system admin:', error.message);
    console.error('\nDetalhes:', error);

    if (error.code === 'auth/project-not-found') {
      console.error('\n💡 Solução: Configure as credenciais do Firebase Admin SDK');
      console.error('   Execute: export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"');
    }

    process.exit(1);
  }
}

// Executar
console.log('════════════════════════════════════════════════');
console.log('  CRIAR SYSTEM ADMIN - FIREBASE PRODUÇÃO');
console.log('  Projeto: curva-mestra');
console.log('════════════════════════════════════════════════\n');

createSystemAdmin();
