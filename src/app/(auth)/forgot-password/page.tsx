"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
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
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      setSuccess(true);
    } catch (err: any) {
      const errorMessage = translateFirebaseError(err.code);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const translateFirebaseError = (errorCode: string): string => {
    switch (errorCode) {
      case "auth/user-not-found":
        return "Usuário não encontrado";
      case "auth/invalid-email":
        return "Email inválido";
      case "auth/too-many-requests":
        return "Muitas tentativas. Tente novamente mais tarde";
      case "auth/network-request-failed":
        return "Erro de conexão. Verifique sua internet";
      default:
        return "Erro ao enviar email. Tente novamente";
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">
          Recuperar Senha
        </CardTitle>
        <CardDescription className="text-center">
          Digite seu email para receber o link de recuperação
        </CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-green-100 dark:bg-green-900 p-3">
                <Mail className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">Email enviado com sucesso!</p>
              <p className="text-sm text-muted-foreground">
                Verifique sua caixa de entrada e siga as instruções para
                redefinir sua senha.
              </p>
              <p className="text-xs text-muted-foreground mt-4">
                Não se esqueça de verificar a pasta de spam.
              </p>
            </div>
          </div>
        ) : (
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
                autoFocus
              />
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter>
        <Link
          href="/login"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mx-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para login
        </Link>
      </CardFooter>
    </Card>
  );
}
