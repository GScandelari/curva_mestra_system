const admin = require('firebase-admin');

// Inicializar o Admin SDK com o emulador
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

admin.initializeApp({
  projectId: 'curva-mestra',
});

const auth = admin.auth();
const db = admin.firestore();

async function setupTestUsers() {
  console.log('🚀 Configurando usuários de teste...\n');

  try {
    // 1. Criar System Admin
    console.log('📝 Criando System Admin...');
    const systemAdminUser = await auth.createUser({
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

    console.log('✅ System Admin criado:');
    console.log('   Email: scandelari.guilherme@curvamestra.com.br');
    console.log('   Senha: admin123');
    console.log('   UID:', systemAdminUser.uid);
    console.log('');

    // 2. Buscar a primeira clínica (tenant)
    console.log('🔍 Buscando clínica para criar usuários...');
    const tenantsSnapshot = await db.collection('tenants').limit(1).get();

    if (tenantsSnapshot.empty) {
      console.log('⚠️  Nenhuma clínica encontrada. Crie uma clínica primeiro.');
      return;
    }

    const tenantDoc = tenantsSnapshot.docs[0];
    const tenantId = tenantDoc.id;
    const tenantData = tenantDoc.data();

    console.log('✅ Clínica encontrada:', tenantData.name);
    console.log('   Tenant ID:', tenantId);
    console.log('');

    // 3. Criar Clinic Admin
    console.log('📝 Criando Clinic Admin...');
    const clinicAdminUser = await auth.createUser({
      email: 'admin@clinic.com',
      password: 'clinic123',
      displayName: 'Admin da Clínica',
      emailVerified: true,
    });

    await auth.setCustomUserClaims(clinicAdminUser.uid, {
      tenant_id: tenantId,
      role: 'clinic_admin',
      is_system_admin: false,
      active: true,
    });

    // Adicionar ao Firestore
    await db.collection('tenants').doc(tenantId).collection('users').doc(clinicAdminUser.uid).set({
      uid: clinicAdminUser.uid,
      email: 'admin@clinic.com',
      displayName: 'Admin da Clínica',
      role: 'clinic_admin',
      active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Clinic Admin criado:');
    console.log('   Email: admin@clinic.com');
    console.log('   Senha: clinic123');
    console.log('   UID:', clinicAdminUser.uid);
    console.log('   Tenant:', tenantData.name);
    console.log('');

    // 4. Criar Clinic User
    console.log('📝 Criando Clinic User...');
    const clinicUserUser = await auth.createUser({
      email: 'user@clinic.com',
      password: 'user123',
      displayName: 'Usuário da Clínica',
      emailVerified: true,
    });

    await auth.setCustomUserClaims(clinicUserUser.uid, {
      tenant_id: tenantId,
      role: 'clinic_user',
      is_system_admin: false,
      active: true,
    });

    // Adicionar ao Firestore
    await db.collection('tenants').doc(tenantId).collection('users').doc(clinicUserUser.uid).set({
      uid: clinicUserUser.uid,
      email: 'user@clinic.com',
      displayName: 'Usuário da Clínica',
      role: 'clinic_user',
      active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Clinic User criado:');
    console.log('   Email: user@clinic.com');
    console.log('   Senha: user123');
    console.log('   UID:', clinicUserUser.uid);
    console.log('   Tenant:', tenantData.name);
    console.log('');

    console.log('🎉 Todos os usuários de teste foram criados com sucesso!\n');
    console.log('📋 Resumo:');
    console.log('   System Admin: scandelari.guilherme@curvamestra.com.br / admin123');
    console.log('   Clinic Admin: admin@clinic.com / clinic123');
    console.log('   Clinic User:  user@clinic.com / user123');
    console.log('');

  } catch (error) {
    console.error('❌ Erro ao criar usuários:', error);
  } finally {
    process.exit(0);
  }
}

setupTestUsers();
