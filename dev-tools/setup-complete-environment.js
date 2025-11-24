const admin = require('firebase-admin');

// Inicializar o Admin SDK com o emulador
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

admin.initializeApp({
  projectId: 'curva-mestra',
});

const auth = admin.auth();
const db = admin.firestore();

async function setupCompleteEnvironment() {
  console.log('🚀 Configurando ambiente completo de teste...\n');

  try {
    // 1. Criar ou verificar System Admin
    console.log('👤 Verificando System Admin...');
    let systemAdminUser;
    try {
      systemAdminUser = await auth.getUserByEmail('scandelari.guilherme@curvamestra.com.br');
      console.log('✅ System Admin já existe');
      console.log('   Email: scandelari.guilherme@curvamestra.com.br');
      console.log('   Senha: admin123\n');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        systemAdminUser = await auth.createUser({
          email: 'scandelari.guilherme@curvamestra.com.br',
          password: 'admin123',
          displayName: 'Guilherme Scandelari',
          emailVerified: true,
        });

        await auth.setCustomUserClaims(systemAdminUser.uid, {
          role: 'system_admin',
          is_system_admin: true,
          active: true,
        });

        console.log('✅ System Admin criado');
        console.log('   Email: scandelari.guilherme@curvamestra.com.br');
        console.log('   Senha: admin123\n');
      } else {
        throw error;
      }
    }

    // 2. Criar Clínica 1 - Clínica Bella Vita
    console.log('🏥 Criando Clínica 1: Bella Vita...');
    const tenant1Ref = await db.collection('tenants').add({
      name: 'Clínica Bella Vita',
      cnpj: '12.345.678/0001-90',
      email: 'contato@bellavita.com',
      phone: '(11) 98765-4321',
      address: 'Av. Paulista, 1000 - São Paulo/SP',
      plan_id: 'professional',
      active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const tenant1Id = tenant1Ref.id;
    console.log('✅ Clínica Bella Vita criada');
    console.log('   Tenant ID:', tenant1Id);

    // Criar Admin da Clínica 1
    const bella1AdminUser = await auth.createUser({
      email: 'admin@bellavita.com',
      password: 'bella123',
      displayName: 'Dr. Guilherme Scandelari',
      emailVerified: true,
    });

    await auth.setCustomUserClaims(bella1AdminUser.uid, {
      tenant_id: tenant1Id,
      role: 'clinic_admin',
      is_system_admin: false,
      active: true,
    });

    await db.collection('tenants').doc(tenant1Id).collection('users').doc(bella1AdminUser.uid).set({
      uid: bella1AdminUser.uid,
      email: 'admin@bellavita.com',
      displayName: 'Dr. Guilherme Scandelari',
      role: 'clinic_admin',
      active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Admin criado: admin@bellavita.com / bella123');

    // Criar User da Clínica 1
    const bella1User = await auth.createUser({
      email: 'maria@bellavita.com',
      password: 'bella123',
      displayName: 'Maria Santos',
      emailVerified: true,
    });

    await auth.setCustomUserClaims(bella1User.uid, {
      tenant_id: tenant1Id,
      role: 'clinic_user',
      is_system_admin: false,
      active: true,
    });

    await db.collection('tenants').doc(tenant1Id).collection('users').doc(bella1User.uid).set({
      uid: bella1User.uid,
      email: 'maria@bellavita.com',
      displayName: 'Maria Santos',
      role: 'clinic_user',
      active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Usuário criado: maria@bellavita.com / bella123\n');

    // 3. Criar Clínica 2 - Espaço Renova
    console.log('🏥 Criando Clínica 2: Espaço Renova...');
    const tenant2Ref = await db.collection('tenants').add({
      name: 'Espaço Renova',
      cnpj: '98.765.432/0001-10',
      email: 'contato@espacorenova.com',
      phone: '(21) 97654-3210',
      address: 'Rua das Flores, 500 - Rio de Janeiro/RJ',
      plan_id: 'basic',
      active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    const tenant2Id = tenant2Ref.id;
    console.log('✅ Espaço Renova criado');
    console.log('   Tenant ID:', tenant2Id);

    // Criar Admin da Clínica 2
    const renova2AdminUser = await auth.createUser({
      email: 'admin@espacorenova.com',
      password: 'renova123',
      displayName: 'Dra. Ana Costa',
      emailVerified: true,
    });

    await auth.setCustomUserClaims(renova2AdminUser.uid, {
      tenant_id: tenant2Id,
      role: 'clinic_admin',
      is_system_admin: false,
      active: true,
    });

    await db.collection('tenants').doc(tenant2Id).collection('users').doc(renova2AdminUser.uid).set({
      uid: renova2AdminUser.uid,
      email: 'admin@espacorenova.com',
      displayName: 'Dra. Ana Costa',
      role: 'clinic_admin',
      active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Admin criado: admin@espacorenova.com / renova123');

    // Criar User da Clínica 2
    const renova2User = await auth.createUser({
      email: 'carlos@espacorenova.com',
      password: 'renova123',
      displayName: 'Carlos Oliveira',
      emailVerified: true,
    });

    await auth.setCustomUserClaims(renova2User.uid, {
      tenant_id: tenant2Id,
      role: 'clinic_user',
      is_system_admin: false,
      active: true,
    });

    await db.collection('tenants').doc(tenant2Id).collection('users').doc(renova2User.uid).set({
      uid: renova2User.uid,
      email: 'carlos@espacorenova.com',
      displayName: 'Carlos Oliveira',
      role: 'clinic_user',
      active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Usuário criado: carlos@espacorenova.com / renova123\n');

    // 4. Resumo
    console.log('🎉 Ambiente completo configurado com sucesso!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 CREDENCIAIS DE ACESSO\n');

    console.log('🔐 SYSTEM ADMIN');
    console.log('   Email: scandelari.guilherme@curvamestra.com.br');
    console.log('   Senha: admin123');
    console.log('   Acesso: Portal Admin (todas as clínicas)\n');

    console.log('🏥 CLÍNICA 1: Bella Vita (Professional)');
    console.log('   CNPJ: 12.345.678/0001-90');
    console.log('   Admin: admin@bellavita.com / bella123');
    console.log('   User:  maria@bellavita.com / bella123\n');

    console.log('🏥 CLÍNICA 2: Espaço Renova (Basic)');
    console.log('   CNPJ: 98.765.432/0001-10');
    console.log('   Admin: admin@espacorenova.com / renova123');
    console.log('   User:  carlos@espacorenova.com / renova123');
    console.log('═══════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erro ao configurar ambiente:', error);
  } finally {
    process.exit(0);
  }
}

setupCompleteEnvironment();
