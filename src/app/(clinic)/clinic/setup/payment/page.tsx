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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import Script from "next/script";

// Declarar tipo global para PagSeguroDirectPayment
declare global {
  interface Window {
    PagSeguroDirectPayment: any;
  }
}

export default function PaymentPage() {
  const { claims, user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [planId, setPlanId] = useState<"semestral" | "anual" | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Dados do cartão
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");

  // Dados do titular
  const [holderCpf, setHolderCpf] = useState("");
  const [holderBirthDate, setHolderBirthDate] = useState("");
  const [holderPhone, setHolderPhone] = useState("");

  const tenantId = claims?.tenant_id;

  useEffect(() => {
    if (tenantId) {
      checkOnboardingStatus();
    }
  }, [tenantId]);

  useEffect(() => {
    if (scriptLoaded) {
      initPagSeguro();
    }
  }, [scriptLoaded]);

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

  async function initPagSeguro() {
    try {
      console.log("[PagSeguro] Inicializando...");

      // Obter session ID
      const response = await fetch("/api/pagseguro/session");
      const data = await response.json();

      if (!data.sessionId) {
        console.warn("[PagSeguro] Falha ao obter session ID - modo MOCK ativado");
        setSessionId("MOCK_SESSION");
        return;
      }

      setSessionId(data.sessionId);

      // Configurar session no PagSeguro
      if (window.PagSeguroDirectPayment) {
        window.PagSeguroDirectPayment.setSessionId(data.sessionId);
        console.log("[PagSeguro] Session configurada:", data.sessionId);
      } else {
        console.warn("[PagSeguro] SDK não disponível - modo MOCK");
      }
    } catch (error: any) {
      console.error("[PagSeguro] Erro ao inicializar:", error);
      console.warn("[PagSeguro] Continuando em modo MOCK");
      setSessionId("MOCK_SESSION");
    }
  }

  function formatCardNumber(value: string) {
    const cleaned = value.replace(/\D/g, "");
    const formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
    return formatted.substring(0, 19); // 16 dígitos + 3 espaços
  }

  function formatExpiry(value: string) {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length >= 2) {
      return `${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}`;
    }
    return cleaned;
  }

  function formatCpf(value: string) {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return value;
  }

  function formatPhone(value: string) {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{5})(\d)/, "$1-$2");
    }
    return value;
  }

  function formatDate(value: string) {
    const cleaned = value.replace(/\D/g, "");

    if (cleaned.length === 0) return "";

    let formatted = cleaned.substring(0, 2); // DD

    if (cleaned.length >= 3) {
      formatted += `/${cleaned.substring(2, 4)}`; // MM
    }

    if (cleaned.length >= 5) {
      formatted += `/${cleaned.substring(4, 8)}`; // AAAA
    }

    return formatted;
  }

  function detectCardBrand(bin: string): string {
    // Detectar bandeira pelo BIN (primeiros 6 dígitos)
    const binNum = parseInt(bin);

    if (bin.startsWith("4")) return "visa";
    if (binNum >= 510000 && binNum <= 559999) return "mastercard";
    if (bin.startsWith("34") || bin.startsWith("37")) return "amex";
    if (bin.startsWith("6011") || bin.startsWith("65")) return "discover";
    if (bin.startsWith("636")) return "elo";
    if (bin.startsWith("606282")) return "hipercard";

    return "visa"; // default
  }

  async function handlePayment() {
    if (!tenantId || !planId) {
      setError("Erro: Dados incompletos");
      return;
    }

    // Validações básicas
    if (!cardNumber || !cardHolder || !cardExpiry || !cardCvv) {
      setError("Preencha todos os dados do cartão");
      return;
    }

    if (!holderCpf || !holderBirthDate || !holderPhone) {
      setError("Preencha todos os dados do titular");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      let cardToken: string;

      // Verificar se SDK do PagSeguro está disponível
      if (window.PagSeguroDirectPayment && sessionId) {
        console.log("[PagSeguro] Obtendo token do cartão via SDK...");

        // Obter bandeira do cartão
        const cardBin = cardNumber.replace(/\D/g, "").substring(0, 6);

        const cardBrand = await new Promise<string>((resolve, reject) => {
          window.PagSeguroDirectPayment.getBrand({
            cardBin: cardBin,
            success: (response: any) => {
              console.log("[PagSeguro] Bandeira:", response.brand.name);
              resolve(response.brand.name);
            },
            error: (error: any) => {
              console.error("[PagSeguro] Erro ao obter bandeira:", error);
              // Fallback: detectar bandeira pelo BIN
              resolve(detectCardBrand(cardBin));
            },
          });
        });

        // Obter token do cartão
        const expiryParts = cardExpiry.split("/");
        cardToken = await new Promise<string>((resolve, reject) => {
          window.PagSeguroDirectPayment.createCardToken({
            cardNumber: cardNumber.replace(/\D/g, ""),
            brand: cardBrand,
            cvv: cardCvv,
            expirationMonth: expiryParts[0],
            expirationYear: `20${expiryParts[1]}`,
            success: (response: any) => {
              console.log("[PagSeguro] Token criado:", response.card.token);
              resolve(response.card.token);
            },
            error: (error: any) => {
              console.error("[PagSeguro] Erro ao criar token:", error);
              reject(new Error(error.message || "Erro ao processar cartão"));
            },
          });
        });
      } else {
        // Modo MOCK para desenvolvimento
        console.warn("[PagSeguro] SDK não disponível - usando modo MOCK");
        cardToken = `MOCK_TOKEN_${Date.now()}`;
      }

      console.log("[Cloud Function] Criando assinatura...");

      // Chamar Cloud Function diretamente
      const createSubscription = httpsCallable(functions, "createPagBankSubscription");

      const result = await createSubscription({
        tenant_id: tenantId,
        plan_id: planId,
        card_token: cardToken,
        holder_name: cardHolder,
        holder_birth_date: holderBirthDate,
        holder_cpf: holderCpf,
        holder_phone: holderPhone,
      });

      console.log("[Cloud Function] Resultado:", result.data);

      // A resposta da Cloud Function vem em result.data
      const responseData = result.data as any;

      if (responseData.subscription_code) {
        // Atualizar onboarding
        await confirmPayment(tenantId, {
          provider: "pagseguro",
          payment_status: "approved",
          transaction_id: responseData.subscription_code,
          payment_date: Timestamp.now(),
        });

        router.push("/clinic/setup/success");
      } else {
        setError(responseData.error || "Pagamento recusado. Verifique os dados e tente novamente.");
      }
    } catch (err: any) {
      console.error("[Pagamento] Erro:", err);
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
  const commitmentMonths = planId === "anual" ? 12 : 6;
  const monthlyAmount = plan.price;

  return (
    <>
      {/* PagSeguro SDK - Sandbox */}
      <Script
        src="https://stc.sandbox.pagseguro.uol.com.br/pagseguro/api/v2/checkout/pagseguro.directpayment.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log("[PagSeguro] Script carregado");
          setScriptLoaded(true);
        }}
        onError={(e) => {
          console.error("[PagSeguro] Erro ao carregar script:", e);
          // Tentar URL alternativa ou modo fallback
          console.log("[PagSeguro] Tentando fallback...");
          // Por enquanto, vamos permitir continuar sem o SDK (modo mock)
          setScriptLoaded(true);
          console.warn("[PagSeguro] Modo MOCK ativado - para desenvolvimento");
        }}
      />

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
                <CardTitle>Resumo da Assinatura</CardTitle>
                <CardDescription>
                  Pagamento mensal com compromisso de {commitmentMonths} meses
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{plan.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {commitmentMonths} meses de compromisso
                  </Badge>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Valor Mensal</p>
                      <p className="text-sm text-muted-foreground">
                        Cobrança recorrente
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        R$ {monthlyAmount.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">/mês</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Como funciona o pagamento
                  </p>
                  <ul className="text-sm text-amber-900 space-y-1 ml-6 list-disc">
                    <li>
                      <strong>Pagamento mensal:</strong> R$ {monthlyAmount.toFixed(2)} cobrado todo mês automaticamente
                    </li>
                    <li>
                      <strong>Período de compromisso:</strong> {commitmentMonths} meses mínimos
                    </li>
                    <li>
                      <strong>Renovação automática:</strong> Após {commitmentMonths} meses, continua mensalmente
                    </li>
                    <li>
                      <strong>Cancelamento:</strong> Pode cancelar após o período de compromisso sem multa
                    </li>
                  </ul>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-900 text-center">
                    <strong>Primeira cobrança:</strong> R$ {monthlyAmount.toFixed(2)} hoje
                    <br />
                    <span className="text-xs">
                      Próximas cobranças: todo dia {new Date().getDate()} de cada mês
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Formulário de Cartão */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Dados do Cartão</CardTitle>
                <CardDescription>
                  Pagamento seguro via PagSeguro (Sandbox)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Número do Cartão</Label>
                  <Input
                    id="cardNumber"
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardHolder">Nome do Titular</Label>
                  <Input
                    id="cardHolder"
                    placeholder="Como impresso no cartão"
                    value={cardHolder}
                    onChange={(e) =>
                      setCardHolder(e.target.value.toUpperCase())
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardExpiry">Validade</Label>
                    <Input
                      id="cardExpiry"
                      placeholder="MM/AA"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                      maxLength={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cardCvv">CVV</Label>
                    <Input
                      id="cardCvv"
                      placeholder="000"
                      type="password"
                      value={cardCvv}
                      onChange={(e) =>
                        setCardCvv(e.target.value.replace(/\D/g, ""))
                      }
                      maxLength={4}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dados do Titular */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Dados do Titular</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="holderCpf">CPF</Label>
                  <Input
                    id="holderCpf"
                    placeholder="000.000.000-00"
                    value={holderCpf}
                    onChange={(e) => setHolderCpf(formatCpf(e.target.value))}
                    maxLength={14}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="holderBirthDate">Data de Nascimento</Label>
                  <Input
                    id="holderBirthDate"
                    type="text"
                    placeholder="DD/MM/AAAA"
                    value={holderBirthDate}
                    onChange={(e) =>
                      setHolderBirthDate(formatDate(e.target.value))
                    }
                    maxLength={10}
                    inputMode="numeric"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="holderPhone">Telefone</Label>
                  <Input
                    id="holderPhone"
                    placeholder="(00) 00000-0000"
                    value={holderPhone}
                    onChange={(e) => setHolderPhone(formatPhone(e.target.value))}
                    maxLength={15}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Botão de Confirmação */}
            <div className="space-y-4">
              <Button
                size="lg"
                className="w-full"
                onClick={handlePayment}
                disabled={processing || !scriptLoaded}
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processando Pagamento...
                  </>
                ) : !scriptLoaded ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Carregando sistema de pagamento...
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
                🔒 Pagamento 100% seguro via PagSeguro | ✓ Ambiente Sandbox (Teste)
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
