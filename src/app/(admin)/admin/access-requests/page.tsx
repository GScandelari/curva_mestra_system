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
import {
  CheckCircle,
  XCircle,
  Clock,
  UserPlus,
  Building2,
  AlertTriangle,
} from "lucide-react";
import {
  listAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
} from "@/lib/services/accessRequestService";
import type { AccessRequest } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatDocumentAuto } from "@/lib/utils/documentValidation";

export default function AccessRequestsPage() {
  const { user, claims } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(
    null
  );
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      setLoading(true);
      const data = await listAccessRequests({ status: "pendente" });
      setRequests(data);
    } catch (error) {
      console.error("Erro ao carregar solicitações:", error);
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
    if (!user || !claims) return;

    setProcessingId(request.id);

    try {
      const result = await approveAccessRequest(request.id, {
        uid: user.uid,
        name: user.displayName || user.email || "Admin",
      });

      if (result.success) {
        toast({
          title: "Solicitação aprovada",
          description: `Código de ativação: ${result.activationCode}`,
        });
        loadRequests(); // Recarregar lista
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
        loadRequests(); // Recarregar lista
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

  const getStatusInfo = (request: AccessRequest) => {
    if (!request.tenant_id) {
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        text: "CNPJ não cadastrado",
        variant: "destructive" as const,
      };
    }

    if (!request.has_available_slots) {
      return {
        icon: <AlertTriangle className="h-4 w-4" />,
        text: "Sem vagas disponíveis",
        variant: "destructive" as const,
      };
    }

    return {
      icon: <CheckCircle className="h-4 w-4" />,
      text: "Pronto para aprovar",
      variant: "default" as const,
    };
  };

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
                  Gerencie pedidos de novos usuários
                </p>
              </div>
              <Button onClick={loadRequests} variant="outline">
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
                    Com vagas
                  </CardTitle>
                  <UserPlus className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {requests.filter((r) => r.has_available_slots).length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    CNPJ não cadastrado
                  </CardTitle>
                  <Building2 className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {requests.filter((r) => !r.tenant_id).length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Solicitações */}
            <Card>
              <CardHeader>
                <CardTitle>Solicitações Pendentes</CardTitle>
                <CardDescription>
                  Aprove ou rejeite solicitações de acesso
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
                      Todas as solicitações foram processadas
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Solicitante</TableHead>
                        <TableHead>Clínica</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request) => {
                        const statusInfo = getStatusInfo(request);
                        return (
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
                            <TableCell>
                              {request.tenant_name ? (
                                <div>
                                  <div className="font-medium">
                                    {request.tenant_name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {request.document_type === "cpf" ? "CPF" : "CNPJ"}: {formatDocumentAuto(request.document_number || request.cnpj || "")}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-sm text-amber-600">
                                    {request.document_type === "cpf" ? "CPF" : "CNPJ"} não cadastrado
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatDocumentAuto(request.document_number || request.cnpj || "")}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusInfo.variant}>
                                {statusInfo.icon}
                                <span className="ml-1">{statusInfo.text}</span>
                              </Badge>
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
                                disabled={processingId === request.id}
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
                        );
                      })}
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
                  placeholder="Ex: CPF/CNPJ não cadastrado, limite de usuários atingido, etc."
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
