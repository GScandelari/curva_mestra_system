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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Package,
  AlertTriangle,
  FileText,
  TrendingUp,
  Calendar,
  Clock,
  DollarSign,
  Users,
} from "lucide-react";
import {
  getInventoryStats,
  getExpiringProducts,
  getRecentActivity,
  type InventoryStats,
  type ExpiringProduct,
  type RecentActivity as ActivityType,
} from "@/lib/services/inventoryService";
import { formatTimestamp } from "@/lib/utils";

export default function ClinicDashboard() {
  const { user, claims } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [expiringProducts, setExpiringProducts] = useState<ExpiringProduct[]>(
    []
  );
  const [recentActivity, setRecentActivity] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isAdmin = claims?.role === "clinic_admin";
  const tenantId = claims?.tenant_id;

  useEffect(() => {
    async function loadDashboardData() {
      if (!tenantId) return;

      try {
        setLoading(true);
        setError("");

        // Carregar dados em paralelo
        const [statsData, expiringData, activityData] = await Promise.all([
          getInventoryStats(tenantId),
          getExpiringProducts(tenantId, 30, 5),
          getRecentActivity(tenantId, 5),
        ]);

        setStats(statsData);
        setExpiringProducts(expiringData);
        setRecentActivity(activityData);
      } catch (err: any) {
        console.error("Erro ao carregar dashboard:", err);
        setError("Erro ao carregar dados do dashboard");
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [tenantId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  const getExpiryBadgeVariant = (diasParaVencer: number) => {
    if (diasParaVencer < 0) return "destructive";
    if (diasParaVencer <= 7) return "destructive";
    if (diasParaVencer <= 30) return "warning";
    return "default";
  };

  const getExpiryText = (diasParaVencer: number) => {
    if (diasParaVencer < 0) return "Vencido";
    if (diasParaVencer === 0) return "Vence hoje";
    if (diasParaVencer === 1) return "Vence amanhã";
    return `${diasParaVencer} dias`;
  };

  return (
    <div className="container py-8">
      <div className="space-y-8">
        {/* Welcome */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Olá, {user?.displayName?.split(" ")[0]}!
          </h2>
          <p className="text-muted-foreground">
            Visão geral do seu estoque e operações
          </p>
        </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Total em Estoque */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total em Estoque
                  </CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-20 mb-1" />
                      <Skeleton className="h-4 w-16" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {stats?.totalProdutos || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Unidades disponíveis
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Valor Total */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Valor Total
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-24 mb-1" />
                      <Skeleton className="h-4 w-16" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {formatCurrency(stats?.totalValor || 0)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Em estoque
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Vencendo em 30 dias */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Vencendo em 30 dias
                  </CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-4 w-20" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-yellow-600">
                        {stats?.produtosVencendo30dias || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {stats?.produtosVencidos || 0} já vencidos
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Estoque Baixo */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Estoque Baixo
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-4 w-24" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-orange-600">
                        {stats?.produtosEstoqueBaixo || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Menos de 10 unidades
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Ações Rápidas</CardTitle>
                <CardDescription>
                  Acesse as principais funcionalidades
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Button
                  variant="outline"
                  className="h-auto flex-col py-6 gap-2"
                  onClick={() => router.push("/clinic/inventory")}
                >
                  <Package className="h-6 w-6" />
                  <span>Gerenciar Estoque</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col py-6 gap-2"
                  onClick={() => router.push("/clinic/requests")}
                >
                  <FileText className="h-6 w-6" />
                  <span>Solicitações</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col py-6 gap-2"
                  onClick={() => router.push("/clinic/patients")}
                >
                  <Users className="h-6 w-6" />
                  <span>Pacientes</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col py-6 gap-2"
                  onClick={() => router.push("/clinic/reports")}
                >
                  <TrendingUp className="h-6 w-6" />
                  <span>Relatórios</span>
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Alertas de Vencimento */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    Alertas de Vencimento
                  </CardTitle>
                  <CardDescription>
                    Produtos próximos ao vencimento
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="h-12 w-12 rounded" />
                          <div className="flex-1">
                            <Skeleton className="h-4 w-full mb-2" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : expiringProducts.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum produto vencendo nos próximos 30 dias
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {expiringProducts.map((product) => (
                        <div
                          key={product.id}
                          className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex-1 space-y-1">
                            <p className="font-medium text-sm leading-tight">
                              {product.nome_produto}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Lote: {product.lote}</span>
                              <span>•</span>
                              <span>{product.quantidade_disponivel} un.</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(product.dt_validade)}</span>
                            </div>
                          </div>
                          <Badge
                            variant={getExpiryBadgeVariant(
                              product.diasParaVencer
                            )}
                          >
                            {getExpiryText(product.diasParaVencer)}
                          </Badge>
                        </div>
                      ))}
                      {expiringProducts.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => router.push("/clinic/inventory?filter=expiring")}
                        >
                          Ver todos os alertas
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Atividade Recente */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    Atividade Recente
                  </CardTitle>
                  <CardDescription>
                    Últimas movimentações do estoque
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      ))}
                    </div>
                  ) : recentActivity.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-muted-foreground">
                        Nenhuma movimentação recente
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {recentActivity.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0"
                        >
                          <div
                            className={`p-2 rounded-full ${
                              activity.tipo === "entrada"
                                ? "bg-green-100 text-green-600"
                                : activity.tipo === "saida"
                                ? "bg-red-100 text-red-600"
                                : "bg-blue-100 text-blue-600"
                            }`}
                          >
                            {activity.tipo === "entrada" ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : (
                              <Package className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-tight">
                              {activity.descricao}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {activity.produto_nome} • {activity.quantidade}{" "}
                              unidades
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTimestamp(activity.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
    </div>
  );
}
