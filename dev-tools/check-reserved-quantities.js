// Script para verificar quantidades reservadas no inventário
// Este script deve ser executado com as variáveis de ambiente do Firebase configuradas

require('dotenv').config({ path: '.env.local' });

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, collectionGroup } = require('firebase/firestore');

// Configuração do Firebase (valores de exemplo - substituir pelos reais)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkReservedQuantities() {
  try {
    console.log('=== Verificando Quantidades Reservadas ===\n');

    // 1. Buscar produtos com quantidade_reservada > 0
    const inventoryQuery = query(
      collectionGroup(db, 'inventory'),
      where('quantidade_reservada', '>', 0)
    );

    const inventorySnapshot = await getDocs(inventoryQuery);

    console.log(`Encontrados ${inventorySnapshot.size} produtos com estoque reservado:\n`);

    const reservedProducts = [];
    inventorySnapshot.forEach(doc => {
      const data = doc.data();
      reservedProducts.push({
        id: doc.id,
        nome: data.nome_produto,
        lote: data.lote,
        disponivel: data.quantidade_disponivel,
        reservado: data.quantidade_reservada || 0,
        total: data.quantidade_disponivel + (data.quantidade_reservada || 0)
      });

      console.log(`Produto: ${data.nome_produto}`);
      console.log(`  Lote: ${data.lote}`);
      console.log(`  Disponível: ${data.quantidade_disponivel}`);
      console.log(`  Reservado: ${data.quantidade_reservada || 0}`);
      console.log(`  Total: ${data.quantidade_disponivel + (data.quantidade_reservada || 0)}`);
      console.log('');
    });

    // 2. Buscar solicitações agendadas
    console.log('\n=== Solicitações Agendadas ===\n');
    const solicitacoesQuery = query(
      collectionGroup(db, 'solicitacoes'),
      where('status', '==', 'agendada')
    );

    const solicitacoesSnapshot = await getDocs(solicitacoesQuery);

    console.log(`Encontradas ${solicitacoesSnapshot.size} solicitações agendadas:\n`);

    const expectedReservations = {};

    solicitacoesSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`Solicitação ID: ${doc.id}`);
      console.log(`  Paciente: ${data.paciente_nome}`);
      console.log(`  Data Procedimento: ${data.dt_procedimento?.toDate().toLocaleDateString('pt-BR')}`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Produtos:`);

      data.produtos_solicitados?.forEach(p => {
        console.log(`    - ${p.produto_nome} (Lote: ${p.lote}) - Qtd: ${p.quantidade}`);

        // Acumular reservas esperadas por produto+lote
        const key = `${p.produto_nome}|${p.lote}`;
        if (!expectedReservations[key]) {
          expectedReservations[key] = {
            produto: p.produto_nome,
            lote: p.lote,
            total: 0
          };
        }
        expectedReservations[key].total += p.quantidade;
      });
      console.log('');
    });

    // 3. Comparar reservas esperadas vs. reais
    console.log('\n=== Comparação: Esperado vs. Real ===\n');

    for (const key in expectedReservations) {
      const expected = expectedReservations[key];
      const found = reservedProducts.find(
        p => p.nome === expected.produto && p.lote === expected.lote
      );

      console.log(`${expected.produto} (Lote: ${expected.lote})`);
      console.log(`  Esperado: ${expected.total}`);
      console.log(`  Real: ${found ? found.reservado : 0}`);

      if (!found || found.reservado !== expected.total) {
        console.log(`  ❌ DIVERGÊNCIA DETECTADA!`);
      } else {
        console.log(`  ✓ OK`);
      }
      console.log('');
    }

    // 4. Verificar se há produtos com reserva mas sem solicitações agendadas
    console.log('\n=== Produtos com Reserva Órfã ===\n');
    let hasOrphan = false;

    for (const product of reservedProducts) {
      const key = `${product.nome}|${product.lote}`;
      if (!expectedReservations[key]) {
        console.log(`${product.nome} (Lote: ${product.lote})`);
        console.log(`  Reservado: ${product.reservado}`);
        console.log(`  ⚠️  Não há solicitação agendada correspondente!`);
        console.log('');
        hasOrphan = true;
      }
    }

    if (!hasOrphan) {
      console.log('Nenhuma reserva órfã encontrada.\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

checkReservedQuantities();
