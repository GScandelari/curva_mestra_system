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
import { createAccessRequest } from "@/lib/services/accessRequestService";
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
      const result = await createAccessRequest({
        document: formData.document,
        document_type: documentType,
        full_name: formData.fullName,
        email: formData.email,
        password: formData.password,
      });

      if (result.success) {
        setSuccess(result.message);
        // Limpar formulário
        setFormData({
          document: "",
          fullName: "",
          email: "",
          password: "",
          confirmPassword: "",
        });

        // Redirecionar após 3 segundos
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      } else {
        setError(result.message);
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
            Você receberá um código de ativação por email.
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
