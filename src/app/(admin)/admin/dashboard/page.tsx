"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Building2, CreditCard, UserCog, Package, DollarSign, TrendingUp, CheckCircle, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PLANS } from "@/lib/constants/plans";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  activeUsers: number;
  planCounts: {
    semestral: number;
    anual: number;
  };
  revenue: {
    semestral: {
      monthly: number;
      total: number;
      count: number;
    };
    anual: {
      monthly: number;
      total: number;
      count: number;
    };
    totalMonthly: number;
    totalAnnual: number;
  };
}

interface Activity {
  id: string;
  type: 'tenant' | 'user' | 'license' | 'access_request';
  title: string;
  description: string;
  timestamp: Date;
  icon: any;
}

export default function SystemAdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
    activeUsers: 0,
    planCounts: { semestral: 0, anual: 0 },
    revenue: {
      semestral: { monthly: 0, total: 0, count: 0 },
      anual: { monthly: 0, total: 0, count: 0 },
      totalMonthly: 0,
      totalAnnual: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    loadDashboardStats();
    loadRecentActivities();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);

      // Buscar tenants
      const tenantsSnapshot = await getDocs(collection(db, "tenants"));
      const tenants = tenantsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const totalTenants = tenants.length;
      const activeTenants = tenants.filter((t: any) => t.active).length;

      // Contar planos
      const semestralTenants = tenants.filter((t: any) => t.plan_id === 'semestral');
      const anualTenants = tenants.filter((t: any) => t.plan_id === 'anual');

      const planCounts = {
        semestral: semestralTenants.length,
        anual: anualTenants.length
      };

      // Calcular faturamento
      const semestralPrice = PLANS.semestral.price;
      const anualPrice = PLANS.anual.price;

      // Faturamento semestral (R$ 59,90/mês por 6 meses)
      const semestralMonthly = semestralTenants.length * semestralPrice;
      const semestralTotal = semestralMonthly * 6;

      // Faturamento anual (R$ 49,90/mês por 12 meses)
      const anualMonthly = anualTenants.length * anualPrice;
      const anualTotal = anualMonthly * 12;

      // Totais
      const totalMonthly = semestralMonthly + anualMonthly;
      const totalAnnual = semestralTotal + anualTotal;

      const revenue = {
        semestral: {
          monthly: semestralMonthly,
          total: semestralTotal,
          count: semestralTenants.length,
        },
        anual: {
          monthly: anualMonthly,
          total: anualTotal,
          count: anualTenants.length,
        },
        totalMonthly,
        totalAnnual,
      };

      // Buscar usuários da coleção raiz
      const usersSnapshot = await getDocs(collection(db, "users"));
      const totalUsers = usersSnapshot.size;
      const activeUsers = usersSnapshot.docs.filter((doc: any) => doc.data().active).length;

      setStats({
        totalTenants,
        activeTenants,
        totalUsers,
        activeUsers,
        planCounts,
        revenue,
      });
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActivities = async () => {
    try {
      const recentActivities: Activity[] = [];

      // Buscar últimos tenants criados
      const tenantsQuery = query(
        collection(db, "tenants"),
        orderBy("created_at", "desc"),
        limit(3)
      );
      const tenantsSnapshot = await getDocs(tenantsQuery);
      tenantsSnapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.created_at?.toDate() || new Date();
        recentActivities.push({
          id: doc.id,
          type: 'tenant',
          title: 'Nova clínica criada',
          description: data.name || 'Sem nome',
          timestamp: createdAt,
          icon: Building2,
        });
      });

      // Buscar últimos usuários criados
      const usersQuery = query(
        collection(db, "users"),
        orderBy("created_at", "desc"),
        limit(3)
      );
      const usersSnapshot = await getDocs(usersQuery);
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.created_at?.toDate() || new Date();
        recentActivities.push({
          id: doc.id,
          type: 'user',
          title: 'Novo usuário registrado',
          description: data.full_name || data.email || 'Sem nome',
          timestamp: createdAt,
          icon: UserPlus,
        });
      });

      // Buscar últimas licenças criadas
      const licensesQuery = query(
        collection(db, "licenses"),
        orderBy("created_at", "desc"),
        limit(3)
      );
      const licensesSnapshot = await getDocs(licensesQuery);
      licensesSnapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.created_at?.toDate() || new Date();
        const planName = data.plan_id === 'semestral' ? 'Semestral' : 'Anual';
        recentActivities.push({
          id: doc.id,
          type: 'license',
          title: `Licença ${planName} ativada`,
          description: `Plano ${planName}`,
          timestamp: createdAt,
          icon: CreditCard,
        });
      });

      // Buscar últimas solicitações aprovadas
      const accessRequestsQuery = query(
        collection(db, "access_requests"),
        orderBy("updated_at", "desc"),
        limit(3)
      );
      const accessRequestsSnapshot = await getDocs(accessRequestsQuery);
      accessRequestsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'approved') {
          const updatedAt = data.updated_at?.toDate() || new Date();
          recentActivities.push({
            id: doc.id,
            type: 'access_request',
            title: 'Solicitação aprovada',
            description: data.clinic_name || 'Sem nome',
            timestamp: updatedAt,
            icon: CheckCircle,
          });
        }
      });

      // Ordenar por timestamp (mais recente primeiro) e pegar as 5 mais recentes
      const sortedActivities = recentActivities
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 5);

      setActivities(sortedActivities);
    } catch (error) {
      console.error("Erro ao carregar atividades recentes:", error);
    }
  };

  return (
    <div className="container py-8">
      <div className="space-y-8">
        {/* Welcome */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Dashboard administrativo
          </h2>
          <p className="text-muted-foreground">
            Visão geral da plataforma
          </p>
        </div>

            {/* Revenue Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Faturamento Mensal Total
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading
                      ? "..."
                      : new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(stats.revenue.totalMonthly)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.activeTenants} clínicas ativas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Plano Semestral
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading
                      ? "..."
                      : new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(stats.revenue.semestral.monthly)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.revenue.semestral.count} clínicas · R$ 59,90/mês
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Plano Anual
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading
                      ? "..."
                      : new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(stats.revenue.anual.monthly)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.revenue.anual.count} clínicas · R$ 49,90/mês
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Projeção Anual
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading
                      ? "..."
                      : new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(stats.revenue.totalAnnual)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Faturamento total dos contratos
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total de Clínicas
                  </CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? "..." : stats.totalTenants}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.activeTenants} ativas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Licenças por Plano
                  </CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? "..." : stats.activeTenants}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.planCounts.semestral} Semestral · {stats.planCounts.anual} Anual
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total de Usuários
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loading ? "..." : stats.totalUsers}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.activeUsers} ativos
                  </p>
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
                  className="h-auto flex-col py-4"
                  onClick={() => router.push("/admin/tenants")}
                >
                  <Building2 className="h-6 w-6 mb-2" />
                  <span>Gerenciar Clínicas</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col py-4"
                  onClick={() => router.push("/admin/users")}
                >
                  <UserCog className="h-6 w-6 mb-2" />
                  <span>Gerenciar Usuários</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col py-4"
                  onClick={() => router.push("/admin/products")}
                >
                  <Package className="h-6 w-6 mb-2" />
                  <span>Gerenciar Produtos</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto flex-col py-4"
                  onClick={() => router.push("/admin/licenses")}
                >
                  <CreditCard className="h-6 w-6 mb-2" />
                  <span>Gerenciar Licenças</span>
                </Button>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Atividade Recente</CardTitle>
                <CardDescription>
                  Últimas ações no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground">
                    Carregando...
                  </p>
                ) : activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma atividade recente
                  </p>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity) => {
                      const Icon = activity.icon;
                      return (
                        <div
                          key={activity.id}
                          className="flex items-start gap-4 pb-4 last:pb-0 border-b last:border-0"
                        >
                          <div className="flex-shrink-0 mt-1">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">
                              {activity.title}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {activity.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(activity.timestamp, {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
    </div>
  );
}
