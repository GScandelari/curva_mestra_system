/**
 * Script final para upgrade de admin - Versão mais robusta
 */

const admin = require('firebase-admin');

async function upgradeToAdmin() {
  const targetUid = '0vdFsTyia3di70080j9KG1vccLN2';
  const targetEmail = 'scandelari.guilherme@hotmail.com';

  // Custom claims para admin
  const adminClaims = {
    role: 'admin',
    isAdmin: true,
    clinicId: 'default-clinic',
    permissions: [
      'view_products', 'manage_products', 'view_requests', 'approve_requests',
      'view_patients', 'manage_patients', 'view_invoices', 'manage_invoices',
      'view_reports', 'manage_users', 'view_analytics', 'manage_settings'
    ]
  };

  console.log('🔄 UPGRADE FINAL: Recepcionista → Admin');
  console.log('👤 Email:', targetEmail);
  console.log('🆔 UID:', targetUid);

  // Tentar múltiplos métodos de inicialização
  const methods = [
    // Método 1: Credenciais padrão
    () => {
      console.log('🔄 Tentativa 1: Credenciais padrão...');
      return admin.initializeApp({
        projectId: 'curva-mestra'
      });
    },
    
    // Método 2: Apenas project ID
    () => {
      console.log('🔄 Tentativa 2: Apenas project ID...');
      if (admin.apps.length > 0) {
        admin.app().delete();
      }
      return admin.initializeApp({
        projectId: 'curva-mestra',
        credential: admin.credential.applicationDefault()
      });
    },
    
    // Método 3: Sem credenciais explícitas
    () => {
      console.log('🔄 Tentativa 3: Inicialização simples...');
      if (admin.apps.length > 0) {
        admin.app().delete();
      }
      return admin.initializeApp();
    }
  ];

  for (let i = 0; i < methods.length; i++) {
    try {
      // Tentar inicializar
      methods[i]();
      console.log(`✅ Método ${i + 1} funcionou!`);
      
      console.log('\n🔧 Aplicando custom claims...');
      
      // Tentar aplicar custom claims
      await admin.auth().setCustomUserClaims(targetUid, adminClaims);
      console.log('✅ Custom claims aplicados com sucesso!');

      // Verificar se foi aplicado
      const user = await admin.auth().getUser(targetUid);
      
      console.log('\n🎉 UPGRADE REALIZADO COM SUCESSO!');
      console.log('📧 Email:', user.email);
      console.log('🆔 UID:', user.uid);
      console.log('🔑 Role:', user.customClaims?.role);
      console.log('👑 Is Admin:', user.customClaims?.isAdmin);
      console.log('🏥 Clinic ID:', user.customClaims?.clinicId);
      console.log('📊 Permissões:', user.customClaims?.permissions?.length || 0);

      console.log('\n🔄 PRÓXIMOS PASSOS:');
      console.log('1. 🚪 Faça LOGOUT do sistema');
      console.log('2. 🔑 Faça LOGIN novamente');
      console.log('3. 🌐 Acesse: https://curva-mestra.web.app');
      console.log('4. ✅ Verifique acesso de Admin!');

      return true;

    } catch (error) {
      console.log(`❌ Método ${i + 1} falhou:`, error.message);
      
      // Se não é o último método, continuar tentando
      if (i < methods.length - 1) {
        console.log('🔄 Tentando próximo método...\n');
        continue;
      }
      
      // Se chegou aqui, todos os métodos falharam
      console.log('\n❌ Todos os métodos automáticos falharam');
      console.log('\n📋 SOLUÇÕES MANUAIS:');
      
      console.log('\n🔧 OPÇÃO 1 - Google Cloud CLI (Mais Confiável):');
      console.log('1. Instale: https://cloud.google.com/sdk/docs/install-windows');
      console.log('2. Execute: gcloud auth application-default login');
      console.log('3. Execute: node upgrade-final.js');
      
      console.log('\n🔧 OPÇÃO 2 - Service Account Key:');
      console.log('1. Acesse: https://console.cloud.google.com/iam-admin/serviceaccounts?project=curva-mestra');
      console.log('2. Baixe a chave JSON do Firebase Admin SDK');
      console.log('3. Execute: set GOOGLE_APPLICATION_CREDENTIALS=caminho\\para\\chave.json');
      console.log('4. Execute: node upgrade-final.js');
      
      console.log('\n🔧 OPÇÃO 3 - Firebase Console (Manual):');
      console.log('1. Acesse: https://console.firebase.google.com/project/curva-mestra');
      console.log('2. Authentication → Users');
      console.log('3. Encontre:', targetEmail);
      console.log('4. Se não houver opção "Custom Claims", use uma das opções acima');
      
      return false;
    }
  }
}

// Executar
console.log('🚀 Iniciando upgrade final para admin...');
console.log('🔧 Tentando múltiplos métodos de autenticação...\n');

upgradeToAdmin()
  .then(success => {
    if (success) {
      console.log('\n🎯 ✅ UPGRADE CONCLUÍDO COM SUCESSO!');
      console.log('🔄 Faça logout/login para aplicar as mudanças!');
    } else {
      console.log('\n📋 Use uma das soluções manuais listadas acima');
    }
  })
  .catch(error => {
    console.error('\n❌ Erro fatal:', error.message);
  })
  .finally(() => {
    process.exit(0);
  });