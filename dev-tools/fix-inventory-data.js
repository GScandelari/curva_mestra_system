const admin = require('firebase-admin');

// Conectar ao emulador
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'curva-mestra'
  });
}

const db = admin.firestore();

async function fixInventoryData() {
  try {
    console.log('🔧 Corrigindo dados do inventário...\n');

    // Buscar todos os tenants
    const tenantsSnapshot = await db.collection('tenants').get();

    for (const tenantDoc of tenantsSnapshot.docs) {
      const tenantData = tenantDoc.data();
      console.log(`\n🏥 Processando: ${tenantData.name} (${tenantDoc.id})`);

      // Buscar produtos do inventário
      const inventoryRef = db.collection('tenants').doc(tenantDoc.id).collection('inventory');
      const inventorySnapshot = await inventoryRef.get();

      console.log(`   Encontrados ${inventorySnapshot.size} produtos`);

      for (const doc of inventorySnapshot.docs) {
        const data = doc.data();

        // Verificar se precisa corrigir
        const needsFix = !data.active || !data.quantidade_disponivel || data.status === 'ativo';

        if (needsFix) {
          console.log(`   ✏️  Corrigindo: ${data.nome_produto}`);

          const updatedData = {
            active: true,
            quantidade_disponivel: data.quantidade_atual || data.quantidade_disponivel || data.quantidade_inicial || 0,
          };

          // Remover campos antigos
          const fieldsToDelete = {
            quantidade_atual: admin.firestore.FieldValue.delete(),
            status: admin.firestore.FieldValue.delete(),
          };

          // Se não tem codigo_produto mas tem codigo, copiar
          if (!data.codigo_produto && data.codigo) {
            updatedData.codigo_produto = data.codigo;
            fieldsToDelete.codigo = admin.firestore.FieldValue.delete();
          }

          // Se não tem produto_id, copiar de master_product_id
          if (!data.produto_id && data.master_product_id) {
            updatedData.produto_id = data.master_product_id;
          }

          // Se não tem dt_entrada, usar created_at ou now
          if (!data.dt_entrada) {
            updatedData.dt_entrada = data.created_at || admin.firestore.FieldValue.serverTimestamp();
          }

          await inventoryRef.doc(doc.id).update({
            ...updatedData,
            ...fieldsToDelete,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(`   ✅ Corrigido`);
        } else {
          console.log(`   ✓  OK: ${data.nome_produto}`);
        }
      }
    }

    console.log('\n✨ Correção concluída!');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    process.exit(0);
  }
}

fixInventoryData();
