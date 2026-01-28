"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Clock } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, isAuthenticated, loading: authLoading, claims } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);

  // Verificar se foi redirecionado por timeout
  useEffect(() => {
    if (searchParams.get("timeout") === "true") {
      setShowTimeoutMessage(true);
    }
  }, [searchParams]);

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

        // Verificar se o usuário precisa trocar a senha
        const userDoc = await getDoc(doc(db, "users", result.user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.requirePasswordChange === true) {
            router.push("/change-password");
            return;
          }
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
        {showTimeoutMessage && (
          <Alert className="mb-4">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Sua sessão expirou por inatividade. Por favor, faça login novamente.
            </AlertDescription>
          </Alert>
        )}
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    }>
      <LoginForm />
    </Suspense>
  );
}
