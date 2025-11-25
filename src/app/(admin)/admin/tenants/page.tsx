"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCNPJ } from "@/lib/utils";
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
  ArrowLeft,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  FileText,
  Edit,
  XCircle,
} from "lucide-react";
import { listTenants, deactivateTenant } from "@/lib/services/tenantServiceDirect";
import { Tenant } from "@/types";
import { formatTimestamp } from "@/lib/utils";

export default function TenantsListPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadTenants();
  }, [showActiveOnly]);

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await listTenants({ limit: 100, activeOnly: showActiveOnly });
      setTenants(result.tenants);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar clínicas");
      console.error("Erro ao carregar tenants:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (tenantId: string, tenantName: string) => {
    if (!confirm(`Tem certeza que deseja desativar "${tenantName}"?`)) {
      return;
    }

    try {
      await deactivateTenant(tenantId);
      await loadTenants();
    } catch (err: any) {
      alert(err.message || "Erro ao desativar clínica");
      console.error("Erro ao desativar tenant:", err);
    }
  };

  const filteredTenants = tenants.filter((tenant) => {
    const search = searchTerm.toLowerCase();
    return (
      tenant.name.toLowerCase().includes(search) ||
      tenant.email.toLowerCase().includes(search) ||
      tenant.cnpj.includes(search)
    );
  });

  return (
    <ProtectedRoute allowedRoles={["system_admin"]}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b">
          <div className="container flex h-16 items-center justify-between">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Dashboard
            </Link>
            <Button onClick={() => router.push("/admin/tenants/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Clínica
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="container py-8">
          <div className="space-y-6">
            {/* Page Title */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Building2 className="h-8 w-8 text-primary" />
                Gerenciar Clínicas
              </h1>
              <p className="text-muted-foreground">
                Visualize e gerencie todas as clínicas cadastradas no sistema
              </p>
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
                        placeholder="Buscar por nome, email ou CNPJ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button
                    variant={showActiveOnly ? "default" : "outline"}
                    onClick={() => setShowActiveOnly(!showActiveOnly)}
                  >
                    {showActiveOnly ? "Mostrando Ativos" : "Mostrar Ativos"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Error Message */}
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}

            {/* Tenants List */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Clínicas ({filteredTenants.length})
                </CardTitle>
                <CardDescription>
                  {loading ? "Carregando..." : "Lista de todas as clínicas cadastradas"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando clínicas...
                  </div>
                ) : filteredTenants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm
                      ? "Nenhuma clínica encontrada com os filtros aplicados"
                      : "Nenhuma clínica cadastrada"}
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>CNPJ</TableHead>
                          <TableHead>Contato</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Criado em</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTenants.map((tenant) => (
                          <TableRow key={tenant.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                {tenant.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                {formatCNPJ(tenant.cnpj)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  {tenant.email}
                                </div>
                                {tenant.phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    {tenant.phone}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{tenant.plan_id}</Badge>
                            </TableCell>
                            <TableCell>
                              {tenant.active ? (
                                <Badge variant="default">Ativo</Badge>
                              ) : (
                                <Badge variant="destructive">Inativo</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatTimestamp(tenant.created_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    router.push(`/admin/tenants/${tenant.id}`)
                                  }
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                {tenant.active && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleDeactivate(tenant.id, tenant.name)
                                    }
                                  >
                                    <XCircle className="h-4 w-4 text-destructive" />
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
        </main>
      </div>
    </ProtectedRoute>
  );
}
