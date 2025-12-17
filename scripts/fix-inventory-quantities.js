/**
 * Script para recalcular quantidade_disponivel e quantidade_reservada
 * com base nas solicitações existentes
 *
 * Uso: node scripts/fix-inventory-quantities.js <tenant_id> [--dry-run]
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function recalcularInventario(tenantId, dryRun = false) {
  console.log('\n========================================');
  console.log('RECÁLCULO DE INVENTÁRIO');
  console.log('========================================\n');
  console.log(`Tenant: ${tenantId}`);
  console.log(`Modo: ${dryRun ? 'DRY RUN (simulação)' : 'PRODUÇÃO (vai alterar dados)'}\n`);

  try {
    // 1. Buscar todos os itens do inventário
    const inventoryRef = db.collection('tenants').doc(tenantId).collection('inventory');
    const inventorySnapshot = await inventoryRef.where('active', '==', true).get();

    console.log(`✓ Encontrados ${inventorySnapshot.size} itens no inventário\n`);

    // 2. Buscar todas as solicitações AGENDADAS (que têm reserva ativa)
    const solicitacoesRef = db.collection('tenants').doc(tenantId).collection('solicitacoes');
    const solicitacoesSnapshot = await solicitacoesRef.where('status', '==', 'agendada').get();

    console.log(`✓ Encontradas ${solicitacoesSnapshot.size} solicitações agendadas\n`);

    // 3. Calcular reservas por item de inventário
    const reservasPorItem = new Map();

    solicitacoesSnapshot.forEach(doc => {
      const solicitacao = doc.data();

      if (solicitacao.produtos_solicitados && Array.isArray(solicitacao.produtos_solicitados)) {
        solicitacao.produtos_solicitados.forEach(produto => {
          const itemId = produto.inventory_item_id;
          const quantidade = produto.quantidade || 0;

          if (itemId) {
            const reservaAtual = reservasPorItem.get(itemId) || 0;
            reservasPorItem.set(itemId, reservaAtual + quantidade);
          }
        });
      }
    });

    console.log(`✓ Calculadas reservas para ${reservasPorItem.size} itens diferentes\n`);

    // 4. Recalcular e corrigir cada item
    const batch = db.batch();
    let itensCorrigidos = 0;
    let itensComErro = 0;
    const erros = [];

    console.log('========================================');
    console.log('ANÁLISE POR ITEM');
    console.log('========================================\n');

    for (const doc of inventorySnapshot.docs) {
      const itemId = doc.id;
      const item = doc.data();

      const quantidadeInicial = item.quantidade_inicial || 0;
      const quantidadeReservadaAtual = item.quantidade_reservada || 0;
      const quantidadeDisponivelAtual = item.quantidade_disponivel || 0;

      // Calcular reserva correta
      const reservaCorreta = reservasPorItem.get(itemId) || 0;

      // Calcular disponível correto
      // Fórmula: disponivel = inicial - reservada
      const disponivelCorreto = Math.max(0, quantidadeInicial - reservaCorreta);

      // Verificar se há discrepância
      const temErro = (quantidadeReservadaAtual !== reservaCorreta) ||
                      (quantidadeDisponivelAtual !== disponivelCorreto);

      if (temErro) {
        itensComErro++;

        console.log(`📦 Item: ${item.nome_produto || item.codigo_produto}`);
        console.log(`   ID: ${itemId}`);
        console.log(`   Lote: ${item.lote}`);
        console.log(`
   VALORES ATUAIS:
   - Inicial: ${quantidadeInicial}
   - Reservada: ${quantidadeReservadaAtual}
   - Disponível: ${quantidadeDisponivelAtual}

   VALORES CORRETOS:
   - Inicial: ${quantidadeInicial} (não muda)
   - Reservada: ${reservaCorreta} ${quantidadeReservadaAtual !== reservaCorreta ? '⚠️' : '✓'}
   - Disponível: ${disponivelCorreto} ${quantidadeDisponivelAtual !== disponivelCorreto ? '⚠️' : '✓'}

   DIFERENÇA:
   - Reservada: ${reservaCorreta - quantidadeReservadaAtual > 0 ? '+' : ''}${reservaCorreta - quantidadeReservadaAtual}
   - Disponível: ${disponivelCorreto - quantidadeDisponivelAtual > 0 ? '+' : ''}${disponivelCorreto - quantidadeDisponivelAtual}
`);

        if (!dryRun) {
          batch.update(doc.ref, {
            quantidade_reservada: reservaCorreta,
            quantidade_disponivel: disponivelCorreto,
            updated_at: admin.firestore.Timestamp.now(),
          });
          itensCorrigidos++;
        }
      }
    }

    console.log('\n========================================');
    console.log('RESUMO');
    console.log('========================================\n');
    console.log(`Total de itens analisados: ${inventorySnapshot.size}`);
    console.log(`Itens com valores incorretos: ${itensComErro}`);
    console.log(`Itens corretos: ${inventorySnapshot.size - itensComErro}\n`);

    if (!dryRun && itensCorrigidos > 0) {
      const confirmar = await question(
        `\n⚠️  ATENÇÃO: Isso irá atualizar ${itensCorrigidos} itens no banco de dados.\n` +
        `Deseja continuar? (digite 'SIM' para confirmar): `
      );

      if (confirmar.trim().toUpperCase() === 'SIM') {
        await batch.commit();
        console.log(`\n✅ ${itensCorrigidos} itens corrigidos com sucesso!`);
      } else {
        console.log('\n❌ Operação cancelada pelo usuário.');
      }
    } else if (dryRun) {
      console.log(`\n💡 Modo DRY RUN: Nenhuma alteração foi feita.`);
      console.log(`   Execute sem --dry-run para aplicar as correções.`);
    } else {
      console.log(`\n✅ Todos os itens já estão corretos!`);
    }

  } catch (error) {
    console.error('\n❌ Erro ao recalcular inventário:', error);
    throw error;
  } finally {
    rl.close();
  }
}

// Executar
const args = process.argv.slice(2);
const tenantId = args[0];
const dryRun = args.includes('--dry-run');

if (!tenantId) {
  console.error('\n❌ Erro: Tenant ID é obrigatório');
  console.log('\nUso: node scripts/fix-inventory-quantities.js <tenant_id> [--dry-run]\n');
  console.log('Exemplos:');
  console.log('  node scripts/fix-inventory-quantities.js clinic_abc123 --dry-run');
  console.log('  node scripts/fix-inventory-quantities.js clinic_abc123\n');
  process.exit(1);
}

recalcularInventario(tenantId, dryRun)
  .then(() => {
    console.log('\n✓ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
