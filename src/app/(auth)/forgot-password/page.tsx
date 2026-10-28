'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Alinha com o padrão de /login e /register -- usuário já autenticado
  // não deveria acessar esta tela para solicitar redefinição de senha de
  // qualquer e-mail, inclusive um diferente do seu.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      // A API responde igual exista ou não a conta (anti-enumeração).
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setSuccess(true);
        return;
      }

      const data = await response.json().catch(() => ({}));
      setError(
        response.status === 429
          ? 'Muitas solicitações. Aguarde alguns minutos e tente novamente.'
          : data.error || 'Erro ao enviar email. Tente novamente'
      );
    } catch {
      setError('Erro de conexão. Verifique sua internet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Recuperar Senha</CardTitle>
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
              <p className="text-sm font-medium">Solicitação recebida!</p>
              <p className="text-sm text-muted-foreground">
                Se houver uma conta com este e-mail, você receberá um link para redefinir a senha. O
                link é válido por 30 minutos.
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
              <div
                role="alert"
                className="text-sm text-destructive bg-destructive/10 p-3 rounded-md"
              >
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link de recuperação'}
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
