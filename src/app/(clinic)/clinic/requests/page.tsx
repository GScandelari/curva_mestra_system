"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  FileText,
  Search,
  Calendar,
  User,
  Package,
  Settings,
} from "lucide-react";
import {
  listSolicitacoes,
  type SolicitacaoWithDetails,
} from "@/lib/services/solicitacaoService";
import { formatTimestamp } from "@/lib/utils";

export default function SolicitacoesPage() {
  const { claims } = useAuth();
  const router = useRouter();

  const tenantId = claims?.tenant_id;
  const isAdmin = claims?.role === "clinic_admin";

  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function loadSolicitacoes() {
      if (!tenantId) return;

      try {
        setLoading(true);
        const data = await listSolicitacoes(tenantId, {
          status: statusFilter === "all" ? undefined : statusFilter,
        });
        setSolicitacoes(data);
      } catch (error) {
        console.error("Erro ao carregar solicitações:", error);
      } finally {
        setLoading(false);
      }
    }

    loadSolicitacoes();
  }, [tenantId, statusFilter]);

  const filteredSolicitacoes = solicitacoes.filter((sol) => {
    const matchesSearch =
      sol.paciente_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sol.paciente_codigo.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      criada: "default",
      agendada: "secondary",
      aprovada: "default",
      reprovada: "destructive",
      cancelada: "destructive",
    };

    const labels: Record<string, string> = {
      criada: "Criada",
      agendada: "Agendada",
      aprovada: "Aprovada",
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

  return (
    <div className="container py-8">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">
                  Solicitações de Produtos
                </h2>
                <p className="text-muted-foreground">
                  Histórico de consumo de produtos por procedimento
                </p>
              </div>
              <Button onClick={() => router.push("/clinic/requests/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Solicitação
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{solicitacoes.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Criadas</CardTitle>
                  <FileText className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {solicitacoes.filter((s) => s.status === "criada").length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Agendadas</CardTitle>
                  <Calendar className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {solicitacoes.filter((s) => s.status === "agendada").length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
                  <Package className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {solicitacoes.filter((s) => s.status === "aprovada").length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filtros</CardTitle>
                <CardDescription>
                  Busque e filtre as solicitações
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por paciente ou código..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="criada">Criada</SelectItem>
                      <SelectItem value="agendada">Agendada</SelectItem>
                      <SelectItem value="aprovada">Aprovada</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Solicitações */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Solicitações ({filteredSolicitacoes.length})
                </CardTitle>
                <CardDescription>
                  Lista de todas as solicitações de produtos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredSolicitacoes.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">
                      Nenhuma solicitação encontrada
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {searchTerm
                        ? "Tente ajustar os filtros de busca"
                        : "Crie sua primeira solicitação de produtos"}
                    </p>
                    <Button onClick={() => router.push("/clinic/requests/new")}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Solicitação
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Data Procedimento</TableHead>
                        <TableHead className="text-right">Produtos</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSolicitacoes.map((solicitacao) => (
                        <TableRow key={solicitacao.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {solicitacao.paciente_nome}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {solicitacao.paciente_codigo}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {solicitacao.dt_procedimento?.toDate
                              ? solicitacao.dt_procedimento
                                  .toDate()
                                  .toLocaleDateString("pt-BR")
                              : "N/A"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">
                              {solicitacao.total_produtos}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(solicitacao.valor_total)}
                          </TableCell>
                          <TableCell>{getStatusBadge(solicitacao.status)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatTimestamp(solicitacao.created_at)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                router.push(`/clinic/requests/${solicitacao.id}`)
                              }
                            >
                              <Settings className="mr-2 h-4 w-4" />
                              Gerenciar
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
    </div>
  );
}
