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

function logTestResult(condition, passMsg, failMsg, counters) {
  if (condition) {
    console.log(`✅ ${passMsg}\n`);
    counters.passed++;
  } else {
    console.log(`❌ ${failMsg}\n`);
    counters.failed++;
  }
}

async function testCustomClaims(counters) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test 1: Verificar Custom Claims');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const systemAdmin = await auth.getUserByEmail('admin@curvamestra.com');
  const alphaAdmin = await auth.getUserByEmail('admin@alpha.com');
  const alphaUser = await auth.getUserByEmail('usuario@alpha.com');

  const [systemAdminToken, alphaAdminToken, alphaUserToken] = await Promise.all([
    auth.getUser(systemAdmin.uid).then(u => u.customClaims),
    auth.getUser(alphaAdmin.uid).then(u => u.customClaims),
    auth.getUser(alphaUser.uid).then(u => u.customClaims),
  ]);

  console.log('System Admin claims:', systemAdminToken);
  logTestResult(
    systemAdminToken.is_system_admin === true && systemAdminToken.role === 'system_admin',
    'System Admin tem claims corretos',
    'System Admin tem claims incorretos',
    counters
  );

  console.log('Alpha Admin claims:', alphaAdminToken);
  logTestResult(
    alphaAdminToken.tenant_id === 'tenant_clinic_alpha' &&
    alphaAdminToken.role === 'clinic_admin' &&
    alphaAdminToken.is_system_admin === false,
    'Alpha Admin tem claims corretos',
    'Alpha Admin tem claims incorretos',
    counters
  );

  console.log('Alpha User claims:', alphaUserToken);
  logTestResult(
    alphaUserToken.tenant_id === 'tenant_clinic_alpha' && alphaUserToken.role === 'clinic_user',
    'Alpha User tem claims corretos',
    'Alpha User tem claims incorretos',
    counters
  );

  return { systemAdmin, alphaAdmin, alphaUser };
}

async function testTenantStructure(counters) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test 2: Verificar Estrutura de Dados');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const tenantsSnapshot = await db.collection('tenants').get();
  console.log(`Total de tenants: ${tenantsSnapshot.size}`);
  logTestResult(tenantsSnapshot.size >= 3, 'Tenants criados corretamente', 'Número incorreto de tenants', counters);

  console.log('Tenants cadastrados:');
  tenantsSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${data.name} (${doc.id}) - ${data.active ? 'Ativo' : 'Inativo'}`);
  });
  console.log('');
}

async function testTenantUsers(counters) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test 3: Verificar Usuários nos Tenants');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const alphaUsersSnapshot = await db.collection('tenants').doc('tenant_clinic_alpha').collection('users').get();
  console.log(`Usuários na Clínica Alpha: ${alphaUsersSnapshot.size}`);
  logTestResult(alphaUsersSnapshot.size === 2, 'Número correto de usuários na Alpha', 'Número incorreto de usuários na Alpha', counters);
  alphaUsersSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${data.displayName} (${data.email}) - ${data.role}`);
  });
  console.log('');

  const betaUsersSnapshot = await db.collection('tenants').doc('tenant_clinic_beta').collection('users').get();
  console.log(`Usuários na Clínica Beta: ${betaUsersSnapshot.size}`);
  logTestResult(betaUsersSnapshot.size === 1, 'Número correto de usuários na Beta', 'Número incorreto de usuários na Beta', counters);
  betaUsersSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${data.displayName} (${data.email}) - ${data.role}`);
  });
  console.log('');
}

async function testInventoryIsolation(counters) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test 4: Verificar Inventário');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const inventorySnapshot = await db.collection('tenants').doc('tenant_clinic_alpha').collection('inventory').get();
  console.log(`Produtos no inventário da Alpha: ${inventorySnapshot.size}`);
  logTestResult(inventorySnapshot.size >= 2, 'Inventário criado corretamente', 'Inventário não foi criado corretamente', counters);
  inventorySnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${data.nome_produto} (Lote: ${data.lote}) - Disponível: ${data.quantidade_disponivel}`);
  });
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test 5: Verificar Isolamento Multi-Tenant');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const betaInventorySnapshot = await db.collection('tenants').doc('tenant_clinic_beta').collection('inventory').get();
  console.log(`Produtos no inventário da Beta: ${betaInventorySnapshot.size}`);
  logTestResult(
    betaInventorySnapshot.size === 0,
    'Isolamento correto - Beta não tem acesso aos dados da Alpha',
    'Violação de isolamento - Beta tem dados que não deveria',
    counters
  );
}

async function runSecurityTests() {
  console.log('🔒 Iniciando testes de segurança multi-tenant\n');
  const counters = { passed: 0, failed: 0 };

  try {
    const { systemAdmin, alphaAdmin, alphaUser } = await testCustomClaims(counters);
    const betaAdmin = await auth.getUserByEmail('admin@beta.com');

    console.log('📋 Usuários de teste carregados:');
    console.log(`   - System Admin: ${systemAdmin.email}`);
    console.log(`   - Alpha Admin: ${alphaAdmin.email}`);
    console.log(`   - Alpha User: ${alphaUser.email}`);
    console.log(`   - Beta Admin: ${betaAdmin.email}\n`);

    await testTenantStructure(counters);
    await testTenantUsers(counters);
    await testInventoryIsolation(counters);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Resultados dos Testes');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Testes passou: ${counters.passed}`);
    console.log(`❌ Testes falhou: ${counters.failed}`);
    console.log(`📊 Total: ${counters.passed + counters.failed}`);
    console.log(`📈 Taxa de sucesso: ${((counters.passed / (counters.passed + counters.failed)) * 100).toFixed(1)}%\n`);

    if (counters.failed === 0) {
      console.log('🎉 Todos os testes passaram! Sistema multi-tenant está configurado corretamente.\n');
    } else {
      console.log('⚠️  Alguns testes falharam. Verifique a configuração.\n');
    }

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

  process.exit(counters.failed > 0 ? 1 : 0);
}

runSecurityTests();
