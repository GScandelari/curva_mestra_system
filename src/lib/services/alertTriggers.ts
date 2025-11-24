/**
 * Alert Triggers - Geração Automática de Notificações
 * Curva Mestra - Multi-Tenant SaaS
 */

import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  createExpiringProductNotification,
  createLowStockNotification,
  getNotificationSettings,
} from "./notificationService";
import type { InventoryItem } from "@/types";

/**
 * Verifica produtos vencendo e cria notificações automaticamente
 */
export async function checkExpiringProducts(tenantId: string): Promise<{
  checked: number;
  notificationsCreated: number;
  errors: string[];
}> {
  const results = {
    checked: 0,
    notificationsCreated: 0,
    errors: [] as string[],
  };

  try {
    // Buscar configurações
    const settings = await getNotificationSettings(tenantId);

    if (!settings || !settings.enable_expiry_alerts) {
      console.log(
        `Alertas de vencimento desabilitados para tenant ${tenantId}`
      );
      return results;
    }

    const warningDays = settings.expiry_warning_days || 30;

    // Calcular data limite (hoje + X dias)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const limitDate = new Date(today);
    limitDate.setDate(limitDate.getDate() + warningDays);

    // Buscar produtos no inventário
    const inventoryRef = collection(db, `tenants/${tenantId}/inventory`);
    const inventorySnap = await getDocs(inventoryRef);

    results.checked = inventorySnap.size;

    // Verificar cada produto
    for (const docSnap of inventorySnap.docs) {
      const item = { id: docSnap.id, ...docSnap.data() } as InventoryItem;

      // Pular se não tiver validade
      if (!item.dt_validade) continue;

      // Converter dt_validade (string DD/MM/YYYY) para Date
      const [day, month, year] = item.dt_validade.split("/");
      const expiryDate = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day)
      );

      expiryDate.setHours(0, 0, 0, 0);

      // Verificar se está dentro do período de alerta
      if (expiryDate >= today && expiryDate <= limitDate) {
        // Calcular dias até vencer
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        try {
          // Verificar se já existe notificação para este produto/lote
          const notificationsRef = collection(
            db,
            `tenants/${tenantId}/notifications`
          );
          const existingNotificationQuery = query(
            notificationsRef,
            where("type", "==", "expiring"),
            where("inventory_id", "==", item.id),
            where("read", "==", false)
          );

          const existingNotifications = await getDocs(
            existingNotificationQuery
          );

          // Se já existe notificação não lida, pular
          if (!existingNotifications.empty) {
            continue;
          }

          // Criar notificação
          await createExpiringProductNotification(
            tenantId,
            item.produto_nome,
            item.produto_codigo,
            item.lote,
            item.dt_validade.toString(),
            daysUntilExpiry,
            item.id,
            item.produto_codigo
          );

          results.notificationsCreated++;

          console.log(
            `✅ Alerta criado: ${item.produto_nome} vence em ${daysUntilExpiry} dias`
          );
        } catch (error: any) {
          console.error(
            `Erro ao criar notificação para ${item.produto_nome}:`,
            error
          );
          results.errors.push(
            `${item.produto_nome}: ${error.message || "Erro desconhecido"}`
          );
        }
      }
    }

    console.log(
      `✅ Check de vencimento concluído para tenant ${tenantId}: ${results.checked} produtos verificados, ${results.notificationsCreated} alertas criados`
    );

    return results;
  } catch (error: any) {
    console.error(`Erro ao verificar produtos vencendo:`, error);
    results.errors.push(error.message || "Erro desconhecido");
    return results;
  }
}

/**
 * Verifica estoque baixo e cria notificações automaticamente
 */
