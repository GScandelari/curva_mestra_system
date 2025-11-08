"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Package,
  AlertTriangle,
  FileText,
  Upload,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function ClinicDashboard() {
  const { user, claims, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const isAdmin = claims?.role === "clinic_admin";

  return (
    <ProtectedRoute allowedRoles={["clinic_admin", "clinic_user"]}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b">
          <div className="container flex h-16 items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Curva Mestra</h1>
              <p className="text-sm text-muted-foreground">
                {isAdmin ? "Administrador" : "Usuário"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">{user?.displayName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container py-8">
          <div className="space-y-8">
            {/* Welcome */}
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                Olá, {user?.displayName?.split(" ")[0]}!
              </h2>
              <p className="text-muted-foreground">
                Gerencie seu estoque e solicitações
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total em Estoque
                  </CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">Produtos</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Vencendo em 30 dias
                  </CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">Alertas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Solicitações Pendentes
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">
                    Aguardando aprovação
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    NFs Importadas
                  </CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">Este mês</p>
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
                {isAdmin && (
                  <Button variant="outline" className="h-auto flex-col py-4">
                    <Upload className="h-6 w-6 mb-2" />
                    <span>Upload DANFE</span>
                  </Button>
                )}
                <Button variant="outline" className="h-auto flex-col py-4">
                  <Package className="h-6 w-6 mb-2" />
                  <span>Ver Estoque</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col py-4">
                  <FileText className="h-6 w-6 mb-2" />
                  <span>Nova Solicitação</span>
                </Button>
                <Button variant="outline" className="h-auto flex-col py-4">
                  <AlertTriangle className="h-6 w-6 mb-2" />
                  <span>Alertas</span>
                </Button>
              </CardContent>
            </Card>

            {/* Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Alertas de Vencimento</CardTitle>
                <CardDescription>
                  Produtos próximos ao vencimento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Nenhum alerta no momento
                </p>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Atividade Recente</CardTitle>
                <CardDescription>
                  Últimas movimentações do estoque
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Nenhuma movimentação recente
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
