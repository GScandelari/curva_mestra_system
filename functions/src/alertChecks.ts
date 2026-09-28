/**
 * Alert Checks (Admin SDK) — mirror de src/lib/services/alertTriggers.ts
 * para uso em Cloud Functions (checkAlertsScheduled.ts). Mesma regra de
 * negócio (via alertRules.ts, espelhado também), mesma forma de criar
 * notificação (createNotification), portadas de client SDK para Admin SDK
 * porque o runtime de Functions não pode usar firebase/firestore (client).
 */

import * as admin from 'firebase-admin';
import {
  parseBrDate,
  startOfToday,
  computeExpiryLimitDate,
  daysUntil,
  resolveExpiryWarningDays,
  isWithinExpiryWindow,
  isExpired,
  resolveLowStockThreshold,
  isLowStock,
} from './alertRules';

interface InventoryItemDoc {
  dt_validade?: string;
  nome_produto: string;
  codigo_produto: string;
  lote: string;
  quantidade_disponivel: number;
}

interface NotificationSettingsDoc {
  enable_expiry_alerts?: boolean;
  expiry_warning_days?: number;
  enable_low_stock_alerts?: boolean;
  low_stock_threshold?: number;
}

type NotificationType = 'expiring' | 'expired' | 'low_stock';
type NotificationPriority = 'medium' | 'high' | 'urgent';

interface CheckResult {
  checked: number;
  notificationsCreated: number;
  errors: string[];
}

async function getNotificationSettings(
  db: admin.firestore.Firestore,
  tenantId: string
): Promise<NotificationSettingsDoc | null> {
  const snap = await db.doc(`tenants/${tenantId}/settings/notifications`).get();
  return snap.exists ? (snap.data() as NotificationSettingsDoc) : null;
}

async function hasUnreadNotification(
  db: admin.firestore.Firestore,
  tenantId: string,
  type: NotificationType,
  field: 'inventory_id' | 'metadata.product_code',
  value: string
): Promise<boolean> {
  const snap = await db
    .collection(`tenants/${tenantId}/notifications`)
    .where('type', '==', type)
    .where(field, '==', value)
    .where('read', '==', false)
    .get();
  return !snap.empty;
}

async function createAlertNotification(
  db: admin.firestore.Firestore,
  tenantId: string,
  input: {
    type: NotificationType;
    priority: NotificationPriority;
    title: string;
    message: string;
    inventory_id?: string;
    product_id: string;
    metadata: Record<string, unknown>;
  }
): Promise<void> {
  await db.collection(`tenants/${tenantId}/notifications`).add({
    tenant_id: tenantId,
    type: input.type,
    priority: input.priority,
    title: input.title,
    message: input.message,
    read: false,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    inventory_id: input.inventory_id,
    product_id: input.product_id,
    metadata: input.metadata,
  });
}

async function getActiveInventory(
  db: admin.firestore.Firestore,
  tenantId: string
): Promise<Array<{ id: string; data: InventoryItemDoc }>> {
  const snap = await db
    .collection(`tenants/${tenantId}/inventory`)
    .where('active', '==', true)
    .get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as InventoryItemDoc }));
}

