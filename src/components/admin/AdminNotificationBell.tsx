'use client';

/**
 * Sino do painel do system_admin: alertas de pendências de catálogo em NF-e
 * (coleção `admin_notifications`, gravada só pelo servidor). Clicar marca como
 * lido e leva à fila de produtos pendentes.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, PackageSearch } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  markAdminNotificationAsRead,
  markAllAdminNotificationsAsRead,
  subscribeAdminNotifications,
} from '@/lib/services/adminNotificationService';
import type { AdminNotification } from '@/types/adminNotification';

function tempoRelativo(v: unknown): string {
  try {
    const data =
      v && typeof (v as { toDate?: () => Date }).toDate === 'function'
        ? (v as { toDate: () => Date }).toDate()
        : new Date(v as string);
    return formatDistanceToNow(data, { addSuffix: true, locale: ptBR });
  } catch {
    return 'agora';
  }
}

export function AdminNotificationBell() {
  const router = useRouter();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [alertas, setAlertas] = useState<AdminNotification[]>([]);

  useEffect(
    () =>
      subscribeAdminNotifications(setAlertas, (error) => {
        console.error('Erro ao carregar alertas do administrador:', error);
      }),
    []
  );

  const naoLidos = alertas.filter((a) => !a.read);

  const handleClick = async (alerta: AdminNotification) => {
    setIsOpen(false);
    try {
      if (!alerta.read) await markAdminNotificationAsRead(alerta.id);
    } catch (error) {
      console.error('Erro ao marcar alerta como lido:', error);
    }
    router.push(alerta.link || '/admin/pending-products');
  };

  const handleMarkAll = async () => {
    try {
      await markAllAdminNotificationsAsRead(naoLidos.map((a) => a.id));
    } catch (error) {
      console.error('Erro ao marcar alertas como lidos:', error);
      toast({ title: 'Não foi possível marcar os alertas como lidos', variant: 'destructive' });
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Alertas do sistema">
          <Bell className="h-5 w-5" />
          {naoLidos.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {naoLidos.length > 99 ? '99+' : naoLidos.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-96">
        <div className="flex items-center justify-between px-4 py-2">
          <DropdownMenuLabel className="p-0">Alertas do sistema</DropdownMenuLabel>
          {naoLidos.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleMarkAll()}
              className="text-xs"
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {alertas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-12 w-12 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Nenhum alerta</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {alertas.map((alerta) => (
                <div
                  key={alerta.id}
                  className={`relative rounded-lg border p-3 cursor-pointer transition-colors ${
                    !alerta.read ? 'bg-blue-50 border-blue-200' : 'hover:bg-muted'
                  }`}
                  onClick={() => void handleClick(alerta)}
                >
                  <div className="flex items-start gap-3">
                    <PackageSearch className="h-4 w-4 mt-0.5 text-amber-600" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{alerta.title}</p>
                        {!alerta.read && (
                          <Badge variant="default" className="h-5 px-1 text-xs">
                            Novo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{alerta.message}</p>
                      <span className="text-xs text-muted-foreground">
                        {tempoRelativo(alerta.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
