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
import { Clock, AlertTriangle } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signOut, isAuthenticated, loading: authLoading, claims } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const [clinicInactiveMessage, setClinicInactiveMessage] = useState(false);

  // Verificar se foi redirecionado por timeout
  useEffect(() => {
    if (searchParams.get("timeout") === "true") {
      setShowTimeoutMessage(true);
    }
  }, [searchParams]);

  // Redirecionar se já estiver autenticado
  useEffect(() => {
    if (!authLoading && isAuthenticated && claims) {
      // Verificar se precisa trocar a senha primeiro
      if (claims.requirePasswordChange) {
        router.push("/change-password");
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
    }
  }, [isAuthenticated, authLoading, claims, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn(email, password);

      if (result.success && result.user) {
        // Forçar refresh do token para obter custom claims atualizados
        await result.user.getIdToken(true);
        const idTokenResult = await result.user.getIdTokenResult();
        const claims = idTokenResult.claims;

        // Verificar se usuário tem custom claims configurados
        if (!claims.role || !claims.active) {
          router.push("/waiting-approval");
          return;
        }

        // Verificar se o usuário precisa trocar a senha (via custom claim)
        if (claims.requirePasswordChange === true) {
          router.push("/change-password");
          return;
        }

        // Verificar status da clínica para usuários não-admin
        if (!claims.is_system_admin && claims.tenant_id) {
          const tenantDoc = await getDoc(doc(db, "tenants", claims.tenant_id as string));
          if (tenantDoc.exists()) {
            const tenantData = tenantDoc.data();
            const isClinicActive = tenantData.active !== false;

            // Se a clínica está inativa
            if (!isClinicActive) {
              // clinic_user: mostrar mensagem e não permitir acesso
              if (claims.role === "clinic_user") {
                // Fazer logout para não manter sessão ativa
                await signOut();
                setClinicInactiveMessage(true);
                setLoading(false);
                return;
              }

              // clinic_admin: redirecionar para my-clinic (acesso restrito)
              if (claims.role === "clinic_admin") {
                router.push("/clinic/my-clinic");
                return;
              }
            }
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

  // Se a clínica está inativa e é clinic_user, mostrar mensagem
  if (clinicInactiveMessage) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-2">
            <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-950/30">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Sistema Indisponível</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              O sistema encontra-se indisponível no momento. Procure o administrador
              da clínica ou entre em contato com o suporte técnico Curva Mestra.
            </AlertDescription>
          </Alert>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Suporte técnico:</p>
            <a
              href="mailto:suporte@curvamestra.com.br"
              className="text-primary hover:underline font-medium"
            >
              suporte@curvamestra.com.br
            </a>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setClinicInactiveMessage(false);
              setEmail("");
              setPassword("");
            }}
          >
            Voltar ao login
          </Button>
        </CardFooter>
      </Card>
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