/** Verifica produtos vencendo e cria notificações automaticamente. */
export async function checkExpiringProducts(
  db: admin.firestore.Firestore,
  tenantId: string
): Promise<CheckResult> {
  const results: CheckResult = { checked: 0, notificationsCreated: 0, errors: [] };

  try {
    const settings = await getNotificationSettings(db, tenantId);
    if (!settings || !settings.enable_expiry_alerts) return results;

    const warningDays = resolveExpiryWarningDays(settings.expiry_warning_days);
    const today = startOfToday();
    const limitDate = computeExpiryLimitDate(today, warningDays);

    const items = await getActiveInventory(db, tenantId);
    results.checked = items.length;

    for (const { id, data: item } of items) {
      const expiryDate = parseBrDate(item.dt_validade);
      if (!expiryDate) continue;

      if (isWithinExpiryWindow(expiryDate, today, limitDate)) {
        const daysUntilExpiry = daysUntil(expiryDate, today);
        try {
          if (await hasUnreadNotification(db, tenantId, 'expiring', 'inventory_id', id)) continue;

          const priority: NotificationPriority =
            daysUntilExpiry <= 7 ? 'urgent' : daysUntilExpiry <= 15 ? 'high' : 'medium';
          await createAlertNotification(db, tenantId, {
            type: 'expiring',
            priority,
            title: 'Produto próximo do vencimento',
            message: `${item.nome_produto} (lote ${item.lote}) vence em ${daysUntilExpiry} dias`,
            inventory_id: id,
            product_id: item.codigo_produto,
            metadata: {
              product_name: item.nome_produto,
              product_code: item.codigo_produto,
              batch_number: item.lote,
              expiry_date: item.dt_validade,
              days_until_expiry: daysUntilExpiry,
            },
          });
          results.notificationsCreated++;
        } catch (error: any) {
          results.errors.push(`${item.nome_produto}: ${error.message || 'Erro desconhecido'}`);
        }
      }
    }

    return results;
  } catch (error: any) {
    console.error('Erro ao verificar produtos vencendo:', error);
    results.errors.push(error.message || 'Erro desconhecido');
    return results;
  }
}

/** Verifica produtos vencidos e cria notificações urgentes. */
export async function checkExpiredProducts(
  db: admin.firestore.Firestore,
  tenantId: string
): Promise<CheckResult> {
  const results: CheckResult = { checked: 0, notificationsCreated: 0, errors: [] };

  try {
    const settings = await getNotificationSettings(db, tenantId);
    if (!settings || !settings.enable_expiry_alerts) return results;

    const today = startOfToday();
    const items = await getActiveInventory(db, tenantId);
    results.checked = items.length;

    for (const { id, data: item } of items) {
      const expiryDate = parseBrDate(item.dt_validade);
      if (!expiryDate) continue;

      if (isExpired(expiryDate, today)) {
        try {
          if (await hasUnreadNotification(db, tenantId, 'expired', 'inventory_id', id)) continue;

          await createAlertNotification(db, tenantId, {
            type: 'expired',
            priority: 'urgent',
            title: 'Produto vencido',
            message: `${item.nome_produto} (lote ${item.lote}) está vencido desde ${item.dt_validade}`,
            inventory_id: id,
            product_id: item.codigo_produto,
            metadata: {
              product_name: item.nome_produto,
              product_code: item.codigo_produto,
              batch_number: item.lote,
              expiry_date: item.dt_validade,
            },
          });
          results.notificationsCreated++;
        } catch (error: any) {
          results.errors.push(`${item.nome_produto}: ${error.message || 'Erro desconhecido'}`);
        }
      }
    }

    return results;
  } catch (error: any) {
    console.error('Erro ao verificar produtos vencidos:', error);
    results.errors.push(error.message || 'Erro desconhecido');
    return results;
  }
}

