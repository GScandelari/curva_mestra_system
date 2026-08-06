'use client';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function WaitingApprovalPage() {
  const { signOut, user, claims, loading } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  // claims só é não-nulo quando o usuário já teve um role atribuído em algum
  // momento (aprovação anterior) -- se `loading` ainda não resolveu, evita
  // mostrar a mensagem errada durante a janela de carregamento do token.
  const isDeactivated = !loading && claims !== null;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">
          {isDeactivated ? 'Conta Desativada' : 'Conta Criada com Sucesso'}
        </CardTitle>
        <CardDescription className="text-center">
          {isDeactivated
            ? 'Acesso suspenso pelo administrador'
            : 'Aguardando aprovação do administrador'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Olá, <span className="font-medium">{user?.displayName}</span>!
          </p>
          <p className="text-sm text-muted-foreground">
            {isDeactivated
              ? 'Sua conta foi desativada por um administrador do sistema.'
              : 'Sua conta foi criada com sucesso. No entanto, você precisará aguardar que um administrador do sistema configure seu acesso e associe você a uma clínica.'}
          </p>
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Entre em contato com o administrador do sistema para solicitar a ativação da sua
              conta.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button variant="outline" onClick={handleSignOut}>
          Sair
        </Button>
      </CardFooter>
    </Card>
  );
}
