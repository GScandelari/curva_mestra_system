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
import { getPatientsStats } from "@/lib/services/patientService";
import { getUpcomingProcedures } from "@/lib/services/solicitacaoService";
import type { Solicitacao } from "@/types";
import { formatTimestamp } from "@/lib/utils";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";

export default function ClinicDashboard() {
  const { user, claims } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [patientStats, setPatientStats] = useState<{
    total: number;
    novos_mes: number;
    novos_3_meses: number;
  } | null>(null);
  const [expiringProducts, setExpiringProducts] = useState<ExpiringProduct[]>(
    []
  );
  const [recentActivity, setRecentActivity] = useState<ActivityType[]>([]);
  const [upcomingProcedures, setUpcomingProcedures] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isAdmin = claims?.role === "clinic_admin";
  const tenantId = claims?.tenant_id;

  useEffect(() => {
    if (!tenantId) return;

    setLoading(true);
    setError("");

    // Configurar listener em tempo real para o inventário
    const inventoryRef = collection(db, "tenants", tenantId, "inventory");
    const inventoryQuery = query(inventoryRef, where("active", "==", true));

    const unsubscribeInventory = onSnapshot(
      inventoryQuery,
      async (snapshot) => {
        try {
          // Calcular estatísticas em tempo real a partir do snapshot
          let totalProdutos = 0;
          let totalValor = 0;
          let produtosVencendo30dias = 0;
          let produtosVencidos = 0;
          let produtosEstoqueBaixo = 0;

          const now = new Date();
          const in30Days = new Date();
          in30Days.setDate(now.getDate() + 30);

          const expiringItems: ExpiringProduct[] = [];

          snapshot.forEach((doc) => {
            const data = doc.data();
            const quantidade = data.quantidade_disponivel || 0;

            if (quantidade > 0) {
              totalProdutos += quantidade;
              totalValor += quantidade * (data.valor_unitario || 0);

              // Verificar vencimento
              const dtValidade =
                data.dt_validade instanceof Timestamp
                  ? data.dt_validade.toDate()
                  : new Date(data.dt_validade);

              const diasParaVencer = Math.ceil(
                (dtValidade.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              );

              if (dtValidade < now) {
                produtosVencidos++;
              } else if (dtValidade <= in30Days) {
                produtosVencendo30dias++;

                // Adicionar aos produtos vencendo (máximo 5)
                if (expiringItems.length < 5) {
                  expiringItems.push({
                    id: doc.id,
                    nome_produto: data.nome_produto,
                    lote: data.lote,
                    quantidade_disponivel: data.quantidade_disponivel,
                    dt_validade: dtValidade,
                    diasParaVencer,
                  });
                }
              }

              // Verificar estoque baixo (menos de 10 unidades)
              if (quantidade < 10) {
                produtosEstoqueBaixo++;
              }
            }
          });

          // Ordenar produtos vencendo por data
          expiringItems.sort((a, b) => a.diasParaVencer - b.diasParaVencer);

          setStats({
            totalProdutos,
            totalValor,
            produtosVencendo30dias,
            produtosVencidos,
            produtosEstoqueBaixo,
            ultimaAtualizacao: new Date(),
          });

          setExpiringProducts(expiringItems);

          // Carregar dados não-realtime em paralelo
          const [patientStatsData, activityData, upcomingData] = await Promise.all([
            getPatientsStats(tenantId),
            getRecentActivity(tenantId, 5),
            getUpcomingProcedures(tenantId, 5),
          ]);

          setPatientStats(patientStatsData);
          setRecentActivity(activityData);
          setUpcomingProcedures(upcomingData);

          setLoading(false);
          setError("");
        } catch (err: any) {
          console.error("Erro ao processar dados do dashboard:", err);
          setError("Erro ao carregar dados do dashboard");
          setLoading(false);
        }
      },
      (err) => {
        console.error("Erro ao monitorar inventário:", err);
        setError("Erro ao carregar dados do dashboard");
        setLoading(false);
      }
    );

    // Cleanup: Desinscrever listener quando componente desmontar
    return () => unsubscribeInventory();
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "criada":
        return "secondary";
      case "agendada":
        return "default";
      case "aprovada":
        return "default";
      case "concluida":
        return "default";
      case "reprovada":
        return "destructive";
      case "cancelada":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "criada":
        return "Criada";
      case "agendada":
        return "Agendada";
      case "aprovada":
        return "Aprovada";
      case "concluida":
        return "Concluída";
      case "reprovada":
        return "Reprovada";
      case "cancelada":
        return "Cancelada";
      default:
        return status;
    }
  };

  const formatProcedureDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Atrasado";
    if (diffDays === 0) return "Hoje";
    if (diffDays === 1) return "Amanhã";
    if (diffDays <= 7) return `Em ${diffDays} dias`;

    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
    }).format(date);
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

              {/* Total de Pacientes */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total de Pacientes
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-4 w-24" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {patientStats?.total || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Cadastrados
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Novos Pacientes (3 meses) */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Novos (3 meses)
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-4 w-24" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-blue-600">
                        {patientStats?.novos_3_meses || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {patientStats?.novos_mes || 0} neste mês
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
                  <span>Procedimentos</span>
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Próximos Procedimentos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    Próximos Procedimentos
                  </CardTitle>
                  <CardDescription>
                    Procedimentos agendados nas próximas 2 semanas
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
                  ) : upcomingProcedures.length === 0 ? (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum procedimento agendado nas próximas 2 semanas
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {upcomingProcedures.map((proc) => (
                        <div
                          key={proc.id}
                          className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => router.push(`/clinic/requests?id=${proc.id}`)}
                        >
                          <div className="flex-1 space-y-1">
                            <p className="font-medium text-sm leading-tight">
                              {proc.paciente_nome}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Cód: {proc.paciente_codigo}</span>
                              <span>•</span>
                              <span>{proc.produtos_solicitados?.length || 0} produtos</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar className="h-3 w-3" />
                              <span>{formatProcedureDate(proc.dt_procedimento)}</span>
                            </div>
                          </div>
                          <Badge variant={getStatusBadgeVariant(proc.status) as any}>
                            {getStatusLabel(proc.status)}
                          </Badge>
                        </div>
                      ))}
                      {upcomingProcedures.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => router.push("/clinic/requests")}
                        >
                          Ver todos os procedimentos
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

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
                              {activity.nome_produto} • {activity.quantidade}{" "}
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
