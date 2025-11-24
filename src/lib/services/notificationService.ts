/**
 * Notification Service - Gerenciamento de Notificações e Alertas
 * Curva Mestra - Multi-Tenant SaaS
 */

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Notification,
  NotificationSettings,
  NotificationStats,
  CreateNotificationInput,
  NotificationType,
  NotificationPriority,
} from "@/types/notification";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/types/notification";

/**
 * Busca configurações de notificação de um tenant
 */
export async function getNotificationSettings(
  tenantId: string
): Promise<NotificationSettings | null> {
  try {
    const settingsRef = doc(
      db,
      `tenants/${tenantId}/settings/notifications`
    );
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      return null;
    }

    return settingsSnap.data() as NotificationSettings;
  } catch (error) {
    console.error("Erro ao buscar configurações de notificação:", error);
    throw error;
  }
}

/**
 * Cria ou atualiza configurações de notificação
 */
export async function saveNotificationSettings(
  tenantId: string,
  settings: Partial<NotificationSettings>,
  userId: string
): Promise<void> {
  try {
    const settingsRef = doc(
      db,
      `tenants/${tenantId}/settings/notifications`
    );

    const dataToSave = {
      ...settings,
      tenant_id: tenantId,
      updated_at: Timestamp.now(),
      updated_by: userId,
    };

    await updateDoc(settingsRef, dataToSave);
  } catch (error: any) {
    // Se documento não existe, criar com valores padrão
    if (error.code === "not-found") {
      const settingsRef = doc(
        db,
        `tenants/${tenantId}/settings/notifications`
      );
      await updateDoc(settingsRef, {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...settings,
        tenant_id: tenantId,
        updated_at: Timestamp.now(),
        updated_by: userId,
      });
    } else {
      console.error("Erro ao salvar configurações:", error);
      throw error;
    }
  }
}

/**
 * Inicializa configurações padrão para um novo tenant
 */
export async function initializeNotificationSettings(
  tenantId: string,
  userId: string
): Promise<void> {
  try {
    const settingsRef = doc(
      db,
      `tenants/${tenantId}/settings/notifications`
    );

    await updateDoc(settingsRef, {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      tenant_id: tenantId,
      updated_at: Timestamp.now(),
      updated_by: userId,
    });
  } catch (error) {
    console.error("Erro ao inicializar configurações:", error);
    throw error;
  }
}

/**
 * Cria uma nova notificação
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<string> {
  try {
    const notificationsRef = collection(
      db,
      `tenants/${input.tenant_id}/notifications`
    );

    const notification: Omit<Notification, "id"> = {
      tenant_id: input.tenant_id,
      type: input.type,
      priority: input.priority,
      title: input.title,
      message: input.message,
      read: false,
      created_at: Timestamp.now(),
      product_id: input.product_id,
      inventory_id: input.inventory_id,
      request_id: input.request_id,
      user_id: input.user_id,
      metadata: input.metadata,
    };

    const docRef = await addDoc(notificationsRef, notification);
    return docRef.id;
  } catch (error) {
    console.error("Erro ao criar notificação:", error);
    throw error;
  }
}

/**
 * Busca notificações de um tenant (com paginação)
 */
