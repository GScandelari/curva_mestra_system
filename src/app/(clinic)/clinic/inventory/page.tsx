"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ClinicLayout } from "@/components/clinic/ClinicLayout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Package,
  Search,
  Filter,
  Download,
  AlertTriangle,
  Calendar,
  TrendingDown,
} from "lucide-react";
import {
  listInventory,
  type InventoryItem,
} from "@/lib/services/inventoryService";

export const dynamic = 'force-dynamic';

function InventoryContent() {
  const { claims } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>(
    []
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const tenantId = claims?.tenant_id;

  useEffect(() => {
    async function loadInventory() {
      if (!tenantId) return;

      try {
        setLoading(true);
        setError("");

        const data = await listInventory(tenantId, true);
        setInventory(data);
        setFilteredInventory(data);

        // Aplicar filtro da URL se houver
        const urlFilter = searchParams.get("filter");
        if (urlFilter === "expiring") {
          setFilterBy("expiring");
          applyFilter(data, "expiring", "");
        }
      } catch (err: any) {
        console.error("Erro ao carregar inventário:", err);
        setError("Erro ao carregar inventário");
      } finally {
        setLoading(false);
      }
    }

    loadInventory();
  }, [tenantId, searchParams]);

  useEffect(() => {
    applyFilter(inventory, filterBy, searchTerm);
  }, [searchTerm, filterBy, inventory]);

  const applyFilter = (
    data: InventoryItem[],
    filter: string,
    search: string
  ) => {
    let filtered = [...data];

    // Aplicar filtro
    if (filter === "expiring") {
      const now = new Date();
      const in30Days = new Date();
      in30Days.setDate(now.getDate() + 30);

      filtered = filtered.filter((item) => {
        return item.dt_validade <= in30Days && item.quantidade_disponivel > 0;
      });
    } else if (filter === "low_stock") {
      filtered = filtered.filter(
        (item) => item.quantidade_disponivel > 0 && item.quantidade_disponivel < 10
      );
    } else if (filter === "out_of_stock") {
      filtered = filtered.filter((item) => item.quantidade_disponivel === 0);
    }

    // Aplicar busca
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.nome_produto.toLowerCase().includes(searchLower) ||
          item.codigo_produto.toLowerCase().includes(searchLower) ||
          item.lote.toLowerCase().includes(searchLower)
      );
    }

    setFilteredInventory(filtered);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getDaysUntilExpiry = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getExpiryBadge = (date: Date, quantity: number) => {
    if (quantity === 0) {
      return <Badge variant="secondary">Sem estoque</Badge>;
    }

    const days = getDaysUntilExpiry(date);

    if (days < 0) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    if (days <= 7) {
      return <Badge variant="destructive">{days} dias</Badge>;
    }
    if (days <= 30) {
      return <Badge variant="warning">{days} dias</Badge>;
    }
    return <Badge variant="default">{days} dias</Badge>;
  };

  const getStockBadge = (quantity: number) => {
    if (quantity === 0) {
      return (
        <Badge variant="destructive" className="gap-1">
          <TrendingDown className="h-3 w-3" />
          Esgotado
        </Badge>
      );
    }
    if (quantity < 10) {
      return (
        <Badge variant="warning" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Baixo
        </Badge>
      );
    }
    return <Badge variant="default">Normal</Badge>;
  };

  const exportToCSV = () => {
    const headers = [
      "Código",
      "Produto",
      "Lote",
      "Quantidade",
      "Validade",
      "Valor Unitário",
      "NF",
    ];

    const rows = filteredInventory.map((item) => [
      item.codigo_produto,
      item.nome_produto,
      item.lote,
      item.quantidade_disponivel,
      formatDate(item.dt_validade),
      item.valor_unitario,
      item.nf_numero || "-",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventario-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <ProtectedRoute allowedRoles={["clinic_admin", "clinic_user"]}>
      <ClinicLayout>
        <div className="container py-8">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">
                  Inventário
                </h2>
                <p className="text-muted-foreground">
                  Gerencie seus produtos e estoques
                </p>
              </div>
              <Button onClick={exportToCSV} disabled={loading}>
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total de Produtos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {inventory.length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total em Estoque
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {inventory.reduce(
                      (acc, item) => acc + item.quantidade_disponivel,
                      0
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Próximos ao Vencimento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">
                    {
                      inventory.filter((item) => {
                        const days = getDaysUntilExpiry(item.dt_validade);
                        return (
                          days <= 30 && days >= 0 && item.quantidade_disponivel > 0
                        );
                      }).length
                    }
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Estoque Baixo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {
                      inventory.filter(
                        (item) =>
                          item.quantidade_disponivel > 0 &&
                          item.quantidade_disponivel < 10
                      ).length
                    }
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filtros e Busca</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por produto, código ou lote..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Filter Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant={filterBy === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterBy("all")}
                    >
                      Todos
                    </Button>
                    <Button
                      variant={filterBy === "expiring" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilterBy("expiring")}
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Vencendo
                    </Button>
                    <Button
                      variant={
                        filterBy === "low_stock" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setFilterBy("low_stock")}
                    >
                      <TrendingDown className="mr-2 h-4 w-4" />
                      Estoque Baixo
                    </Button>
                    <Button
                      variant={
                        filterBy === "out_of_stock" ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setFilterBy("out_of_stock")}
                    >
                      Esgotado
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Produtos ({filteredInventory.length})
                </CardTitle>
                <CardDescription>
                  Lista completa de produtos no estoque
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : error ? (
                  <div className="text-center py-8 text-destructive">
                    {error}
                  </div>
                ) : filteredInventory.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">
                      Nenhum produto encontrado
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {searchTerm || filterBy !== "all"
                        ? "Tente ajustar os filtros ou busca"
                        : "Faça upload de uma DANFE para adicionar produtos"}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Lote</TableHead>
                          <TableHead className="text-right">Qtd.</TableHead>
                          <TableHead>Validade</TableHead>
                          <TableHead className="text-right">
                            Valor Un.
                          </TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInventory.map((item) => (
                          <TableRow
                            key={item.id}
                            className="cursor-pointer hover:bg-accent/50"
                            onClick={() =>
                              router.push(`/clinic/inventory/${item.id}`)
                            }
                          >
                            <TableCell className="font-mono text-xs">
                              {item.codigo_produto}
                            </TableCell>
                            <TableCell className="font-medium">
                              {item.nome_produto}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {item.lote}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {item.quantidade_disponivel}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">
                                  {formatDate(item.dt_validade)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.valor_unitario)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {getExpiryBadge(
                                  item.dt_validade,
                                  item.quantidade_disponivel
                                )}
                                {getStockBadge(item.quantidade_disponivel)}
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
      </ClinicLayout>
    </ProtectedRoute>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <InventoryContent />
    </Suspense>
  );
}
