"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types";
import { needsOnboarding, getNextOnboardingStep } from "@/lib/services/tenantOnboardingService";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireAuth?: boolean;
  skipOnboardingCheck?: boolean; // Para rotas de setup não verificarem
}

/**
 * Componente para proteger rotas
 * - Redireciona para login se não autenticado
 * - Redireciona para onboarding se não completou setup
 * - Redireciona para dashboard apropriado se não tem permissão
 * - Permite acesso se role está na lista de allowedRoles
 */
export function ProtectedRoute({
  children,
  allowedRoles,
  requireAuth = true,
  skipOnboardingCheck = false,
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, claims, role } = useAuth();
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      if (loading) return;

      // Se requer autenticação e não está autenticado
      if (requireAuth && !user) {
        router.push("/login");
        return;
      }

      // Se está autenticado mas não tem claims (ainda não configurado)
      if (user && !claims) {
        router.push("/waiting-approval");
        return;
      }

      // Se tem claims mas não está ativo (aguardando aprovação)
      if (user && claims && claims.active === false) {
        router.push("/waiting-approval");
        return;
      }

      // Verificar onboarding (apenas para clinic_admin e clinic_user)
      if (
        !skipOnboardingCheck &&
        user &&
        claims?.tenant_id &&
        (role === "clinic_admin" || role === "clinic_user")
      ) {
        // Não verificar se já está em rota de setup
        const isSetupRoute = pathname?.startsWith("/clinic/setup");

        if (!isSetupRoute) {
          setCheckingOnboarding(true);

          try {
            const needsSetup = await needsOnboarding(claims.tenant_id);

            if (needsSetup) {
              const nextStep = await getNextOnboardingStep(claims.tenant_id);

              // Redirecionar para a etapa pendente
              switch (nextStep) {
                case "pending_setup":
                  router.push("/clinic/setup");
                  return;
                case "pending_plan":
                  router.push("/clinic/setup/plan");
                  return;
                case "pending_payment":
                  router.push("/clinic/setup/payment");
                  return;
              }
            }
          } catch (error) {
            console.error("Erro ao verificar onboarding:", error);
          } finally {
            setCheckingOnboarding(false);
          }
        }
      }

      // Se tem roles permitidos, verificar permissão
      if (allowedRoles && allowedRoles.length > 0 && role) {
        if (!allowedRoles.includes(role)) {
          // Redirecionar para o dashboard apropriado baseado no role
          redirectToDashboard(role, router);
          return;
        }
      }
    }

    checkAccess();
  }, [user, loading, claims, role, allowedRoles, requireAuth, skipOnboardingCheck, pathname, router]);

  // Mostrar loading enquanto verifica autenticação ou onboarding
  if (loading || checkingOnboarding) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">
            {checkingOnboarding ? "Verificando configuração..." : "Carregando..."}
          </p>
        </div>
      </div>
    );
  }

  // Se não requer autenticação, mostrar conteúdo
  if (!requireAuth) {
    return <>{children}</>;
  }

  // Se não está autenticado, não mostrar nada (vai redirecionar)
  if (!user) {
    return null;
  }

  // Se não tem claims, não mostrar nada (vai redirecionar)
  if (!claims) {
    return null;
  }

  // Se não está ativo, não mostrar nada (vai redirecionar)
  if (claims.active === false) {
    return null;
  }

  // Se tem roles permitidos e não tem permissão, não mostrar nada
  if (allowedRoles && allowedRoles.length > 0 && role) {
    if (!allowedRoles.includes(role)) {
      return null;
    }
  }

  // Tudo ok, mostrar conteúdo
  return <>{children}</>;
}

/**
 * Redireciona para o dashboard apropriado baseado no role
 */
function redirectToDashboard(role: UserRole, router: any) {
  switch (role) {
    case "system_admin":
      router.push("/admin/dashboard");
      break;
    case "clinic_admin":
    case "clinic_user":
      router.push("/clinic/dashboard");
      break;
    case "clinic_consultant":
      router.push("/consultant/dashboard");
      break;
    default:
      router.push("/dashboard");
  }
}
