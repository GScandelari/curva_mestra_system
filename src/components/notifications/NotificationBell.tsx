/**
 * Componente NotificationBell - Sino de Notificações no Header
 * Curva Mestra - Multi-Tenant SaaS
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, X, Trash2, AlertCircle, Package, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Notification, NotificationType } from "@/types/notification";

interface NotificationBellProps {
  playSound?: boolean;
}

export function NotificationBell({ playSound = true }: NotificationBellProps) {
  const { claims } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearRead,
  } = useNotifications({
    tenantId: claims?.tenant_id || null,
    playSound,
  });

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "expiring":
      case "expired":
        return <Clock className="h-4 w-4 text-orange-500" />;
      case "low_stock":
        return <Package className="h-4 w-4 text-yellow-500" />;
      case "request_approved":
        return <Check className="h-4 w-4 text-green-500" />;
      case "request_rejected":
        return <X className="h-4 w-4 text-red-500" />;
      case "request_created":
        return <FileText className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: Notification["priority"]) => {
    switch (priority) {
      case "urgent":
        return "bg-red-50 border-red-200 hover:bg-red-100";
      case "high":
        return "bg-orange-50 border-orange-200 hover:bg-orange-100";
      case "medium":
        return "bg-yellow-50 border-yellow-200 hover:bg-yellow-100";
      case "low":
        return "bg-blue-50 border-blue-200 hover:bg-blue-100";
      default:
        return "bg-gray-50 border-gray-200 hover:bg-gray-100";
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Marcar como lida
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navegar para o contexto da notificação
    if (notification.inventory_id) {
      router.push(`/clinic/inventory/${notification.inventory_id}`);
    } else if (notification.request_id) {
      router.push(`/clinic/requests/${notification.request_id}`);
    }

    setIsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleClearAll = async () => {
    if (confirm("Deseja realmente limpar todas as notificações lidas?")) {
      await clearRead();
    }
  };

  const handleDelete = async (
    e: React.MouseEvent,
    notificationId: string
  ) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  const formatRelativeTime = (timestamp: any) => {
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, {
        addSuffix: true,
        locale: ptBR,
      });
    } catch {
      return "agora";
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between px-4 py-2">
          <DropdownMenuLabel className="p-0">Notificações</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="text-xs"
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>

        <DropdownMenuSeparator />

        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-12 w-12 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">
                Nenhuma notificação
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`
                    relative rounded-lg border p-3 cursor-pointer transition-colors
                    ${!notification.read ? "bg-blue-50 border-blue-200" : getPriorityColor(notification.priority)}
                  `}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 leading-tight">
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <Badge variant="default" className="h-5 px-1 text-xs">
                            Novo
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {notification.message}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          {formatRelativeTime(notification.created_at)}
                        </span>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => handleDelete(e, notification.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="w-full text-xs"
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Limpar notificações lidas
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
