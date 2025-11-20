const admin = require('firebase-admin');

// Conectar ao emulador
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'curva-mestra'
  });
}

const db = admin.firestore();

async function checkInventory() {
  try {
    console.log('🔍 Verificando dados no Firestore...\n');

    // Verificar tenants
    const tenantsSnapshot = await db.collection('tenants').get();
    console.log(`📋 Total de tenants: ${tenantsSnapshot.size}`);

    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantData = tenantDoc.data();
      console.log(`\n🏥 Tenant: ${tenantData.name} (${tenantDoc.id})`);

      // Verificar inventory
      const inventorySnapshot = await db
        .collection('tenants')
        .doc(tenantDoc.id)
        .collection('inventory')
        .get();

      console.log(`   📦 Produtos no inventário: ${inventorySnapshot.size}`);

      if (inventorySnapshot.size > 0) {
        console.log('   \n   Produtos:');
        inventorySnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`   - ${data.nome_produto || 'SEM NOME'}`);
          console.log(`     Código: ${data.codigo_produto || data.codigo || 'N/A'}`);
          console.log(`     Qtd Disponível: ${data.quantidade_disponivel || 'N/A'}`);
          console.log(`     Qtd Atual: ${data.quantidade_atual || 'N/A'}`);
          console.log(`     Active: ${data.active}`);
          console.log(`     Status: ${data.status || 'N/A'}`);
          console.log('');
        });
      }

      // Verificar nf_imports
      const nfSnapshot = await db
        .collection('tenants')
        .doc(tenantDoc.id)
        .collection('nf_imports')
        .get();

      console.log(`   📄 NFs importadas: ${nfSnapshot.size}`);
    }

    // Verificar master_products
    const masterSnapshot = await db.collection('master_products').get();
    console.log(`\n🎯 Produtos Master (Rennova): ${masterSnapshot.size}`);

    if (masterSnapshot.size > 0) {
      console.log('\nPrimeiros 5 produtos:');
      masterSnapshot.docs.slice(0, 5).forEach(doc => {
        const data = doc.data();
        console.log(`  - ${data.code} - ${data.name}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    process.exit(0);
  }
}

checkInventory();
