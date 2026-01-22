/**
 * Script de auditoria de inventário - Versão Web
 * Execute este arquivo no console do navegador quando estiver logado no sistema
 *
 * Como usar:
 * 1. Faça login no sistema como admin
 * 2. Abra o console do navegador (F12)
 * 3. Cole este script e execute
 */

async function auditarInventarioWeb() {
  console.log('\n========================================');
  console.log('AUDITORIA DE INVENTÁRIO - WEB');
  console.log('========================================\n');

  // Verificar se Firebase está disponível
  if (typeof window === 'undefined' || !window.firebase) {
    console.error('❌ Firebase não encontrado. Execute este script no console do navegador.');
    return;
  }

  const db = window.firebase.firestore();

  // Pegar tenant_id do usuário logado
  const auth = window.firebase.auth();
  const user = auth.currentUser;

  if (!user) {
    console.error('❌ Usuário não está logado');
    return;
  }

  const token = await user.getIdTokenResult();
  const tenantId = token.claims.tenant_id;

  if (!tenantId) {
    console.error('❌ Tenant ID não encontrado no usuário');
    return;
  }

  console.log(`✓ Tenant: ${tenantId}\n`);

  try {
    // Buscar inventário
    const inventorySnapshot = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('inventory')
      .where('active', '==', true)
      .get();

    // Buscar solicitações (agendadas E aprovadas têm reserva, concluídas foram consumidas)
    const agendadasSnapshot = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('solicitacoes')
      .where('status', '==', 'agendada')
      .get();

    const aprovadasSnapshot = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('solicitacoes')
      .where('status', '==', 'aprovada')
      .get();

    const concluidasSnapshot = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('solicitacoes')
      .where('status', '==', 'concluida')
      .get();

    console.log(`✓ ${inventorySnapshot.size} itens no inventário`);
    console.log(`✓ ${agendadasSnapshot.size} solicitações agendadas`);
    console.log(`✓ ${aprovadasSnapshot.size} solicitações aprovadas`);
    console.log(`✓ ${concluidasSnapshot.size} solicitações concluídas\n`);

    // Calcular reservas esperadas (agendadas + aprovadas)
    const reservasEsperadas = new Map();

    // Reservas das agendadas
    agendadasSnapshot.forEach(doc => {
      const solicitacao = doc.data();
      if (solicitacao.produtos_solicitados) {
        solicitacao.produtos_solicitados.forEach(p => {
          const atual = reservasEsperadas.get(p.inventory_item_id) || 0;
          reservasEsperadas.set(p.inventory_item_id, atual + (p.quantidade || 0));
        });
      }
    });

    // Reservas das aprovadas
    aprovadasSnapshot.forEach(doc => {
      const solicitacao = doc.data();
      if (solicitacao.produtos_solicitados) {
        solicitacao.produtos_solicitados.forEach(p => {
          const atual = reservasEsperadas.get(p.inventory_item_id) || 0;
          reservasEsperadas.set(p.inventory_item_id, atual + (p.quantidade || 0));
        });
      }
    });

    // Calcular quantidades consumidas (concluídas)
    const quantidadesConsumidas = new Map();

    concluidasSnapshot.forEach(doc => {
      const solicitacao = doc.data();
      if (solicitacao.produtos_solicitados) {
        solicitacao.produtos_solicitados.forEach(p => {
          const atual = quantidadesConsumidas.get(p.inventory_item_id) || 0;
          quantidadesConsumidas.set(p.inventory_item_id, atual + (p.quantidade || 0));
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
      const consumido = quantidadesConsumidas.get(doc.id) || 0;

      const info = {
        id: doc.id,
        nome: item.nome_produto || item.codigo_produto,
        lote: item.lote,
        inicial,
        reservada,
        disponivel,
        reservaEsperada,
        consumido,
      };

      // Verificar fórmula (inicial = disponível + reservada + consumido)
      const somaAtual = disponivel + reservada + consumido;
      const formulaCorreta = somaAtual === inicial;

      // Verificar reserva
      const reservaCorreta = reservada === reservaEsperada;

      // Verificar disponível (disponível = inicial - consumido - reservado)
      const disponivelEsperado = Math.max(0, inicial - consumido - reservaEsperada);
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
      console.table(problemas.formulaQuebrada.map(p => ({
        Nome: p.nome,
        Lote: p.lote,
        Inicial: p.inicial,
        'Disp+Res': p.somaAtual,
        Diferença: p.diferenca
      })));
    }

    if (problemas.reservaIncorreta.length > 0) {
      console.log('\n🟡 RESERVA INCORRETA:');
      console.log(`   ${problemas.reservaIncorreta.length} itens\n`);
      console.table(problemas.reservaIncorreta.map(p => ({
        Nome: p.nome,
        Lote: p.lote,
        Atual: p.reservada,
        Esperada: p.reservaEsperada,
        Diferença: p.diferencaReserva
      })));
    }

    if (problemas.disponivelIncorreto.length > 0) {
      console.log('\n🟡 DISPONÍVEL INCORRETO:');
      console.log(`   ${problemas.disponivelIncorreto.length} itens\n`);
      console.table(problemas.disponivelIncorreto.map(p => ({
        Nome: p.nome,
        Lote: p.lote,
        Atual: p.disponivel,
        Esperado: p.disponivelEsperado,
        Diferença: p.diferencaDisponivel
      })));
    }

    console.log('\n✅ ITENS CORRETOS:');
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
      console.log('💡 Para corrigir, use a ferramenta de correção no painel admin');
      console.log('   ou execute: corrigirInventarioWeb()');
    } else {
      console.log('✅ Tudo certo! Nenhuma correção necessária.\n');
    }

    // Retornar dados para possível correção
    return {
      tenantId,
      problemas,
      totalProblemas,
      reservasEsperadas
    };

  } catch (error) {
    console.error('\n❌ Erro ao auditar inventário:', error);
    throw error;
  }
}

// Executar
console.log('📊 Executando auditoria...');
auditarInventarioWeb().then(result => {
  if (result) {
    console.log('\n✓ Auditoria concluída');
    console.log('\n💾 Dados salvos em: window.auditoriaResult');
    window.auditoriaResult = result;
  }
}).catch(error => {
  console.error('❌ Erro:', error);
});
