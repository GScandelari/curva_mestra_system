'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Usa o estilo destrutivo (vermelho) no botão de confirmação. */
  destructive?: boolean;
}

/**
 * Diálogo de confirmação genérico, reutilizável em qualquer ação
 * irreversível que hoje não tem (ou tem de forma inconsistente com uma
 * ação irmã) uma etapa de "tem certeza?" antes de executar.
 *
 * Extraído para evitar repetir o mesmo bloco de AlertDialog em cada tela
 * (ex.: concluir/cancelar procedimento — UC-19-RN-06; aprovar pendência de
 * vínculo consultor-clínica — UC-26-RN-01/UC-27-RN-03).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  destructive = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(destructive && buttonVariants({ variant: 'destructive' }))}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
