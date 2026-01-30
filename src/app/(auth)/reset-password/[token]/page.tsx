"use client";

import { useState, useEffect, use } from "react";
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
import {
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function ResetPasswordPage({ params }: PageProps) {
  const { token } = use(params);
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Estados de validação do token
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [emailMasked, setEmailMasked] = useState("");

  // Validar token ao carregar a página
  useEffect(() => {
    async function validateToken() {
      try {
        const response = await fetch(
          `/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`
        );
        const data = await response.json();

        if (data.valid) {
          setTokenValid(true);
          setEmailMasked(data.email_masked || "");
        } else {
          setTokenValid(false);
          setTokenError(data.error || "Token inválido");
        }
      } catch (err) {
        console.error("Erro ao validar token:", err);
        setTokenValid(false);
        setTokenError("Erro ao validar token. Tente novamente.");
      } finally {
        setValidating(false);
      }
    }

    validateToken();
  }, [token]);

  const validatePassword = (password: string): string | null => {
    if (password.length < 6) {
      return "A senha deve ter pelo menos 6 caracteres";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validar nova senha
      const passwordError = validatePassword(newPassword);
      if (passwordError) {
        setError(passwordError);
        setLoading(false);
        return;
      }

      // Verificar se as senhas coincidem
      if (newPassword !== confirmPassword) {
        setError("As senhas não coincidem");
        setLoading(false);
        return;
      }

      // Chamar API para redefinir a senha
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        // Redirecionar para login após 3 segundos
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      } else {
        setError(data.error || "Erro ao redefinir senha");
      }
    } catch (err: any) {
      console.error("Erro ao redefinir senha:", err);
      setError("Erro ao redefinir senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Estado de carregamento (validando token)
  if (validating) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">
            Validando Link...
          </CardTitle>
          <CardDescription className="text-center">
            Aguarde enquanto verificamos seu link de redefinição de senha.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Token inválido
  if (!tokenValid) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-destructive/10">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Link Inválido</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-destructive bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              {tokenError}
            </AlertDescription>
          </Alert>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Se você precisa redefinir sua senha, entre em contato com o administrador do sistema.</p>
          </div>
        </CardContent>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button variant="outline" className="w-full">
              Voltar ao Login
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // Sucesso na redefinição
  if (success) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-950/30">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">
            Senha Redefinida!
          </CardTitle>
          <CardDescription className="text-center">
            Sua senha foi alterada com sucesso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              Você será redirecionado para a página de login automaticamente...
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button className="w-full">Fazer Login Agora</Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // Formulário de nova senha
  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 rounded-full bg-primary/10">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Nova Senha</CardTitle>
        <CardDescription className="text-center">
          Defina uma nova senha para sua conta
          {emailMasked && (
            <span className="block mt-1 font-medium text-foreground">
              {emailMasked}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova Senha</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="Digite a nova senha"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Mínimo de 6 caracteres
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirme a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Definir Nova Senha"
            )}
          </Button>
        </form>

        <div className="mt-4 p-3 rounded-md bg-muted">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                Dicas para uma senha segura:
              </p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Use pelo menos 6 caracteres</li>
                <li>Combine letras, números e símbolos</li>
                <li>Evite senhas óbvias como &quot;123456&quot;</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <div className="text-sm text-center text-muted-foreground">
          <Link
            href="/login"
            className="text-primary hover:underline font-medium"
          >
            Voltar ao Login
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
