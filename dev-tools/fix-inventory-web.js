/**
 * Script de correção de inventário - Versão Web
 * Execute este arquivo no console do navegador quando estiver logado no sistema
 *
 * IMPORTANTE: Execute audit-inventory-web.js primeiro para ver os problemas!
 *
 * Como usar:
 * 1. Faça login no sistema como admin
 * 2. Execute audit-inventory-web.js primeiro
 * 3. Cole este script e execute
 */

async function corrigirInventarioWeb(dryRun = true) {
  console.log('\n========================================');
  console.log('CORREÇÃO DE INVENTÁRIO - WEB');
  console.log('========================================\n');
  console.log(`Modo: ${dryRun ? 'DRY RUN (simulação)' : 'PRODUÇÃO (vai alterar dados)'}\n`);

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

    console.log(`✓ Calculadas reservas para ${reservasEsperadas.size} itens diferentes`);
    console.log(`✓ Calculadas quantidades consumidas para ${quantidadesConsumidas.size} itens diferentes\n`);

    // Preparar correções
    const batch = db.batch();
    let itensCorrigidos = 0;
    const correcoes = [];

    console.log('========================================');
    console.log('ITENS A CORRIGIR');
    console.log('========================================\n');

    inventorySnapshot.forEach(doc => {
      const item = doc.data();
      const inicial = item.quantidade_inicial || 0;
      const reservadaAtual = item.quantidade_reservada || 0;
      const disponivelAtual = item.quantidade_disponivel || 0;

      // Calcular valores corretos
      const reservaCorreta = reservasEsperadas.get(doc.id) || 0;
      const consumido = quantidadesConsumidas.get(doc.id) || 0;
      const disponivelCorreto = Math.max(0, inicial - consumido - reservaCorreta);

      // Verificar se precisa correção
      const precisaCorrigir = (reservadaAtual !== reservaCorreta) ||
                              (disponivelAtual !== disponivelCorreto);

      if (precisaCorrigir) {
        const correcao = {
          id: doc.id,
          nome: item.nome_produto || item.codigo_produto,
          lote: item.lote,
          antes: {
            inicial,
            reservada: reservadaAtual,
            disponivel: disponivelAtual
          },
          depois: {
            inicial,
            reservada: reservaCorreta,
            disponivel: disponivelCorreto
          },
          diferenca: {
            reservada: reservaCorreta - reservadaAtual,
            disponivel: disponivelCorreto - disponivelAtual
          }
        };

        correcoes.push(correcao);

        console.log(`📦 ${correcao.nome} (${correcao.lote})`);
        console.log(`   Reservada: ${reservadaAtual} → ${reservaCorreta} (${correcao.diferenca.reservada > 0 ? '+' : ''}${correcao.diferenca.reservada})`);
        console.log(`   Disponível: ${disponivelAtual} → ${disponivelCorreto} (${correcao.diferenca.disponivel > 0 ? '+' : ''}${correcao.diferenca.disponivel})\n`);

        if (!dryRun) {
          batch.update(doc.ref, {
            quantidade_reservada: reservaCorreta,
            quantidade_disponivel: disponivelCorreto,
            updated_at: window.firebase.firestore.Timestamp.now(),
          });
          itensCorrigidos++;
        }
      }
    });

    console.log('========================================');
    console.log('RESUMO');
    console.log('========================================\n');
    console.log(`Total de itens: ${inventorySnapshot.size}`);
    console.log(`Itens a corrigir: ${correcoes.length}\n`);

    if (dryRun) {
      console.log('💡 Modo DRY RUN: Nenhuma alteração foi feita.');
      console.log('   Execute: corrigirInventarioWeb(false) para aplicar as correções\n');

      // Mostrar resumo em tabela
      if (correcoes.length > 0) {
        console.table(correcoes.map(c => ({
          Nome: c.nome,
          Lote: c.lote,
          'Res Antes': c.antes.reservada,
          'Res Depois': c.depois.reservada,
          'Disp Antes': c.antes.disponivel,
          'Disp Depois': c.depois.disponivel
        })));
      }

      return { correcoes, dryRun: true };
    }

    if (correcoes.length === 0) {
      console.log('✅ Nenhuma correção necessária!\n');
      return { correcoes: [], dryRun: false };
    }

    // Pedir confirmação
    const confirmacao = confirm(
      `⚠️  ATENÇÃO: Isso irá atualizar ${itensCorrigidos} itens no banco de dados.\n\n` +
      `Deseja continuar?`
    );

    if (!confirmacao) {
      console.log('\n❌ Operação cancelada pelo usuário.\n');
      return { correcoes, cancelado: true };
    }

    // Aplicar correções
    await batch.commit();

    console.log(`\n✅ ${itensCorrigidos} itens corrigidos com sucesso!\n`);

    // Mostrar resumo
    console.table(correcoes.map(c => ({
      Nome: c.nome,
      Lote: c.lote,
      'Δ Reservada': c.diferenca.reservada,
      'Δ Disponível': c.diferenca.disponivel
    })));

    return { correcoes, corrigidos: itensCorrigidos };

  } catch (error) {
    console.error('\n❌ Erro ao corrigir inventário:', error);
    throw error;
  }
}

// Executar em modo dry-run por padrão
console.log('🔧 Executando correção (DRY RUN)...');
console.log('💡 Para aplicar as correções de verdade, execute: corrigirInventarioWeb(false)\n');

corrigirInventarioWeb(true).then(result => {
  if (result) {
    console.log('\n✓ Análise concluída');
    console.log('\n💾 Dados salvos em: window.correcaoResult');
    window.correcaoResult = result;

    if (result.dryRun && result.correcoes.length > 0) {
      console.log('\n📌 PRÓXIMOS PASSOS:');
      console.log('   1. Revise as correções acima');
      console.log('   2. Execute: corrigirInventarioWeb(false)');
      console.log('   3. Confirme quando perguntado\n');
    }
  }
}).catch(error => {
  console.error('❌ Erro:', error);
});
