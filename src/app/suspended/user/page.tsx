/**
 * Página: Clínica Suspensa (Usuário)
 * Exibe mensagem genérica para clinic_user
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useTenantSuspension } from "@/hooks/useTenantSuspension";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, LogOut } from "lucide-react";

export default function SuspendedUserPage() {
  const router = useRouter();
  const { claims, signOut } = useAuth();
  const { isSuspended, isLoading } = useTenantSuspension();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    // Se não está suspenso, redirecionar
    if (!isLoading && !isSuspended) {
      router.push("/clinic");
    }

    // Se é clinic_admin, redirecionar para página de admin
    if (!isLoading && claims?.role === "clinic_admin") {
      router.push("/suspended/admin");
    }
  }, [isSuspended, isLoading, claims, router]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    router.push("/login");
  };

  if (isLoading || !isSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-background to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="text-center border-b bg-amber-50/50">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <AlertCircle className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-amber-900">
            Acesso Temporariamente Bloqueado
          </CardTitle>
          <CardDescription className="text-base">
            O sistema está temporariamente indisponível
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Mensagem Principal */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <p className="text-center text-muted-foreground leading-relaxed">
              O acesso à plataforma foi temporariamente bloqueado.
            </p>
            <p className="text-center text-muted-foreground leading-relaxed mt-2">
              Para mais informações, entre em contato com o{" "}
              <span className="font-semibold text-foreground">
                administrador da clínica
              </span>
              .
            </p>
          </div>

          {/* Ilustração */}
          <div className="flex justify-center py-4">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-200 rounded-full blur-2xl opacity-20"></div>
              <AlertCircle className="relative h-24 w-24 text-amber-500/30" />
            </div>
          </div>

          {/* Instruções */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <h3 className="font-semibold mb-3 text-center">O que fazer?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">1.</span>
                <span>
                  Entre em contato com o administrador responsável pela clínica
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">2.</span>
                <span>
                  Solicite informações sobre o status da conta
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">3.</span>
                <span>
                  Aguarde a regularização para acessar novamente
                </span>
              </li>
            </ul>
          </div>

          {/* Botão de Sair */}
          <div className="pt-2">
            <Button
              variant="outline"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {isSigningOut ? "Saindo..." : "Sair da Conta"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
