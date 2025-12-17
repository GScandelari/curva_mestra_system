/**
 * Serviço de Solicitações (Agendamentos de Procedimentos)
 * Gerencia criação de solicitações com consumo imediato do inventário
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  runTransaction,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Solicitacao, ProdutoSolicitado, InventoryItem, StatusHistoryEntry, SolicitacaoStatus } from "@/types";
import {
  createRequestApprovedNotification,
  createRequestRejectedNotification,
} from "./notificationService";

// ============================================================================
// TIPOS E INTERFACES
// ============================================================================

export interface CreateSolicitacaoInput {
  paciente_codigo: string;
  paciente_nome: string;
  dt_procedimento: Date;
  produtos: {
    inventory_item_id: string;
    quantidade: number;
  }[];
  observacoes?: string;
}

export interface SolicitacaoWithDetails extends Solicitacao {
  total_produtos: number;
  valor_total: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determina o status inicial da solicitação
 * SEMPRE retorna "agendada" independente da data
 * Produtos são RESERVADOS e só consumidos ao mudar para "concluida"
 */
function determineInitialStatus(dtProcedimento: Date): SolicitacaoStatus {
  return "agendada";
}

// ============================================================================
// VALIDAÇÕES
// ============================================================================

/**
 * Valida se há estoque disponível para todos os produtos
 */
