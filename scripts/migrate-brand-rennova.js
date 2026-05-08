/**
 * Script de migração: atribuir brand='Rennova' a itens de inventário
 * importados via NF-e que ainda não possuem o campo brand.
 *
 * Critério: itens com nf_id != null e brand == null/undefined.
 *
 * Uso:
 *   node scripts/migrate-brand-rennova.js            (dry-run por padrão)
 *   node scripts/migrate-brand-rennova.js --apply    (executa de fato)
 *
 * Pré-requisito: GOOGLE_APPLICATION_CREDENTIALS apontando para a service account
 * ou firebase-admin inicializado via applicationDefault().
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();
const DRY_RUN = !process.argv.includes('--apply');

async function run() {
  console.log(DRY_RUN ? '[DRY-RUN] Nenhuma alteração será salva.' : '[APPLY] Alterações serão salvas.');

  const tenantsSnap = await db.collection('tenants').listDocuments();
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const tenantRef of tenantsSnap) {
    const tenantId = tenantRef.id;
    const inventoryRef = db.collection(`tenants/${tenantId}/inventory`);

    // Buscar itens com nf_id definido e brand ausente
    const snap = await inventoryRef
      .where('nf_id', '!=', null)
      .get();

    const toUpdate = snap.docs.filter((doc) => {
      const data = doc.data();
      return !data.brand;
    });

    if (toUpdate.length === 0) {
      totalSkipped++;
      continue;
    }

    console.log(`Tenant ${tenantId}: ${toUpdate.length} item(s) para atualizar`);

    if (!DRY_RUN) {
      const BATCH_LIMIT = 500;
      for (let i = 0; i < toUpdate.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        toUpdate.slice(i, i + BATCH_LIMIT).forEach((doc) => {
          batch.update(doc.ref, { brand: 'Rennova', updated_at: admin.firestore.FieldValue.serverTimestamp() });
        });
        await batch.commit();
      }
    }

    totalUpdated += toUpdate.length;
  }

  console.log(`\nResumo:`);
  console.log(`  Tenants processados: ${tenantsSnap.length}`);
  console.log(`  Tenants sem alteração: ${totalSkipped}`);
  console.log(`  Itens ${DRY_RUN ? 'que seriam' : ''} atualizados: ${totalUpdated}`);
  if (DRY_RUN) {
    console.log('\nPara aplicar, rode com: node scripts/migrate-brand-rennova.js --apply');
  }
}

run().catch((err) => {
  console.error('Erro durante migração:', err);
  process.exit(1);
});
