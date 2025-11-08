"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireAuth?: boolean;
}

/**
 * Componente para proteger rotas
 * - Redireciona para login se não autenticado
 * - Redireciona para dashboard apropriado se não tem permissão
 * - Permite acesso se role está na lista de allowedRoles
 */
export function ProtectedRoute({
  children,
  allowedRoles,
  requireAuth = true,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { user, loading, claims, role } = useAuth();

  useEffect(() => {
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

    // Se tem roles permitidos, verificar permissão
    if (allowedRoles && allowedRoles.length > 0 && role) {
      if (!allowedRoles.includes(role)) {
        // Redirecionar para o dashboard apropriado baseado no role
        redirectToDashboard(role, router);
        return;
      }
    }
  }, [user, loading, claims, role, allowedRoles, requireAuth, router]);

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Carregando...</p>
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
    default:
      router.push("/dashboard");
  }
}
