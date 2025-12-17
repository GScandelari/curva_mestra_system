// Script para migrar usuário usando cliente web (não precisa de credenciais admin)
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateUser() {
  const tenantId = 'o3oKqjfPeHg7zTxGyYaw';
  
  try {
    console.log('🔍 Buscando usuários em tenants/' + tenantId + '/users...');
    
    // 1. Buscar usuários na subcoleção
    const usersRef = collection(db, 'tenants', tenantId, 'users');
    const usersSnapshot = await getDocs(usersRef);

    if (usersSnapshot.empty) {
      console.log('❌ Nenhum usuário encontrado');
      process.exit(1);
    }

    console.log(`📋 Encontrados ${usersSnapshot.size} usuário(s)\n`);

    // 2. Migrar cada usuário
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      console.log(`🔄 Migrando usuário: ${userId}`);
      console.log('   Email:', userData.email || userData.displayName);
      console.log('   Dados:', JSON.stringify(userData, null, 2));

      // 3. Criar na coleção raiz users
      const newUserData = {
        tenant_id: tenantId,
        email: userData.email,
        full_name: userData.displayName || userData.full_name,
        phone: userData.phone || '',
        role: userData.role || 'clinic_admin',
        active: userData.active !== false,
        created_at: userData.created_at || new Date(),
        updated_at: new Date(),
      };

      await setDoc(doc(db, 'users', userId), newUserData);
      console.log('   ✅ Criado em users/' + userId);

      // 4. Deletar da subcoleção
      await deleteDoc(doc(db, 'tenants', tenantId, 'users', userId));
      console.log('   🗑️  Removido de tenants/' + tenantId + '/users/' + userId);
    }

    console.log('\n✅ Migração concluída!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

migrateUser();
