/**
 * Hook useNotifications - Gerenciamento de Notificações em Tempo Real
 * Curva Mestra - Multi-Tenant SaaS
 */

import { useState, useEffect, useCallback } from "react";
import type { Notification, NotificationStats } from "@/types/notification";
import {
  subscribeToNotifications,
  getNotificationStats,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteReadNotifications,
} from "@/lib/services/notificationService";

interface UseNotificationsOptions {
  tenantId: string | null;
  onlyUnread?: boolean;
  playSound?: boolean;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  stats: NotificationStats | null;
  loading: boolean;
  error: string | null;
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  clearRead: () => Promise<void>;
  refreshStats: () => Promise<void>;
}

/**
 * Hook para gerenciar notificações em tempo real
 */
export function useNotifications(
  options: UseNotificationsOptions
): UseNotificationsReturn {
  const { tenantId, onlyUnread = false, playSound = false } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0);

  // Função para tocar som de notificação
  const playNotificationSound = useCallback(() => {
    if (!playSound) return;

    try {
      // Som simples usando Web Audio API
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.5
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (err) {
      console.error("Erro ao tocar som de notificação:", err);
    }
  }, [playSound]);

  // Carregar estatísticas
  const refreshStats = useCallback(async () => {
    if (!tenantId) return;

    try {
      const statsData = await getNotificationStats(tenantId);
      setStats(statsData);
    } catch (err) {
      console.error("Erro ao carregar estatísticas:", err);
    }
  }, [tenantId]);

  // Listener em tempo real
  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToNotifications(
      tenantId,
      (updatedNotifications) => {
        setNotifications(updatedNotifications);
        setLoading(false);

        // Calcular unread count
        const unreadCount = updatedNotifications.filter((n) => !n.read).length;

        // Tocar som se houver novas notificações não lidas
        if (unreadCount > previousUnreadCount) {
          playNotificationSound();
        }

        setPreviousUnreadCount(unreadCount);

        // Atualizar estatísticas
        refreshStats();
      },
      onlyUnread
    );

    // Carregar estatísticas iniciais
    refreshStats();

    return () => {
      unsubscribe();
    };
  }, [tenantId, onlyUnread, previousUnreadCount, playNotificationSound, refreshStats]);

  // Marcar como lida
  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      if (!tenantId) return;

      try {
        await markAsRead(tenantId, notificationId);
      } catch (err) {
        console.error("Erro ao marcar como lida:", err);
        setError("Erro ao marcar notificação como lida");
      }
    },
    [tenantId]
  );

  // Marcar todas como lidas
  const handleMarkAllAsRead = useCallback(async () => {
    if (!tenantId) return;

    try {
      await markAllAsRead(tenantId);
    } catch (err) {
      console.error("Erro ao marcar todas como lidas:", err);
      setError("Erro ao marcar todas as notificações como lidas");
    }
  }, [tenantId]);

  // Deletar notificação
  const handleDeleteNotification = useCallback(
    async (notificationId: string) => {
      if (!tenantId) return;

      try {
        await deleteNotification(tenantId, notificationId);
      } catch (err) {
        console.error("Erro ao deletar notificação:", err);
        setError("Erro ao deletar notificação");
      }
    },
    [tenantId]
  );

  // Limpar notificações lidas
  const handleClearRead = useCallback(async () => {
    if (!tenantId) return;

    try {
      await deleteReadNotifications(tenantId);
    } catch (err) {
      console.error("Erro ao limpar notificações lidas:", err);
      setError("Erro ao limpar notificações lidas");
    }
  }, [tenantId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    stats,
    loading,
    error,
    unreadCount,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    deleteNotification: handleDeleteNotification,
    clearRead: handleClearRead,
    refreshStats,
  };
}
