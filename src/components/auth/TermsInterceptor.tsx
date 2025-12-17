"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { usePendingTerms } from "@/hooks/usePendingTerms";
import { useAuth } from "@/hooks/useAuth";

// Rotas públicas que não precisam de verificação de termos
const PUBLIC_ROUTES = ["/login", "/register", "/accept-terms", "/clinic/setup/terms", "/"];

export function TermsInterceptor({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, claims, loading: authLoading } = useAuth();
  const { loading: termsLoading, hasPendingTerms } = usePendingTerms();

  useEffect(() => {
    console.log("[TermsInterceptor] Estado:", {
      pathname,
      authLoading,
      termsLoading,
      hasUser: !!user,
      role: claims?.role,
      hasPendingTerms,
    });

    // Aguardar autenticação e verificação de termos
    if (authLoading || termsLoading) {
      console.log("[TermsInterceptor] Aguardando carregamento...");
      return;
    }

    // Se não está logado, não fazer nada
    if (!user) {
      console.log("[TermsInterceptor] Usuário não autenticado");
      return;
    }

    // Se está em uma rota pública, não fazer nada
    if (PUBLIC_ROUTES.includes(pathname)) {
      console.log("[TermsInterceptor] Rota pública, ignorando");
      return;
    }

    // Se tem termos pendentes, redirecionar para a página de aceitação
    if (hasPendingTerms) {
      console.log("[TermsInterceptor] Termos pendentes! Redirecionando...");
      // Se é usuário de clínica e está em rota de setup, vai para /clinic/setup/terms
      if (claims?.role === "clinic_admin" || claims?.role === "clinic_user") {
        if (pathname.startsWith("/clinic/setup")) {
          console.log("[TermsInterceptor] → /clinic/setup/terms");
          router.push("/clinic/setup/terms");
        } else {
          // Usuário de clínica já fez onboarding, vai para página geral
          console.log("[TermsInterceptor] → /accept-terms");
          router.push("/accept-terms");
        }
      } else {
        // Outros tipos de usuário vão para página geral
        console.log("[TermsInterceptor] → /accept-terms");
        router.push("/accept-terms");
      }
    } else {
      console.log("[TermsInterceptor] Sem termos pendentes");
    }
  }, [user, claims, authLoading, termsLoading, hasPendingTerms, pathname, router]);

  // Não bloquear a renderização enquanto carrega
  return <>{children}</>;
}
