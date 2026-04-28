/**
 * Script para importar produtos Rennova para master_products no projeto curva-mestra-dev
 *
 * Uso:
 *   FIREBASE_ADMIN_CREDENTIALS='<json>' node scripts/import-master-products-dev.js
 */

const admin = require('firebase-admin');

const credJson = process.env.FIREBASE_ADMIN_CREDENTIALS;
if (!credJson) {
  console.error('❌ Variável FIREBASE_ADMIN_CREDENTIALS não definida.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(credJson)),
  projectId: 'curva-mestra-dev',
});

const db = admin.firestore();

const products = [
  // Preenchedores
  { code: '9980012', name: 'FILL 1ML', category: 'Preenchedores' },
  { code: '9006974', name: 'FILL LIDO 1ML', category: 'Preenchedores' },
  { code: '9263484', name: 'FILL SOFT LIPS LIDO 1ML', category: 'Preenchedores' },
  { code: '9253592', name: 'FILL FINE LINES LIDO 1,1ML', category: 'Preenchedores' },
  { code: '9253626', name: 'FILL EYES LINES LIDO 1,1ML', category: 'Preenchedores' },
  { code: '9980020', name: 'LIFT 1ML', category: 'Preenchedores' },
  { code: '9006982', name: 'LIFT LIDO 1ML', category: 'Preenchedores' },
  { code: '9253683', name: 'LIFT LIPS PLUS LIDO 1ML', category: 'Preenchedores' },
  { code: '9123886', name: 'LIFT PLUS LIDO 1ML', category: 'Preenchedores' },
  { code: '9124736', name: 'DEEP LINE LIDO 1ML', category: 'Preenchedores' },
  { code: '9195058', name: 'ULTRA VOLUME LIDO 1ML', category: 'Preenchedores' },
  { code: '9161530', name: 'ULTRA VOLUME LIDO 2ML', category: 'Preenchedores' },
  { code: '9263062', name: 'FILL HYALURONIC 30 3ML', category: 'Preenchedores' },
  { code: '9215468', name: 'LIFT SHAPE LIDO 2ML', category: 'Preenchedores' },

  // Bioestimuladores
  { code: '9252818', name: 'ELLEVA 150 150MG', category: 'Bioestimuladores' },
  { code: '9058322', name: 'ELLEVA 210MG', category: 'Bioestimuladores' },
  { code: '9160508', name: 'ELLEVA X 630MG', category: 'Bioestimuladores' },
  { code: '9192840', name: 'DIAMOND INTENSE 1,5ML', category: 'Bioestimuladores' },

  // Fios de PDO
  { code: '9193913', name: 'MONO 30GX25X30 6-0 60 UND', category: 'Fios de PDO' },
  { code: '9193917', name: 'MONO 30GX40X50 6-0 60 UND', category: 'Fios de PDO' },
  { code: '9193924', name: 'SCREW 27GX50X70 5-0 60 UND', category: 'Fios de PDO' },
  { code: '9193930', name: 'CUTTING 20GX60X105 30 UND', category: 'Fios de PDO' },
  { code: '9193943', name: 'CUTTING 20GX90X140 30 UND', category: 'Fios de PDO' },
  { code: '9193948', name: 'CUTTING 18GX100X150 30 UND', category: 'Fios de PDO' },
  { code: '9193959', name: 'MOLDING 18GX100X185 30 UND', category: 'Fios de PDO' },

  // Toxina
  { code: '1162957', name: 'NABOTA 100U 150MG', category: 'Toxina' },
  { code: '9274598', name: 'NABOTA 200U 210MG', category: 'Toxina' },

  // Cannulas
  { code: '3076536', name: 'CANNULA 25GX50MM', category: 'Cannulas' },
  { code: '3076551', name: 'CANNULA 22GX70MM', category: 'Cannulas' },
  { code: '3076528', name: 'CANNULA 22GX50MM', category: 'Cannulas' },
  { code: '3076544', name: 'CANNULA 21GX70MM', category: 'Cannulas' },
  { code: '3077294', name: 'CANNULA 18GX70MM', category: 'Cannulas' },
  { code: '9258441', name: 'SUBCISION 18G X 100MM', category: 'Cannulas' },
  { code: '9258446', name: 'SUBCISION 17G X 100MM', category: 'Cannulas' },
  { code: '9258438', name: 'BODY 20G X 80MM', category: 'Cannulas' },
  { code: '9258435', name: 'BODY 20G X 100MM', category: 'Cannulas' },

  // Care Home
  { code: '9251216', name: 'HYALURONIC GEL CLEANSER 150G', category: 'Care Home' },
  { code: '9251265', name: 'HYALURONIC MICELLAR SOLUTION 200ML', category: 'Care Home' },
  { code: '9254421', name: 'MAKEUP REMOVER CLEANSING FACE WIPES 40 UND', category: 'Care Home' },
  { code: '9255837', name: 'MAKEUP REMOVER CLEANSING LIP WIPES 40 UND', category: 'Care Home' },
  { code: '9258906', name: 'BEAUTY WATER 100ML', category: 'Care Home' },
  { code: '9251224', name: 'DEEP HYDRATION BODY CREAM 200G', category: 'Care Home' },
  { code: '9251232', name: 'HAND AND NAILS CREAM 50G', category: 'Care Home' },
  { code: '9251281', name: 'PROTETOR SOLAR FPS 60 FACIAL 50ML', category: 'Care Home' },
  { code: '9251299', name: 'PROTETOR SOLAR FPS 60 FACIAL TONALIZANTE 50ML', category: 'Care Home' },
  { code: '9251307', name: 'PROTETOR SOLAR FPS 99 50ML', category: 'Care Home' },
  { code: '9253276', name: 'HYALURONIC GLOSS RUBY 4,5ML', category: 'Care Home' },
  { code: '9254799', name: 'HYALURONIC GLOSS DIAMOND 4,5ML', category: 'Care Home' },
  { code: '9254802', name: 'HYALURONIC GLOSS QUARTZO 4,5ML', category: 'Care Home' },
  { code: '9254804', name: 'HYALURONIC GLOSS AGATE 4,5ML', category: 'Care Home' },
  { code: '9254807', name: 'PERFECT LIPS DUO QUEEN 1,6G', category: 'Care Home' },
  { code: '9254809', name: 'PERFECT LIPS DUO LADY 1,6G', category: 'Care Home' },
  { code: '9254813', name: 'PERFECT LIPS DUO DIVA 1,6G', category: 'Care Home' },
  { code: '9254816', name: 'PERFECT LIPS DUO PRINCESS 1,6G', category: 'Care Home' },
  { code: '9254821', name: 'PERFECT EYES DUO CRYSTAL 1,6G', category: 'Care Home' },
  { code: '9160136', name: 'BEAUTE HYALURONIC COMPLEX 30 CAPS', category: 'Care Home' },
  { code: '309960', name: 'COLAGENO ELLEVA SABOR FRUTAS VERM 30 UND', category: 'Care Home' },
  { code: '9272172', name: 'LIFT-FILLER HYALURONIC BOOSTER + MULT. PEPTIDE 50G', category: 'Care Home' },
  { code: '9272174', name: 'ELLEVA COLLAGEN CREAM 40G', category: 'Care Home' },
  { code: '9272170', name: 'LIFT-TOX SERUM 30ML', category: 'Care Home' },

  // Care Professional
  { code: '9255134', name: 'HYALURONIC GEL CLEANSER 150G', category: 'Care Professional' },
  { code: '9255142', name: 'HYALURONIC MICELLAR SOLUTION 200ML', category: 'Care Professional' },
  { code: '9255183', name: 'MAKEUP REMOVER CLEANSING FACE WIPES 40 UND', category: 'Care Professional' },
  { code: '9255829', name: 'MAKEUP REMOVER CLEANSING LIP WIPES 40 UND', category: 'Care Professional' },
  { code: '9259067', name: 'BEAUTY WATER 100ML', category: 'Care Professional' },
  { code: '9255159', name: 'DEEP HYDRATION BODY CREAM 200G', category: 'Care Professional' },
  { code: '9257879', name: 'HAND AND NAILS CREAM 50G', category: 'Care Professional' },
  { code: '9255167', name: 'PROTETOR SOLAR FPS 60 FACIAL 50ML', category: 'Care Professional' },
  { code: '9255175', name: 'PROTETOR SOLAR FPS 60 FACIAL TONALIZANTE 50ML', category: 'Care Professional' },
  { code: '9258907', name: 'PROTETOR SOLAR FPS 99 50ML', category: 'Care Professional' },
];

async function importProducts() {
  console.log('📦 Importando lista completa Rennova para curva-mestra-dev...\n');

  try {
    let imported = 0;
    let skipped = 0;

    for (const product of products) {
      const existing = await db.collection('master_products')
        .where('code', '==', product.code)
        .get();

      if (!existing.empty) {
        console.log(`   ⚠️  ${product.code} já existe — pulando`);
        skipped++;
        continue;
      }

      await db.collection('master_products').add({
        code: product.code,
        name: product.name,
        category: product.category,
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`   ✅ [${product.category}] ${product.code} — ${product.name}`);
      imported++;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Concluído! Importados: ${imported} | Pulados: ${skipped}`);
    const total = await db.collection('master_products').get();
    console.log(`📊 Total no catálogo dev: ${total.size}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

importProducts();
