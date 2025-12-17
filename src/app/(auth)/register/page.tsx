"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { DocumentType } from "@/types";
import { validateDocument, maskDocument } from "@/lib/utils/documentValidation";

export default function RegisterPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [documentType, setDocumentType] = useState<DocumentType>("cnpj");
  const [formData, setFormData] = useState({
    document: "",
    fullName: "",
    email: "",
    phone: "",
    businessName: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirecionar se já estiver autenticado
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, authLoading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // Formatar documento (CPF ou CNPJ) automaticamente
    if (e.target.id === "document") {
      value = maskDocument(value, documentType);
    }

    // Formatar telefone
    if (e.target.id === "phone") {
      const cleaned = value.replace(/\D/g, "");
      if (cleaned.length <= 11) {
        value = cleaned
          .replace(/(\d{2})(\d)/, "($1) $2")
          .replace(/(\d{5})(\d)/, "$1-$2");
      }
    }

    setFormData({
      ...formData,
      [e.target.id]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validações
    if (!validateDocument(formData.document)) {
      setError(`${documentType === "cpf" ? "CPF" : "CNPJ"} inválido. Verifique os dígitos verificadores.`);
      return;
    }

    if (!formData.fullName || formData.fullName.trim().length < 3) {
      setError("Nome completo inválido");
      return;
    }

    if (!formData.email || !formData.email.includes("@")) {
      setError("Email inválido");
      return;
    }

    if (!formData.phone || formData.phone.replace(/\D/g, "").length < 10) {
      setError("Telefone inválido");
      return;
    }

    if (!formData.businessName || formData.businessName.trim().length < 3) {
      setError(documentType === "cnpj" ? "Nome da clínica é obrigatório" : "Nome profissional é obrigatório");
      return;
    }

    if (formData.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setLoading(true);

    try {
      // Chamar nova API
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: documentType === "cnpj" ? "clinica" : "autonomo",
          full_name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          business_name: formData.businessName,
          document_type: documentType,
          document_number: formData.document,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || "Solicitação enviada com sucesso! Nossa equipe irá analisar em breve.");
        // Limpar formulário
        setFormData({
          document: "",
          fullName: "",
          email: "",
          phone: "",
          businessName: "",
          password: "",
          confirmPassword: "",
        });

        // Redirecionar após 3 segundos
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      } else {
        setError(data.error || "Erro ao enviar solicitação");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao enviar solicitação");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Solicitar Acesso
          </CardTitle>
          <CardDescription className="text-center">
            Preencha os dados abaixo para solicitar acesso ao sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 border-green-600 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Conta *</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-md hover:bg-accent">
                  <input
                    type="radio"
                    value="cnpj"
                    checked={documentType === "cnpj"}
                    onChange={(e) => {
                      setDocumentType(e.target.value as DocumentType);
                      setFormData({ ...formData, document: "" });
                    }}
                    disabled={loading || !!success}
                    className="h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Clínica / Empresa</div>
                    <div className="text-xs text-muted-foreground">CNPJ - até 5 usuários</div>
                  </div>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-md hover:bg-accent">
                  <input
                    type="radio"
                    value="cpf"
                    checked={documentType === "cpf"}
                    onChange={(e) => {
                      setDocumentType(e.target.value as DocumentType);
                      setFormData({ ...formData, document: "" });
                    }}
                    disabled={loading || !!success}
                    className="h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Profissional Autônomo</div>
                    <div className="text-xs text-muted-foreground">CPF - apenas 1 usuário (você)</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="document">{documentType === "cpf" ? "CPF" : "CNPJ"} *</Label>
              <Input
                id="document"
                type="text"
                placeholder={documentType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                value={formData.document}
                onChange={handleChange}
                autoComplete="off"
                maxLength={18}
                required
                disabled={loading || !!success}
              />
              <p className="text-xs text-muted-foreground">
                {documentType === "cpf"
                  ? "Digite seu CPF para criar uma conta individual"
                  : "Digite o CNPJ da clínica à qual deseja se vincular ou criar"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo *</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Seu nome completo"
                value={formData.fullName}
                onChange={handleChange}
                autoComplete="name"
                required
                disabled={loading || !!success}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.email@exemplo.com"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                required
                disabled={loading || !!success}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(00) 00000-0000"
                value={formData.phone}
                onChange={handleChange}
                autoComplete="tel"
                maxLength={15}
                required
                disabled={loading || !!success}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName">
                {documentType === "cnpj" ? "Nome da Clínica *" : "Nome Profissional *"}
              </Label>
              <Input
                id="businessName"
                type="text"
                placeholder={
                  documentType === "cnpj"
                    ? "Nome da sua clínica"
                    : "Como você quer ser conhecido"
                }
                value={formData.businessName}
                onChange={handleChange}
                required
                disabled={loading || !!success}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                required
                disabled={loading || !!success}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Digite a senha novamente"
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                required
                disabled={loading || !!success}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !!success}
            >
              {loading ? "Enviando..." : "Solicitar Acesso"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-muted-foreground">
            Já tem uma conta?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Fazer login
            </Link>
          </div>
          <div className="text-xs text-center text-muted-foreground">
            Após enviar, aguarde a aprovação do administrador. <br />
            Você receberá as credenciais de acesso por email.
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
