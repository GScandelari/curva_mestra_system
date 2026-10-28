'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { KeyRound, AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { validatePassword } from '@/lib/validations/serverValidations';

interface PageProps {
  params: Promise<{ token: string }>;
}

type Phase = 'validating' | 'invalid' | 'intro' | 'form' | 'success';
type Purpose = 'password_reset' | 'first_access';

interface StoredSession {
  session: string;
  expiresAt: string;
}

/**
 * A sessão do primeiro acesso fica só nesta aba (sessionStorage), para que
 * recarregar a página mantenha o formulário (DN-02). A chave usa o hash do
 * token, nunca o token em si.
 */
async function sessionStorageKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `cm_first_access_session:${hex}`;
}

async function readStoredSession(token: string): Promise<StoredSession | null> {
  try {
    const raw = sessionStorage.getItem(await sessionStorageKey(token));
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredSession;
    return new Date(stored.expiresAt) > new Date() ? stored : null;
  } catch {
    return null;
  }
}

async function writeStoredSession(token: string, value: StoredSession | null): Promise<void> {
  try {
    const key = await sessionStorageKey(token);
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch {
    // Sem sessionStorage (aba privada/bloqueada): o formulário segue
    // funcionando enquanto a página não for recarregada.
  }
}

export default function ResetPasswordPage({ params }: PageProps) {
  const { token } = use(params);
  const router = useRouter();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [phase, setPhase] = useState<Phase>('validating');
  const [purpose, setPurpose] = useState<Purpose>('password_reset');
  const [tokenError, setTokenError] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [session, setSession] = useState<string | null>(null);

  // Validar token ao carregar a página (não altera o token)
  useEffect(() => {
    async function validateToken() {
      try {
        const response = await fetch(
          `/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`
        );
        const data = await response.json();
        const tokenPurpose: Purpose =
          data.purpose === 'first_access' ? 'first_access' : 'password_reset';
        setPurpose(tokenPurpose);

        if (data.valid) {
          setEmailMasked(data.email_masked || '');
          setPhase(tokenPurpose === 'first_access' ? 'intro' : 'form');
          return;
        }

        // Primeiro acesso já aberto nesta aba: segue no formulário.
        if (data.reason === 'opened') {
          const stored = await readStoredSession(token);
          if (stored) {
            setSession(stored.session);
            setPhase('form');
            return;
          }
        }

        setTokenError(data.error || 'Link inválido ou expirado.');
        setPhase('invalid');
      } catch (err) {
        console.error('Erro ao validar token:', err);
        setTokenError('Erro ao validar o link. Tente novamente.');
        setPhase('invalid');
      }
    }

    void validateToken();
  }, [token]);

  const handleOpen = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/password-token/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();

      if (!data.success) {
        if (data.reason) {
          setTokenError(data.error || 'Link inválido ou expirado.');
          setPhase('invalid');
        } else {
          setError(data.error || 'Erro ao processar o link. Tente novamente.');
        }
        return;
      }

      await writeStoredSession(token, {
        session: data.session,
        expiresAt: data.session_expires_at,
      });
      setSession(data.session);
      if (data.email_masked) setEmailMasked(data.email_masked);
      setPhase('form');
    } catch (err) {
      console.error('Erro ao abrir link de primeiro acesso:', err);
      setError('Erro ao processar o link. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validar nova senha
      const passwordValidation = validatePassword(newPassword, { minLength: 6 });
      if (!passwordValidation.valid) {
        setError(passwordValidation.error!);
        setLoading(false);
        return;
      }

      // Verificar se as senhas coincidem
      if (newPassword !== confirmPassword) {
        setError('As senhas não coincidem');
        setLoading(false);
        return;
      }

      // Chamar API para redefinir a senha
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          new_password: newPassword,
          ...(session && { session }),
        }),
      });

      const data = await response.json();

      if (data.success) {
        await writeStoredSession(token, null);
        setPhase('success');
        // Redirecionar para login após 3 segundos
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else if (data.reason) {
        // Link usado, vencido ou sessão encerrada: não adianta tentar de novo.
        await writeStoredSession(token, null);
        setTokenError(data.error || 'Link inválido ou expirado.');
        setPhase('invalid');
      } else {
        setError(data.error || 'Erro ao redefinir senha');
      }
    } catch (err: any) {
      console.error('Erro ao redefinir senha:', err);
      setError('Erro ao redefinir senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const isFirstAccess = purpose === 'first_access';

  // Estado de carregamento (validando token)
  if (phase === 'validating') {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Validando Link...</CardTitle>
          <CardDescription className="text-center">
            Aguarde enquanto verificamos seu link.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Token inválido
  if (phase === 'invalid') {
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
            <AlertDescription className="text-destructive">{tokenError}</AlertDescription>
          </Alert>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Solicite um novo link informando o seu e-mail de acesso.</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Link href="/forgot-password" className={buttonVariants({ className: 'w-full' })}>
            Solicitar nova senha
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: 'outline', className: 'w-full' })}
          >
            Voltar ao Login
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // Sucesso na redefinição
  if (phase === 'success') {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-950/30">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">
            {isFirstAccess ? 'Senha Definida!' : 'Senha Redefinida!'}
          </CardTitle>
          <CardDescription className="text-center">
            {isFirstAccess
              ? 'Sua senha foi criada com sucesso.'
              : 'Sua senha foi alterada com sucesso.'}
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
          <Link href="/login" className={buttonVariants({ className: 'w-full' })}>
            Fazer Login Agora
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // Primeiro acesso: o link só é marcado como usado neste clique (DN-02),
  // para que pré-visualizações do e-mail não o consumam.
  if (phase === 'intro') {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Primeiro Acesso</CardTitle>
          <CardDescription className="text-center">
            Crie a senha da sua conta
            {emailMasked && (
              <span className="block mt-1 font-medium text-foreground">{emailMasked}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Este link é de uso único. Depois de continuar, você terá 30 minutos para definir a
              senha nesta aba. Se não concluir, basta solicitar uma nova senha.
            </AlertDescription>
          </Alert>
          {error && (
            <div role="alert" className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button className="w-full" onClick={() => void handleOpen()} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Abrindo...
              </>
            ) : (
              'Definir minha senha'
            )}
          </Button>
          <div className="text-sm text-center text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline font-medium">
              Voltar ao Login
            </Link>
          </div>
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
        <CardTitle className="text-2xl text-center">
          {isFirstAccess ? 'Defina sua Senha' : 'Nova Senha'}
        </CardTitle>
        <CardDescription className="text-center">
          {isFirstAccess ? 'Crie a senha da sua conta' : 'Defina uma nova senha para sua conta'}
          {emailMasked && (
            <span className="block mt-1 font-medium text-foreground">{emailMasked}</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova Senha</Label>
            <PasswordInput
              id="newPassword"
              placeholder="Digite a nova senha"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <PasswordInput
              id="confirmPassword"
              placeholder="Confirme a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div role="alert" className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : isFirstAccess ? (
              'Salvar Senha'
            ) : (
              'Definir Nova Senha'
            )}
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
                <li>Evite senhas óbvias como &quot;123456&quot;</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <div className="text-sm text-center text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline font-medium">
            Voltar ao Login
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
