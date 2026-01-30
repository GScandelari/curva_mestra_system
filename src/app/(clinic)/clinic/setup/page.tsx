"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building2, CheckCircle2 } from "lucide-react";
import {
  completeClinicSetup,
  getTenantOnboarding,
} from "@/lib/services/tenantOnboardingService";
import { getTenant } from "@/lib/services/tenantServiceDirect";
import { ClinicSetupData } from "@/types/onboarding";
import { validateCNPJ } from "@/types/tenant";
import { InfoIcon } from "lucide-react";

export default function ClinicSetupPage() {
  const { user, claims, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [dataPreFilled, setDataPreFilled] = useState(false);

  const [formData, setFormData] = useState<ClinicSetupData>({
    name: "",
    document_type: "cnpj",
    document_number: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    cep: "",
  });

  const tenantId = claims?.tenant_id;

  useEffect(() => {
    // Verifica se já completou setup e carrega dados existentes
    if (tenantId) {
      loadExistingData();
    }
  }, [tenantId]);

  async function loadExistingData() {
    if (!tenantId) return;

    try {
      setLoadingData(true);

      // Verifica se já completou setup
      const onboarding = await getTenantOnboarding(tenantId);
      if (onboarding?.setup_completed) {
        router.push("/clinic/setup/plan");
        return;
      }

      // Carrega dados existentes do tenant (inseridos pelo system_admin)
      const { tenant } = await getTenant(tenantId);

      if (tenant) {
        // Extrai cidade, estado e CEP do endereço se não estiverem separados
        let city = tenant.city || "";
        let state = tenant.state || "";
        let cep = tenant.cep || "";

        // Se não há campos separados, tenta extrair do address
        if (!city && !state && !cep && tenant.address) {
          const addressParts = tenant.address.split(",");
          if (addressParts.length >= 2) {
            // Formato: "Rua X, Cidade - UF, CEP"
            const lastPart = addressParts[addressParts.length - 1].trim();
            const secondLastPart = addressParts[addressParts.length - 2].trim();

            // Extrai CEP
            const cepMatch = lastPart.match(/\d{5}-?\d{3}/);
            if (cepMatch) {
              cep = cepMatch[0];
            }

            // Extrai cidade e estado
            const cityStateMatch = secondLastPart.match(/(.+)\s*-\s*([A-Z]{2})/);
            if (cityStateMatch) {
              city = cityStateMatch[1].trim();
              state = cityStateMatch[2].trim();
            }
          }
        }

        // Pre-preenche formulário
        setFormData({
          name: tenant.name || "",
          document_type: tenant.document_type || "cnpj",
          document_number: tenant.document_number || tenant.cnpj || "",
          email: tenant.email || "",
          phone: tenant.phone || "",
          address: tenant.address?.split(",")[0] || "", // Pega apenas rua/número
          city: city,
          state: state,
          cep: cep,
        });

        setDataPreFilled(true);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoadingData(false);
    }
  }

  function handleInputChange(field: keyof ClinicSetupData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  }

  function formatCNPJ(value: string): string {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 14) {
      return cleaned.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        "$1.$2.$3/$4-$5"
      );
    }
    return value;
  }

  function formatCPF(value: string): string {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 11) {
      return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    }
    return value;
  }

  function formatPhone(value: string): string {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    } else if (cleaned.length === 10) {
      return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
    }
    return value;
  }

  function formatCEP(value: string): string {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 8) {
      return cleaned.replace(/^(\d{5})(\d{3})$/, "$1-$2");
    }
    return value;
  }

  function validateStep1(): boolean {
    if (!formData.name.trim()) {
      setError("Nome da clínica é obrigatório");
      return false;
    }

    const docNumber = formData.document_number.replace(/\D/g, "");

    if (formData.document_type === "cnpj") {
      if (docNumber.length !== 14) {
        setError("CNPJ deve ter 14 dígitos");
        return false;
      }
      if (!validateCNPJ(docNumber)) {
        setError("CNPJ inválido");
        return false;
      }
    } else {
      if (docNumber.length !== 11) {
        setError("CPF deve ter 11 dígitos");
        return false;
      }
    }

    if (!formData.email.trim() || !formData.email.includes("@")) {
      setError("Email válido é obrigatório");
      return false;
    }

    const phone = formData.phone.replace(/\D/g, "");
    if (phone.length < 10) {
      setError("Telefone deve ter pelo menos 10 dígitos");
      return false;
    }

    return true;
  }

  function validateStep2(): boolean {
    if (!formData.address.trim()) {
      setError("Endereço é obrigatório");
      return false;
    }

    if (!formData.city.trim()) {
      setError("Cidade é obrigatória");
      return false;
    }

    if (!formData.state.trim()) {
      setError("Estado é obrigatório");
      return false;
    }

    const cep = formData.cep.replace(/\D/g, "");
    if (cep.length !== 8) {
      setError("CEP deve ter 8 dígitos");
      return false;
    }

    return true;
  }

  function handleNextStep() {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  }

  function handlePrevStep() {
    setStep(1);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateStep2()) return;
    if (!tenantId) {
      setError("Erro: Tenant não identificado");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await completeClinicSetup(tenantId, formData);

      if (result.success) {
        // Redireciona para seleção de plano
        router.push("/clinic/setup/plan");
      } else {
        setError(result.error || "Erro ao salvar configurações");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao processar solicitação");
    } finally {
      setLoading(false);
    }
  }

  const BRAZILIAN_STATES = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  // Mostra loading enquanto carrega dados
  if (loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-7xl mx-auto mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-primary">Curva Mestra</h1>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-2xl p-8">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">Carregando dados...</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Curva Mestra</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              router.push("/login");
            }}
          >
            Sair
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-full">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {dataPreFilled ? "Revisão de Dados da Clínica" : "Configuração Inicial"}
          </CardTitle>
          <CardDescription>
            {dataPreFilled
              ? "Revise e confirme os dados cadastrados pelo administrador do sistema"
              : "Complete os dados da sua clínica para ativar sua conta"}
          </CardDescription>

          {dataPreFilled && (
            <Alert className="mt-4 text-left">
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                Os dados abaixo foram pré-cadastrados pelo administrador. Você pode revisar e editar qualquer informação antes de confirmar.
              </AlertDescription>
            </Alert>
          )}

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= 1
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {step > 1 ? <CheckCircle2 className="w-5 h-5" /> : "1"}
              </div>
              <span className="text-sm font-medium">Dados Básicos</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300" />
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= 2
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                2
              </div>
              <span className="text-sm font-medium">Endereço</span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Step 1: Dados Básicos */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome da Clínica *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Ex: Clínica Beleza e Estética"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="document_type">Tipo de Documento *</Label>
                  <Select
                    value={formData.document_type}
                    onValueChange={(value: "cnpj" | "cpf") =>
                      handleInputChange("document_type", value)
                    }
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cnpj">CNPJ (até 5 usuários)</SelectItem>
                      <SelectItem value="cpf">CPF (apenas 1 usuário)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="document_number">
                    {formData.document_type === "cnpj" ? "CNPJ *" : "CPF *"}
                  </Label>
                  <Input
                    id="document_number"
                    value={
                      formData.document_type === "cnpj"
                        ? formatCNPJ(formData.document_number)
                        : formatCPF(formData.document_number)
                    }
                    onChange={(e) =>
                      handleInputChange("document_number", e.target.value)
                    }
                    placeholder={
                      formData.document_type === "cnpj"
                        ? "00.000.000/0000-00"
                        : "000.000.000-00"
                    }
                    maxLength={formData.document_type === "cnpj" ? 18 : 14}
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email da Clínica *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="contato@clinica.com.br"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    value={formatPhone(formData.phone)}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    disabled={loading}
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full"
                  disabled={loading}
                >
                  Próximo
                </Button>
              </div>
            )}

            {/* Step 2: Endereço */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="cep">CEP *</Label>
                  <Input
                    id="cep"
                    value={formatCEP(formData.cep)}
                    onChange={(e) => handleInputChange("cep", e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="address">Endereço *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                    placeholder="Rua, número, complemento"
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">Cidade *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange("city", e.target.value)}
                      placeholder="São Paulo"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="state">Estado *</Label>
                    <Select
                      value={formData.state}
                      onValueChange={(value) => handleInputChange("state", value)}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAZILIAN_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevStep}
                    className="flex-1"
                    disabled={loading}
                  >
                    Voltar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? "Salvando..." : dataPreFilled ? "Confirmar e Continuar" : "Continuar"}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
