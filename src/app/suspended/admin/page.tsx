/**
 * Página: Clínica Suspensa (Administrador)
 * Exibe detalhes completos da suspensão para clinic_admin
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantSuspension } from "@/hooks/useTenantSuspension";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Mail, Clock, AlertTriangle } from "lucide-react";
import type { SuspensionReason } from "@/types";

// Mapa de motivos para textos legíveis
const REASON_LABELS: Record<SuspensionReason, { title: string; description: string }> = {
  payment_failure: {
    title: "Falha no Pagamento",
    description: "Identificamos pendências no pagamento da assinatura.",
  },
  contract_breach: {
    title: "Quebra de Contrato",
    description: "Foram identificadas violações aos termos contratuais acordados.",
  },
  terms_violation: {
    title: "Violação dos Termos de Uso",
    description: "O uso da plataforma violou nossos Termos de Uso.",
  },
  fraud_detected: {
    title: "Fraude Detectada",
    description: "Atividades suspeitas ou fraudulentas foram identificadas.",
  },
  other: {
    title: "Outro Motivo",
    description: "A conta foi suspensa por motivos administrativos.",
  },
};

export default function SuspendedAdminPage() {
  const router = useRouter();
  const { user, customClaims, signOut } = useAuth();
  const { isSuspended, suspensionInfo, isLoading } = useTenantSuspension();
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    // Se não está suspenso, redirecionar
    if (!isLoading && !isSuspended) {
      router.push("/clinic");
    }

    // Se não é clinic_admin, redirecionar para página de user
    if (!isLoading && customClaims?.role !== "clinic_admin") {
      router.push("/suspended/user");
    }
  }, [isSuspended, isLoading, customClaims, router]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    router.push("/login");
  };

  if (isLoading || !isSuspended || !suspensionInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const reasonInfo = REASON_LABELS[suspensionInfo.reason];
  const suspendedDate = suspensionInfo.suspended_at
    ? new Date(suspensionInfo.suspended_at.toDate()).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Data não disponível";

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-background to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl">
        <CardHeader className="text-center border-b bg-destructive/5">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-3xl font-bold text-destructive">
            Acesso Temporariamente Bloqueado
          </CardTitle>
          <CardDescription className="text-lg">
            Sua clínica foi suspensa e o acesso à plataforma está bloqueado
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Motivo da Suspensão */}
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-1">
                  {reasonInfo.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {reasonInfo.description}
                </p>
              </div>
            </div>
          </div>

          {/* Detalhes Adicionais */}
          {suspensionInfo.details && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Informações Adicionais
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {suspensionInfo.details}
              </p>
            </div>
          )}

          {/* Data da Suspensão */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Data da Suspensão
            </h3>
            <p className="text-sm text-muted-foreground">{suspendedDate}</p>
          </div>

          {/* Contato */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Precisa de Ajuda?
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Para resolver esta situação, entre em contato com nosso suporte:
            </p>
            <a
              href={`mailto:${suspensionInfo.contact_email}?subject=Suspensão da Clínica - ${user?.email}`}
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              <Mail className="h-4 w-4" />
              {suspensionInfo.contact_email}
            </a>
          </div>

          {/* Instruções */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <h3 className="font-semibold mb-2">O que fazer agora?</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Entre em contato com nosso suporte através do e-mail acima</li>
              <li>Forneça as informações solicitadas pela equipe</li>
              <li>Aguarde a análise e regularização da situação</li>
              <li>Após a reativação, você poderá acessar a plataforma normalmente</li>
            </ol>
          </div>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="flex-1"
            >
              {isSigningOut ? "Saindo..." : "Sair da Conta"}
            </Button>
            <Button
              onClick={() =>
                window.open(
                  `mailto:${suspensionInfo.contact_email}?subject=Suspensão da Clínica - ${user?.email}`,
                  "_blank"
                )
              }
              className="flex-1"
            >
              <Mail className="h-4 w-4 mr-2" />
              Entrar em Contato
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
