"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  User,
  Calendar,
  Package,
  AlertTriangle,
  Check,
  FileText,
  CheckCircle,
  XCircle,
  Ban,
  Edit,
} from "lucide-react";
import {
  getSolicitacao,
  updateSolicitacaoStatus,
  type SolicitacaoWithDetails,
} from "@/lib/services/solicitacaoService";
import { formatTimestamp } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function SolicitacaoDetalhesPage() {
  const { claims, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const tenantId = claims?.tenant_id;
  const solicitacaoId = params.id as string;
  const isAdmin = claims?.role === "clinic_admin";

  const [solicitacao, setSolicitacao] = useState<SolicitacaoWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function loadSolicitacao() {
      if (!tenantId || !solicitacaoId) return;

      try {
        setLoading(true);
        const data = await getSolicitacao(tenantId, solicitacaoId);

        if (!data) {
          setError("Procedimento não encontrado");
          return;
        }

        setSolicitacao(data);
      } catch (err: any) {
        console.error("Erro ao carregar procedimento:", err);
        setError("Erro ao carregar detalhes do procedimento");
      } finally {
        setLoading(false);
      }
    }

    loadSolicitacao();
  }, [tenantId, solicitacaoId]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      agendada: "secondary",
      aprovada: "default",
      concluida: "default",
      reprovada: "destructive",
      cancelada: "destructive",
    };

    const labels: Record<string, string> = {
      agendada: "Agendada",
      aprovada: "Aprovada",
      concluida: "Concluída",
      reprovada: "Reprovada",
      cancelada: "Cancelada",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleStatusUpdate = async (
    newStatus: "aprovada" | "reprovada" | "cancelada" | "concluida",
    observacao?: string
  ) => {
    if (!tenantId || !user || !solicitacao) return;

    setUpdating(true);
    try {
      const result = await updateSolicitacaoStatus(
        tenantId,
        solicitacaoId,
        user.uid,
        user.displayName || user.email || "Usuário",
        newStatus,
        observacao
      );

      if (result.success) {
        toast({
          title: "Status atualizado",
          description: `Procedimento ${
            newStatus === "aprovada"
              ? "aprovado"
              : newStatus === "reprovada"
              ? "reprovado"
              : "cancelado"
          } com sucesso.`,
        });

        // Recarregar dados
        const data = await getSolicitacao(tenantId, solicitacaoId);
        if (data) {
          setSolicitacao(data);
        }
      } else {
        toast({
          title: "Erro",
          description: result.error || "Erro ao atualizar status",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error("Erro ao atualizar status:", err);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status do procedimento",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-8">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !solicitacao) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error || "Procedimento não encontrado"}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/clinic/requests")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Procedimentos
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="space-y-6">
            {/* Header */}
            <div>
              <Button
                variant="ghost"
                onClick={() => router.push("/clinic/requests")}
                className="mb-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>

              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">
                    Procedimento #{solicitacaoId.substring(0, 8)}
                  </h2>
                  <p className="text-muted-foreground">
                    Detalhes do consumo de produtos
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(solicitacao.status)}
                </div>
              </div>

              {/* Action Buttons - Only for Admin and non-finalized requests */}
              {isAdmin && solicitacao.status !== "concluida" && solicitacao.status !== "reprovada" && solicitacao.status !== "cancelada" && (
                  <div className="flex gap-2 mt-4 flex-wrap">
                    {/* AGENDADA → Editar, Aprovar, Reprovar ou Cancelar */}
                    {solicitacao.status === "agendada" && (
                      <>
                        <Button
                          onClick={() => router.push(`/clinic/requests/${solicitacao.id}/edit`)}
                          variant="outline"
                          className="border-blue-600 text-blue-600 hover:bg-blue-50"
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Editar Procedimento
                        </Button>

                        <Button
                          onClick={() => handleStatusUpdate("aprovada", "Aprovado pelo administrador")}
                          disabled={updating}
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Aprovar Procedimento
                        </Button>

                        <Button
                          onClick={() =>
                            handleStatusUpdate("reprovada", "Reprovado pelo administrador")
                          }
                          disabled={updating}
                          variant="destructive"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reprovar Procedimento
                        </Button>

                        <Button
                          onClick={() =>
                            handleStatusUpdate("cancelada", "Cancelado pelo administrador")
                          }
                          disabled={updating}
                          variant="outline"
                        >
                          <Ban className="mr-2 h-4 w-4" />
                          Cancelar Procedimento
                        </Button>
                      </>
                    )}

                    {/* APROVADA → Concluir ou Cancelar */}
                    {solicitacao.status === "aprovada" && (
                      <>
                        <Button
                          onClick={() => handleStatusUpdate("concluida", "Procedimento concluído")}
                          disabled={updating}
                          variant="default"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Concluir Procedimento
                        </Button>

                        <Button
                          onClick={() =>
                            handleStatusUpdate("cancelada", "Cancelado pelo administrador")
                          }
                          disabled={updating}
                          variant="outline"
                        >
                          <Ban className="mr-2 h-4 w-4" />
                          Cancelar Procedimento
                        </Button>
                      </>
                    )}
                  </div>
                )}
            </div>

            {/* Informações do Paciente e Procedimento */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Informações do Paciente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Código</Label>
                    <p className="font-medium text-lg">
                      {solicitacao.paciente_codigo}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Nome</Label>
                    <p className="font-medium text-lg">{solicitacao.paciente_nome}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Detalhes do Procedimento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">
                      Data do Procedimento
                    </Label>
                    <p className="font-medium text-lg">
                      {solicitacao.dt_procedimento?.toDate
                        ? solicitacao.dt_procedimento
                            .toDate()
                            .toLocaleDateString("pt-BR")
                        : "N/A"}
                    </p>
                  </div>
                  {solicitacao.observacoes && (
                    <div>
                      <Label className="text-muted-foreground">Observações</Label>
                      <p className="font-medium">{solicitacao.observacoes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Resumo Financeiro */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
                <CardDescription>
                  Resumo financeiro dos produtos consumidos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Package className="h-4 w-4" />
                      <span className="text-sm">Total de Produtos</span>
                    </div>
                    <p className="text-2xl font-bold">{solicitacao.total_produtos}</p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">Tipos Diferentes</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {solicitacao.produtos_solicitados.length}
                    </p>
                  </div>

                  <div className="p-4 border rounded-lg bg-primary/5">
                    <div className="text-muted-foreground mb-1 text-sm">
                      Valor Total
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(solicitacao.valor_total)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Produtos Consumidos */}
            <Card>
              <CardHeader>
                <CardTitle>Produtos Consumidos</CardTitle>
                <CardDescription>
                  Lista de todos os produtos utilizados neste procedimento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Lote</TableHead>
                      <TableHead className="text-right">
                        Qtd Consumida
                      </TableHead>
                      <TableHead className="text-right">Valor Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {solicitacao.produtos_solicitados.map((produto, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{produto.produto_nome}</div>
                            <div className="text-xs text-muted-foreground">
                              Código: {produto.produto_codigo}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{produto.lote}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {produto.quantidade}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(produto.valor_unitario)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(produto.quantidade * produto.valor_unitario)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-bold">
                        Valor Total:
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatCurrency(solicitacao.valor_total)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Histórico de Status */}
            {solicitacao.status_history && solicitacao.status_history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Status</CardTitle>
                  <CardDescription>
                    Rastreamento de todas as mudanças de status deste procedimento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {solicitacao.status_history.map((entry, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0"
                      >
                        <div className="flex-shrink-0">
                          {getStatusBadge(entry.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              {entry.changed_by_name}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {entry.changed_at?.toDate
                                ? entry.changed_at.toDate().toLocaleString("pt-BR")
                                : "N/A"}
                            </span>
                          </div>
                          {entry.observacao && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {entry.observacao}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Informações de Auditoria */}
            <Card>
              <CardHeader>
                <CardTitle>Informações de Auditoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Criado por</Label>
                    <p className="font-medium">
                      {solicitacao.created_by_name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Criado em</Label>
                    <p className="font-medium">
                      {formatTimestamp(solicitacao.created_at)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Última atualização</Label>
                    <p className="font-medium">
                      {formatTimestamp(solicitacao.updated_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alerta baseado no status */}
            {solicitacao.status === "aprovada" && (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Consumo Realizado</AlertTitle>
                <AlertDescription>
                  Os produtos foram consumidos do inventário.
                  {solicitacao.status_history &&
                   solicitacao.status_history.length > 0 &&
                   solicitacao.status_history[0].status === "aprovada"
                    ? " (consumo imediato no momento da criação)"
                    : ""}
                </AlertDescription>
              </Alert>
            )}

            {solicitacao.status === "agendada" && (
              <Alert>
                <Calendar className="h-4 w-4" />
                <AlertTitle>Estoque Reservado</AlertTitle>
                <AlertDescription>
                  Os produtos estão reservados no inventário para este procedimento
                  agendado. O consumo será efetivado quando o procedimento for aprovado.
                </AlertDescription>
              </Alert>
            )}

            {solicitacao.status === "reprovada" && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Procedimento Reprovado</AlertTitle>
                <AlertDescription>
                  Este procedimento foi reprovado. Qualquer reserva de estoque foi liberada.
                </AlertDescription>
              </Alert>
            )}

            {solicitacao.status === "cancelada" && (
              <Alert>
                <Ban className="h-4 w-4" />
                <AlertTitle>Procedimento Cancelado</AlertTitle>
                <AlertDescription>
                  Este procedimento foi cancelado. O estoque foi ajustado de acordo com o
                  status anterior.
                </AlertDescription>
              </Alert>
            )}
      </div>
    </div>
  );
}
