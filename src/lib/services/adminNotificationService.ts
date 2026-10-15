/**
 * Alertas do sino do system_admin (`admin_notifications`). Criados só pelo
 * servidor; aqui o client lê em tempo real e marca como lido (a rule só
 * permite alterar read/read_at).
 */

import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AdminNotification } from '@/types/adminNotification';

const COLLECTION = 'admin_notifications';
export const ADMIN_NOTIFICATIONS_LIMIT = 30;

export function subscribeAdminNotifications(
  onChange: (items: AdminNotification[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTION),
    orderBy('created_at', 'desc'),
    limit(ADMIN_NOTIFICATIONS_LIMIT)
  );
  return onSnapshot(
    q,
    (snap) =>
      onChange(
        snap.docs.map((d) => ({ ...(d.data() as Omit<AdminNotification, 'id'>), id: d.id }))
      ),
    onError
  );
}

export async function markAdminNotificationAsRead(id: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { read: true, read_at: serverTimestamp() });
}

export async function markAllAdminNotificationsAsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.update(doc(db, COLLECTION, id), { read: true, read_at: serverTimestamp() });
  }
  await batch.commit();
}
