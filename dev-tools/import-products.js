/**
 * Script para importar produtos do CSV para o Firestore
 * Uso: node dev-tools/import-products.js
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const CSV_PATH = path.join(__dirname, '../_lista_produtos_rennova_/lista_produtos_rennova.csv');

async function importProducts() {
  try {
    console.log('📦 Iniciando importação de produtos...\n');

    const db = getFirestore();
    const productsRef = db.collection('master_products');

    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = csvContent.split('\n');

    const header = lines[0];
    console.log(`CSV Header: ${header}`);
    console.log(`Total de linhas: ${lines.length - 1}\n`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const [code, name] = line.split(';').map(s => s.trim());

      if (!code || !name) {
        console.log(`⚠️  Linha ${i} ignorada (formato inválido): ${line}`);
        skipped++;
        continue;
      }

      try {
        const existingQuery = await productsRef.where('code', '==', code).limit(1).get();

        if (!existingQuery.empty) {
          console.log(`⏭️  Produto ${code} já existe - pulando`);
          skipped++;
          continue;
        }

        const productData = {
          code: code.replace(/\D/g, ''),
          name: name.toUpperCase(),
          active: true,
          created_at: Timestamp.now(),
          updated_at: Timestamp.now(),
        };

        await productsRef.add(productData);
        console.log(`✅ ${imported + 1}. Importado: ${code} - ${name}`);
        imported++;

      } catch (err) {
        console.error(`❌ Erro ao importar ${code}:`, err.message);
        errors++;
      }
    }

    console.log(`\n✨ Importação concluída!`);
    console.log(`   Importados: ${imported}`);
    console.log(`   Pulados: ${skipped}`);
    console.log(`   Erros: ${errors}`);

  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }
}

importProducts()
  .then(() => {
    console.log('\n✅ Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script falhou:', error);
    process.exit(1);
  });
