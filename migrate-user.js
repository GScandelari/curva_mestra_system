const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'curva-mestra',
  });
}

const db = admin.firestore();

async function migrateUser() {
  const tenantId = 'o3oKqjfPeHg7zTxGyYaw';
  
  try {
    // 1. Buscar usuários na subcoleção
    const usersSnapshot = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('users')
      .get();

    if (usersSnapshot.empty) {
      console.log('❌ Nenhum usuário encontrado em tenants/' + tenantId + '/users');
      return;
    }

    console.log(`📋 Encontrados ${usersSnapshot.size} usuário(s) para migrar`);

    // 2. Migrar cada usuário
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      console.log(`\n🔄 Migrando usuário: ${userId}`);
      console.log('   Email:', userData.email);
      console.log('   Nome:', userData.displayName || userData.full_name);

      // 3. Criar na coleção raiz users
      await db.collection('users').doc(userId).set({
        tenant_id: tenantId,
        email: userData.email,
        full_name: userData.displayName || userData.full_name,
        phone: userData.phone || '',
        role: userData.role || 'clinic_admin',
        active: userData.active !== false,
        created_at: userData.created_at || admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log('   ✅ Usuário criado em users/' + userId);

      // 4. Deletar da subcoleção
      await db
        .collection('tenants')
        .doc(tenantId)
        .collection('users')
        .doc(userId)
        .delete();

      console.log('   🗑️  Removido de tenants/' + tenantId + '/users/' + userId);
    }

    console.log('\n✅ Migração concluída com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  }
}

migrateUser();
