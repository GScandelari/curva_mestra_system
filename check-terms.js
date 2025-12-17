/**
 * Script para verificar configuração de termos de uso
 */

const admin = require('firebase-admin');
const serviceAccount = require('./curva-mestra-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkTerms() {
  console.log('🔍 Verificando termos de uso no Firestore...\n');

  try {
    const snapshot = await db.collection('legal_documents').get();

    if (snapshot.empty) {
      console.log('❌ PROBLEMA: Nenhum documento legal encontrado!');
      console.log('   Solução: Crie pelo menos um termo de uso em /admin/legal-documents\n');
      return;
    }

    console.log(`📋 Total de documentos legais: ${snapshot.size}\n`);

    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log('─'.repeat(60));
      console.log(`ID: ${doc.id}`);
      console.log(`Título: ${data.title}`);
      console.log(`Versão: ${data.version}`);
      console.log(`Status: ${data.status}`);
      console.log(`Ordem: ${data.order}`);
      console.log(`Obrigatório para novos usuários: ${data.required_for_registration}`);
      console.log(`Obrigatório para usuários existentes: ${data.required_for_existing_users}`);
      console.log(`Criado em: ${data.created_at?.toDate?.()?.toLocaleString('pt-BR') || 'N/A'}`);
      console.log('');
    });

    console.log('─'.repeat(60));

    // Verificar se há pelo menos um documento ativo e obrigatório para novos usuários
    const activeForNewUsers = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data.status === 'ativo' && data.required_for_registration === true;
    });

    console.log('\n📊 ANÁLISE:');
    if (activeForNewUsers.length === 0) {
      console.log('❌ PROBLEMA: Nenhum termo ativo e obrigatório para novos usuários!');
      console.log('   Solução: Ative ou crie um termo com required_for_registration = true\n');
    } else {
      console.log(`✅ ${activeForNewUsers.length} termo(s) ativo(s) para novos usuários`);
      activeForNewUsers.forEach(doc => {
        console.log(`   - ${doc.data().title} (versão ${doc.data().version})`);
      });
      console.log('');
    }

    // Verificar se há termos para usuários existentes
    const activeForExisting = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data.status === 'ativo' && data.required_for_existing_users === true;
    });

    if (activeForExisting.length > 0) {
      console.log(`ℹ️  ${activeForExisting.length} termo(s) ativo(s) para usuários existentes`);
      activeForExisting.forEach(doc => {
        console.log(`   - ${doc.data().title} (versão ${doc.data().version})`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Erro ao verificar termos:', error);
  } finally {
    process.exit(0);
  }
}

checkTerms();