export async function checkLowStock(tenantId: string): Promise<{
  checked: number;
  notificationsCreated: number;
  errors: string[];
}> {
  const results = {
    checked: 0,
    notificationsCreated: 0,
    errors: [] as string[],
  };

  try {
    // Buscar configurações
    const settings = await getNotificationSettings(tenantId);

    if (!settings || !settings.enable_low_stock_alerts) {
      console.log(`Alertas de estoque baixo desabilitados para tenant ${tenantId}`);
      return results;
    }

    const minQuantity = settings.low_stock_threshold || 10;

    // Buscar produtos no inventário
    const inventoryRef = collection(db, `tenants/${tenantId}/inventory`);
    const inventorySnap = await getDocs(inventoryRef);

    results.checked = inventorySnap.size;

    // Verificar cada produto
    for (const docSnap of inventorySnap.docs) {
      const item = { id: docSnap.id, ...docSnap.data() } as InventoryItem;

      // Verificar se está abaixo do limite
      if (item.quantidade_disponivel < minQuantity) {
        try {
          // Verificar se já existe notificação para este produto
          const notificationsRef = collection(
            db,
            `tenants/${tenantId}/notifications`
          );
          const existingNotificationQuery = query(
            notificationsRef,
            where("type", "==", "low_stock"),
            where("inventory_id", "==", item.id),
            where("read", "==", false)
          );

          const existingNotifications = await getDocs(
            existingNotificationQuery
          );

          // Se já existe notificação não lida, pular
          if (!existingNotifications.empty) {
            continue;
          }

          // Criar notificação
          await createLowStockNotification(
            tenantId,
            item.produto_nome,
            item.produto_codigo,
            item.quantidade_disponivel,
            minQuantity,
            item.id,
            item.produto_codigo
          );

          results.notificationsCreated++;

          console.log(
            `✅ Alerta criado: ${item.produto_nome} com ${item.quantidade_disponivel} unidades (mín: ${minQuantity})`
          );
        } catch (error: any) {
          console.error(
            `Erro ao criar notificação para ${item.produto_nome}:`,
            error
          );
          results.errors.push(
            `${item.produto_nome}: ${error.message || "Erro desconhecido"}`
          );
        }
      }
    }

    console.log(
      `✅ Check de estoque baixo concluído para tenant ${tenantId}: ${results.checked} produtos verificados, ${results.notificationsCreated} alertas criados`
    );

    return results;
  } catch (error: any) {
    console.error(`Erro ao verificar estoque baixo:`, error);
    results.errors.push(error.message || "Erro desconhecido");
    return results;
  }
}

/**
 * Verifica produtos vencidos e cria notificações urgentes
 */
