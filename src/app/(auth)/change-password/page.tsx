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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, claims } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Verificar se está autenticado
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

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

      // Verificar se a nova senha é diferente da atual
      if (currentPassword === newPassword) {
        setError("A nova senha deve ser diferente da senha atual");
        setLoading(false);
        return;
      }

      if (!user || !user.email) {
        setError("Usuário não encontrado");
        setLoading(false);
        return;
      }

      // Reautenticar o usuário com a senha atual
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Atualizar a senha
      await updatePassword(user, newPassword);

      // Chamar API para remover a flag de troca obrigatória (custom claim + Firestore)
      const token = await user.getIdToken();
      const response = await fetch("/api/users/clear-password-change-flag", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("Erro ao limpar flag de troca de senha");
      }

      // Redirecionar para o dashboard apropriado
      if (claims?.is_system_admin) {
        router.push("/admin/dashboard");
      } else if (claims?.role === "clinic_admin" || claims?.role === "clinic_user") {
        router.push("/clinic/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      console.error("Erro ao trocar senha:", err);

      // Traduzir erros do Firebase
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Senha atual incorreta");
      } else if (err.code === "auth/weak-password") {
        setError("A nova senha é muito fraca. Use pelo menos 6 caracteres");
      } else if (err.code === "auth/requires-recent-login") {
        setError("Por segurança, faça login novamente antes de trocar a senha");
        router.push("/login");
      } else {
        setError("Erro ao trocar senha. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto mt-10">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 rounded-full bg-primary/10">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Trocar Senha</CardTitle>
        <CardDescription className="text-center">
          Você está usando uma senha temporária. Por segurança, defina uma nova senha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Você precisa definir uma nova senha para continuar usando o sistema.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Senha Atual (Temporária)</Label>
            <Input
              id="currentPassword"
              type="password"
              placeholder="Digite a senha temporária"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

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
            />
            <p className="text-xs text-muted-foreground">
              Mínimo de 6 caracteres
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
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
            {loading ? "Salvando..." : "Definir Nova Senha"}
          </Button>
        </form>

        <div className="mt-4 p-3 rounded-md bg-muted">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Dicas para uma senha segura:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Use pelo menos 6 caracteres</li>
                <li>Combine letras, números e símbolos</li>
                <li>Evite senhas óbvias como "123456"</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
