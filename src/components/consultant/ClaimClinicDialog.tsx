'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2, CheckCircle2, Loader2, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Tenant {
  id: string;
  name: string;
  document_type?: string;
  document_number?: string;
  consultant_id?: string | null;
  consultant_name?: string | null;
}

interface ClaimClinicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
  onSuccess?: () => void;
}

export function ClaimClinicDialog({
  open,
  onOpenChange,
  tenant,
  onSuccess,
}: ClaimClinicDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [autoLinked, setAutoLinked] = useState(false);

  const hasConsultant = !!tenant?.consultant_id;

  const handleClaim = async () => {
    if (!tenant || !user) return;

    setLoading(true);

    try {
      const token = await user.getIdToken();

      const response = await fetch('/api/consultants/claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tenant_id: tenant.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar solicitação');
      }

      setAutoLinked(data.auto_linked === true);
      setSuccess(true);

      if (data.auto_linked) {
        toast({ title: 'Vínculo estabelecido com sucesso!' });
      } else {
        toast({ title: 'Pedido de transferência enviado ao consultor atual.' });
      }

      setTimeout(() => {
        setSuccess(false);
        setAutoLinked(false);
        onOpenChange(false);
        onSuccess?.();
      }, 2500);
    } catch (error: any) {
      toast({ title: error.message || 'Erro ao processar solicitação', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSuccess(false);
      setAutoLinked(false);
      onOpenChange(false);
    }
  };

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasConsultant ? (
              <ArrowRightLeft className="h-5 w-5 text-amber-600" />
            ) : (
              <Building2 className="h-5 w-5 text-sky-600" />
            )}
            {hasConsultant ? 'Solicitar Transferência' : 'Confirmar Vínculo'}
          </DialogTitle>
          <DialogDescription>
            {hasConsultant
              ? `Esta clínica já possui o consultor ${tenant.consultant_name} vinculado. Um pedido será enviado para que ele aprove a transferência.`
              : 'Ao confirmar, você será vinculado imediatamente como consultor desta clínica.'}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <p className="text-center text-muted-foreground">
              {autoLinked
                ? 'Vínculo estabelecido! Você já tem acesso à clínica.'
                : 'Pedido enviado! Aguarde a resposta do consultor atual.'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Clínica</p>
                <p className="text-lg font-semibold">{tenant.name}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Documento</p>
                <p className="text-sm text-muted-foreground">
                  {tenant.document_type?.toUpperCase()}: {tenant.document_number}
                </p>
              </div>

              {hasConsultant && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                  <p className="text-sm text-amber-800">
                    <strong>Consultor atual:</strong> {tenant.consultant_name}. O pedido de
                    transferência será enviado para aprovação dele.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button
                onClick={handleClaim}
                disabled={loading}
                className={
                  hasConsultant ? 'bg-amber-600 hover:bg-amber-700' : 'bg-sky-600 hover:bg-sky-700'
                }
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {hasConsultant ? 'Solicitar Transferência' : 'Vincular Agora'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