async function validateInventoryAvailability(
  tenantId: string,
  produtos: { inventory_item_id: string; quantidade: number }[]
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const produto of produtos) {
    const itemRef = doc(
      db,
      "tenants",
      tenantId,
      "inventory",
      produto.inventory_item_id
    );
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      errors.push(
        `Produto com ID ${produto.inventory_item_id} não encontrado no inventário`
      );
      continue;
    }

    const itemData = itemSnap.data() as any;

    if (itemData.active === false) {
      errors.push(`Produto ${itemData.nome_produto} está inativo`);
      continue;
    }

    if (itemData.quantidade_disponivel < produto.quantidade) {
      errors.push(
        `Estoque insuficiente para ${itemData.nome_produto} (Lote: ${itemData.lote}). ` +
          `Disponível: ${itemData.quantidade_disponivel}, Solicitado: ${produto.quantidade}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// CRIAÇÃO DE SOLICITAÇÃO (COM CONSUMO IMEDIATO)
// ============================================================================

/**
 * Cria uma solicitação e consome imediatamente do inventário
 * Usa transação para garantir atomicidade
 */
export async function createSolicitacaoWithConsumption(
  tenantId: string,
  userId: string,
  userName: string,
  input: CreateSolicitacaoInput
): Promise<{
  success: boolean;
  solicitacaoId?: string;
  error?: string;
  validationErrors?: string[];
}> {
  try {
    // 1. Validar disponibilidade de estoque
    const validation = await validateInventoryAvailability(
      tenantId,
      input.produtos
    );

    if (!validation.valid) {
      return {
        success: false,
        error: "Erro de validação de estoque",
        validationErrors: validation.errors,
      };
    }

    // 2. Buscar detalhes de todos os produtos para a solicitação
    const produtosDetalhados: ProdutoSolicitado[] = [];

    for (const produto of input.produtos) {
      const itemRef = doc(
        db,
        "tenants",
        tenantId,
        "inventory",
        produto.inventory_item_id
      );
      const itemSnap = await getDoc(itemRef);

      if (!itemSnap.exists()) {
        throw new Error(
          `Produto ${produto.inventory_item_id} não encontrado`
        );
      }

      const itemData = itemSnap.data() as InventoryItem;

      produtosDetalhados.push({
        inventory_item_id: produto.inventory_item_id,
        produto_codigo: itemData.codigo_produto,
        produto_nome: itemData.nome_produto,
        lote: itemData.lote,
        quantidade: produto.quantidade,
        quantidade_disponivel_antes: itemData.quantidade_disponivel,
        valor_unitario: itemData.valor_unitario,
      });
    }

    // 3. Determinar status inicial baseado na data do procedimento
    const statusInicial = determineInitialStatus(input.dt_procedimento);
    const isAgendada = statusInicial === "agendada";

    // 3.1. Criar solicitação e atualizar inventário em transação
    const solicitacaoRef = await runTransaction(db, async (transaction) => {
      // Função helper para remover campos undefined
      const removeUndefined = (obj: any): any => {
        const cleaned: any = {};
        Object.keys(obj).forEach((key) => {
          if (obj[key] !== undefined && obj[key] !== null) {
            if (typeof obj[key] === 'object' && !Array.isArray(obj[key]) && !(obj[key] instanceof Timestamp)) {
              cleaned[key] = removeUndefined(obj[key]);
            } else if (Array.isArray(obj[key])) {
              cleaned[key] = obj[key].map((item: any) =>
                typeof item === 'object' && item !== null ? removeUndefined(item) : item
              );
            } else {
              cleaned[key] = obj[key];
            }
          }
        });
        return cleaned;
      };

      // ========== FASE 1: TODAS AS LEITURAS ==========
      // 3.1. Ler e verificar estoque de todos os produtos
      const inventoryReads = [];
      for (const produto of input.produtos) {
        const itemRef = doc(
          db,
          "tenants",
          tenantId,
          "inventory",
          produto.inventory_item_id
        );
        inventoryReads.push({
          ref: itemRef,
          quantidade_solicitada: produto.quantidade,
        });
      }

      // Fazer todas as leituras
      const inventorySnapshots = await Promise.all(
        inventoryReads.map((item) => transaction.get(item.ref))
      );

      // Validar estoque
      const inventoryData: { ref: any; data: InventoryItem; quantidade_solicitada: number }[] = [];
      for (let i = 0; i < inventorySnapshots.length; i++) {
        const itemSnap = inventorySnapshots[i];
        const inventoryRead = inventoryReads[i];

        if (!itemSnap.exists()) {
          throw new Error(
            `Produto com ID ${input.produtos[i].inventory_item_id} não encontrado`
          );
        }

        const itemData = itemSnap.data() as InventoryItem;

        if (itemData.quantidade_disponivel < inventoryRead.quantidade_solicitada) {
          throw new Error(
            `Estoque insuficiente para ${itemData.nome_produto}. ` +
              `Disponível: ${itemData.quantidade_disponivel}, Solicitado: ${inventoryRead.quantidade_solicitada}`
          );
        }

        inventoryData.push({
          ref: inventoryRead.ref,
          data: itemData,
          quantidade_solicitada: inventoryRead.quantidade_solicitada,
        });
      }

      // ========== FASE 2: TODAS AS ESCRITAS ==========
      // 3.2. Criar entrada no histórico de status
      const now = Timestamp.now();
      const statusHistory: StatusHistoryEntry[] = [
        {
          status: statusInicial,
          changed_by: userId,
          changed_by_name: userName,
          changed_at: now,
          observacao: "Solicitação criada e produtos reservados",
        }
      ];

      // 3.3. Criar documento de solicitação
      const solicitacoesRef = collection(
        db,
        "tenants",
        tenantId,
        "solicitacoes"
      );
      const newSolicitacaoRef = doc(solicitacoesRef);

      const solicitacaoData = removeUndefined({
        tenant_id: tenantId,
        paciente_codigo: input.paciente_codigo,
        paciente_nome: input.paciente_nome,
        dt_procedimento: Timestamp.fromDate(input.dt_procedimento),
        produtos_solicitados: produtosDetalhados,
        status: statusInicial,
        status_history: statusHistory,
        observacoes: input.observacoes,
        created_by: userId,
        created_by_name: userName,
        created_at: now,
        updated_at: now,
      });

      transaction.set(newSolicitacaoRef, solicitacaoData);

      // 3.4. Atualizar inventário (sempre RESERVA no momento da criação)
      for (const item of inventoryData) {
        // Toda solicitação inicia como "agendada" → RESERVAR estoque
        // RESERVAR = mover do "disponível" para "reservado"
        const novaQuantidadeReservada =
          (item.data.quantidade_reservada || 0) + item.quantidade_solicitada;
        const novaQuantidadeDisponivel =
          (item.data.quantidade_disponivel || 0) - item.quantidade_solicitada;

        transaction.update(item.ref, {
          quantidade_reservada: novaQuantidadeReservada,
          quantidade_disponivel: novaQuantidadeDisponivel,
          updated_at: now,
        });
      }

      // 3.5. Registrar movimentação de estoque (para auditoria)
      for (const produto of produtosDetalhados) {
        const activityRef = collection(
          db,
          "tenants",
          tenantId,
          "inventory_activity"
        );

        const activityData = removeUndefined({
          tenant_id: tenantId,
          inventory_item_id: produto.inventory_item_id,
          produto_codigo: produto.produto_codigo,
          produto_nome: produto.produto_nome,
          lote: produto.lote,
          tipo: "reserva",
          quantidade: produto.quantidade,
          quantidade_anterior: produto.quantidade_disponivel_antes,
          quantidade_posterior: produto.quantidade_disponivel_antes, // Disponível não muda
          descricao: `Reserva para procedimento agendado - Paciente: ${input.paciente_nome} (${input.paciente_codigo})`,
          solicitacao_id: newSolicitacaoRef.id,
          created_by: userId,
          created_by_name: userName,
          timestamp: now,
        });

        transaction.set(doc(activityRef), activityData);
      }

      return newSolicitacaoRef;
    });

    return {
      success: true,
      solicitacaoId: solicitacaoRef.id,
    };
  } catch (error: any) {
    console.error("Erro ao criar solicitação:", error);
    return {
      success: false,
      error: error.message || "Erro ao criar solicitação",
    };
  }
}

// ============================================================================
// ATUALIZAÇÃO DE STATUS
// ============================================================================

/**
 * Atualiza o status de uma solicitação
 * - Aprovação: Consome estoque reservado (se agendada) ou apenas atualiza status
 * - Reprovação: Libera estoque reservado (se agendada)
 * - Cancelamento: Libera/devolve estoque conforme o status atual
 */
export async function updateSolicitacaoStatus(
  tenantId: string,
  solicitacaoId: string,
  userId: string,
  userName: string,
  newStatus: SolicitacaoStatus,
  observacao?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await runTransaction(db, async (transaction) => {
      // 1. Ler solicitação atual
      const solicitacaoRef = doc(
        db,
        "tenants",
        tenantId,
        "solicitacoes",
        solicitacaoId
      );
      const solicitacaoSnap = await transaction.get(solicitacaoRef);

      if (!solicitacaoSnap.exists()) {
        throw new Error("Solicitação não encontrada");
      }

      const solicitacao = solicitacaoSnap.data() as Solicitacao;
      const statusAnterior = solicitacao.status;

      // Validações de transição de status
      if (statusAnterior === newStatus) {
        throw new Error("A solicitação já está neste status");
      }

      // Fluxo válido:
      // agendada → aprovada | reprovada | cancelada
      // aprovada → concluida | cancelada
      // reprovada e cancelada → status final (não pode mudar)

      if (statusAnterior === "reprovada" || statusAnterior === "cancelada") {
        throw new Error(`Não é possível alterar uma solicitação ${statusAnterior}`);
      }

      if (statusAnterior === "concluida") {
        throw new Error("Não é possível alterar uma solicitação concluída");
      }

      if (statusAnterior === "agendada" && !["aprovada", "reprovada", "cancelada"].includes(newStatus)) {
        throw new Error("Status inválido. De 'agendada' só pode ir para: aprovada, reprovada ou cancelada");
      }

      if (statusAnterior === "aprovada" && !["concluida", "cancelada"].includes(newStatus)) {
        throw new Error("Status inválido. De 'aprovada' só pode ir para: concluída ou cancelada");
      }

      // 2. Processar mudanças de estoque baseado na transição de status
      const now = Timestamp.now();

      // FASE 1: TODAS AS LEITURAS (reads must be before writes)
      const produtosData = new Map<string, InventoryItem>();

      for (const produto of solicitacao.produtos_solicitados) {
        const itemRef = doc(
          db,
          "tenants",
          tenantId,
          "inventory",
          produto.inventory_item_id
        );
        const itemSnap = await transaction.get(itemRef);

        if (!itemSnap.exists()) {
          throw new Error(`Produto ${produto.produto_nome} não encontrado no inventário`);
        }

        const itemData = itemSnap.data() as InventoryItem;
        produtosData.set(produto.inventory_item_id, itemData);
      }

      // FASE 2: TODAS AS ESCRITAS (after all reads)
      // Lógica de atualização de estoque - Fluxo Correto:
      //
      // CRIAÇÃO (status: agendada):
      //   - quantidade_reservada += quantidade (adiciona ao reservado)
      //   - quantidade_disponivel -= quantidade (remove do disponível)
      //   - Total = disponível + reservado (permanece constante)
      //
      // AGENDADA → APROVADA:
      //   - quantidade_reservada NÃO muda (mantém reserva)
      //   - quantidade_disponivel NÃO muda (produtos já foram movidos para reservado)
      //
      // APROVADA → CONCLUÍDA:
      //   - quantidade_reservada -= quantidade (libera reserva - CONSUMO EFETIVO!)
      //   - quantidade_disponivel NÃO muda (já foi descontado na criação)
      //   - Total diminui (consumo efetivo = inicial - reservado)
      //
      // AGENDADA → REPROVADA/CANCELADA:
      //   - quantidade_reservada -= quantidade (libera reserva)
      //   - quantidade_disponivel += quantidade (devolve ao disponível)
      //
      // APROVADA → CANCELADA:
      //   - quantidade_reservada -= quantidade (libera reserva)
      //   - quantidade_disponivel += quantidade (devolve ao disponível)

      for (const produto of solicitacao.produtos_solicitados) {
        const itemData = produtosData.get(produto.inventory_item_id);
        if (!itemData) continue;

        const itemRef = doc(
          db,
          "tenants",
          tenantId,
          "inventory",
          produto.inventory_item_id
        );

        if (statusAnterior === "agendada" && newStatus === "aprovada") {
          // Aprovar solicitação agendada: Mantém a reserva (produtos continuam reservados)
          // Nenhuma ação necessária no inventário
          // Produtos já foram movidos de "disponível" para "reservado" na criação

        } else if (statusAnterior === "agendada" && (newStatus === "reprovada" || newStatus === "cancelada")) {
          // Reprovar/Cancelar agendada: Libera reserva E devolve ao disponível
          const novaReserva = (itemData.quantidade_reservada || 0) - produto.quantidade;
          const novoDisponivel = (itemData.quantidade_disponivel || 0) + produto.quantidade;

          transaction.update(itemRef, {
            quantidade_reservada: Math.max(0, novaReserva),
            quantidade_disponivel: novoDisponivel,
            updated_at: now,
          });

        } else if (statusAnterior === "aprovada" && newStatus === "concluida") {
          // Concluir aprovada: Apenas libera reserva (CONSUMO EFETIVO!)
          // Disponível NÃO muda porque já foi descontado na criação
          // O total diminui = consumo efetivo
          const novaReserva = (itemData.quantidade_reservada || 0) - produto.quantidade;

          transaction.update(itemRef, {
            quantidade_reservada: Math.max(0, novaReserva),
            updated_at: now,
          });

        } else if (statusAnterior === "aprovada" && newStatus === "cancelada") {
          // Cancelar aprovada: Libera reserva E devolve ao disponível
          const novaReserva = (itemData.quantidade_reservada || 0) - produto.quantidade;
          const novoDisponivel = (itemData.quantidade_disponivel || 0) + produto.quantidade;

          transaction.update(itemRef, {
            quantidade_reservada: Math.max(0, novaReserva),
            quantidade_disponivel: novoDisponivel,
            updated_at: now,
          });
        }
      }

      // 3. Atualizar status e histórico
      const novaEntradaHistorico: StatusHistoryEntry = {
        status: newStatus,
        changed_by: userId,
        changed_by_name: userName,
        changed_at: now,
        ...(observacao && { observacao }), // Apenas adiciona se observacao existir
      };

      const statusHistory = solicitacao.status_history || [];
      statusHistory.push(novaEntradaHistorico);

      // Preparar dados de atualização
      const updateData: any = {
        status: newStatus,
        status_history: statusHistory,
        updated_by: userId,
        updated_at: now,
      };

      // Se o procedimento for concluído antes da data agendada, atualizar dt_procedimento
      if (newStatus === "concluida" && solicitacao.dt_procedimento) {
        const dtProcedimento = solicitacao.dt_procedimento instanceof Timestamp
          ? solicitacao.dt_procedimento.toDate()
          : new Date(solicitacao.dt_procedimento);

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Zerar horas para comparação apenas de data
        dtProcedimento.setHours(0, 0, 0, 0);

        // Se a data do procedimento é futura, atualizar para hoje
        if (dtProcedimento > hoje) {
          updateData.dt_procedimento = now;
        }
      }

      transaction.update(solicitacaoRef, updateData);
    });

    // 4. Criar notificações após atualização bem-sucedida
    try {
      const requestNumber = `#${solicitacaoId.slice(-6).toUpperCase()}`;

      if (newStatus === "aprovada") {
        await createRequestApprovedNotification(
          tenantId,
          requestNumber,
          solicitacaoId
        );
      } else if (newStatus === "reprovada") {
        await createRequestRejectedNotification(
          tenantId,
          requestNumber,
          solicitacaoId
        );
      } else if (newStatus === "concluida") {
        // TODO: Criar notificação de conclusão se necessário
      }
    } catch (notificationError: any) {
      // Log erro mas não falha a operação principal
      console.error(
        "Erro ao criar notificação (operação de status foi concluída):",
        notificationError
      );
    }

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao atualizar status da solicitação:", error);
    return {
      success: false,
      error: error.message || "Erro ao atualizar status da solicitação",
    };
  }
}

