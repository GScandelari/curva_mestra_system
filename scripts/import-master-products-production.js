/**
 * Script para importar produtos Rennova do CSV para master_products em PRODUÇÃO
 * Uso: node scripts/import-master-products-production.js
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin para PRODUÇÃO
// NÃO configurar emuladores aqui!
admin.initializeApp({
  projectId: 'curva-mestra',
});

const db = admin.firestore();

// Produtos do CSV
const products = [
  { code: '9274598', name: 'NABOTA 200U 1FR/AMP' },
  { code: '9089061', name: 'TORNEIRA DESCARTAVEL 3 VIAS SOLIDOR' },
  { code: '9192840', name: 'RENNOVA DIAMOND INTENSE C/ AGULHA TSK' },
  { code: '3029055', name: 'TORNEIRA DESCARTAVEL 3 VIAS LL' },
  { code: '9058322', name: 'RENNOVA ELLEVA' },
  { code: '9160508', name: 'RENNOVA ELLEVA X' },
  { code: '9252818', name: 'RENNOVA ELLEVA 150' },
  { code: '9253592', name: 'RENNOVA FILL FINE LINES LIDO' },
  { code: '9253626', name: 'RENNOVA FILL EYES LINES LIDO 1,1 ML' },
  { code: '3076528', name: 'RENNOVA CANNULA 22GX50MM C/ AGULHA 21G' },
  { code: '3076536', name: 'RENNOVA CANNULA 25GX50MM C/ AGULHA 23G' },
  { code: '3077294', name: 'RENNOVA CANNULA 18GX70MM' },
  { code: '9123886', name: 'RENNOVA LIFT PLUS LIDO' },
  { code: '9193913', name: 'CROQUIS MONO 30GX25X30 6-0 - IMP CX60' },
  { code: '9193924', name: 'CROQUIS SCREW 27GX50X70 5-0 - IMP CX60' },
  { code: '9193948', name: 'CROQUIS BARBED CUTTING 18GX100X150 2 L CANNULA-IMP CX30' },
  { code: '9253683', name: 'RENNOVA LIFT LIPS PLUS LIDO 1,1 ML' },
  { code: '9263484', name: 'RENNOVA FILL SOFT LIPS LIDO' },
  { code: '9980020', name: 'RENNOVA LIFT SER 1ML' }
];

async function importProducts() {
  console.log('════════════════════════════════════════════════');
  console.log('  IMPORTAR PRODUTOS - FIREBASE PRODUÇÃO');
  console.log('  Projeto: curva-mestra');
  console.log('════════════════════════════════════════════════\n');
  
  console.log('📦 Importando produtos Rennova para catálogo master...\n');
  console.log('⚠️  ATENÇÃO: Este script vai criar produtos no Firestore de PRODUÇÃO!\n');

  try {
    // Verificar produtos existentes
    console.log('🔍 Verificando produtos existentes...');
    const existingProducts = await db.collection('master_products').get();
    console.log(`   ℹ️  ${existingProducts.size} produtos já existem no catálogo\n`);

    // Importar produtos do CSV
    console.log('📥 Importando produtos do catálogo Rennova...');
    let imported = 0;
    let skipped = 0;

    for (const product of products) {
      try {
        // Verificar se já existe produto com este código
        const existingQuery = await db.collection('master_products')
          .where('code', '==', product.code)
          .get();

        if (!existingQuery.empty) {
          console.log(`   ⚠️  ${product.code} - ${product.name} (já existe)`);
          skipped++;
          continue;
        }

        // Criar produto
        await db.collection('master_products').add({
          code: product.code,
          name: product.name,
          active: true,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`   ✅ ${product.code} - ${product.name}`);
        imported++;
      } catch (error) {
        console.error(`   ❌ Erro ao importar ${product.code}:`, error.message);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ IMPORTAÇÃO CONCLUÍDA!');
    console.log(`   Total no CSV: ${products.length}`);
    console.log(`   Importados: ${imported}`);
    console.log(`   Já existiam: ${skipped}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Verificar total no banco
    const finalCount = await db.collection('master_products').get();
    console.log(`📊 Total de produtos no catálogo: ${finalCount.size}`);
    console.log(`🔧 Firebase Console: https://console.firebase.google.com/project/curva-mestra/firestore/data/master_products\n`);

  } catch (error) {
    console.error('❌ Erro ao importar produtos:', error);
    process.exit(1);
  }

  process.exit(0);
}

importProducts();
