"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  Clock,
  UserPlus,
  AlertTriangle,
} from "lucide-react";
import {
  listAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  getTenantLimits,
} from "@/lib/services/accessRequestService";
import type { AccessRequest, TenantLimits } from "@/types";
import { useToast } from "@/hooks/use-toast";

export default function ClinicAccessRequestsPage() {
  const { user, claims } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const tenantId = claims?.tenant_id;

  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [limits, setLimits] = useState<TenantLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(
    null
  );
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId]);

  async function loadData() {
    if (!tenantId) return;

    try {
      setLoading(true);
      const [requestsData, limitsData] = await Promise.all([
        listAccessRequests({ status: "pendente", tenant_id: tenantId }),
        getTenantLimits(tenantId),
      ]);
      setRequests(requestsData);
      setLimits(limitsData);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as solicitações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(request: AccessRequest) {
    if (!user || !claims || !limits) return;

    // Verificar vagas disponíveis
    if (limits.available_slots <= 0) {
      toast({
        title: "Limite atingido",
        description:
          "Sua clínica atingiu o limite de usuários. Entre em contato com o suporte.",
        variant: "destructive",
      });
      return;
    }

    setProcessingId(request.id);

    try {
      const result = await approveAccessRequest(request.id, {
        uid: user.uid,
        name: user.displayName || user.email || "Admin",
      });

      if (result.success) {
        toast({
          title: "Solicitação aprovada",
          description: "O usuário receberá um email com código de ativação",
        });
        loadData(); // Recarregar lista
      } else {
        toast({
          title: "Erro",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao aprovar solicitação",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  }

  function openRejectDialog(request: AccessRequest) {
    setSelectedRequest(request);
    setRejectionReason("");
    setRejectDialogOpen(true);
  }

  async function handleReject() {
    if (!selectedRequest || !user || !claims) return;

    setProcessingId(selectedRequest.id);

    try {
      const result = await rejectAccessRequest(
        selectedRequest.id,
        {
          uid: user.uid,
          name: user.displayName || user.email || "Admin",
        },
        rejectionReason
      );

      if (result.success) {
        toast({
          title: "Solicitação rejeitada",
          description: "O solicitante será notificado",
        });
        setRejectDialogOpen(false);
        loadData();
      } else {
        toast({
          title: "Erro",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao rejeitar solicitação",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="container py-8">
      <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">
                  Solicitações de Acesso
                </h2>
                <p className="text-muted-foreground">
                  Pedidos para entrar na sua clínica
                </p>
              </div>
              <Button onClick={loadData} variant="outline">
                Atualizar
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Pendentes
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{requests.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Vagas Disponíveis
                  </CardTitle>
                  <UserPlus className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {limits?.available_slots || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    de {limits?.max_users || 0} usuários
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Usuários Ativos
                  </CardTitle>
                  <UserPlus className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {limits?.current_users || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alert de Limite */}
            {limits && limits.available_slots <= 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Sua clínica atingiu o limite de {limits.max_users} usuários.
                  Entre em contato com o suporte para aumentar o limite.
                </AlertDescription>
              </Alert>
            )}

            {/* Lista de Solicitações */}
            <Card>
              <CardHeader>
                <CardTitle>Solicitações Pendentes</CardTitle>
                <CardDescription>
                  Aprove ou rejeite solicitações de novos usuários
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : requests.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">
                      Nenhuma solicitação pendente
                    </h3>
                    <p className="text-muted-foreground">
                      Não há pedidos de acesso no momento
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Solicitante</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {request.full_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {request.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {request.created_at?.toDate
                              ? request.created_at
                                  .toDate()
                                  .toLocaleDateString("pt-BR")
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApprove(request)}
                              disabled={
                                processingId === request.id ||
                                (limits?.available_slots || 0) <= 0
                              }
                            >
                              <CheckCircle className="mr-1 h-4 w-4" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openRejectDialog(request)}
                              disabled={processingId === request.id}
                            >
                              <XCircle className="mr-1 h-4 w-4" />
                              Rejeitar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
      </div>

      {/* Dialog de Rejeição */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar Solicitação</DialogTitle>
              <DialogDescription>
                Informe o motivo da rejeição (opcional)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reason">Motivo da rejeição</Label>
                <Textarea
                  id="reason"
                  placeholder="Ex: Perfil não compatível, dados incorretos, etc."
                  value={rejectionReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectionReason(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRejectDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!!processingId}
              >
                Confirmar Rejeição
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
