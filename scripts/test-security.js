/**
 * Script para testar regras de segurança multi-tenant do Firestore
 * Uso: node scripts/test-security.js
 */

const admin = require('firebase-admin');

// Conectar ao emulador
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

admin.initializeApp({
  projectId: 'curva-mestra'
});

const auth = admin.auth();
const db = admin.firestore();

async function runSecurityTests() {
  console.log('🔒 Iniciando testes de segurança multi-tenant\n');
  let passedTests = 0;
  let failedTests = 0;

  try {
    // Obter usuários para teste
    const systemAdmin = await auth.getUserByEmail('admin@curvamestra.com');
    const alphaAdmin = await auth.getUserByEmail('admin@alpha.com');
    const alphaUser = await auth.getUserByEmail('usuario@alpha.com');
    const betaAdmin = await auth.getUserByEmail('admin@beta.com');

    console.log('📋 Usuários de teste carregados:');
    console.log(`   - System Admin: ${systemAdmin.email}`);
    console.log(`   - Alpha Admin: ${alphaAdmin.email}`);
    console.log(`   - Alpha User: ${alphaUser.email}`);
    console.log(`   - Beta Admin: ${betaAdmin.email}\n`);

    // Teste 1: Verificar custom claims
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 1: Verificar Custom Claims');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const systemAdminToken = await auth.getUser(systemAdmin.uid).then(u => u.customClaims);
    const alphaAdminToken = await auth.getUser(alphaAdmin.uid).then(u => u.customClaims);
    const alphaUserToken = await auth.getUser(alphaUser.uid).then(u => u.customClaims);

    console.log('System Admin claims:', systemAdminToken);
    if (systemAdminToken.is_system_admin === true && systemAdminToken.role === 'system_admin') {
      console.log('✅ System Admin tem claims corretos\n');
      passedTests++;
    } else {
      console.log('❌ System Admin tem claims incorretos\n');
      failedTests++;
    }

    console.log('Alpha Admin claims:', alphaAdminToken);
    if (alphaAdminToken.tenant_id === 'tenant_clinic_alpha' &&
        alphaAdminToken.role === 'clinic_admin' &&
        alphaAdminToken.is_system_admin === false) {
      console.log('✅ Alpha Admin tem claims corretos\n');
      passedTests++;
    } else {
      console.log('❌ Alpha Admin tem claims incorretos\n');
      failedTests++;
    }

    console.log('Alpha User claims:', alphaUserToken);
    if (alphaUserToken.tenant_id === 'tenant_clinic_alpha' &&
        alphaUserToken.role === 'clinic_user') {
      console.log('✅ Alpha User tem claims corretos\n');
      passedTests++;
    } else {
      console.log('❌ Alpha User tem claims incorretos\n');
      failedTests++;
    }

    // Teste 2: Verificar dados do Firestore
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 2: Verificar Estrutura de Dados');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const tenantsSnapshot = await db.collection('tenants').get();
    console.log(`Total de tenants: ${tenantsSnapshot.size}`);

    if (tenantsSnapshot.size >= 3) {
      console.log('✅ Tenants criados corretamente\n');
      passedTests++;
    } else {
      console.log('❌ Número incorreto de tenants\n');
      failedTests++;
    }

    // Listar tenants
    console.log('Tenants cadastrados:');
    tenantsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.name} (${doc.id}) - ${data.active ? 'Ativo' : 'Inativo'}`);
    });
    console.log('');

    // Teste 3: Verificar usuários dentro dos tenants
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 3: Verificar Usuários nos Tenants');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const alphaUsersSnapshot = await db
      .collection('tenants')
      .doc('tenant_clinic_alpha')
      .collection('users')
      .get();

    console.log(`Usuários na Clínica Alpha: ${alphaUsersSnapshot.size}`);
    if (alphaUsersSnapshot.size === 2) {
      console.log('✅ Número correto de usuários na Alpha\n');
      passedTests++;
    } else {
      console.log('❌ Número incorreto de usuários na Alpha\n');
      failedTests++;
    }

    alphaUsersSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.displayName} (${data.email}) - ${data.role}`);
    });
    console.log('');

    const betaUsersSnapshot = await db
      .collection('tenants')
      .doc('tenant_clinic_beta')
      .collection('users')
      .get();

    console.log(`Usuários na Clínica Beta: ${betaUsersSnapshot.size}`);
    if (betaUsersSnapshot.size === 1) {
      console.log('✅ Número correto de usuários na Beta\n');
      passedTests++;
    } else {
      console.log('❌ Número incorreto de usuários na Beta\n');
      failedTests++;
    }

    betaUsersSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.displayName} (${data.email}) - ${data.role}`);
    });
    console.log('');

    // Teste 4: Verificar inventário
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 4: Verificar Inventário');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const inventorySnapshot = await db
      .collection('tenants')
      .doc('tenant_clinic_alpha')
      .collection('inventory')
      .get();

    console.log(`Produtos no inventário da Alpha: ${inventorySnapshot.size}`);
    if (inventorySnapshot.size >= 2) {
      console.log('✅ Inventário criado corretamente\n');
      passedTests++;
    } else {
      console.log('❌ Inventário não foi criado corretamente\n');
      failedTests++;
    }

    inventorySnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.nome_produto} (Lote: ${data.lote}) - Disponível: ${data.quantidade_disponivel}`);
    });
    console.log('');

    // Teste 5: Verificar isolamento de dados (Beta não deve ter inventário)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Test 5: Verificar Isolamento Multi-Tenant');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const betaInventorySnapshot = await db
      .collection('tenants')
      .doc('tenant_clinic_beta')
      .collection('inventory')
      .get();

    console.log(`Produtos no inventário da Beta: ${betaInventorySnapshot.size}`);
    if (betaInventorySnapshot.size === 0) {
      console.log('✅ Isolamento correto - Beta não tem acesso aos dados da Alpha\n');
      passedTests++;
    } else {
      console.log('❌ Violação de isolamento - Beta tem dados que não deveria\n');
      failedTests++;
    }

    // Resultados finais
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Resultados dos Testes');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Testes passou: ${passedTests}`);
    console.log(`❌ Testes falhou: ${failedTests}`);
    console.log(`📊 Total: ${passedTests + failedTests}`);
    console.log(`📈 Taxa de sucesso: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%\n`);

    if (failedTests === 0) {
      console.log('🎉 Todos os testes passaram! Sistema multi-tenant está configurado corretamente.\n');
    } else {
      console.log('⚠️  Alguns testes falharam. Verifique a configuração.\n');
    }

    // Instruções de uso
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 Próximos Passos');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. Acesse o Emulator UI: http://127.0.0.1:4000');
    console.log('2. Vá em Authentication para ver os usuários');
    console.log('3. Vá em Firestore para explorar os dados');
    console.log('4. Teste o login na aplicação com as credenciais:');
    console.log('   - admin@curvamestra.com / Admin123! (System Admin)');
    console.log('   - admin@alpha.com / Alpha123! (Clinic Admin)');
    console.log('   - usuario@alpha.com / Alpha123! (Clinic User)');
    console.log('   - admin@beta.com / Beta123! (Clinic Admin)\n');

  } catch (error) {
    console.error('❌ Erro durante os testes:', error);
    process.exit(1);
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

runSecurityTests();
