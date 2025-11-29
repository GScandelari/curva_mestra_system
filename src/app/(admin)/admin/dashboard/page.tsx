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
import { Users, Building2, CreditCard, UserCog, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  activeUsers: number;
  planCounts: {
    semestral: number;
    anual: number;
  };
}

export default function SystemAdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalTenants: 0,
    activeTenants: 0,
    totalUsers: 0,
    activeUsers: 0,
    planCounts: { semestral: 0, anual: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
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
      const planCounts = {
        semestral: tenants.filter((t: any) => t.plan_id === 'semestral').length,
        anual: tenants.filter((t: any) => t.plan_id === 'anual').length
      };

      // Buscar usuários de todos os tenants
      let totalUsers = 0;
      let activeUsers = 0;

      for (const tenant of tenants) {
        const usersSnapshot = await getDocs(
          collection(db, "tenants", tenant.id, "users")
        );
        totalUsers += usersSnapshot.size;
        activeUsers += usersSnapshot.docs.filter((doc: any) => doc.data().active).length;
      }

      setStats({
        totalTenants,
        activeTenants,
        totalUsers,
        activeUsers,
        planCounts
      });
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-8">
      <div className="space-y-8">
        {/* Welcome */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Bem-vindo de volta!
          </h2>
          <p className="text-muted-foreground">
            Gerencie clínicas, licenças e produtos master
          </p>
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
                <p className="text-sm text-muted-foreground">
                  Nenhuma atividade recente
                </p>
              </CardContent>
            </Card>
          </div>
    </div>
  );
}