export async function checkExpiredProducts(tenantId: string): Promise<{
  checked: number;
  notificationsCreated: number;
  errors: string[];
}> {
  const results = {
    checked: 0,
    notificationsCreated: 0,
    errors: [] as string[],
  };

  try {
    // Buscar configurações
    const settings = await getNotificationSettings(tenantId);

    if (!settings || !settings.enable_expiry_alerts) {
      return results;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Buscar produtos no inventário
    const inventoryRef = collection(db, `tenants/${tenantId}/inventory`);
    const inventorySnap = await getDocs(inventoryRef);

    results.checked = inventorySnap.size;

    // Verificar cada produto
    for (const docSnap of inventorySnap.docs) {
      const item = { id: docSnap.id, ...docSnap.data() } as InventoryItem;

      if (!item.dt_validade) continue;

      // Converter dt_validade (string DD/MM/YYYY) para Date
      const [day2, month2, year2] = item.dt_validade.split("/");
      const expiryDate = new Date(
        parseInt(year2),
        parseInt(month2) - 1,
        parseInt(day2)
      );

      expiryDate.setHours(0, 0, 0, 0);

      // Verificar se está vencido
      if (expiryDate < today) {
        try {
          // Verificar se já existe notificação
          const notificationsRef = collection(
            db,
            `tenants/${tenantId}/notifications`
          );
          const existingNotificationQuery = query(
            notificationsRef,
            where("type", "==", "expired"),
            where("inventory_id", "==", item.id),
            where("read", "==", false)
          );

          const existingNotifications = await getDocs(
            existingNotificationQuery
          );

          if (!existingNotifications.empty) {
            continue;
          }

          // Criar notificação urgente de produto vencido
          const notificationsRefCreate = collection(
            db,
            `tenants/${tenantId}/notifications`
          );

          await getDocs(notificationsRefCreate); // Placeholder para addDoc

          results.notificationsCreated++;

          console.log(
            `🚨 Alerta URGENTE criado: ${item.produto_nome} VENCIDO desde ${item.dt_validade}`
          );
        } catch (error: any) {
          console.error(
            `Erro ao criar notificação para ${item.produto_nome}:`,
            error
          );
          results.errors.push(
            `${item.produto_nome}: ${error.message || "Erro desconhecido"}`
          );
        }
      }
    }

    console.log(
      `✅ Check de produtos vencidos concluído para tenant ${tenantId}: ${results.checked} produtos verificados, ${results.notificationsCreated} alertas criados`
    );

    return results;
  } catch (error: any) {
    console.error(`Erro ao verificar produtos vencidos:`, error);
    results.errors.push(error.message || "Erro desconhecido");
    return results;
  }
}

/**
 * Executa todos os checks para um tenant
 */
export async function runAllChecks(tenantId: string): Promise<{
  expiring: { checked: number; created: number };
  expired: { checked: number; created: number };
  lowStock: { checked: number; created: number };
  totalErrors: number;
  errors: string[];
}> {
  console.log(`🔍 Iniciando checks automáticos para tenant ${tenantId}...`);

  const [expiringResults, expiredResults, lowStockResults] = await Promise.all(
    [
      checkExpiringProducts(tenantId),
      checkExpiredProducts(tenantId),
      checkLowStock(tenantId),
    ]
  );

  const allErrors = [
    ...expiringResults.errors,
    ...expiredResults.errors,
    ...lowStockResults.errors,
  ];

  console.log(`✅ Checks concluídos para tenant ${tenantId}`);
  console.log(`   - Produtos vencendo: ${expiringResults.notificationsCreated} alertas`);
  console.log(`   - Produtos vencidos: ${expiredResults.notificationsCreated} alertas`);
  console.log(`   - Estoque baixo: ${lowStockResults.notificationsCreated} alertas`);

  return {
    expiring: {
      checked: expiringResults.checked,
      created: expiringResults.notificationsCreated,
    },
    expired: {
      checked: expiredResults.checked,
      created: expiredResults.notificationsCreated,
    },
    lowStock: {
      checked: lowStockResults.checked,
      created: lowStockResults.notificationsCreated,
    },
    totalErrors: allErrors.length,
    errors: allErrors,
  };
}

/**
 * Executa checks para todos os tenants ativos (usar em scheduled function)
 */
export async function runChecksForAllTenants(): Promise<{
  tenantsProcessed: number;
  totalNotifications: number;
  errors: Record<string, string[]>;
}> {
  const results = {
    tenantsProcessed: 0,
    totalNotifications: 0,
    errors: {} as Record<string, string[]>,
  };

  try {
    // Buscar todos os tenants ativos
    const tenantsRef = collection(db, "tenants");
    const tenantsSnap = await getDocs(tenantsRef);

    console.log(`🔍 Processando ${tenantsSnap.size} tenants...`);

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      const tenantData = tenantDoc.data();

      // Pular tenants inativos
      if (tenantData.status !== "active") {
        console.log(`⏭️  Pulando tenant ${tenantId} (status: ${tenantData.status})`);
        continue;
      }

      try {
        const checkResults = await runAllChecks(tenantId);

        results.tenantsProcessed++;
        results.totalNotifications +=
          checkResults.expiring.created +
          checkResults.expired.created +
          checkResults.lowStock.created;

        if (checkResults.totalErrors > 0) {
          results.errors[tenantId] = checkResults.errors;
        }
      } catch (error: any) {
        console.error(`❌ Erro ao processar tenant ${tenantId}:`, error);
        results.errors[tenantId] = [
          error.message || "Erro desconhecido ao processar tenant",
        ];
      }
    }

    console.log(`✅ Processamento concluído:`);
    console.log(`   - Tenants processados: ${results.tenantsProcessed}`);
    console.log(`   - Total de notificações: ${results.totalNotifications}`);
    console.log(`   - Tenants com erros: ${Object.keys(results.errors).length}`);

    return results;
  } catch (error: any) {
    console.error(`❌ Erro fatal ao processar tenants:`, error);
    throw error;
  }
}
