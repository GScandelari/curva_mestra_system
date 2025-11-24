/**
 * Script para criar usuários de teste no Firebase Emulator
 * Cria: 1 system_admin + 1 tenant + 1 clinic_admin
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin para emuladores
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
  projectId: 'curva-mestra',
});

const auth = admin.auth();
const db = admin.firestore();

async function setupTestUsers() {
  try {
    console.log('🚀 Iniciando configuração de usuários de teste...\n');

    // 1. Criar System Admin
    console.log('1️⃣ Criando System Admin...');
    let systemAdmin;
    try {
      systemAdmin = await auth.createUser({
        email: 'scandelari.guilherme@curvamestra.com.br',
        password: 'Admin@123',
        displayName: 'Guilherme Scandelari',
        emailVerified: true,
      });
      console.log('   ✓ Usuário criado:', systemAdmin.email);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log('   ℹ Usuário já existe, buscando...');
        systemAdmin = await auth.getUserByEmail('scandelari.guilherme@curvamestra.com.br');
      } else {
        throw error;
      }
    }

    // Configurar custom claims do system_admin
    await auth.setCustomUserClaims(systemAdmin.uid, {
      is_system_admin: true,
      role: 'system_admin',
      active: true,
    });
    console.log('   ✓ Custom claims configurados');
    console.log(`   📧 Email: scandelari.guilherme@curvamestra.com.br`);
    console.log(`   🔑 Senha: Admin@123\n`);

    // 2. Criar Tenant de Teste
    console.log('2️⃣ Criando Tenant de teste...');
    const tenantId = 'tenant_clinic_teste_001';
    const tenantRef = db.collection('tenants').doc(tenantId);

    await tenantRef.set({
      id: tenantId,
      name: 'Clínica Beleza & Harmonia',
      cnpj: '12.345.678/0001-90',
      email: 'contato@clinicateste.com',
      phone: '(11) 98765-4321',
      plan_id: 'professional',
      active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('   ✓ Tenant criado:', tenantId);
    console.log('   🏥 Nome: Clínica Beleza & Harmonia');
    console.log('   📄 CNPJ: 12.345.678/0001-90\n');

    // 3. Criar Clinic Admin
    console.log('3️⃣ Criando Clinic Admin...');
    let clinicAdmin;
    try {
      clinicAdmin = await auth.createUser({
        email: 'admin@clinicateste.com',
        password: 'Clinic@123',
        displayName: 'Dr. João Silva',
        emailVerified: true,
      });
      console.log('   ✓ Usuário criado:', clinicAdmin.email);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log('   ℹ Usuário já existe, buscando...');
        clinicAdmin = await auth.getUserByEmail('admin@clinicateste.com');
      } else {
        throw error;
      }
    }

    // Configurar custom claims do clinic_admin
    await auth.setCustomUserClaims(clinicAdmin.uid, {
      tenant_id: tenantId,
      role: 'clinic_admin',
      is_system_admin: false,
      active: true,
    });
    console.log('   ✓ Custom claims configurados');

    // Criar documento do usuário no tenant
    await db
      .collection('tenants')
      .doc(tenantId)
      .collection('users')
      .doc(clinicAdmin.uid)
      .set({
        uid: clinicAdmin.uid,
        email: clinicAdmin.email,
        display_name: clinicAdmin.displayName,
        tenant_id: tenantId,
        role: 'clinic_admin',
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    console.log('   ✓ Documento do usuário criado no tenant');
    console.log(`   📧 Email: admin@clinicateste.com`);
    console.log(`   🔑 Senha: Clinic@123\n`);

    // 4. Criar um Clinic User (opcional)
    console.log('4️⃣ Criando Clinic User...');
    let clinicUser;
    try {
      clinicUser = await auth.createUser({
        email: 'user@clinicateste.com',
        password: 'User@123',
        displayName: 'Maria Santos',
        emailVerified: true,
      });
      console.log('   ✓ Usuário criado:', clinicUser.email);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log('   ℹ Usuário já existe, buscando...');
        clinicUser = await auth.getUserByEmail('user@clinicateste.com');
      } else {
        throw error;
      }
    }

    // Configurar custom claims do clinic_user
    await auth.setCustomUserClaims(clinicUser.uid, {
      tenant_id: tenantId,
      role: 'clinic_user',
      is_system_admin: false,
      active: true,
    });
    console.log('   ✓ Custom claims configurados');

    // Criar documento do usuário no tenant
    await db
      .collection('tenants')
      .doc(tenantId)
      .collection('users')
      .doc(clinicUser.uid)
      .set({
        uid: clinicUser.uid,
        email: clinicUser.email,
        display_name: clinicUser.displayName,
        tenant_id: tenantId,
        role: 'clinic_user',
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    console.log('   ✓ Documento do usuário criado no tenant');
    console.log(`   📧 Email: user@clinicateste.com`);
    console.log(`   🔑 Senha: User@123\n`);

    // Resumo
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SETUP CONCLUÍDO COM SUCESSO!\n');
    console.log('📊 RESUMO DOS USUÁRIOS CRIADOS:\n');
    console.log('👑 SYSTEM ADMIN');
    console.log('   Email: scandelari.guilherme@curvamestra.com.br');
    console.log('   Senha: Admin@123');
    console.log('   UID:', systemAdmin.uid);
    console.log('');
    console.log('🏥 TENANT: Clínica Beleza & Harmonia');
    console.log('   ID:', tenantId);
    console.log('   CNPJ: 12.345.678/0001-90');
    console.log('');
    console.log('👨‍⚕️ CLINIC ADMIN (Dr. João Silva)');
    console.log('   Email: admin@clinicateste.com');
    console.log('   Senha: Clinic@123');
    console.log('   UID:', clinicAdmin.uid);
    console.log('');
    console.log('👩‍⚕️ CLINIC USER (Maria Santos)');
    console.log('   Email: user@clinicateste.com');
    console.log('   Senha: User@123');
    console.log('   UID:', clinicUser.uid);
    console.log('');
    console.log('🌐 Acesse: http://localhost:3000/login');
    console.log('🔧 Emulator UI: http://127.0.0.1:4000');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao configurar usuários:', error);
    process.exit(1);
  }
}

setupTestUsers();