// ============================================================================
// ATUALIZAÇÃO DE SOLICITAÇÃO AGENDADA
// ============================================================================

/**
 * Atualiza uma solicitação no status "agendada"
 * Permite editar produtos, paciente e data
 * Ajusta as reservas de estoque automaticamente
 */
export async function updateSolicitacaoAgendada(
  tenantId: string,
  solicitacaoId: string,
  userId: string,
  userName: string,
  updates: {
    paciente_codigo?: string;
    paciente_nome?: string;
    dt_procedimento?: Date;
    produtos?: {
      inventory_item_id: string;
      quantidade: number;
    }[];
    observacoes?: string;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await runTransaction(db, async (transaction) => {
      const solicitacaoRef = doc(db, "tenants", tenantId, "solicitacoes", solicitacaoId);
      const solicitacaoSnap = await transaction.get(solicitacaoRef);

      if (!solicitacaoSnap.exists()) {
        throw new Error("Solicitação não encontrada");
      }

      const solicitacao = solicitacaoSnap.data() as Solicitacao;

      // Só permite editar se estiver agendada
      if (solicitacao.status !== "agendada") {
        throw new Error("Só é possível editar solicitações no status 'Agendada'");
      }

      const now = Timestamp.now();

      // Se estiver atualizando produtos, precisamos ajustar o estoque
      if (updates.produtos) {
        // FASE 1: TODAS AS LEITURAS (reads must be before writes)

        // 1a. Ler todos os produtos antigos
        const produtosAntigosData = new Map<string, InventoryItem>();
        for (const produtoAntigo of solicitacao.produtos_solicitados) {
          const itemRef = doc(db, "tenants", tenantId, "inventory", produtoAntigo.inventory_item_id);
          const itemSnap = await transaction.get(itemRef);
          if (itemSnap.exists()) {
            produtosAntigosData.set(produtoAntigo.inventory_item_id, { id: itemSnap.id, ...itemSnap.data() } as InventoryItem);
          }
        }

        // 1b. Ler todos os novos produtos
        const produtosNovosData = new Map<string, InventoryItem>();
        for (const produto of updates.produtos) {
          const itemRef = doc(db, "tenants", tenantId, "inventory", produto.inventory_item_id);
          const itemSnap = await transaction.get(itemRef);

          if (!itemSnap.exists()) {
            throw new Error(`Produto ${produto.inventory_item_id} não encontrado`);
          }

          const rawData = itemSnap.data();
          const itemData = { id: itemSnap.id, ...rawData } as InventoryItem;
          produtosNovosData.set(produto.inventory_item_id, itemData);
        }

        // 1c. Validar estoque disponível APÓS liberar produtos antigos
        // Calcular disponível após liberar produtos antigos desta solicitação
        const disponivelAposLiberar = new Map<string, number>();

        // Inicializar com disponível atual
        produtosNovosData.forEach((itemData, itemId) => {
          disponivelAposLiberar.set(itemId, itemData.quantidade_disponivel || 0);
        });

        // Adicionar produtos antigos que serão liberados
        for (const produtoAntigo of solicitacao.produtos_solicitados) {
          const disponivelAtual = disponivelAposLiberar.get(produtoAntigo.inventory_item_id) || 0;
          disponivelAposLiberar.set(
            produtoAntigo.inventory_item_id,
            disponivelAtual + produtoAntigo.quantidade
          );
        }

        // Validar se há estoque suficiente para os novos produtos
        for (const produto of updates.produtos) {
          const disponivelAposLib = disponivelAposLiberar.get(produto.inventory_item_id) || 0;
          const itemData = produtosNovosData.get(produto.inventory_item_id)!;

          if (disponivelAposLib < produto.quantidade) {
            throw new Error(
              `Estoque insuficiente para ${itemData.nome_produto}. ` +
              `Disponível (após liberar produtos antigos): ${disponivelAposLib}, ` +
              `Solicitado: ${produto.quantidade}`
            );
          }
        }

        // FASE 2: TODAS AS ESCRITAS (after all reads)

        // 2a. Calcular ajustes de reserva E disponível
        const reservasAjustadas = new Map<string, number>();
        const disponiveisAjustados = new Map<string, number>();

        // Inicializar com valores atuais
        produtosAntigosData.forEach((itemData, itemId) => {
          reservasAjustadas.set(itemId, itemData.quantidade_reservada || 0);
          disponiveisAjustados.set(itemId, itemData.quantidade_disponivel || 0);
        });
        produtosNovosData.forEach((itemData, itemId) => {
          if (!reservasAjustadas.has(itemId)) {
            reservasAjustadas.set(itemId, itemData.quantidade_reservada || 0);
            disponiveisAjustados.set(itemId, itemData.quantidade_disponivel || 0);
          }
        });

        // Liberar produtos antigos (devolver reserva → disponível)
        for (const produtoAntigo of solicitacao.produtos_solicitados) {
          const reservaAtual = reservasAjustadas.get(produtoAntigo.inventory_item_id) || 0;
          const disponivelAtual = disponiveisAjustados.get(produtoAntigo.inventory_item_id) || 0;

          reservasAjustadas.set(
            produtoAntigo.inventory_item_id,
            Math.max(0, reservaAtual - produtoAntigo.quantidade)
          );
          disponiveisAjustados.set(
            produtoAntigo.inventory_item_id,
            disponivelAtual + produtoAntigo.quantidade
          );
        }

        // Reservar novos produtos (disponível → reserva)
        for (const produto of updates.produtos) {
          const reservaAtual = reservasAjustadas.get(produto.inventory_item_id) || 0;
          const disponivelAtual = disponiveisAjustados.get(produto.inventory_item_id) || 0;

          reservasAjustadas.set(
            produto.inventory_item_id,
            reservaAtual + produto.quantidade
          );
          disponiveisAjustados.set(
            produto.inventory_item_id,
            disponivelAtual - produto.quantidade
          );
        }

        // 2b. Aplicar todas as atualizações de reserva E disponível
        const itensAtualizados = new Set<string>();

        // Atualizar produtos antigos
        for (const produtoAntigo of solicitacao.produtos_solicitados) {
          const itemRef = doc(db, "tenants", tenantId, "inventory", produtoAntigo.inventory_item_id);
          const novaReserva = reservasAjustadas.get(produtoAntigo.inventory_item_id) || 0;
          const novoDisponivel = disponiveisAjustados.get(produtoAntigo.inventory_item_id) || 0;

          transaction.update(itemRef, {
            quantidade_reservada: novaReserva,
            quantidade_disponivel: Math.max(0, novoDisponivel),
            updated_at: now,
          });

          itensAtualizados.add(produtoAntigo.inventory_item_id);
        }

        // Atualizar produtos novos que ainda não foram atualizados
        for (const produto of updates.produtos) {
          if (!itensAtualizados.has(produto.inventory_item_id)) {
            const itemRef = doc(db, "tenants", tenantId, "inventory", produto.inventory_item_id);
            const novaReserva = reservasAjustadas.get(produto.inventory_item_id) || 0;
            const novoDisponivel = disponiveisAjustados.get(produto.inventory_item_id) || 0;

            transaction.update(itemRef, {
              quantidade_reservada: novaReserva,
              quantidade_disponivel: Math.max(0, novoDisponivel),
              updated_at: now,
            });

            itensAtualizados.add(produto.inventory_item_id);
          }
        }

        // 2c. Montar lista de produtos detalhados para a solicitação
        const produtosDetalhados: ProdutoSolicitado[] = [];
        for (const produto of updates.produtos) {
          const itemData = produtosNovosData.get(produto.inventory_item_id);
          if (itemData) {
            produtosDetalhados.push({
              inventory_item_id: produto.inventory_item_id,
              produto_codigo: itemData.codigo_produto,
              produto_nome: itemData.nome_produto,
              lote: itemData.lote,
              quantidade: produto.quantidade,
              quantidade_disponivel_antes: itemData.quantidade_disponivel,
              valor_unitario: itemData.valor_unitario,
            });
          }
        }

        // 2c. Atualizar solicitação com novos produtos
        const updateData: any = {
          produtos_solicitados: produtosDetalhados,
          updated_by: userId,
          updated_at: now,
        };

        if (updates.paciente_codigo) {
          updateData.paciente_codigo = updates.paciente_codigo;
        }
        if (updates.paciente_nome) {
          updateData.paciente_nome = updates.paciente_nome;
        }
        if (updates.dt_procedimento) {
          updateData.dt_procedimento = Timestamp.fromDate(updates.dt_procedimento);
        }
        if (updates.observacoes !== undefined) {
          updateData.observacoes = updates.observacoes;
        }

        transaction.update(solicitacaoRef, updateData);
      } else {
        // Atualizar apenas dados do paciente/data (sem mexer em produtos)
        const updateData: any = {
          updated_by: userId,
          updated_at: now,
        };

        if (updates.paciente_codigo) {
          updateData.paciente_codigo = updates.paciente_codigo;
        }
        if (updates.paciente_nome) {
          updateData.paciente_nome = updates.paciente_nome;
        }
        if (updates.dt_procedimento) {
          updateData.dt_procedimento = Timestamp.fromDate(updates.dt_procedimento);
        }
        if (updates.observacoes !== undefined) {
          updateData.observacoes = updates.observacoes;
        }

        transaction.update(solicitacaoRef, updateData);
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao atualizar solicitação:", error);
    return {
      success: false,
      error: error.message || "Erro ao atualizar solicitação",
    };
  }
}

// ============================================================================
// LISTAGEM E CONSULTA
// ============================================================================

/**
 * Lista solicitações do tenant com filtros opcionais
 */
export async function listSolicitacoes(
  tenantId: string,
  options?: {
    status?: string;
    limit?: number;
    codigoPaciente?: string;
  }
): Promise<SolicitacaoWithDetails[]> {
  try {
    let q = query(
      collection(db, "tenants", tenantId, "solicitacoes"),
      orderBy("created_at", "desc")
    );

    if (options?.status) {
      q = query(q, where("status", "==", options.status));
    }

    if (options?.codigoPaciente) {
      q = query(q, where("paciente_codigo", "==", options.codigoPaciente));
    }

    if (options?.limit) {
      q = query(q, firestoreLimit(options.limit));
    }

    const snapshot = await getDocs(q);

    const solicitacoes: SolicitacaoWithDetails[] = snapshot.docs.map((doc) => {
      const data = doc.data() as Omit<Solicitacao, "id">;

      const total_produtos = data.produtos_solicitados.reduce(
        (sum, p) => sum + p.quantidade,
        0
      );

      const valor_total = data.produtos_solicitados.reduce(
        (sum, p) => sum + p.quantidade * p.valor_unitario,
        0
      );

      return {
        id: doc.id,
        ...data,
        total_produtos,
        valor_total,
      };
    });

    return solicitacoes;
  } catch (error) {
    console.error("Erro ao listar solicitações:", error);
    throw error;
  }
}

/**
 * Busca uma solicitação específica
 */
export async function getSolicitacao(
  tenantId: string,
  solicitacaoId: string
): Promise<SolicitacaoWithDetails | null> {
  try {
    const docRef = doc(db, "tenants", tenantId, "solicitacoes", solicitacaoId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data() as Omit<Solicitacao, "id">;

    const total_produtos = data.produtos_solicitados.reduce(
      (sum, p) => sum + p.quantidade,
      0
    );

    const valor_total = data.produtos_solicitados.reduce(
      (sum, p) => sum + p.quantidade * p.valor_unitario,
      0
    );

    return {
      id: docSnap.id,
      ...data,
      total_produtos,
      valor_total,
    };
  } catch (error) {
    console.error("Erro ao buscar solicitação:", error);
    throw error;
  }
}

// ============================================================================
// ESTATÍSTICAS
// ============================================================================

/**
 * Obtém estatísticas de solicitações do tenant
 */
export async function getSolicitacoesStats(tenantId: string): Promise<{
  total: number;
  criadas: number;
  agendadas: number;
  aprovadas: number;
  canceladas: number;
}> {
  try {
    const snapshot = await getDocs(
      collection(db, "tenants", tenantId, "solicitacoes")
    );

    const stats = {
      total: snapshot.size,
      criadas: 0,
      agendadas: 0,
      aprovadas: 0,
      canceladas: 0,
    };

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as Solicitacao;
      switch (data.status) {
        case "criada":
          stats.criadas++;
          break;
        case "agendada":
          stats.agendadas++;
          break;
        case "aprovada":
          stats.aprovadas++;
          break;
        case "cancelada":
          stats.canceladas++;
          break;
      }
    });

    return stats;
  } catch (error) {
    console.error("Erro ao obter estatísticas de solicitações:", error);
    throw error;
  }
}

/**
 * Busca próximos procedimentos (não concluídos) ordenados por data
 * Filtra do mais antigo até 2 semanas a partir de hoje
 */
export async function getUpcomingProcedures(
  tenantId: string,
  limitCount: number = 5
): Promise<Solicitacao[]> {
  try {
    const now = new Date();
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(now.getDate() + 14);

    const solicitacoesRef = collection(db, "tenants", tenantId, "solicitacoes");

    // Buscar solicitações agendadas, aprovadas e criadas (não concluídas)
    // que tenham data de procedimento até 2 semanas no futuro
    const q = query(
      solicitacoesRef,
      where("status", "in", ["criada", "agendada", "aprovada"]),
      where("dt_procedimento", "<=", Timestamp.fromDate(twoWeeksFromNow)),
      orderBy("dt_procedimento", "asc"),
      firestoreLimit(limitCount)
    );

    const snapshot = await getDocs(q);

    const solicitacoes: Solicitacao[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Solicitacao[];

    return solicitacoes;
  } catch (error) {
    console.error("Erro ao buscar próximos procedimentos:", error);
    throw error;
  }
}
