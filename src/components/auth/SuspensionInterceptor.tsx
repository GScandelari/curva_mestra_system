/**
 * Componente: Suspension Interceptor
 * Verifica se a clínica está suspensa ou inativa e controla acesso
 *
 * Comportamento para SUSPENSÃO (suspension.suspended = true):
 * - clinic_admin: vê detalhes completos da suspensão
 * - clinic_user: vê mensagem genérica
 * - system_admin: nunca é bloqueado
 *
 * Comportamento para INATIVIDADE (active = false):
 * - clinic_admin: acesso apenas a /clinic/my-clinic e /clinic/profile
 * - clinic_user: bloqueado no login (não chega aqui)
 * - system_admin: nunca é bloqueado
 */

"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useTenantSuspension } from "@/hooks/useTenantSuspension";

// Rotas permitidas para clinic_admin quando a clínica está inativa
const ALLOWED_ROUTES_INACTIVE_ADMIN = [
  "/clinic/my-clinic",
  "/clinic/profile",
];

export function SuspensionInterceptor({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { claims } = useAuth();
  const { isSuspended, isInactive, isLoading } = useTenantSuspension();

  useEffect(() => {
    // Não verificar durante loading
    if (isLoading) return;

    // System admin nunca é bloqueado
    if (claims?.is_system_admin) return;

    // ========== SUSPENSÃO (mais restritiva) ==========
    // Se não está nas páginas de suspensão e está suspenso
    if (
      isSuspended &&
      !pathname?.startsWith("/suspended") &&
      !pathname?.startsWith("/login")
    ) {
      // Redirecionar para página apropriada conforme role
      if (claims?.role === "clinic_admin") {
        router.push("/suspended/admin");
      } else if (claims?.role === "clinic_user") {
        router.push("/suspended/user");
      }
      return;
    }

    // Se está nas páginas de suspensão mas não está mais suspenso
    if (!isSuspended && pathname?.startsWith("/suspended")) {
      // Redirecionar de volta para o dashboard ou my-clinic se inativo
      if (isInactive && claims?.role === "clinic_admin") {
        router.push("/clinic/my-clinic");
      } else {
        router.push("/clinic");
      }
      return;
    }

    // ========== INATIVIDADE (menos restritiva) ==========
    // Se a clínica está inativa (mas não suspensa)
    if (isInactive && !isSuspended) {
      // clinic_user não deveria chegar aqui (bloqueado no login)
      // mas por segurança, redirecionar para login
      if (claims?.role === "clinic_user") {
        router.push("/login");
        return;
      }

      // clinic_admin: verificar se está em rota permitida
      if (claims?.role === "clinic_admin") {
        const isAllowedRoute = ALLOWED_ROUTES_INACTIVE_ADMIN.some(
          (route) => pathname?.startsWith(route)
        );

        if (!isAllowedRoute && !pathname?.startsWith("/login")) {
          // Redirecionar para my-clinic
          router.push("/clinic/my-clinic");
          return;
        }
      }
    }
  }, [isSuspended, isInactive, isLoading, pathname, claims, router]);

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
