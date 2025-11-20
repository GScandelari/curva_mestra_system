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
 * Determina o status inicial da solicitação baseado na data do procedimento
 * - Data passada ou atual → "aprovada" (consumo imediato)
 * - Data futura → "agendada" (reserva de estoque)
 */
function determineInitialStatus(dtProcedimento: Date): SolicitacaoStatus {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0); // Normaliza para início do dia

  const procedimento = new Date(dtProcedimento);
  procedimento.setHours(0, 0, 0, 0); // Normaliza para início do dia

  if (procedimento <= hoje) {
    return "aprovada"; // Procedimento passado ou hoje → aprova automaticamente
  } else {
    return "agendada"; // Procedimento futuro → agenda e reserva estoque
  }
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
      errors.push(`Produto ${itemData.produto_nome} está inativo`);
      continue;
    }

    if (itemData.quantidade_disponivel < produto.quantidade) {
      errors.push(
        `Estoque insuficiente para ${itemData.produto_nome} (Lote: ${itemData.lote}). ` +
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
        produto_codigo: itemData.produto_codigo,
        produto_nome: itemData.produto_nome,
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
            `Estoque insuficiente para ${itemData.produto_nome}. ` +
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
          observacao: isAgendada
            ? "Solicitação agendada automaticamente (procedimento futuro)"
            : "Solicitação aprovada automaticamente (procedimento passado/atual)",
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

      // 3.4. Atualizar inventário (consumir ou reservar)
      for (const item of inventoryData) {
        if (isAgendada) {
          // Para procedimentos futuros → RESERVAR estoque
          const novaQuantidadeReservada =
            (item.data.quantidade_reservada || 0) + item.quantidade_solicitada;

          transaction.update(item.ref, {
            quantidade_reservada: novaQuantidadeReservada,
            updated_at: now,
          });
        } else {
          // Para procedimentos passados/atuais → CONSUMIR estoque
          const novaQuantidadeDisponivel =
            item.data.quantidade_disponivel - item.quantidade_solicitada;

          transaction.update(item.ref, {
            quantidade_disponivel: novaQuantidadeDisponivel,
            updated_at: now,
          });
        }
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
          tipo: isAgendada ? "reserva" : "saida",
          quantidade: produto.quantidade,
          quantidade_anterior: produto.quantidade_disponivel_antes,
          quantidade_posterior: isAgendada
            ? produto.quantidade_disponivel_antes // Disponível não muda
            : produto.quantidade_disponivel_antes - produto.quantidade,
          descricao: isAgendada
            ? `Reserva para procedimento agendado - Paciente: ${input.paciente_nome} (${input.paciente_codigo})`
            : `Consumo para procedimento - Paciente: ${input.paciente_nome} (${input.paciente_codigo})`,
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

      if (statusAnterior === "reprovada") {
        throw new Error("Não é possível alterar uma solicitação reprovada");
      }

      // Permitir cancelar aprovada, mas não outras transições
      if (statusAnterior === "aprovada" && newStatus !== "cancelada") {
        throw new Error("Não é possível alterar uma solicitação aprovada (apenas cancelamento é permitido)");
      }

      // 2. Processar mudanças de estoque baseado na transição de status
      const now = Timestamp.now();

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

        // Lógica de atualização de estoque
        if (statusAnterior === "agendada" && newStatus === "aprovada") {
          // Aprovar: Libera reserva e consome estoque
          const novaReserva = (itemData.quantidade_reservada || 0) - produto.quantidade;
          const novoDisponivel = itemData.quantidade_disponivel - produto.quantidade;

          if (itemData.quantidade_disponivel < produto.quantidade) {
            throw new Error(
              `Estoque insuficiente para ${produto.produto_nome}. ` +
              `Disponível: ${itemData.quantidade_disponivel}, Necessário: ${produto.quantidade}`
            );
          }

          transaction.update(itemRef, {
            quantidade_reservada: Math.max(0, novaReserva),
            quantidade_disponivel: novoDisponivel,
            updated_at: now,
          });

        } else if (statusAnterior === "agendada" && (newStatus === "reprovada" || newStatus === "cancelada")) {
          // Reprovar/Cancelar agendada: Apenas libera reserva
          const novaReserva = (itemData.quantidade_reservada || 0) - produto.quantidade;

          transaction.update(itemRef, {
            quantidade_reservada: Math.max(0, novaReserva),
            updated_at: now,
          });

        } else if (statusAnterior === "criada" && newStatus === "aprovada") {
          // Aprovar criada: Consome estoque se ainda não foi consumido
          const novoDisponivel = itemData.quantidade_disponivel - produto.quantidade;

          if (itemData.quantidade_disponivel < produto.quantidade) {
            throw new Error(
              `Estoque insuficiente para ${produto.produto_nome}. ` +
              `Disponível: ${itemData.quantidade_disponivel}, Necessário: ${produto.quantidade}`
            );
          }

          transaction.update(itemRef, {
            quantidade_disponivel: novoDisponivel,
            updated_at: now,
          });

        } else if (statusAnterior === "aprovada" && newStatus === "cancelada") {
          // Cancelar aprovada: Devolve estoque
          const novoDisponivel = itemData.quantidade_disponivel + produto.quantidade;

          transaction.update(itemRef, {
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
        observacao,
      };

      const statusHistory = solicitacao.status_history || [];
      statusHistory.push(novaEntradaHistorico);

      transaction.update(solicitacaoRef, {
        status: newStatus,
        status_history: statusHistory,
        updated_by: userId,
        updated_at: now,
      });
    });

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
