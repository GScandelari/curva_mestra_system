/**
 * Script para tornar um usuário admin
 * Execute este script para definir seu usuário como administrador
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'curva-mestra'
  });
}

async function makeUserAdmin(email) {
  try {
    console.log(`🔍 Procurando usuário com email: ${email}`);
    
    // Buscar usuário pelo email
    const user = await admin.auth().getUserByEmail(email);
    console.log(`✅ Usuário encontrado: ${user.uid}`);
    
    // Definir custom claims para admin
    const customClaims = {
      role: 'admin',
      isAdmin: true,
      clinicId: 'default-clinic',
      permissions: [
        'view_products', 'manage_products', 'view_requests', 'approve_requests',
        'view_patients', 'manage_patients', 'view_invoices', 'manage_invoices',
        'view_reports', 'manage_users', 'view_analytics', 'manage_settings'
      ]
    };
    
    // Aplicar custom claims
    await admin.auth().setCustomUserClaims(user.uid, customClaims);
    console.log(`🎉 Custom claims aplicados com sucesso!`);
    
    // Atualizar display name
    await admin.auth().updateUser(user.uid, {
      displayName: 'Administrator'
    });
    console.log(`📝 Display name atualizado para 'Administrator'`);
    
    // Verificar se foi aplicado corretamente
    const updatedUser = await admin.auth().getUser(user.uid);
    console.log(`\n✅ SUCESSO! Usuário agora é admin:`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   UID: ${updatedUser.uid}`);
    console.log(`   Role: ${updatedUser.customClaims?.role}`);
    console.log(`   Is Admin: ${updatedUser.customClaims?.isAdmin}`);
    console.log(`   Clinic ID: ${updatedUser.customClaims?.clinicId}`);
    
    console.log(`\n🔄 IMPORTANTE: Faça logout e login novamente para aplicar as mudanças!`);
    
  } catch (error) {
    console.error('❌ Erro ao tornar usuário admin:', error.message);
    
    if (error.code === 'auth/user-not-found') {
      console.log('💡 Certifique-se de que o email está correto e o usuário existe no Firebase Authentication');
    }
  }
}

// Obter email dos argumentos da linha de comando
const email = process.argv[2];

if (!email) {
  console.log('❌ Por favor, forneça o email do usuário:');
  console.log('   node scripts/make-admin.js seu-email@exemplo.com');
  process.exit(1);
}

// Executar
makeUserAdmin(email)
  .then(() => {
    console.log('\n🎯 Script concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });