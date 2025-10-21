/**
 * Script para definir admin usando UID diretamente
 */

const admin = require('firebase-admin');

// Tentar diferentes métodos de inicialização
async function initializeFirebase() {
  try {
    // Método 1: Usar credenciais padrão
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'curva-mestra'
      });
    }
    return true;
  } catch (error) {
    console.log('⚠️ Método 1 falhou, tentando método 2...');
    
    try {
      // Método 2: Usar service account key se disponível
      const serviceAccount = require('../service-account-key.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'curva-mestra'
      });
      return true;
    } catch (error2) {
      console.log('⚠️ Método 2 falhou, tentando método 3...');
      
      try {
        // Método 3: Usar variáveis de ambiente
        admin.initializeApp({
          projectId: 'curva-mestra',
          credential: admin.credential.applicationDefault()
        });
        return true;
      } catch (error3) {
        return false;
      }
    }
  }
}

async function setAdminByUID(uid) {
  try {
    console.log(`🔍 Configurando admin para UID: ${uid}`);
    
    // Inicializar Firebase
    const initialized = await initializeFirebase();
    if (!initialized) {
      throw new Error('Não foi possível inicializar Firebase Admin SDK');
    }
    
    // Custom claims para admin
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
    
    console.log('🔧 Aplicando custom claims...');
    console.log('📋 Claims:', JSON.stringify(customClaims, null, 2));
    
    // Aplicar custom claims diretamente pelo UID
    await admin.auth().setCustomUserClaims(uid, customClaims);
    console.log('✅ Custom claims aplicados com sucesso!');
    
    // Verificar se foi aplicado
    const user = await admin.auth().getUser(uid);
    console.log(`\n🎉 SUCESSO! Usuário agora é admin:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   UID: ${user.uid}`);
    console.log(`   Role: ${user.customClaims?.role}`);
    console.log(`   Is Admin: ${user.customClaims?.isAdmin}`);
    console.log(`   Clinic ID: ${user.customClaims?.clinicId}`);
    console.log(`   Permissions: ${user.customClaims?.permissions?.length} permissões`);
    
    console.log(`\n🔄 IMPORTANTE: Faça logout e login novamente no sistema!`);
    console.log(`🌐 Acesse: https://curva-mestra.web.app`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    
    if (error.message.includes('credentials') || error.message.includes('authentication')) {
      console.log('\n🔑 PROBLEMA DE CREDENCIAIS DETECTADO');
      console.log('📋 SOLUÇÃO MANUAL:');
      console.log('1. Acesse: https://console.firebase.google.com/project/curva-mestra');
      console.log('2. Authentication → Users');
      console.log(`3. Encontre o usuário com UID: ${uid}`);
      console.log('4. Clique no usuário → Custom Claims');
      console.log('5. Adicione este JSON:');
      console.log(JSON.stringify({
        role: 'admin',
        isAdmin: true,
        clinicId: 'default-clinic',
        permissions: [
          'view_products', 'manage_products', 'view_requests', 'approve_requests',
          'view_patients', 'manage_patients', 'view_invoices', 'manage_invoices',
          'view_reports', 'manage_users', 'view_analytics', 'manage_settings'
        ]
      }, null, 2));
      console.log('6. Save → Logout/Login no sistema');
      
    } else if (error.code === 'auth/user-not-found') {
      console.log('💡 UID não encontrado. Verifique se está correto.');
    }
    
    return false;
  }
}

// Executar com o UID fornecido
const uid = process.argv[2] || '0vdFsTyia3di70080j9KG1vccLN2';

console.log('🚀 Iniciando processo de configuração admin...');
console.log(`🎯 UID alvo: ${uid}`);

setAdminByUID(uid)
  .then(success => {
    if (success) {
      console.log('\n🎯 ✅ PROCESSO CONCLUÍDO COM SUCESSO!');
      console.log('🔄 Próximos passos:');
      console.log('   1. Faça logout do sistema');
      console.log('   2. Faça login novamente');
      console.log('   3. Verifique se tem acesso de admin');
    } else {
      console.log('\n📋 Use as instruções manuais acima');
    }
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error.message);
  })
  .finally(() => {
    process.exit(0);
  });