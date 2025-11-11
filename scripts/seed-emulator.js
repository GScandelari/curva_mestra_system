/**
 * Script para popular o Firebase Emulator com dados de teste
 * Uso: node scripts/seed-emulator.js
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

async function seedData() {
  console.log('🌱 Iniciando seed do emulador...\n');

  try {
    // 1. Criar System Admin
    console.log('👤 Criando System Admin...');
    let systemAdmin;
    try {
      systemAdmin = await auth.createUser({
        email: 'admin@curvamestra.com',
        password: 'Admin123!',
        displayName: 'System Administrator',
        emailVerified: true
      });
      console.log(`   ✅ System Admin criado: ${systemAdmin.email} (${systemAdmin.uid})`);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        systemAdmin = await auth.getUserByEmail('admin@curvamestra.com');
        console.log(`   ℹ️  System Admin já existe: ${systemAdmin.email}`);
      } else {
        throw error;
      }
    }

    // Configurar custom claims
    await auth.setCustomUserClaims(systemAdmin.uid, {
      is_system_admin: true,
      role: 'system_admin',
      active: true
    });
    console.log('   ✅ Custom claims configurados\n');

    // 2. Criar Tenants de Teste
    console.log('🏢 Criando tenants de teste...');

    const tenants = [
      {
        id: 'tenant_clinic_alpha',
        name: 'Clínica Alpha',
        cnpj: '12.345.678/0001-90',
        email: 'contato@alpha.com',
        phone: '(11) 98765-4321',
        address: {
          street: 'Av. Paulista, 1000',
          city: 'São Paulo',
          state: 'SP',
          zip: '01310-100'
        },
        plan_id: 'professional',
        active: true
      },
      {
        id: 'tenant_clinic_beta',
        name: 'Clínica Beta',
        cnpj: '98.765.432/0001-10',
        email: 'contato@beta.com',
        phone: '(21) 91234-5678',
        address: {
          street: 'Av. Atlântica, 500',
          city: 'Rio de Janeiro',
          state: 'RJ',
          zip: '22021-000'
        },
        plan_id: 'basic',
        active: true
      },
      {
        id: 'tenant_clinic_gamma',
        name: 'Clínica Gamma (Inativa)',
        cnpj: '11.222.333/0001-44',
        email: 'contato@gamma.com',
        phone: '(31) 3333-4444',
        address: {
          street: 'Av. Afonso Pena, 1500',
          city: 'Belo Horizonte',
          state: 'MG',
          zip: '30130-009'
        },
        plan_id: 'basic',
        active: false
      }
    ];

    for (const tenant of tenants) {
      await db.collection('tenants').doc(tenant.id).set({
        ...tenant,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`   ✅ ${tenant.name} (${tenant.id})`);
    }

    // 3. Criar usuários para cada tenant
    console.log('\n👥 Criando usuários dos tenants...');

    // Tenant Alpha - Admin
    let alphaAdmin;
    try {
      alphaAdmin = await auth.createUser({
        email: 'admin@alpha.com',
        password: 'Alpha123!',
        displayName: 'Admin Alpha',
        emailVerified: true
      });
      console.log(`   ✅ Admin Alpha criado: ${alphaAdmin.email}`);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        alphaAdmin = await auth.getUserByEmail('admin@alpha.com');
        console.log(`   ℹ️  Admin Alpha já existe`);
      }
    }

    await auth.setCustomUserClaims(alphaAdmin.uid, {
      tenant_id: 'tenant_clinic_alpha',
      role: 'clinic_admin',
      is_system_admin: false,
      active: true
    });

    await db.collection('tenants')
      .doc('tenant_clinic_alpha')
      .collection('users')
      .doc(alphaAdmin.uid)
      .set({
        uid: alphaAdmin.uid,
        email: alphaAdmin.email,
        displayName: alphaAdmin.displayName,
        role: 'clinic_admin',
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

    // Tenant Alpha - User
    let alphaUser;
    try {
      alphaUser = await auth.createUser({
        email: 'usuario@alpha.com',
        password: 'Alpha123!',
        displayName: 'Usuário Alpha',
        emailVerified: true
      });
      console.log(`   ✅ Usuário Alpha criado: ${alphaUser.email}`);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        alphaUser = await auth.getUserByEmail('usuario@alpha.com');
        console.log(`   ℹ️  Usuário Alpha já existe`);
      }
    }

    await auth.setCustomUserClaims(alphaUser.uid, {
      tenant_id: 'tenant_clinic_alpha',
      role: 'clinic_user',
      is_system_admin: false,
      active: true
    });

    await db.collection('tenants')
      .doc('tenant_clinic_alpha')
      .collection('users')
      .doc(alphaUser.uid)
      .set({
        uid: alphaUser.uid,
        email: alphaUser.email,
        displayName: alphaUser.displayName,
        role: 'clinic_user',
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

    // Tenant Beta - Admin
    let betaAdmin;
    try {
      betaAdmin = await auth.createUser({
        email: 'admin@beta.com',
        password: 'Beta123!',
        displayName: 'Admin Beta',
        emailVerified: true
      });
      console.log(`   ✅ Admin Beta criado: ${betaAdmin.email}`);
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        betaAdmin = await auth.getUserByEmail('admin@beta.com');
        console.log(`   ℹ️  Admin Beta já existe`);
      }
    }

    await auth.setCustomUserClaims(betaAdmin.uid, {
      tenant_id: 'tenant_clinic_beta',
      role: 'clinic_admin',
      is_system_admin: false,
      active: true
    });

    await db.collection('tenants')
      .doc('tenant_clinic_beta')
      .collection('users')
      .doc(betaAdmin.uid)
      .set({
        uid: betaAdmin.uid,
        email: betaAdmin.email,
        displayName: betaAdmin.displayName,
        role: 'clinic_admin',
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

    // 4. Adicionar alguns produtos de exemplo no inventário da Alpha
    console.log('\n📦 Adicionando produtos de exemplo...');

    const produtos = [
      {
        tenant_id: 'tenant_clinic_alpha',
        produto_id: 'prod_3029055',
        codigo_produto: '3029055',
        nome_produto: 'TORNEIRA DESCARTAVEL 3VIAS LL',
        lote: 'SCTPAB002B',
        quantidade_inicial: 5,
        quantidade_disponivel: 3,
        dt_validade: new Date('2029-06-01'),
        dt_entrada: new Date(),
        valor_unitario: 1.55,
        nf_numero: '026229',
        nf_id: 'nf_026229',
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        tenant_id: 'tenant_clinic_alpha',
        produto_id: 'prod_1234567',
        codigo_produto: '1234567',
        nome_produto: 'ÁCIDO HIALURÔNICO 2ML',
        lote: 'AH2024001',
        quantidade_inicial: 10,
        quantidade_disponivel: 7,
        dt_validade: new Date('2025-12-31'),
        dt_entrada: new Date(),
        valor_unitario: 45.00,
        nf_numero: '026230',
        nf_id: 'nf_026230',
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        tenant_id: 'tenant_clinic_alpha',
        produto_id: 'prod_9876543',
        codigo_produto: '9876543',
        nome_produto: 'TOXINA BOTULÍNICA 100U',
        lote: 'BOT2024A',
        quantidade_inicial: 15,
        quantidade_disponivel: 12,
        dt_validade: new Date('2026-03-15'),
        dt_entrada: new Date(),
        valor_unitario: 320.00,
        nf_numero: '026231',
        nf_id: 'nf_026231',
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    for (const produto of produtos) {
      await db.collection('tenants')
        .doc('tenant_clinic_alpha')
        .collection('inventory')
        .add(produto);
      console.log(`   ✅ ${produto.nome_produto}`);
    }

    // 5. Adicionar alguns produtos master no catálogo
    console.log('\n📚 Adicionando produtos ao catálogo master...');

    const masterProducts = [
      {
        code: '3029055',
        name: 'TORNEIRA DESCARTAVEL 3VIAS LL',
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        code: '1234567',
        name: 'ÁCIDO HIALURÔNICO 2ML',
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        code: '9876543',
        name: 'TOXINA BOTULÍNICA 100U',
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        code: '5555555',
        name: 'PREENCHEDOR LABIAL 1ML',
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }
    ];

    for (const product of masterProducts) {
      await db.collection('master_products').add(product);
      console.log(`   ✅ ${product.name}`);
    }

    console.log('\n✅ Seed concluído com sucesso!');
    console.log('\n📋 Credenciais de acesso:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('System Admin:');
    console.log('  Email: admin@curvamestra.com');
    console.log('  Senha: Admin123!');
    console.log('');
    console.log('Clinic Alpha - Admin:');
    console.log('  Email: admin@alpha.com');
    console.log('  Senha: Alpha123!');
    console.log('');
    console.log('Clinic Alpha - Usuário:');
    console.log('  Email: usuario@alpha.com');
    console.log('  Senha: Alpha123!');
    console.log('');
    console.log('Clinic Beta - Admin:');
    console.log('  Email: admin@beta.com');
    console.log('  Senha: Beta123!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🌐 Acesse o Emulator UI: http://127.0.0.1:4000');
    console.log('🔐 Auth Emulator: http://127.0.0.1:4000/auth');
    console.log('📊 Firestore Emulator: http://127.0.0.1:4000/firestore\n');

  } catch (error) {
    console.error('❌ Erro ao fazer seed:', error);
    process.exit(1);
  }

  process.exit(0);
}

seedData();
