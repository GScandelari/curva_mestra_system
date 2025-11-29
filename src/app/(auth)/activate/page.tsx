"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { activateAccountWithCode } from "@/lib/services/accessRequestService";

export default function ActivatePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    activationCode: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // Apenas números no código
    if (e.target.id === "activationCode") {
      value = value.replace(/\D/g, "").slice(0, 8);
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
    if (!formData.email || !formData.email.includes("@")) {
      setError("Email inválido");
      return;
    }

    if (formData.activationCode.length !== 8) {
      setError("Código deve ter 8 dígitos");
      return;
    }

    setLoading(true);

    try {
      // Validar código
      const validationResult = await activateAccountWithCode(
        formData.email,
        formData.activationCode
      );

      if (!validationResult.success) {
        setError(validationResult.message);
        setLoading(false);
        return;
      }

      // Criar usuário via API
      const createResponse = await fetch("/api/users/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: validationResult.requestData!.email,
          password: validationResult.requestData!.password,
          displayName: validationResult.requestData!.full_name,
          tenant_id: validationResult.requestData!.tenant_id,
        }),
      });

      const createData = await createResponse.json();

      if (createData.success) {
        setSuccess(
          "Conta ativada com sucesso! Redirecionando para o login..."
        );
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        setError(createData.message || "Erro ao criar conta");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao ativar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Ativar Conta
          </CardTitle>
          <CardDescription className="text-center">
            Digite o código de 8 dígitos enviado para seu email
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
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.email@exemplo.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading || !!success}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="activationCode">Código de Ativação *</Label>
              <Input
                id="activationCode"
                type="text"
                placeholder="12345678"
                value={formData.activationCode}
                onChange={handleChange}
                required
                disabled={loading || !!success}
                maxLength={8}
                className="text-center text-2xl font-mono tracking-wider"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground text-center">
                Digite os 8 dígitos enviados por email
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !!success}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ativando...
                </>
              ) : (
                "Ativar Conta"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-muted-foreground">
            Não recebeu o código?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Solicitar novamente
            </Link>
          </div>
          <div className="text-sm text-center text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              Voltar para login
            </Link>
          </div>
          <div className="text-xs text-center text-muted-foreground mt-4">
            O código expira em 24 horas após aprovação
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
