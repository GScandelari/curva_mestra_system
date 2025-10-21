/**
 * Script direto para definir admin usando Firebase Admin SDK
 */

const admin = require('firebase-admin');

// Inicializar com credenciais padrão do projeto
admin.initializeApp({
  projectId: 'curva-mestra'
});

async function makeAdmin(email) {
  try {
    console.log(`🔍 Procurando usuário: ${email}`);
    
    // Buscar usuário pelo email
    const user = await admin.auth().getUserByEmail(email);
    console.log(`✅ Usuário encontrado: ${user.uid}`);
    
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
    
    // Aplicar custom claims
    await admin.auth().setCustomUserClaims(user.uid, customClaims);
    console.log(`🎉 Custom claims aplicados com sucesso!`);
    
    // Verificar se foi aplicado
    const updatedUser = await admin.auth().getUser(user.uid);
    console.log(`\n✅ SUCESSO! Usuário agora é admin:`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   UID: ${updatedUser.uid}`);
    console.log(`   Role: ${updatedUser.customClaims?.role}`);
    console.log(`   Is Admin: ${updatedUser.customClaims?.isAdmin}`);
    console.log(`   Clinic ID: ${updatedUser.customClaims?.clinicId}`);
    
    console.log(`\n🔄 IMPORTANTE: Faça logout e login novamente no sistema!`);
    console.log(`🌐 Acesse: https://curva-mestra.web.app`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    
    if (error.code === 'auth/user-not-found') {
      console.log('💡 Usuário não encontrado. Verifique se o email está correto.');
    } else if (error.message.includes('credentials')) {
      console.log('🔑 Problema de credenciais. Vou tentar usar o Firebase CLI...');
      
      // Tentar via Firebase CLI
      const { execSync } = require('child_process');
      
      try {
        console.log('🔄 Tentando via Firebase CLI...');
        
        // Usar firebase functions:shell para executar código
        const code = `
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp();
}

admin.auth().getUserByEmail('${email}')
  .then(user => {
    const claims = ${JSON.stringify(customClaims)};
    return admin.auth().setCustomUserClaims(user.uid, claims);
  })
  .then(() => {
    console.log('✅ Claims aplicados via CLI!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erro CLI:', err.message);
    process.exit(1);
  });
        `;
        
        // Salvar código temporário
        require('fs').writeFileSync('temp-admin.js', code);
        
        // Executar com node
        execSync('node temp-admin.js', { stdio: 'inherit' });
        
        // Limpar arquivo temporário
        require('fs').unlinkSync('temp-admin.js');
        
        return true;
        
      } catch (cliError) {
        console.error('❌ Firebase CLI também falhou:', cliError.message);
        return false;
      }
    }
    
    return false;
  }
}

// Executar
const email = process.argv[2] || 'scandelari.guilherme@hotmail.com';

makeAdmin(email)
  .then(success => {
    if (success) {
      console.log('\n🎯 Processo concluído com sucesso!');
    } else {
      console.log('\n📋 INSTRUÇÕES MANUAIS:');
      console.log('1. Acesse: https://console.firebase.google.com/project/curva-mestra');
      console.log('2. Authentication → Users');
      console.log(`3. Encontre: ${email}`);
      console.log('4. Custom Claims → Adicione:');
      console.log(JSON.stringify({
        role: 'admin',
        isAdmin: true,
        clinicId: 'default-clinic',
        permissions: ['view_products', 'manage_products', 'view_requests', 'approve_requests', 'view_patients', 'manage_patients', 'view_invoices', 'manage_invoices', 'view_reports', 'manage_users', 'view_analytics', 'manage_settings']
      }, null, 2));
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });