/**
 * Inventory Service
 * Gerencia o inventário de produtos de uma clínica (tenant)
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface InventoryItem {
  id: string;
  tenant_id: string;
  produto_id: string;
  codigo_produto: string;
  nome_produto: string;
  lote: string;
  quantidade_inicial: number;
  quantidade_disponivel: number;
  quantidade_reservada?: number;
  dt_validade: Date;
  dt_entrada: Date;
  valor_unitario: number;
  nf_numero?: string;
  nf_id?: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface InventoryStats {
  totalProdutos: number;
  totalValor: number;
  produtosVencendo30dias: number;
  produtosVencidos: number;
  produtosEstoqueBaixo: number;
  ultimaAtualizacao: Date;
}

export interface ExpiringProduct {
  id: string;
  nome_produto: string;
  lote: string;
  quantidade_disponivel: number;
  dt_validade: Date;
  diasParaVencer: number;
}

export interface RecentActivity {
  id: string;
  tipo: "entrada" | "saida" | "ajuste";
  descricao: string;
  nome_produto: string;
  quantidade: number;
  timestamp: Date;
  usuario?: string;
}

/**
 * Busca estatísticas gerais do inventário
 */
export async function getInventoryStats(
  tenantId: string
): Promise<InventoryStats> {
  try {
    const inventoryRef = collection(
      db,
      "tenants",
      tenantId,
      "inventory"
    );

    // Buscar todos os produtos ativos
    const q = query(inventoryRef, where("active", "==", true));
    const snapshot = await getDocs(q);

    let totalProdutos = 0;
    let totalValor = 0;
    let produtosVencendo30dias = 0;
    let produtosVencidos = 0;
    let produtosEstoqueBaixo = 0;

    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(now.getDate() + 30);

    snapshot.forEach((doc) => {
      const data = doc.data();
      const quantidade = data.quantidade_disponivel || 0;

      if (quantidade > 0) {
        totalProdutos += quantidade;
        totalValor += quantidade * (data.valor_unitario || 0);

        // Verificar vencimento
        const dtValidade =
          data.dt_validade instanceof Timestamp
            ? data.dt_validade.toDate()
            : new Date(data.dt_validade);

        if (dtValidade < now) {
          produtosVencidos++;
        } else if (dtValidade <= in30Days) {
          produtosVencendo30dias++;
        }

        // Verificar estoque baixo (menos de 10 unidades)
        if (quantidade < 10) {
          produtosEstoqueBaixo++;
        }
      }
    });

    return {
      totalProdutos,
      totalValor,
      produtosVencendo30dias,
      produtosVencidos,
      produtosEstoqueBaixo,
      ultimaAtualizacao: new Date(),
    };
  } catch (error) {
    console.error("Erro ao buscar estatísticas do inventário:", error);
    throw error;
  }
}

/**
 * Busca produtos próximos ao vencimento
 */
export async function getExpiringProducts(
  tenantId: string,
  daysThreshold: number = 30,
  limitResults: number = 10
): Promise<ExpiringProduct[]> {
  try {
    const inventoryRef = collection(
      db,
      "tenants",
      tenantId,
      "inventory"
    );

    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() + daysThreshold);

    const q = query(
      inventoryRef,
      where("active", "==", true),
      where("quantidade_disponivel", ">", 0),
      orderBy("dt_validade", "asc"),
      limit(limitResults)
    );

    const snapshot = await getDocs(q);
    const products: ExpiringProduct[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const dtValidade =
        data.dt_validade instanceof Timestamp
          ? data.dt_validade.toDate()
          : new Date(data.dt_validade);

      // Só incluir se estiver dentro do threshold
      if (dtValidade <= thresholdDate) {
        const diasParaVencer = Math.ceil(
          (dtValidade.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        products.push({
          id: doc.id,
          nome_produto: data.nome_produto,
          lote: data.lote,
          quantidade_disponivel: data.quantidade_disponivel,
          dt_validade: dtValidade,
          diasParaVencer,
        });
      }
    });

    return products;
  } catch (error) {
    console.error("Erro ao buscar produtos vencendo:", error);
    throw error;
  }
}

/**
 * Busca atividades recentes do inventário
 */
export async function getRecentActivity(
  tenantId: string,
  limitResults: number = 10
): Promise<RecentActivity[]> {
  try {
    const activityRef = collection(
      db,
      "tenants",
      tenantId,
      "inventory_activity"
    );

    const q = query(
      activityRef,
      orderBy("timestamp", "desc"),
      limit(limitResults)
    );

    const snapshot = await getDocs(q);
    const activities: RecentActivity[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      activities.push({
        id: doc.id,
        tipo: data.tipo,
        descricao: data.descricao,
        nome_produto: data.nome_produto,
        quantidade: data.quantidade,
        timestamp:
          data.timestamp instanceof Timestamp
            ? data.timestamp.toDate()
            : new Date(data.timestamp),
        usuario: data.usuario,
      });
    });

    return activities;
  } catch (error) {
    console.error("Erro ao buscar atividades recentes:", error);
    // Retornar array vazio se a coleção não existir ainda
    return [];
  }
}

/**
 * Busca lista completa do inventário
 */
export async function listInventory(
  tenantId: string,
  activeOnly: boolean = true
): Promise<InventoryItem[]> {
  try {
    const inventoryRef = collection(
      db,
      "tenants",
      tenantId,
      "inventory"
    );

    let q = query(inventoryRef, orderBy("nome_produto", "asc"));

    if (activeOnly) {
      q = query(
        inventoryRef,
        where("active", "==", true),
        orderBy("nome_produto", "asc")
      );
    }

    const snapshot = await getDocs(q);
    const items: InventoryItem[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      items.push({
        id: doc.id,
        tenant_id: data.tenant_id,
        produto_id: data.produto_id,
        codigo_produto: data.codigo_produto,
        nome_produto: data.nome_produto,
        lote: data.lote,
        quantidade_inicial: data.quantidade_inicial,
        quantidade_disponivel: data.quantidade_disponivel,
        quantidade_reservada: data.quantidade_reservada,
        dt_validade:
          data.dt_validade instanceof Timestamp
            ? data.dt_validade.toDate()
            : new Date(data.dt_validade),
        dt_entrada:
          data.dt_entrada instanceof Timestamp
            ? data.dt_entrada.toDate()
            : new Date(data.dt_entrada),
        valor_unitario: data.valor_unitario,
        nf_numero: data.nf_numero,
        nf_id: data.nf_id,
        active: data.active,
        created_at:
          data.created_at instanceof Timestamp
            ? data.created_at.toDate()
            : new Date(data.created_at),
        updated_at:
          data.updated_at instanceof Timestamp
            ? data.updated_at.toDate()
            : new Date(data.updated_at),
      });
    });

    return items;
  } catch (error) {
    console.error("Erro ao listar inventário:", error);
    throw error;
  }
}

/**
 * Busca item específico do inventário
 */
export async function getInventoryItem(
  tenantId: string,
  itemId: string
): Promise<InventoryItem | null> {
  try {
    const itemRef = doc(db, "tenants", tenantId, "inventory", itemId);
    const snapshot = await getDoc(itemRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return {
      id: snapshot.id,
      tenant_id: data.tenant_id,
      produto_id: data.produto_id,
      codigo_produto: data.codigo_produto,
      nome_produto: data.nome_produto,
      lote: data.lote,
      quantidade_inicial: data.quantidade_inicial,
      quantidade_disponivel: data.quantidade_disponivel,
      quantidade_reservada: data.quantidade_reservada,
      dt_validade:
        data.dt_validade instanceof Timestamp
          ? data.dt_validade.toDate()
          : new Date(data.dt_validade),
      dt_entrada:
        data.dt_entrada instanceof Timestamp
          ? data.dt_entrada.toDate()
          : new Date(data.dt_entrada),
      valor_unitario: data.valor_unitario,
      nf_numero: data.nf_numero,
      nf_id: data.nf_id,
      active: data.active,
      created_at:
        data.created_at instanceof Timestamp
          ? data.created_at.toDate()
          : new Date(data.created_at),
      updated_at:
        data.updated_at instanceof Timestamp
          ? data.updated_at.toDate()
          : new Date(data.updated_at),
    };
  } catch (error) {
    console.error("Erro ao buscar item do inventário:", error);
    throw error;
  }
}