export async function getNotifications(
  tenantId: string,
  limitCount: number = 50,
  onlyUnread: boolean = false
): Promise<Notification[]> {
  try {
    const notificationsRef = collection(
      db,
      `tenants/${tenantId}/notifications`
    );

    let q = query(
      notificationsRef,
      orderBy("created_at", "desc"),
      limit(limitCount)
    );

    if (onlyUnread) {
      q = query(
        notificationsRef,
        where("read", "==", false),
        orderBy("created_at", "desc"),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Notification[];
  } catch (error) {
    console.error("Erro ao buscar notificações:", error);
    throw error;
  }
}

/**
 * Marca uma notificação como lida
 */
export async function markAsRead(
  tenantId: string,
  notificationId: string
): Promise<void> {
  try {
    const notificationRef = doc(
      db,
      `tenants/${tenantId}/notifications/${notificationId}`
    );

    await updateDoc(notificationRef, {
      read: true,
      read_at: Timestamp.now(),
    });
  } catch (error) {
    console.error("Erro ao marcar notificação como lida:", error);
    throw error;
  }
}

/**
 * Marca todas as notificações como lidas
 */
export async function markAllAsRead(tenantId: string): Promise<void> {
  try {
    const notificationsRef = collection(
      db,
      `tenants/${tenantId}/notifications`
    );

    const q = query(notificationsRef, where("read", "==", false));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);

    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        read: true,
        read_at: Timestamp.now(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error("Erro ao marcar todas como lidas:", error);
    throw error;
  }
}

/**
 * Deleta uma notificação
 */
export async function deleteNotification(
  tenantId: string,
  notificationId: string
): Promise<void> {
  try {
    const notificationRef = doc(
      db,
      `tenants/${tenantId}/notifications/${notificationId}`
    );
    await deleteDoc(notificationRef);
  } catch (error) {
    console.error("Erro ao deletar notificação:", error);
    throw error;
  }
}

/**
 * Deleta todas as notificações lidas (limpeza)
 */
export async function deleteReadNotifications(tenantId: string): Promise<void> {
  try {
    const notificationsRef = collection(
      db,
      `tenants/${tenantId}/notifications`
    );

    const q = query(notificationsRef, where("read", "==", true));
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);

    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
  } catch (error) {
    console.error("Erro ao deletar notificações lidas:", error);
    throw error;
  }
}

/**
 * Busca estatísticas de notificações
 */
export async function getNotificationStats(
  tenantId: string
): Promise<NotificationStats> {
  try {
    const notificationsRef = collection(
      db,
      `tenants/${tenantId}/notifications`
    );

    const snapshot = await getDocs(notificationsRef);

    const stats: NotificationStats = {
      total: snapshot.size,
      unread: 0,
      by_type: {
        expiring: 0,
        expired: 0,
        low_stock: 0,
        request_approved: 0,
        request_rejected: 0,
        request_created: 0,
        new_user: 0,
        license_expiring: 0,
        license_expired: 0,
      },
      by_priority: {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0,
      },
    };

    snapshot.docs.forEach((doc) => {
      const notification = doc.data() as Notification;

      if (!notification.read) {
        stats.unread++;
      }

      stats.by_type[notification.type]++;
      stats.by_priority[notification.priority]++;
    });

    return stats;
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    throw error;
  }
}

/**
 * Listener em tempo real para notificações
 */
export function subscribeToNotifications(
  tenantId: string,
  callback: (notifications: Notification[]) => void,
  onlyUnread: boolean = false
): Unsubscribe {
  const notificationsRef = collection(
    db,
    `tenants/${tenantId}/notifications`
  );

  let q = query(notificationsRef, orderBy("created_at", "desc"), limit(50));

  if (onlyUnread) {
    q = query(
      notificationsRef,
      where("read", "==", false),
      orderBy("created_at", "desc"),
      limit(50)
    );
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[];

      callback(notifications);
    },
    (error) => {
      console.error("Erro no listener de notificações:", error);
    }
  );
}

/**
 * Helper: Cria notificação de produto próximo do vencimento
 */
export async function createExpiringProductNotification(
  tenantId: string,
  productName: string,
  productCode: string,
  batchNumber: string,
  expiryDate: string,
  daysUntilExpiry: number,
  inventoryId: string,
  productId: string
): Promise<void> {
  const priority: NotificationPriority =
    daysUntilExpiry <= 7 ? "urgent" : daysUntilExpiry <= 15 ? "high" : "medium";

  await createNotification({
    tenant_id: tenantId,
    type: "expiring",
    priority,
    title: `Produto próximo do vencimento`,
    message: `${productName} (lote ${batchNumber}) vence em ${daysUntilExpiry} dias`,
    inventory_id: inventoryId,
    product_id: productId,
    metadata: {
      product_name: productName,
      product_code: productCode,
      batch_number: batchNumber,
      expiry_date: expiryDate,
      days_until_expiry: daysUntilExpiry,
    },
  });
}

/**
 * Helper: Cria notificação de estoque baixo
 */
export async function createLowStockNotification(
  tenantId: string,
  productName: string,
  productCode: string,
  currentQuantity: number,
  minQuantity: number,
  inventoryId: string,
  productId: string
): Promise<void> {
  await createNotification({
    tenant_id: tenantId,
    type: "low_stock",
    priority: "high",
    title: `Estoque baixo`,
    message: `${productName} com apenas ${currentQuantity} unidades (mínimo: ${minQuantity})`,
    inventory_id: inventoryId,
    product_id: productId,
    metadata: {
      product_name: productName,
      product_code: productCode,
      current_quantity: currentQuantity,
      min_quantity: minQuantity,
    },
  });
}

/**
 * Helper: Cria notificação de solicitação aprovada
 */
export async function createRequestApprovedNotification(
  tenantId: string,
  requestNumber: string,
  requestId: string
): Promise<void> {
  await createNotification({
    tenant_id: tenantId,
    type: "request_approved",
    priority: "medium",
    title: `Solicitação aprovada`,
    message: `Sua solicitação #${requestNumber} foi aprovada`,
    request_id: requestId,
    metadata: {
      request_number: requestNumber,
    },
  });
}

/**
 * Helper: Cria notificação de solicitação reprovada
 */
export async function createRequestRejectedNotification(
  tenantId: string,
  requestNumber: string,
  requestId: string
): Promise<void> {
  await createNotification({
    tenant_id: tenantId,
    type: "request_rejected",
    priority: "medium",
    title: `Solicitação reprovada`,
    message: `Sua solicitação #${requestNumber} foi reprovada`,
    request_id: requestId,
    metadata: {
      request_number: requestNumber,
    },
  });
}
