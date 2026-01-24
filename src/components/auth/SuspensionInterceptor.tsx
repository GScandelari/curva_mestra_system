/**
 * Componente: Suspension Interceptor
 * Verifica se a clínica está suspensa e bloqueia acesso
 * Comportamento diferenciado por role:
 * - clinic_admin: vê detalhes completos da suspensão
 * - clinic_user: vê mensagem genérica
 * - system_admin: nunca é bloqueado
 */

"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantSuspension } from "@/hooks/useTenantSuspension";

export function SuspensionInterceptor({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { customClaims } = useAuth();
  const { isSuspended, isLoading } = useTenantSuspension();

  useEffect(() => {
    // Não verificar durante loading
    if (isLoading) return;

    // System admin nunca é bloqueado
    if (customClaims?.is_system_admin) return;

    // Se não está nas páginas de suspensão e está suspenso
    if (
      isSuspended &&
      !pathname?.startsWith("/suspended") &&
      !pathname?.startsWith("/login")
    ) {
      // Redirecionar para página apropriada conforme role
      if (customClaims?.role === "clinic_admin") {
        router.push("/suspended/admin");
      } else if (customClaims?.role === "clinic_user") {
        router.push("/suspended/user");
      }
    }

    // Se está nas páginas de suspensão mas não está mais suspenso
    if (!isSuspended && pathname?.startsWith("/suspended")) {
      // Redirecionar de volta para o dashboard
      if (customClaims?.role === "clinic_admin") {
        router.push("/clinic");
      } else if (customClaims?.role === "clinic_user") {
        router.push("/clinic");
      }
    }
  }, [isSuspended, isLoading, pathname, customClaims, router]);

  // Mostrar loading enquanto verifica
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
