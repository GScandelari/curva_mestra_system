/**
 * Script para configurar ambiente de produção
 * Cria system_admin, clínicas e produtos Rennova
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Configurar Firebase Admin para produção
const serviceAccount = require('../curva-mestra-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'curva-mestra.firebasestorage.app'
});

const db = admin.firestore();
const auth = admin.auth();

async function setupProduction() {
  console.log('🚀 Configurando ambiente de produção...\n');

  try {
    // 1. Criar System Admin
    console.log('👤 Criando System Admin...');
    const adminEmail = 'admin@curvamestra.com';
    const adminPassword = 'Admin@123456';

    let adminUser;
    try {
      adminUser = await auth.getUserByEmail(adminEmail);
      console.log('✅ System Admin já existe:', adminEmail);
    } catch (error) {
      adminUser = await auth.createUser({
        email: adminEmail,
        password: adminPassword,
        displayName: 'System Administrator',
        emailVerified: true,
      });
      console.log('✅ System Admin criado:', adminEmail);
    }

    // Setar custom claims
    await auth.setCustomUserClaims(adminUser.uid, {
      role: 'system_admin',
      is_system_admin: true,
      active: true,
    });
    console.log('✅ Custom claims configurados\n');

    // 2. Criar Tenant de Teste (Clínica Demo)
    console.log('🏥 Criando clínica de demonstração...');
    const tenantId = 'clinic_demo_001';

    const tenantRef = db.collection('tenants').doc(tenantId);
    const tenantDoc = await tenantRef.get();

    if (!tenantDoc.exists) {
      await tenantRef.set({
        nome: 'Clínica Demo',
        documento: '12.345.678/0001-90',
        tipo_documento: 'cnpj',
        email: 'contato@clinicademo.com',
        telefone: '(11) 98765-4321',
        endereco: {
          rua: 'Av. Paulista',
          numero: '1000',
          complemento: 'Sala 101',
          bairro: 'Bela Vista',
          cidade: 'São Paulo',
          estado: 'SP',
          cep: '01310-100',
        },
        status: 'ativa',
        dt_criacao: admin.firestore.FieldValue.serverTimestamp(),
        dt_atualizacao: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('✅ Clínica Demo criada\n');
    } else {
      console.log('✅ Clínica Demo já existe\n');
    }

    // 3. Criar usuário admin da clínica
    console.log('👨‍⚕️ Criando admin da clínica...');
    const clinicAdminEmail = 'admin@clinicademo.com';
    const clinicAdminPassword = 'Clinic@123456';

    let clinicAdmin;
    try {
      clinicAdmin = await auth.getUserByEmail(clinicAdminEmail);
      console.log('✅ Admin da clínica já existe:', clinicAdminEmail);
    } catch (error) {
      clinicAdmin = await auth.createUser({
        email: clinicAdminEmail,
        password: clinicAdminPassword,
        displayName: 'Dr. João Silva',
        emailVerified: true,
      });
      console.log('✅ Admin da clínica criado:', clinicAdminEmail);
    }

    await auth.setCustomUserClaims(clinicAdmin.uid, {
      tenant_id: tenantId,
      role: 'clinic_admin',
      is_system_admin: false,
      active: true,
    });
    console.log('✅ Custom claims configurados\n');

    // 4. Importar produtos Rennova
    console.log('📦 Importando produtos Rennova...');
    const csvPath = path.join(__dirname, '../_lista_produtos_rennova_/lista_produtos_rennova.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    let importedCount = 0;
    const productsRef = db.collection('produtos');

    for (let i = 1; i < lines.length; i++) { // Skip header
      const line = lines[i].trim();
      if (!line) continue;

      const [codigo, nome] = line.split(';').map(item => item.trim().replace(/"/g, ''));

      if (!codigo || !nome) continue;

      const productRef = productsRef.doc(codigo);
      const productDoc = await productRef.get();

      if (!productDoc.exists) {
        await productRef.set({
          codigo,
          nome,
          ativo: true,
          fornecedor: 'Rennova',
          categoria: 'harmonizacao',
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
        importedCount++;
      }
    }

    console.log(`✅ ${importedCount} produtos importados\n`);

    console.log('🎉 Ambiente de produção configurado com sucesso!\n');
    console.log('📋 Credenciais:');
    console.log('   System Admin:');
    console.log(`     Email: ${adminEmail}`);
    console.log(`     Senha: ${adminPassword}`);
    console.log('   Clinic Admin:');
    console.log(`     Email: ${clinicAdminEmail}`);
    console.log(`     Senha: ${clinicAdminPassword}`);
    console.log('\n   Acesse: https://curva-mestra.web.app');

  } catch (error) {
    console.error('❌ Erro ao configurar ambiente:', error);
    throw error;
  }
}

setupProduction()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
