'use client';

/**
 * Diálogo "Recusar" da fila de produtos pendentes: motivo obrigatório,
 * enviado à clínica pela notificação nf_pending_rejected.
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { formatImportId, formatNFLabel } from '@/lib/nfIdentity';
import { REJECT_REASON_MAX, validateRejectReason } from '@/lib/nfPendingRejection';
import type { PendingMasterProduct } from '@/types/pendingMasterProduct';

interface RejectPendingDialogProps {
  pendencia: (PendingMasterProduct & { tenant_nome: string }) | null;
  onClose: () => void;
  onDone: () => void;
}

export function RejectPendingDialog({ pendencia, onClose, onDone }: RejectPendingDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setMotivo('');
  }, [pendencia?.id]);

  const validacao = validateRejectReason(motivo);

  const handleRecusar = async () => {
    if (!pendencia || !user || !validacao.ok) return;
    setEnviando(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(
        `/api/admin/pending-products/${encodeURIComponent(pendencia.id)}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ motivo: validacao.motivo }),
        }
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast({
          title: 'Não foi possível recusar',
          description: body.error ?? 'Erro ao recusar a pendência',
          variant: 'destructive',
        });
        if (response.status === 409) onDone();
        return;
      }
      toast({ title: 'Pendência recusada; a clínica foi notificada.' });
      onDone();
    } catch (error) {
      console.error('Erro ao recusar pendência:', error);
      toast({ title: 'Erro ao recusar a pendência', variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={pendencia !== null} onOpenChange={(open) => !open && !enviando && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recusar pendência</DialogTitle>
          <DialogDescription>
            O produto não entra no estoque e a clínica recebe o motivo pelo sino de notificações.
          </DialogDescription>
        </DialogHeader>

        {pendencia && (
          <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Clínica:</span> {pendencia.tenant_nome}
            </p>
            <p>
              <span className="text-muted-foreground">Importação:</span>{' '}
              {formatImportId(pendencia.nf_import_id)} ·{' '}
              {formatNFLabel({
                numero: pendencia.numero_nf,
                serie: pendencia.serie,
                cnpj: pendencia.cnpj_emitente,
              })}
            </p>
            <p>
              <span className="text-muted-foreground">Produto:</span>{' '}
              <span className="font-mono">{pendencia.codigo}</span> — {pendencia.nome_produto} (lote{' '}
              {pendencia.lote})
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="motivo-recusa">Motivo da recusa (será enviado à clínica)</Label>
          <Textarea
            id="motivo-recusa"
            value={motivo}
            maxLength={REJECT_REASON_MAX}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: código inexistente no catálogo Rennova"
            disabled={enviando}
          />
          <p className="text-xs text-muted-foreground text-right">
            {motivo.trim().length}/{REJECT_REASON_MAX}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleRecusar()}
            disabled={enviando || !validacao.ok}
          >
            {enviando ? 'Recusando...' : 'Recusar pendência'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
