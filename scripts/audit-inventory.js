/**
 * Script de auditoria de inventário
 * Verifica a consistência entre quantidade_inicial, quantidade_disponivel e quantidade_reservada
 *
 * Uso: node scripts/audit-inventory.js <tenant_id>
 */

const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function auditarInventario(tenantId) {
  console.log('\n========================================');
  console.log('AUDITORIA DE INVENTÁRIO');
  console.log('========================================\n');
  console.log(`Tenant: ${tenantId}\n`);

  try {
    // Buscar inventário
    const inventoryRef = db.collection('tenants').doc(tenantId).collection('inventory');
    const inventorySnapshot = await inventoryRef.where('active', '==', true).get();

    // Buscar solicitações agendadas
    const solicitacoesRef = db.collection('tenants').doc(tenantId).collection('solicitacoes');
    const agendadasSnapshot = await solicitacoesRef.where('status', '==', 'agendada').get();

    console.log(`✓ ${inventorySnapshot.size} itens no inventário`);
    console.log(`✓ ${agendadasSnapshot.size} solicitações agendadas\n`);

    // Calcular reservas esperadas
    const reservasEsperadas = new Map();
    agendadasSnapshot.forEach(doc => {
      const solicitacao = doc.data();
      if (solicitacao.produtos_solicitados) {
        solicitacao.produtos_solicitados.forEach(p => {
          const atual = reservasEsperadas.get(p.inventory_item_id) || 0;
          reservasEsperadas.set(p.inventory_item_id, atual + (p.quantidade || 0));
        });
      }
    });

    // Analisar cada item
    const problemas = {
      reservaIncorreta: [],
      disponivelIncorreto: [],
      formulaQuebrada: [],
      ok: []
    };

    inventorySnapshot.forEach(doc => {
      const item = { id: doc.id, ...doc.data() };
      const inicial = item.quantidade_inicial || 0;
      const reservada = item.quantidade_reservada || 0;
      const disponivel = item.quantidade_disponivel || 0;
      const reservaEsperada = reservasEsperadas.get(doc.id) || 0;

      const info = {
        id: doc.id,
        nome: item.nome_produto || item.codigo_produto,
        lote: item.lote,
        inicial,
        reservada,
        disponivel,
        reservaEsperada,
      };

      // Verificar se a fórmula básica está correta
      // inicial = disponivel + reservada
      const somaAtual = disponivel + reservada;
      const formulaCorreta = somaAtual === inicial;

      // Verificar se a reserva está correta
      const reservaCorreta = reservada === reservaEsperada;

      // Verificar se disponível está correto
      const disponivelEsperado = inicial - reservaEsperada;
      const disponivelCorreto = disponivel === disponivelEsperado;

      if (!formulaCorreta) {
        problemas.formulaQuebrada.push({
          ...info,
          somaAtual,
          diferenca: inicial - somaAtual
        });
      } else if (!reservaCorreta) {
        problemas.reservaIncorreta.push({
          ...info,
          diferencaReserva: reservada - reservaEsperada
        });
      } else if (!disponivelCorreto) {
        problemas.disponivelIncorreto.push({
          ...info,
          disponivelEsperado,
          diferencaDisponivel: disponivel - disponivelEsperado
        });
      } else {
        problemas.ok.push(info);
      }
    });

    // Relatório
    console.log('========================================');
    console.log('RESULTADO DA AUDITORIA');
    console.log('========================================\n');

    if (problemas.formulaQuebrada.length > 0) {
      console.log('🔴 FÓRMULA QUEBRADA (inicial ≠ disponivel + reservada):');
      console.log(`   ${problemas.formulaQuebrada.length} itens\n`);
      problemas.formulaQuebrada.forEach(p => {
        console.log(`   ${p.nome} (${p.lote})`);
        console.log(`   ID: ${p.id}`);
        console.log(`   Inicial: ${p.inicial}`);
        console.log(`   Disponível + Reservada: ${p.somaAtual}`);
        console.log(`   Diferença: ${p.diferenca > 0 ? '+' : ''}${p.diferenca}\n`);
      });
    }

    if (problemas.reservaIncorreta.length > 0) {
      console.log('🟡 RESERVA INCORRETA:');
      console.log(`   ${problemas.reservaIncorreta.length} itens\n`);
      problemas.reservaIncorreta.forEach(p => {
        console.log(`   ${p.nome} (${p.lote})`);
        console.log(`   ID: ${p.id}`);
        console.log(`   Reservada: ${p.reservada} | Esperada: ${p.reservaEsperada}`);
        console.log(`   Diferença: ${p.diferencaReserva > 0 ? '+' : ''}${p.diferencaReserva}\n`);
      });
    }

    if (problemas.disponivelIncorreto.length > 0) {
      console.log('🟡 DISPONÍVEL INCORRETO:');
      console.log(`   ${problemas.disponivelIncorreto.length} itens\n`);
      problemas.disponivelIncorreto.forEach(p => {
        console.log(`   ${p.nome} (${p.lote})`);
        console.log(`   ID: ${p.id}`);
        console.log(`   Disponível: ${p.disponivel} | Esperado: ${p.disponivelEsperado}`);
        console.log(`   Diferença: ${p.diferencaDisponivel > 0 ? '+' : ''}${p.diferencaDisponivel}\n`);
      });
    }

    console.log('✅ ITENS CORRETOS:');
    console.log(`   ${problemas.ok.length} itens\n`);

    // Resumo
    const totalProblemas = problemas.formulaQuebrada.length +
                          problemas.reservaIncorreta.length +
                          problemas.disponivelIncorreto.length;

    console.log('========================================');
    console.log('RESUMO');
    console.log('========================================\n');
    console.log(`Total de itens: ${inventorySnapshot.size}`);
    console.log(`Itens OK: ${problemas.ok.length}`);
    console.log(`Itens com problemas: ${totalProblemas}\n`);

    if (totalProblemas > 0) {
      console.log('💡 Para corrigir, execute:');
      console.log(`   node scripts/fix-inventory-quantities.js ${tenantId} --dry-run`);
      console.log(`   node scripts/fix-inventory-quantities.js ${tenantId}\n`);
    } else {
      console.log('✅ Tudo certo! Nenhuma correção necessária.\n');
    }

  } catch (error) {
    console.error('\n❌ Erro ao auditar inventário:', error);
    throw error;
  }
}

// Executar
const tenantId = process.argv[2];

if (!tenantId) {
  console.error('\n❌ Erro: Tenant ID é obrigatório');
  console.log('\nUso: node scripts/audit-inventory.js <tenant_id>\n');
  process.exit(1);
}

auditarInventario(tenantId)
  .then(() => {
    console.log('✓ Auditoria finalizada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
