"use client";

import { useState, useEffect } from "react";
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
import { CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import { getTenantOnboarding } from "@/lib/services/tenantOnboardingService";
import { PLANS } from "@/lib/constants/plans";

export default function SetupSuccessPage() {
  const { claims } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [planId, setPlanId] = useState<"semestral" | "anual" | null>(null);

  const tenantId = claims?.tenant_id;

  useEffect(() => {
    if (tenantId) {
      checkOnboardingStatus();
    }
  }, [tenantId]);

  async function checkOnboardingStatus() {
    if (!tenantId) return;

    try {
      setLoading(true);
      const onboarding = await getTenantOnboarding(tenantId);

      // Se não completou onboarding, redireciona para etapa pendente
      if (!onboarding || onboarding.status !== "completed") {
        if (!onboarding?.setup_completed) {
          router.push("/clinic/setup");
        } else if (!onboarding?.plan_selected) {
          router.push("/clinic/setup/plan");
        } else if (!onboarding?.payment_confirmed) {
          router.push("/clinic/setup/payment");
        }
        return;
      }

      setPlanId(onboarding.selected_plan_id || null);
    } catch (error) {
      console.error("Erro ao verificar status:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleGoToDashboard() {
    router.push("/clinic/dashboard");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </div>
      </div>
    );
  }

  const plan = planId ? PLANS[planId] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Curva Mestra</h1>
          <div className="text-sm text-muted-foreground">Configuração Concluída</div>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20" />
              <div className="relative p-3 bg-green-500 rounded-full">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
            </div>
          </div>
          <CardTitle className="text-3xl">
            Parabéns! Sua conta está ativa!
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Tudo pronto para você começar a usar a Curva Mestra
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Confirmação do Plano */}
          {plan && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Plano Ativado</h3>
              </div>
              <p className="text-lg font-medium mb-2">{plan.name}</p>
              <p className="text-sm text-muted-foreground">
                Sua assinatura está ativa e você tem acesso completo a todas as
                funcionalidades da plataforma.
              </p>
            </div>
          )}

          {/* Próximos Passos */}
          <div>
            <h3 className="font-semibold mb-4">Próximos Passos:</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-white border rounded-lg">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-sm font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium">Configure seu Estoque</p>
                  <p className="text-sm text-muted-foreground">
                    Adicione produtos ao seu catálogo e comece a gerenciar seu
                    inventário
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-white border rounded-lg">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-sm font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium">Cadastre Pacientes</p>
                  <p className="text-sm text-muted-foreground">
                    Registre seus pacientes para rastrear procedimentos e
                    consumo
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-white border rounded-lg">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-sm font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium">Convide Usuários</p>
                  <p className="text-sm text-muted-foreground">
                    Adicione membros da sua equipe para colaborar na plataforma
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-white border rounded-lg">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-sm font-bold flex-shrink-0">
                  4
                </div>
                <div>
                  <p className="font-medium">Configure Alertas</p>
                  <p className="text-sm text-muted-foreground">
                    Personalize notificações de estoque baixo e vencimento
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Botão para Dashboard */}
          <div className="pt-4">
            <Button
              size="lg"
              className="w-full"
              onClick={handleGoToDashboard}
            >
              Ir para o Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Informações Adicionais */}
          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              Precisa de ajuda para começar?
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="link" size="sm">
                Ver Tutorial
              </Button>
              <Button variant="link" size="sm">
                Falar com Suporte
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
