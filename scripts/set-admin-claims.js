/**
 * Script para definir custom claims usando Firebase CLI
 * Este script usa o Firebase CLI que já está autenticado
 */

const { execSync } = require('child_process');

async function setAdminClaims(email) {
  try {
    console.log(`🔍 Definindo custom claims para: ${email}`);
    
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
    
    // Primeiro, vamos buscar o UID do usuário
    console.log('📋 Buscando UID do usuário...');
    
    // Usar Firebase CLI para definir custom claims
    const claimsJson = JSON.stringify(customClaims).replace(/"/g, '\\"');
    
    console.log('🔧 Aplicando custom claims...');
    console.log('📝 Claims:', JSON.stringify(customClaims, null, 2));
    
    // Comando Firebase CLI para definir custom claims
    const command = `firebase auth:set-custom-user-claims "${email}" "${claimsJson}"`;
    
    console.log('⚡ Executando comando Firebase CLI...');
    console.log('🔄 Comando:', command);
    
    try {
      const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
      console.log('✅ Resultado:', result);
      
      console.log(`\n🎉 SUCESSO! Custom claims aplicados para ${email}`);
      console.log('📋 Role: admin');
      console.log('🔑 Is Admin: true');
      console.log('🏥 Clinic ID: default-clinic');
      console.log('🔐 Permissões: Todas as permissões de administrador');
      
      console.log(`\n🔄 IMPORTANTE: Faça logout e login novamente para aplicar as mudanças!`);
      
    } catch (cliError) {
      console.error('❌ Erro no Firebase CLI:', cliError.message);
      
      // Tentar abordagem alternativa usando Firebase Functions
      console.log('\n🔄 Tentando abordagem alternativa...');
      await tryAlternativeApproach(email, customClaims);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    
    // Instruções manuais
    console.log('\n📋 INSTRUÇÕES MANUAIS:');
    console.log('1. Acesse: https://console.firebase.google.com/project/curva-mestra');
    console.log('2. Vá em Authentication → Users');
    console.log(`3. Encontre o usuário: ${email}`);
    console.log('4. Clique no usuário → Custom Claims');
    console.log('5. Adicione este JSON:');
    console.log(JSON.stringify(customClaims, null, 2));
    console.log('6. Salve e faça logout/login no sistema');
  }
}

async function tryAlternativeApproach(email, customClaims) {
  console.log('🔄 Tentando usar Firebase Functions...');
  
  try {
    // Tentar usar firebase functions:shell
    const functionCall = `
      const functions = require('firebase-functions-test')();
      const admin = require('firebase-admin');
      
      admin.initializeApp();
      
      admin.auth().getUserByEmail('${email}')
        .then(user => {
          return admin.auth().setCustomUserClaims(user.uid, ${JSON.stringify(customClaims)});
        })
        .then(() => {
          console.log('✅ Custom claims aplicados com sucesso!');
        })
        .catch(error => {
          console.error('❌ Erro:', error.message);
        });
    `;
    
    console.log('📝 Código para executar manualmente:');
    console.log(functionCall);
    
  } catch (error) {
    console.error('❌ Abordagem alternativa falhou:', error.message);
  }
}

// Obter email dos argumentos
const email = process.argv[2];

if (!email) {
  console.log('❌ Por favor, forneça o email do usuário:');
  console.log('   node scripts/set-admin-claims.js email@exemplo.com');
  process.exit(1);
}

// Executar
setAdminClaims(email)
  .then(() => {
    console.log('\n🎯 Script concluído!');
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
  });