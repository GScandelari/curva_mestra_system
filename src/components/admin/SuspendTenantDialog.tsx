/**
 * Componente: Dialog para Suspender Clínica
 * Permite system_admin suspender uma clínica com motivo e detalhes
 */

"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AlertCircle, Ban, CheckCircle } from "lucide-react";
import type { SuspensionReason, Tenant } from "@/types";

interface SuspendTenantDialogProps {
  tenant: Tenant;
  onSuccess?: () => void;
  children?: React.ReactNode;
}

const REASON_OPTIONS: {
  value: SuspensionReason;
  label: string;
  description: string;
}[] = [
  {
    value: "payment_failure",
    label: "Falha no Pagamento",
    description: "Pendências no pagamento da assinatura",
  },
  {
    value: "contract_breach",
    label: "Quebra de Contrato",
    description: "Violação aos termos contratuais",
  },
  {
    value: "terms_violation",
    label: "Violação dos Termos de Uso",
    description: "Uso inadequado da plataforma",
  },
  {
    value: "fraud_detected",
    label: "Fraude Detectada",
    description: "Atividades suspeitas ou fraudulentas",
  },
  {
    value: "other",
    label: "Outro Motivo",
    description: "Motivos administrativos",
  },
];

export function SuspendTenantDialog({
  tenant,
  onSuccess,
  children,
}: SuspendTenantDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reason, setReason] = useState<SuspensionReason | "">("");
  const [details, setDetails] = useState("");
  const [contactEmail, setContactEmail] = useState(
    "scandelari.guilherme@curvamestra.com.br"
  );

  const handleSuspend = async () => {
    if (!reason || !details.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const token = await user?.getIdToken();

      const response = await fetch(`/api/tenants/${tenant.id}/suspend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason,
          details: details.trim(),
          contact_email: contactEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao suspender clínica");
      }

      toast({
        title: "Clínica suspensa com sucesso",
        description: `${data.users_affected} usuário(s) desativado(s)`,
      });

      setOpen(false);
      setReason("");
      setDetails("");

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Erro ao suspender clínica:", error);
      toast({
        title: "Erro ao suspender clínica",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="destructive" size="sm">
            <Ban className="h-4 w-4 mr-2" />
            Suspender Clínica
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Suspender Clínica
          </DialogTitle>
          <DialogDescription>
            Bloqueie o acesso de todos os usuários desta clínica. Esta ação pode
            ser revertida a qualquer momento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Informações da Clínica */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-sm font-medium">{tenant.name}</p>
            <p className="text-xs text-muted-foreground">{tenant.email}</p>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Motivo da Suspensão <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={(v) => setReason(v as SuspensionReason)}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Detalhes */}
          <div className="space-y-2">
            <Label htmlFor="details">
              Detalhes Adicionais <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="details"
              placeholder="Descreva os motivos específicos da suspensão..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Estes detalhes serão visíveis para o administrador da clínica
            </p>
          </div>

          {/* Email de Contato */}
          <div className="space-y-2">
            <Label htmlFor="contact_email">E-mail de Contato para Suporte</Label>
            <Input
              id="contact_email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="suporte@curvamestra.com.br"
            />
          </div>

          {/* Aviso */}
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm text-destructive font-medium mb-1">
              ⚠️ Atenção
            </p>
            <p className="text-xs text-muted-foreground">
              Todos os usuários desta clínica serão imediatamente desconectados e
              não poderão mais acessar o sistema até que a suspensão seja removida.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleSuspend}
            disabled={isLoading || !reason || !details.trim()}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Suspendendo...
              </>
            ) : (
              <>
                <Ban className="h-4 w-4 mr-2" />
                Suspender Clínica
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dialog para Reativar Clínica
 */
interface ReactivateTenantDialogProps {
  tenant: Tenant;
  onSuccess?: () => void;
  children?: React.ReactNode;
}

export function ReactivateTenantDialog({
  tenant,
  onSuccess,
  children,
}: ReactivateTenantDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleReactivate = async () => {
    setIsLoading(true);

    try {
      const token = await user?.getIdToken();

      const response = await fetch(`/api/tenants/${tenant.id}/suspend`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao reativar clínica");
      }

      toast({
        title: "Clínica reativada com sucesso",
        description: `${data.users_affected} usuário(s) reativado(s)`,
      });

      setOpen(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Erro ao reativar clínica:", error);
      toast({
        title: "Erro ao reativar clínica",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="default" size="sm">
            <CheckCircle className="h-4 w-4 mr-2" />
            Reativar Clínica
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Reativar Clínica
          </DialogTitle>
          <DialogDescription>
            Remova a suspensão e permita que os usuários acessem novamente a
            plataforma.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Informações da Clínica */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-sm font-medium">{tenant.name}</p>
            <p className="text-xs text-muted-foreground">{tenant.email}</p>
          </div>

          {/* Informação da Suspensão Atual */}
          {tenant.suspension && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900 mb-1">
                Suspensão Atual
              </p>
              <p className="text-xs text-muted-foreground">
                {tenant.suspension.details}
              </p>
            </div>
          )}

          {/* Confirmação */}
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-sm text-green-900">
              ✓ Todos os usuários poderão acessar o sistema novamente após a
              reativação.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleReactivate} disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Reativando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Reativação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
