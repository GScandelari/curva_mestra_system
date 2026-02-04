"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Users,
  Edit,
  Ban,
  CheckCircle,
  Building2,
  Copy,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatTimestamp } from "@/lib/utils";
import type { Consultant } from "@/types";

export default function ConsultantsListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadConsultants();
  }, [statusFilter, user]);

  const loadConsultants = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError("");

      const token = await user.getIdToken();
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);

      const response = await fetch(`/api/consultants?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao carregar consultores");
      }

      setConsultants(data.data || []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar consultores");
      console.error("Erro ao carregar consultores:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (consultant: Consultant) => {
    if (!user) return;

    const newStatus = consultant.status === "active" ? "suspended" : "active";
    const action = newStatus === "suspended" ? "suspender" : "reativar";

    if (!confirm(`Tem certeza que deseja ${action} o consultor "${consultant.name}"?`)) {
      return;
    }

    try {
      const token = await user.getIdToken();

      const response = await fetch(`/api/consultants/${consultant.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Erro ao ${action} consultor`);
      }

      toast({ title: `Consultor ${newStatus === "active" ? "reativado" : "suspenso"} com sucesso` });
      loadConsultants();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Código copiado para a área de transferência" });
  };

  const filteredConsultants = consultants.filter((consultant) => {
    const search = searchTerm.toLowerCase();
    return (
      consultant.name.toLowerCase().includes(search) ||
      consultant.email.toLowerCase().includes(search) ||
      consultant.code.includes(search) ||
      consultant.phone.includes(search)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Ativo</Badge>;
      case "suspended":
        return <Badge variant="destructive">Suspenso</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inativo</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container py-8">
      <div className="space-y-6">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-8 w-8 text-sky-600" />
              Gerenciar Consultores
            </h1>
            <p className="text-muted-foreground">
              Cadastre e gerencie consultores externos do sistema
            </p>
          </div>
          <Button
            onClick={() => router.push("/admin/consultants/new")}
            className="bg-sky-600 hover:bg-sky-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Consultor
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, email, código ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={statusFilter === null ? "default" : "outline"}
                  onClick={() => setStatusFilter(null)}
                >
                  Todos
                </Button>
                <Button
                  variant={statusFilter === "active" ? "default" : "outline"}
                  onClick={() => setStatusFilter("active")}
                >
                  Ativos
                </Button>
                <Button
                  variant={statusFilter === "suspended" ? "default" : "outline"}
                  onClick={() => setStatusFilter("suspended")}
                >
                  Suspensos
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        {/* Consultants List */}
        <Card>
          <CardHeader>
            <CardTitle>Consultores ({filteredConsultants.length})</CardTitle>
            <CardDescription>
              {loading ? "Carregando..." : "Lista de consultores cadastrados"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando consultores...
              </div>
            ) : filteredConsultants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm
                  ? "Nenhum consultor encontrado com os filtros aplicados"
                  : "Nenhum consultor cadastrado"}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Clínicas</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConsultants.map((consultant) => (
                      <TableRow key={consultant.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sky-600">
                              {consultant.code}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyCode(consultant.code)}
                              title="Copiar código"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {consultant.name}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div>{consultant.email}</div>
                            <div className="text-muted-foreground">
                              {consultant.phone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{consultant.authorized_tenants?.length || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(consultant.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatTimestamp(consultant.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                router.push(`/admin/consultants/${consultant.id}`)
                              }
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {consultant.status === "active" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(consultant)}
                                title="Suspender"
                              >
                                <Ban className="h-4 w-4 text-destructive" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(consultant)}
                                title="Reativar"
                              >
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                          </div>
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
