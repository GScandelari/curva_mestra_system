"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
  FileText,
  Search,
  Calendar,
  Package,
  ArrowLeft,
  Users,
} from "lucide-react";
import { ReadOnlyBanner } from "@/components/consultant/ReadOnlyBanner";
import { formatTimestamp } from "@/lib/utils";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore";

interface Solicitacao {
  id: string;
  paciente_nome: string;
  paciente_codigo: string;
  dt_procedimento: Timestamp | null;
  status: string;
  total_produtos: number;
  valor_total: number;
  created_at: Timestamp;
}

export default function ConsultantProceduresPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.tenantId as string;
  const { user, authorizedTenants, loading: authLoading, claims } = useAuth();

  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (authLoading) return;

    if (claims) {
      if (!authorizedTenants.includes(tenantId)) {
        router.push("/consultant/clinics");
        return;
      }
      loadSolicitacoes();
    }
  }, [tenantId, authorizedTenants, authLoading, claims]);

  const loadSolicitacoes = async () => {
    try {
      setLoading(true);

      const solicitacoesRef = collection(db, "tenants", tenantId, "solicitacoes");
      const q = query(solicitacoesRef, orderBy("created_at", "desc"));

      const snapshot = await getDocs(q);
      const items: Solicitacao[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          paciente_nome: data.paciente_nome || "",
          paciente_codigo: data.paciente_codigo || "",
          dt_procedimento: data.dt_procedimento || null,
          status: data.status || "criada",
          total_produtos: data.total_produtos || 0,
          valor_total: data.valor_total || 0,
          created_at: data.created_at,
        });
      });

      setSolicitacoes(items);
    } catch (error) {
      console.error("Erro ao carregar procedimentos:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSolicitacoes = solicitacoes.filter((sol) => {
    const matchesSearch =
      sol.paciente_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sol.paciente_codigo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || sol.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      agendada: "secondary",
      aprovada: "default",
      concluida: "default",
      reprovada: "destructive",
      cancelada: "destructive",
    };

    const labels: Record<string, string> = {
      criada: "Criada",
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

  if (authLoading || loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.push(`/consultant/clinics/${tenantId}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-sky-600" />
            Procedimentos
          </h2>
          <p className="text-muted-foreground">
            Histórico de consumo de produtos por procedimento
          </p>
        </div>

        {/* Read-Only Banner */}
        <ReadOnlyBanner />

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
              <CardTitle className="text-sm font-medium">Agendadas</CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
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
              <Package className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {solicitacoes.filter((s) => s.status === "aprovada").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
              <Package className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {solicitacoes.filter((s) => s.status === "concluida").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Busque e filtre os procedimentos</CardDescription>
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
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="reprovada">Reprovada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Procedimentos */}
        <Card>
          <CardHeader>
            <CardTitle>Procedimentos ({filteredSolicitacoes.length})</CardTitle>
            <CardDescription>
              Lista de todos os procedimentos realizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredSolicitacoes.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">
                  Nenhum procedimento encontrado
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== "all"
                    ? "Tente ajustar os filtros de busca"
                    : "Esta clínica ainda não possui procedimentos registrados"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Data Procedimento</TableHead>
                      <TableHead className="text-right">Produtos</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
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
                          {solicitacao.dt_procedimento
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
