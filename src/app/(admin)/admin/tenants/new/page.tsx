"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, User, Mail, ArrowRight, Send, Eye } from "lucide-react";
import { createTenant } from "@/lib/services/tenantServiceDirect";
import { validateDocument, maskDocument } from "@/lib/utils/documentValidation";
import { DocumentType } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Step = 1 | 2 | 3;

interface ClinicData {
  name: string;
  documentType: DocumentType;
  document: string;
  email: string;
  phone: string;
  cep: string;
  address: string;
  city: string;
  state: string;
  planId: "semestral" | "anual";
}

interface AdminData {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export default function NewTenantPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Dados da Clínica (Step 1)
  const [clinicData, setClinicData] = useState<ClinicData>({
    name: "",
    documentType: "cnpj",
    document: "",
    email: "",
    phone: "",
    cep: "",
    address: "",
    city: "",
    state: "",
    planId: "semestral",
  });

  // Dados do Administrador (Step 2)
  const [adminData, setAdminData] = useState<AdminData>({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  // E-mail de Boas-Vindas (Step 3)
  const [emailSubject, setEmailSubject] = useState("Bem-vindo à Curva Mestra!");
  const [emailBody, setEmailBody] = useState(
`Olá, {{admin_name}}!

Seja bem-vindo(a) à Curva Mestra! 🎉

Sua clínica {{clinic_name}} foi cadastrada com sucesso em nossa plataforma.

**Dados de Acesso:**
- E-mail: {{admin_email}}
- Senha temporária: {{temp_password}}

**Importante:** Por favor, altere sua senha no primeiro acesso através do menu Perfil.

**Próximos Passos:**
1. Acesse o sistema em: https://curva-mestra.web.app
2. Faça login com suas credenciais
3. Altere sua senha temporária
4. Configure os dados da sua clínica
5. Adicione produtos ao seu estoque

Se tiver qualquer dúvida, estamos à disposição!

Atenciosamente,
Equipe Curva Mestra`
  );

  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatPhoneInput = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    if (numbers.length <= 10) {
      return numbers
        .replace(/^(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return numbers
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  };

  const validateStep1 = () => {
    if (!clinicData.name.trim()) {
      setError("Nome da clínica é obrigatório");
      return false;
    }
    if (!validateDocument(clinicData.document)) {
      setError(`${clinicData.documentType === "cpf" ? "CPF" : "CNPJ"} inválido`);
      return false;
    }
    if (!clinicData.email.trim() || !clinicData.email.includes("@")) {
      setError("E-mail válido é obrigatório");
      return false;
    }
    setError("");
    return true;
  };

  const validateStep2 = () => {
    if (!adminData.name.trim()) {
      setError("Nome do administrador é obrigatório");
      return false;
    }
    if (!adminData.email.trim() || !adminData.email.includes("@")) {
      setError("E-mail válido do administrador é obrigatório");
      return false;
    }
    if (!adminData.password || adminData.password.length < 6) {
      setError("Senha deve ter no mínimo 6 caracteres");
      return false;
    }
    setError("");
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    setCurrentStep((prev) => Math.min(3, prev + 1) as Step);
  };

  const getPreviewEmail = () => {
    return emailBody
      .replace(/{{admin_name}}/g, adminData.name || "[Nome do Administrador]")
      .replace(/{{clinic_name}}/g, clinicData.name || "[Nome da Clínica]")
      .replace(/{{admin_email}}/g, adminData.email || "[E-mail do Administrador]")
      .replace(/{{temp_password}}/g, adminData.password || "[Senha Temporária]");
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    const documentNumbers = clinicData.document.replace(/\D/g, "");
    const maxUsers = clinicData.documentType === "cpf" ? 1 : 5;

    try {
      await createTenant({
        // Dados da clínica
        name: clinicData.name.trim(),
        document_type: clinicData.documentType,
        document_number: documentNumbers,
        cnpj: documentNumbers,
        max_users: maxUsers,
        email: clinicData.email.trim(),
        phone: clinicData.phone.trim(),
        address: clinicData.address.trim(),
        city: clinicData.city.trim(),
        state: clinicData.state.trim(),
        cep: clinicData.cep.replace(/\D/g, ""),
        plan_id: clinicData.planId,

        // Dados do administrador
        admin_name: adminData.name.trim(),
        admin_email: adminData.email.trim(),
        admin_phone: adminData.phone.trim(),
        temp_password: adminData.password,

        // Dados do e-mail
        welcome_email: {
          subject: emailSubject,
          body: getPreviewEmail(),
          send: true,
        },
      });

      router.push("/admin/tenants");
    } catch (err: any) {
      setError(err.message || "Erro ao criar clínica");
      console.error("Erro ao criar tenant:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            Nova Clínica
          </h1>
          <p className="text-muted-foreground">
            Processo completo de cadastro de nova clínica
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {/* Step 1 */}
          <div className="flex flex-col items-center flex-1">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep >= 1
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-muted-foreground text-muted-foreground"
              }`}
            >
              1
            </div>
            <span className="text-xs mt-2 text-center">Dados da Clínica</span>
          </div>
          <div className={`flex-1 h-[2px] ${currentStep >= 2 ? "bg-primary" : "bg-muted"}`} />

          {/* Step 2 */}
          <div className="flex flex-col items-center flex-1">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep >= 2
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-muted-foreground text-muted-foreground"
              }`}
            >
              2
            </div>
            <span className="text-xs mt-2 text-center">Administrador</span>
          </div>
          <div className={`flex-1 h-[2px] ${currentStep >= 3 ? "bg-primary" : "bg-muted"}`} />

          {/* Step 3 */}
          <div className="flex flex-col items-center flex-1">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                currentStep >= 3
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-muted-foreground text-muted-foreground"
              }`}
            >
              3
            </div>
            <span className="text-xs mt-2 text-center">E-mail Boas-Vindas</span>
          </div>
        </div>

        {/* Step 1: Dados da Clínica */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Informações da Clínica
              </CardTitle>
              <CardDescription>
                Preencha os dados da clínica que está sendo cadastrada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clinicName">
                  Nome da Clínica <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="clinicName"
                  value={clinicData.name}
                  onChange={(e) =>
                    setClinicData({ ...clinicData, name: e.target.value })
                  }
                  placeholder="Ex: Clínica Beleza & Harmonia"
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Tipo de Conta <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="cnpj"
                      checked={clinicData.documentType === "cnpj"}
                      onChange={(e) =>
                        setClinicData({
                          ...clinicData,
                          documentType: e.target.value as DocumentType,
                          document: "",
                        })
                      }
                      className="h-4 w-4"
                    />
                    <span className="text-sm">CNPJ (até 5 usuários)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="cpf"
                      checked={clinicData.documentType === "cpf"}
                      onChange={(e) =>
                        setClinicData({
                          ...clinicData,
                          documentType: e.target.value as DocumentType,
                          document: "",
                        })
                      }
                      className="h-4 w-4"
                    />
                    <span className="text-sm">CPF (1 usuário)</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    {clinicData.documentType === "cpf" ? "CPF" : "CNPJ"}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={clinicData.document}
                    onChange={(e) =>
                      setClinicData({
                        ...clinicData,
                        document: maskDocument(e.target.value, clinicData.documentType),
                      })
                    }
                    placeholder={
                      clinicData.documentType === "cpf"
                        ? "000.000.000-00"
                        : "00.000.000/0000-00"
                    }
                    maxLength={18}
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    E-mail da Clínica <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={clinicData.email}
                    onChange={(e) =>
                      setClinicData({ ...clinicData, email: e.target.value })
                    }
                    placeholder="contato@clinica.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={clinicData.phone}
                    onChange={(e) =>
                      setClinicData({
                        ...clinicData,
                        phone: formatPhoneInput(e.target.value),
                      })
                    }
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>

                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    value={clinicData.cep}
                    onChange={(e) => {
                      const formatted = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 8);
                      setClinicData({
                        ...clinicData,
                        cep: formatted.replace(/^(\d{5})(\d)/, "$1-$2"),
                      });
                    }}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={clinicData.address}
                  onChange={(e) =>
                    setClinicData({ ...clinicData, address: e.target.value })
                  }
                  placeholder="Rua, número, complemento"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={clinicData.city}
                    onChange={(e) =>
                      setClinicData({ ...clinicData, city: e.target.value })
                    }
                    placeholder="São Paulo"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Estado</Label>
                  <select
                    value={clinicData.state}
                    onChange={(e) =>
                      setClinicData({ ...clinicData, state: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Selecione</option>
                    <option value="AC">AC</option>
                    <option value="AL">AL</option>
                    <option value="AP">AP</option>
                    <option value="AM">AM</option>
                    <option value="BA">BA</option>
                    <option value="CE">CE</option>
                    <option value="DF">DF</option>
                    <option value="ES">ES</option>
                    <option value="GO">GO</option>
                    <option value="MA">MA</option>
                    <option value="MT">MT</option>
                    <option value="MS">MS</option>
                    <option value="MG">MG</option>
                    <option value="PA">PA</option>
                    <option value="PB">PB</option>
                    <option value="PR">PR</option>
                    <option value="PE">PE</option>
                    <option value="PI">PI</option>
                    <option value="RJ">RJ</option>
                    <option value="RN">RN</option>
                    <option value="RS">RS</option>
                    <option value="RO">RO</option>
                    <option value="RR">RR</option>
                    <option value="SC">SC</option>
                    <option value="SP">SP</option>
                    <option value="SE">SE</option>
                    <option value="TO">TO</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Plano <span className="text-destructive">*</span>
                </Label>
                <select
                  value={clinicData.planId}
                  onChange={(e) =>
                    setClinicData({
                      ...clinicData,
                      planId: e.target.value as "semestral" | "anual",
                    })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="semestral">Plano Semestral - R$ 59,90/mês</option>
                  <option value="anual">Plano Anual - R$ 49,90/mês</option>
                </select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Dados do Administrador */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados do Administrador
              </CardTitle>
              <CardDescription>
                Cadastre o administrador que terá acesso à clínica
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Nome Completo <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={adminData.name}
                  onChange={(e) =>
                    setAdminData({ ...adminData, name: e.target.value })
                  }
                  placeholder="Ex: João Silva"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    E-mail <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={adminData.email}
                    onChange={(e) =>
                      setAdminData({ ...adminData, email: e.target.value })
                    }
                    placeholder="joao@clinica.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={adminData.phone}
                    onChange={(e) =>
                      setAdminData({
                        ...adminData,
                        phone: formatPhoneInput(e.target.value),
                      })
                    }
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Senha Temporária <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="text"
                  value={adminData.password}
                  onChange={(e) =>
                    setAdminData({ ...adminData, password: e.target.value })
                  }
                  placeholder="Mínimo 6 caracteres"
                />
                <p className="text-xs text-muted-foreground">
                  Esta senha será enviada por e-mail. O usuário deverá alterá-la no
                  primeiro acesso.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: E-mail de Boas-Vindas */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                E-mail de Boas-Vindas
              </CardTitle>
              <CardDescription>
                Personalize o e-mail que será enviado ao administrador
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Assunto do E-mail</Label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Bem-vindo à Curva Mestra!"
                />
              </div>

              <div className="space-y-2">
                <Label>Corpo do E-mail</Label>
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                  placeholder="Digite o conteúdo do e-mail..."
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis disponíveis: <code>{"{{admin_name}}"}</code>,{" "}
                  <code>{"{{clinic_name}}"}</code>, <code>{"{{admin_email}}"}</code>,{" "}
                  <code>{"{{temp_password}}"}</code>
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => setShowPreview(true)}
                className="w-full"
              >
                <Eye className="mr-2 h-4 w-4" />
                Visualizar Preview
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => router.push("/admin/tenants")}
            disabled={loading}
          >
            Cancelar
          </Button>

          {currentStep < 3 ? (
            <Button onClick={handleNextStep} disabled={loading}>
              Próximo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              <Send className="mr-2 h-4 w-4" />
              {loading ? "Criando e Enviando..." : "Criar Clínica e Enviar E-mail"}
            </Button>
          )}
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview do E-mail</DialogTitle>
            <DialogDescription>
              Veja como o e-mail será enviado ao administrador
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Para:</Label>
              <p className="text-sm">{adminData.email || "[E-mail do Administrador]"}</p>
            </div>
            <div className="space-y-2">
              <Label>Assunto:</Label>
              <p className="text-sm font-semibold">{emailSubject}</p>
            </div>
            <div className="space-y-2">
              <Label>Mensagem:</Label>
              <div className="bg-muted p-4 rounded-md whitespace-pre-wrap text-sm">
                {getPreviewEmail()}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
