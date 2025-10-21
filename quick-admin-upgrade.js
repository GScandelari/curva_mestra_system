/**
 * Script rápido para upgrade usando Firebase CLI
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 UPGRADE RÁPIDO PARA ADMIN');
console.log('👤 Email: scandelari.guilherme@hotmail.com');
console.log('🆔 UID: 0vdFsTyia3di70080j9KG1vccLN2');

try {
  // Criar script Node.js simples que será executado
  const upgradeScript = `
const admin = require('firebase-admin');

// Tentar inicializar com diferentes métodos
let app;
try {
  app = admin.initializeApp({
    projectId: 'curva-mestra'
  });
} catch (e) {
  console.log('Tentando método alternativo...');
  try {
    app = admin.initializeApp();
  } catch (e2) {
    console.error('Erro na inicialização:', e2.message);
    process.exit(1);
  }
}

const targetUid = '0vdFsTyia3di70080j9KG1vccLN2';
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

console.log('🔧 Aplicando custom claims...');

admin.auth().setCustomUserClaims(targetUid, adminClaims)
  .then(() => {
    console.log('✅ Custom claims aplicados!');
    return admin.auth().getUser(targetUid);
  })
  .then(user => {
    console.log('🎉 UPGRADE REALIZADO COM SUCESSO!');
    console.log('📧 Email:', user.email);
    console.log('🔑 Role:', user.customClaims?.role);
    console.log('👑 Is Admin:', user.customClaims?.isAdmin);
    console.log('🏥 Clinic ID:', user.customClaims?.clinicId);
    console.log('📊 Permissões:', user.customClaims?.permissions?.length || 0);
    console.log('');
    console.log('🔄 PRÓXIMOS PASSOS:');
    console.log('1. 🚪 Faça LOGOUT do sistema');
    console.log('2. 🔑 Faça LOGIN novamente');
    console.log('3. 🌐 Acesse: https://curva-mestra.web.app');
    console.log('4. ✅ Verifique acesso de Admin!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro:', error.message);
    
    if (error.message.includes('credentials')) {
      console.log('');
      console.log('🔑 PROBLEMA DE CREDENCIAIS');
      console.log('📋 SOLUÇÕES:');
      console.log('');
      console.log('1️⃣ GOOGLE CLOUD CLI:');
      console.log('   - Instale: https://cloud.google.com/sdk/docs/install-windows');
      console.log('   - Execute: gcloud auth application-default login');
      console.log('   - Execute: node quick-admin-upgrade.js');
      console.log('');
      console.log('2️⃣ SERVICE ACCOUNT:');
      console.log('   - Acesse: https://console.cloud.google.com/iam-admin/serviceaccounts?project=curva-mestra');
      console.log('   - Baixe a chave JSON do Firebase Admin SDK');
      console.log('   - set GOOGLE_APPLICATION_CREDENTIALS=caminho\\\\para\\\\chave.json');
      console.log('   - node quick-admin-upgrade.js');
      console.log('');
      console.log('3️⃣ MANUAL (MAIS RÁPIDO):');
      console.log('   - Acesse: https://console.firebase.google.com/project/curva-mestra');
      console.log('   - Authentication → Users → scandelari.guilherme@hotmail.com');
      console.log('   - Se não houver "Custom Claims", use uma das opções acima');
    }
    
    process.exit(1);
  });
`;

  // Escrever script temporário
  fs.writeFileSync('temp-quick-upgrade.js', upgradeScript);
  console.log('✅ Script temporário criado');

  // Tentar executar no contexto das functions
  console.log('🔧 Tentando executar no contexto das functions...');
  
  try {
    execSync('node temp-quick-upgrade.js', { 
      stdio: 'inherit',
      cwd: './functions'
    });
  } catch (error) {
    console.log('⚠️ Tentativa no diretório functions falhou');
    console.log('🔧 Tentando no diretório root...');
    
    execSync('node temp-quick-upgrade.js', { 
      stdio: 'inherit',
      cwd: '.'
    });
  }

} catch (error) {
  console.error('❌ Erro no processo:', error.message);
  
  console.log('\\n📋 INSTRUÇÕES MANUAIS RÁPIDAS:');
  console.log('\\n🎯 OPÇÃO MAIS RÁPIDA - MANUAL:');
  console.log('1. Acesse: https://console.firebase.google.com/project/curva-mestra');
  console.log('2. Authentication → Users');
  console.log('3. Encontre: scandelari.guilherme@hotmail.com');
  console.log('4. Clique no usuário');
  console.log('5. Se houver "Custom Claims", adicione:');
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
  
} finally {
  // Limpar arquivo temporário
  if (fs.existsSync('temp-quick-upgrade.js')) {
    fs.unlinkSync('temp-quick-upgrade.js');
  }
}