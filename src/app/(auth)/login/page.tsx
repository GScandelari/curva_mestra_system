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

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isAuthenticated, loading: authLoading, claims } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirecionar se já estiver autenticado
  useEffect(() => {
    if (!authLoading && isAuthenticated && claims) {
      // Redirecionar baseado no role
      if (claims.is_system_admin) {
        router.push("/admin/dashboard");
      } else if (claims.role === "clinic_admin" || claims.role === "clinic_user") {
        router.push("/clinic/dashboard");
      } else {
        router.push("/dashboard");
      }
    }
  }, [isAuthenticated, authLoading, claims, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn(email, password);

      if (result.success && result.user) {
        // Obter claims do usuário para redirecionar corretamente
        const idTokenResult = await result.user.getIdTokenResult();
        const claims = idTokenResult.claims;

        // Verificar se usuário tem custom claims configurados
        if (!claims.role || !claims.active) {
          router.push("/waiting-approval");
          return;
        }

        // Redirecionar baseado no role
        if (claims.is_system_admin) {
          router.push("/admin/dashboard");
        } else if (claims.role === "clinic_admin" || claims.role === "clinic_user") {
          router.push("/clinic/dashboard");
        } else {
          router.push("/dashboard");
        }
      } else {
        // Traduzir erros comuns do Firebase
        const errorMessage = translateFirebaseError(result.error || "");
        setError(errorMessage);
      }
    } catch (err: any) {
      const errorMessage = translateFirebaseError(err.message);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Traduzir erros do Firebase para português
  const translateFirebaseError = (error: string): string => {
    if (error.includes("wrong-password") || error.includes("invalid-credential")) {
      return "Email ou senha incorretos";
    }
    if (error.includes("user-not-found")) {
      return "Usuário não encontrado";
    }
    if (error.includes("too-many-requests")) {
      return "Muitas tentativas. Tente novamente mais tarde";
    }
    if (error.includes("network-request-failed")) {
      return "Erro de conexão. Verifique sua internet";
    }
    if (error.includes("invalid-email")) {
      return "Email inválido";
    }
    return error || "Erro ao fazer login. Tente novamente";
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Curva Mestra</CardTitle>
        <CardDescription className="text-center">
          Entre com suas credenciais para acessar o sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <div className="text-sm text-center text-muted-foreground">
          <Link
            href="/forgot-password"
            className="text-primary hover:underline font-medium"
          >
            Esqueceu a senha?
          </Link>
        </div>
        <div className="text-sm text-center text-muted-foreground">
          Não tem uma conta?{" "}
          <Link
            href="/register"
            className="text-primary hover:underline font-medium"
          >
            Registrar-se
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
