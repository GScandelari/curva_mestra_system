/**
 * Script para atualizar produtos master do catálogo Rennova
 *
 * Este script:
 * 1. Inativa todos os produtos master existentes
 * 2. Cria novos produtos a partir do arquivo lista_completa.txt
 * 3. Adiciona o grupo de cada produto
 *
 * Uso: node scripts/update-master-products-with-groups.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  try {
    // Tentar usar service account se existir
    const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

    if (fs.existsSync(serviceAccountPath)) {
      console.log('✅ Usando service account key...');
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'curva-mestra',
      });
    } else {
      // Usar credenciais do Firebase CLI / ambiente
      console.log('⚠️  Service account não encontrado, usando credenciais do ambiente...');
      console.log('💡 Execute: firebase login && firebase use curva-mestra\n');

      // Tentar usar GOOGLE_APPLICATION_CREDENTIALS
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.error('❌ ERRO: Nenhuma credencial encontrada!');
        console.error('\nOpções:');
        console.error('1. Baixar service account key do Firebase Console e salvar como serviceAccountKey.json');
        console.error('2. Ou definir: export GOOGLE_APPLICATION_CREDENTIALS="path/to/key.json"');
        console.error('\nFirebase Console: https://console.firebase.google.com/project/curva-mestra/settings/serviceaccounts/adminsdk\n');
        process.exit(1);
      }

      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'curva-mestra',
      });
    }
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase Admin:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

// Configurações
const LISTA_PRODUTOS_PATH = path.join(
  __dirname,
  '../_lista_produtos_rennova_/lista_completa.txt'
);

/**
 * Parse do arquivo de produtos
 * Retorna array de produtos com grupo
 */
function parseListaProdutos(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map(line => line.trim());

  const produtos = [];
  let grupoAtual = null;

  for (const line of lines) {
    // Ignorar linhas vazias
    if (!line) {
      continue;
    }

    // Verificar se é uma linha de grupo (não começa com número)
    const isGrupo = !/^\d/.test(line);

    if (isGrupo) {
      // Nova categoria/grupo
      grupoAtual = line;
      console.log(`📦 Grupo: ${grupoAtual}`);
    } else {
      // Produto: formato "CODIGO NOME DO PRODUTO"
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (match) {
        const codigo = match[1];
        const nome = match[2].trim();

        if (!grupoAtual) {
          console.warn(`⚠️  Produto sem grupo: ${codigo} ${nome}`);
          continue;
        }

        produtos.push({
          codigo,
          nome,
          grupo: grupoAtual,
        });
      } else {
        console.warn(`⚠️  Linha inválida: ${line}`);
      }
    }
  }

  return produtos;
}

/**
 * Inativa todos os produtos master existentes
 */
async function inactivateAllMasterProducts() {
  console.log('\n📋 Inativando todos os produtos master existentes...');

  const masterProductsRef = db.collection('master_products');
  const snapshot = await masterProductsRef.get();

  if (snapshot.empty) {
    console.log('ℹ️  Nenhum produto master encontrado no banco.');
    return 0;
  }

  const batch = db.batch();
  let count = 0;

  snapshot.forEach((doc) => {
    batch.update(doc.ref, {
      active: false,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    count++;
  });

  await batch.commit();
  console.log(`✅ ${count} produtos master foram inativados.`);
  return count;
}

/**
 * Cria novos produtos master
 */
async function createMasterProducts(produtos) {
  console.log(`\n📦 Criando ${produtos.length} novos produtos master...`);

  // Processar em lotes de 500 (limite do Firestore)
  const BATCH_SIZE = 500;
  let totalCreated = 0;

  for (let i = 0; i < produtos.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchProdutos = produtos.slice(i, i + BATCH_SIZE);

    for (const produto of batchProdutos) {
      // Usar código como ID do documento para evitar duplicatas
      const docRef = db.collection('master_products').doc(produto.codigo);

      batch.set(docRef, {
        code: produto.codigo,      // ← Usar 'code' ao invés de 'codigo'
        name: produto.nome.toUpperCase(),  // ← Usar 'name' ao invés de 'nome'
        grupo: produto.grupo,
        active: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      totalCreated++;
    }

    await batch.commit();
    console.log(`   ✓ Lote ${Math.floor(i / BATCH_SIZE) + 1} criado (${batchProdutos.length} produtos)`);
  }

  console.log(`✅ ${totalCreated} produtos master foram criados.`);
  return totalCreated;
}

/**
 * Gera estatísticas dos produtos por grupo
 */
function gerarEstatisticas(produtos) {
  const estatisticas = {};

  produtos.forEach(produto => {
    if (!estatisticas[produto.grupo]) {
      estatisticas[produto.grupo] = 0;
    }
    estatisticas[produto.grupo]++;
  });

  return estatisticas;
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando atualização de produtos master...\n');
  console.log('📂 Arquivo:', LISTA_PRODUTOS_PATH);

  // Verificar se arquivo existe
  if (!fs.existsSync(LISTA_PRODUTOS_PATH)) {
    console.error(`❌ Arquivo não encontrado: ${LISTA_PRODUTOS_PATH}`);
    process.exit(1);
  }

  try {
    // 1. Parse do arquivo
    console.log('\n📖 Lendo arquivo de produtos...');
    const produtos = parseListaProdutos(LISTA_PRODUTOS_PATH);
    console.log(`✅ ${produtos.length} produtos encontrados no arquivo.`);

    // 2. Mostrar estatísticas
    console.log('\n📊 Estatísticas por grupo:');
    const stats = gerarEstatisticas(produtos);
    Object.entries(stats).forEach(([grupo, count]) => {
      console.log(`   • ${grupo}: ${count} produtos`);
    });

    // 3. Confirmar com usuário
    console.log('\n⚠️  ATENÇÃO: Esta operação irá:');
    console.log('   1. Inativar TODOS os produtos master existentes');
    console.log(`   2. Criar ${produtos.length} novos produtos master com grupos`);
    console.log('\n');

    // Aguardar 3 segundos antes de continuar
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 4. Inativar produtos existentes
    const inactivated = await inactivateAllMasterProducts();

    // 5. Criar novos produtos
    const created = await createMasterProducts(produtos);

    // 6. Resumo final
    console.log('\n' + '='.repeat(60));
    console.log('✅ ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(60));
    console.log(`📊 Resumo:`);
    console.log(`   • Produtos inativados: ${inactivated}`);
    console.log(`   • Produtos criados: ${created}`);
    console.log(`   • Grupos: ${Object.keys(stats).length}`);
    console.log('='.repeat(60));

    // 7. Mostrar exemplo de produto criado
    console.log('\n📄 Exemplo de produto criado:');
    const exemplo = produtos[0];
    console.log(JSON.stringify({
      code: exemplo.codigo,
      name: exemplo.nome,
      grupo: exemplo.grupo,
      active: true,
    }, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro durante a execução:', error);
    process.exit(1);
  }
}

// Executar
main();
