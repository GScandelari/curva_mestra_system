"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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

  const handleClaim = async () => {
    if (!tenant || !user) return;

    setLoading(true);

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/consultants/claims", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenant_id: tenant.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar solicitação");
      }

      setSuccess(true);
      toast({ title: "Solicitação enviada com sucesso!" });

      // Aguardar um pouco antes de fechar
      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
        onSuccess?.();
      }, 2000);
    } catch (error: any) {
      toast({ title: error.message || "Erro ao enviar solicitação", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSuccess(false);
      onOpenChange(false);
    }
  };

  if (!tenant) return null;

  const hasConsultant = !!tenant.consultant_id;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-sky-600" />
            Solicitar Vínculo
          </DialogTitle>
          <DialogDescription>
            {hasConsultant
              ? "Esta clínica já possui um consultor vinculado."
              : "Confirme para enviar uma solicitação de vínculo para esta clínica."}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <p className="text-center text-muted-foreground">
              Solicitação enviada! Aguarde a aprovação do administrador da clínica.
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
                    <strong>Atenção:</strong> Esta clínica já possui o consultor{" "}
                    <strong>{tenant.consultant_name}</strong> vinculado.
                    Não é possível solicitar vínculo.
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
                disabled={loading || hasConsultant}
                className="bg-sky-600 hover:bg-sky-700"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar Solicitação
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
