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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CreditCard, Sparkles } from "lucide-react";
import {
  completePlanSelection,
  getTenantOnboarding,
} from "@/lib/services/tenantOnboardingService";
import { PLANS } from "@/lib/constants/plans";

export default function PlanSelectionPage() {
  const { claims } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<"semestral" | "anual" | null>(
    null
  );

  const tenantId = claims?.tenant_id;

  useEffect(() => {
    if (tenantId) {
      checkOnboardingStatus();
    }
  }, [tenantId]);

  async function checkOnboardingStatus() {
    if (!tenantId) return;

    try {
      const onboarding = await getTenantOnboarding(tenantId);

      // Se não completou setup, volta para setup
      if (!onboarding?.setup_completed) {
        router.push("/clinic/setup");
        return;
      }

      // Se já selecionou plano, vai para pagamento
      if (onboarding?.plan_selected) {
        router.push("/clinic/setup/payment");
      }
    } catch (error) {
      console.error("Erro ao verificar status:", error);
    }
  }

  async function handleSelectPlan(planId: "semestral" | "anual") {
    if (!tenantId) {
      setError("Erro: Tenant não identificado");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await completePlanSelection(tenantId, {
        plan_id: planId,
        payment_method: "credit_card", // Default para MVP
      });

      if (result.success) {
        // Redireciona para pagamento
        router.push("/clinic/setup/payment");
      } else {
        setError(result.error || "Erro ao selecionar plano");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao processar solicitação");
    } finally {
      setLoading(false);
    }
  }

  const semestralPlan = PLANS.semestral;
  const anualPlan = PLANS.anual;

  // Calcula economia do plano anual
  const semestralTotal = semestralPlan.price * 6;
  const anualTotal = anualPlan.price * 12;
  const savingsPercent = Math.round(
    ((semestralTotal * 2 - anualTotal) / (semestralTotal * 2)) * 100
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Curva Mestra</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/login")}
          >
            Sair
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="w-full max-w-5xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-full">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Escolha seu Plano</h1>
          <p className="text-muted-foreground">
            Selecione o melhor plano para sua clínica
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Plano Semestral */}
          <Card
            className={`relative cursor-pointer transition-all hover:shadow-lg ${
              selectedPlan === "semestral"
                ? "ring-2 ring-primary shadow-lg"
                : ""
            }`}
            onClick={() => setSelectedPlan("semestral")}
          >
            {selectedPlan === "semestral" && (
              <div className="absolute -top-3 -right-3">
                <div className="bg-primary text-white rounded-full p-2">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            )}

            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {semestralPlan.name}
                <Badge variant="outline">Popular</Badge>
              </CardTitle>
              <CardDescription>{semestralPlan.description}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">
                    R$ {semestralPlan.price.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Cobrado a cada 6 meses: R$ {semestralTotal.toFixed(2)}
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-sm">Inclui:</p>
                <ul className="space-y-2">
                  {semestralPlan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                className="w-full"
                variant={selectedPlan === "semestral" ? "default" : "outline"}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlan("semestral");
                }}
                disabled={loading}
              >
                {selectedPlan === "semestral" ? "Selecionado" : "Selecionar Plano"}
              </Button>
            </CardContent>
          </Card>

          {/* Plano Anual */}
          <Card
            className={`relative cursor-pointer transition-all hover:shadow-lg ${
              selectedPlan === "anual" ? "ring-2 ring-primary shadow-lg" : ""
            }`}
            onClick={() => setSelectedPlan("anual")}
          >
            {selectedPlan === "anual" && (
              <div className="absolute -top-3 -right-3">
                <div className="bg-primary text-white rounded-full p-2">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            )}

            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0">
                <Sparkles className="w-3 h-3 mr-1" />
                Economize {savingsPercent}%
              </Badge>
            </div>

            <CardHeader className="pt-8">
              <CardTitle className="flex items-center justify-between">
                {anualPlan.name}
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                  Melhor Valor
                </Badge>
              </CardTitle>
              <CardDescription>{anualPlan.description}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">
                    R$ {anualPlan.price.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Cobrado anualmente: R$ {anualTotal.toFixed(2)}
                </p>
                <p className="text-sm text-green-600 font-medium mt-1">
                  Você economiza R${" "}
                  {(semestralTotal * 2 - anualTotal).toFixed(2)} por ano!
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-sm">Inclui:</p>
                <ul className="space-y-2">
                  {anualPlan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                className="w-full"
                variant={selectedPlan === "anual" ? "default" : "outline"}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlan("anual");
                }}
                disabled={loading}
              >
                {selectedPlan === "anual" ? "Selecionado" : "Selecionar Plano"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Botão de Continuar */}
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={() => selectedPlan && handleSelectPlan(selectedPlan)}
            disabled={!selectedPlan || loading}
            className="min-w-[200px]"
          >
            {loading ? "Processando..." : "Continuar para Pagamento"}
          </Button>
        </div>

        {/* Garantia */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            ✓ Garantia de 7 dias | ✓ Cancele quando quiser | ✓ Suporte dedicado
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
