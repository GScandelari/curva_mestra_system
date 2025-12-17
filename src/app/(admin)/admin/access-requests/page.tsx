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
      const response = await fetch(`/api/access-requests/${request.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          approved_by_uid: user.uid,
          approved_by_name: user.displayName || user.email || "Admin",
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "Solicitação aprovada!",
          description: `Tenant e usuário criados com sucesso. Email: ${result.data.email}`,
        });
        loadRequests(); // Recarregar lista
      } else {
        toast({
          title: "Erro",
          description: result.error || "Erro ao aprovar solicitação",
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

  const getStatusBadge = (type: "clinica" | "autonomo") => {
    if (type === "clinica") {
      return {
        icon: <Building2 className="h-4 w-4" />,
        text: "Clínica (até 5 usuários)",
        variant: "default" as const,
      };
    } else {
      return {
        icon: <UserPlus className="h-4 w-4" />,
        text: "Autônomo (1 usuário)",
        variant: "secondary" as const,
      };
    }
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
                    Total Pendentes
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
                    Clínicas
                  </CardTitle>
                  <Building2 className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {requests.filter((r) => r.type === "clinica").length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Autônomos
                  </CardTitle>
                  <UserPlus className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {requests.filter((r) => r.type === "autonomo").length}
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
                        <TableHead>Tipo</TableHead>
                        <TableHead>Solicitante</TableHead>
                        <TableHead>Negócio</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request) => {
                        const typeBadge = getStatusBadge(request.type);
                        return (
                          <TableRow key={request.id}>
                            <TableCell>
                              <Badge variant={typeBadge.variant}>
                                {typeBadge.icon}
                                <span className="ml-1">
                                  {request.type === "clinica" ? "Clínica" : "Autônomo"}
                                </span>
                              </Badge>
                            </TableCell>
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
                              <div>
                                <div className="font-medium">
                                  {request.business_name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {request.document_type === "cpf" ? "CPF" : "CNPJ"}:{" "}
                                  {formatDocumentAuto(request.document_number)}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {request.phone}
                              </div>
                              {request.city && request.state && (
                                <div className="text-xs text-muted-foreground">
                                  {request.city}/{request.state}
                                </div>
                              )}
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
                                {processingId === request.id ? "Processando..." : "Aprovar"}
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
