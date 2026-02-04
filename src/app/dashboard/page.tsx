"use client";

import { useEffect } from "react";
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

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, isAuthenticated, signOut, claims } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    // Redirecionar para o dashboard correto baseado no role
    if (!loading && isAuthenticated && claims) {
      if (claims.is_system_admin) {
        router.push("/admin/dashboard");
      } else if (claims.role === "clinic_admin" || claims.role === "clinic_user") {
        router.push("/clinic/dashboard");
      } else if (claims.role === "clinic_consultant") {
        router.push("/consultant/dashboard");
      }
      // Se não tiver role, permanece nesta página de debug
    }
  }, [isAuthenticated, loading, claims, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Dashboard de Debug</h1>
            <p className="text-muted-foreground">
              Bem-vindo, {user?.displayName || user?.email}
            </p>
            <p className="text-amber-600 dark:text-amber-400 text-sm mt-2">
              ⚠️ Esta página só deve ser acessada para debug. Usuários com roles configurados são redirecionados automaticamente.
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sair
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Usuário</CardTitle>
              <CardDescription>Dados da conta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Nome</p>
                <p className="text-sm text-muted-foreground">
                  {user?.displayName || "Não definido"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">UID</p>
                <p className="text-sm text-muted-foreground font-mono text-xs">
                  {user?.uid}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custom Claims</CardTitle>
              <CardDescription>Permissões e tenant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {claims ? (
                <>
                  <div>
                    <p className="text-sm font-medium">Tenant ID</p>
                    <p className="text-sm text-muted-foreground">
                      {claims.tenant_id || "Não configurado"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Role</p>
                    <p className="text-sm text-muted-foreground">
                      {claims.role || "Não configurado"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">System Admin</p>
                    <p className="text-sm text-muted-foreground">
                      {claims.is_system_admin ? "Sim" : "Não"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Ativo</p>
                    <p className="text-sm text-muted-foreground">
                      {claims.active ? "Sim" : "Não"}
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-sm text-amber-600 dark:text-amber-400">
                  Nenhuma permissão configurada. Entre em contato com o
                  administrador.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>Estado da conexão</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm">
                  {process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
                    ? "Conectado aos emuladores (local)"
                    : "Conectado ao Firebase (produção)"}
                </span>
              </div>
              {process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" && (
                <p className="text-xs text-muted-foreground">
                  Firebase Emulator UI: http://127.0.0.1:4000
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
