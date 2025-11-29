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
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  confirmPayment,
  getTenantOnboarding,
} from "@/lib/services/tenantOnboardingService";
import { PLANS } from "@/lib/constants/plans";
import { Timestamp } from "firebase/firestore";

export default function PaymentPage() {
  const { claims } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
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

      // Se não completou setup, volta para setup
      if (!onboarding?.setup_completed) {
        router.push("/clinic/setup");
        return;
      }

      // Se não selecionou plano, volta para seleção
      if (!onboarding?.plan_selected || !onboarding.selected_plan_id) {
        router.push("/clinic/setup/plan");
        return;
      }

      // Se já confirmou pagamento, vai para success
      if (onboarding?.payment_confirmed) {
        router.push("/clinic/setup/success");
        return;
      }

      setPlanId(onboarding.selected_plan_id);
    } catch (error) {
      console.error("Erro ao verificar status:", error);
      setError("Erro ao carregar informações");
    } finally {
      setLoading(false);
    }
  }

  async function handleMockPayment() {
    if (!tenantId || !planId) {
      setError("Erro: Dados incompletos");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      // Simula processamento de pagamento (2 segundos)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock: Confirma pagamento automaticamente
      const result = await confirmPayment(tenantId, {
        provider: "mock",
        payment_status: "approved",
        transaction_id: `MOCK-${Date.now()}`,
        payment_date: Timestamp.now(),
        card_last_digits: "1234",
        card_brand: "Visa",
      });

      if (result.success) {
        // Redireciona para página de sucesso
        router.push("/clinic/setup/success");
      } else {
        setError(result.error || "Erro ao processar pagamento");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao processar pagamento");
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!planId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar informações do plano. Por favor, tente novamente.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const plan = PLANS[planId];
  const totalMonths = planId === "anual" ? 12 : 6;
  const totalAmount = plan.price * totalMonths;

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
        <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-full">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Pagamento</h1>
          <p className="text-muted-foreground">
            Confirme seu plano e finalize a assinatura
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Resumo do Plano */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Resumo do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{plan.name}</p>
                <p className="text-sm text-muted-foreground">
                  {plan.description}
                </p>
              </div>
              <Badge>{planId === "anual" ? "12 meses" : "6 meses"}</Badge>
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  R$ {plan.price.toFixed(2)} x {totalMonths} meses
                </span>
                <span>R$ {totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>R$ {totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Cobrança recorrente:</strong> Após o período inicial, a
                cobrança será renovada automaticamente a cada{" "}
                {planId === "anual" ? "12" : "6"} meses no valor de R${" "}
                {totalAmount.toFixed(2)}.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Mock Payment Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Forma de Pagamento</CardTitle>
            <CardDescription>
              Modo demonstração - Pagamento automático
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Modo MVP:</strong> Esta é uma demonstração. O pagamento
                será processado automaticamente. A integração com PagSeguro para
                pagamentos reais será implementada em breve.
              </AlertDescription>
            </Alert>

            <div className="mt-4 p-4 border rounded-lg bg-white">
              <div className="flex items-center gap-3 mb-3">
                <CreditCard className="w-5 h-5 text-gray-600" />
                <div>
                  <p className="font-medium">Cartão de Crédito (Mock)</p>
                  <p className="text-sm text-muted-foreground">
                    Visa •••• 1234
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Renovação automática habilitada</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>Pagamento seguro</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botão de Confirmação */}
        <div className="space-y-4">
          <Button
            size="lg"
            className="w-full"
            onClick={handleMockPayment}
            disabled={processing}
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando Pagamento...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirmar e Ativar Assinatura
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Ao confirmar, você concorda com os{" "}
            <a href="#" className="text-primary hover:underline">
              Termos de Uso
            </a>{" "}
            e{" "}
            <a href="#" className="text-primary hover:underline">
              Política de Privacidade
            </a>
            .
          </p>
        </div>

        {/* Garantia */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            🔒 Pagamento 100% seguro | ✓ Garantia de 7 dias | ✓ Cancele quando
            quiser
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