/** Verifica estoque baixo (agregado por codigo_produto) e cria notificações. */
export async function checkLowStock(
  db: admin.firestore.Firestore,
  tenantId: string
): Promise<CheckResult> {
  const results: CheckResult = { checked: 0, notificationsCreated: 0, errors: [] };

  try {
    const settings = await getNotificationSettings(db, tenantId);
    if (!settings || !settings.enable_low_stock_alerts) return results;

    const stockLimitsSnap = await db.collection(`tenants/${tenantId}/stock_limits`).get();
    const stockLimitsMap = new Map<string, number>();
    stockLimitsSnap.forEach((d) => {
      stockLimitsMap.set(d.id, d.data().limite_estoque_baixo as number);
    });

    const items = await getActiveInventory(db, tenantId);
    results.checked = items.length;

    const totalByCode = new Map<string, number>();
    const representativeItem = new Map<string, InventoryItemDoc & { id: string }>();
    for (const { id, data: item } of items) {
      totalByCode.set(
        item.codigo_produto,
        (totalByCode.get(item.codigo_produto) ?? 0) + item.quantidade_disponivel
      );
      if (!representativeItem.has(item.codigo_produto)) {
        representativeItem.set(item.codigo_produto, { ...item, id });
      }
    }

    for (const [codigoProduto, totalQty] of totalByCode.entries()) {
      const item = representativeItem.get(codigoProduto)!;
      const minQuantity = resolveLowStockThreshold(
        stockLimitsMap.get(codigoProduto),
        settings.low_stock_threshold
      );

      if (isLowStock(totalQty, minQuantity)) {
        try {
          if (
            await hasUnreadNotification(
              db,
              tenantId,
              'low_stock',
              'metadata.product_code',
              codigoProduto
            )
          ) {
            continue;
          }

          await createAlertNotification(db, tenantId, {
            type: 'low_stock',
            priority: 'high',
            title: 'Estoque baixo',
            message: `${item.nome_produto} com apenas ${totalQty} unidades (mínimo: ${minQuantity})`,
            inventory_id: item.id,
            product_id: codigoProduto,
            metadata: {
              product_name: item.nome_produto,
              product_code: codigoProduto,
              current_quantity: totalQty,
              min_quantity: minQuantity,
            },
          });
          results.notificationsCreated++;
        } catch (error: any) {
          results.errors.push(`${item.nome_produto}: ${error.message || 'Erro desconhecido'}`);
        }
      }
    }

    return results;
  } catch (error: any) {
    console.error('Erro ao verificar estoque baixo:', error);
    results.errors.push(error.message || 'Erro desconhecido');
    return results;
  }
}

/** Executa os três checks para um tenant. */
export async function runAllChecks(
  db: admin.firestore.Firestore,
  tenantId: string
): Promise<{ totalCreated: number; totalErrors: number; errors: string[] }> {
  const [expiring, expired, lowStock] = await Promise.all([
    checkExpiringProducts(db, tenantId),
    checkExpiredProducts(db, tenantId),
    checkLowStock(db, tenantId),
  ]);

  const errors = [...expiring.errors, ...expired.errors, ...lowStock.errors];
  return {
    totalCreated:
      expiring.notificationsCreated + expired.notificationsCreated + lowStock.notificationsCreated,
    totalErrors: errors.length,
    errors,
  };
}

/** Executa os checks para todos os tenants ativos (active === true). */
export async function runChecksForAllTenants(db: admin.firestore.Firestore): Promise<{
  tenantsProcessed: number;
  totalNotifications: number;
  errors: Record<string, string[]>;
}> {
  const results = {
    tenantsProcessed: 0,
    totalNotifications: 0,
    errors: {} as Record<string, string[]>,
  };

  const tenantsSnap = await db.collection('tenants').get();
  console.log(`🔍 Processando ${tenantsSnap.size} tenants...`);

  for (const tenantDoc of tenantsSnap.docs) {
    const tenantId = tenantDoc.id;
    const tenantData = tenantDoc.data();

    if (tenantData.active !== true) {
      continue;
    }

    try {
      const checkResults = await runAllChecks(db, tenantId);
      results.tenantsProcessed++;
      results.totalNotifications += checkResults.totalCreated;
      if (checkResults.totalErrors > 0) {
        results.errors[tenantId] = checkResults.errors;
      }
    } catch (error: any) {
      console.error(`❌ Erro ao processar tenant ${tenantId}:`, error);
      results.errors[tenantId] = [error.message || 'Erro desconhecido ao processar tenant'];
    }
  }

  console.log(
    `✅ Processamento concluído: ${results.tenantsProcessed} tenants, ${results.totalNotifications} notificações, ${Object.keys(results.errors).length} com erros`
  );

  return results;
}
